// loadgen-gateway is the single public entry point for the live load demo. Browsers open one
// WebSocket to it and, while a burst runs, stream batches of dummy transactions up; the gateway
// rate-limits them (per-connection and a hard global cap), publishes them to NATS JetStream, and
// once per second streams a system-wide metrics snapshot back down every socket. Because there is
// exactly one gateway, "offered" load is inherently the sum across all tabs/users.
//
// Metrics sources: offered load is counted in-process; backlog comes straight from the JetStream
// consumer. Processed TPS and worker replica count come from Prometheus when PROM_URL is set
// (in-cluster), and fall back to NATS-derived signals otherwise (local dev), so the whole demo
// runs against just NATS with docker-compose.
package main

import (
	"context"
	"encoding/json"
	"io"
	"log"
	"math"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"syscall"
	"time"

	"github.com/coder/websocket"
	"github.com/nats-io/nats.go"
	"github.com/nats-io/nats.go/jetstream"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

var (
	receivedTotal = promauto.NewCounter(prometheus.CounterOpts{
		Name: "loadgen_received_total",
		Help: "Total dummy transactions accepted (post rate-limit) and published to NATS.",
	})
	activeConns = promauto.NewGauge(prometheus.GaugeOpts{
		Name: "loadgen_active_connections",
		Help: "Current number of connected load-generating clients.",
	})
)

var txPayload = []byte("tx")

func env(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}

func envInt(k string, def int) int {
	if v := os.Getenv(k); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return def
}

// tokenBucket is a simple rate limiter: up to `rate` tokens accrue per second, capped at one
// second's worth, and take(n) returns however many of n are currently affordable.
type tokenBucket struct {
	mu       sync.Mutex
	rate     float64
	capacity float64
	tokens   float64
	last     time.Time
}

func newBucket(rate float64) *tokenBucket {
	return &tokenBucket{rate: rate, capacity: rate, tokens: rate, last: time.Now()}
}

func (b *tokenBucket) take(n int) int {
	if n <= 0 {
		return 0
	}
	b.mu.Lock()
	defer b.mu.Unlock()
	now := time.Now()
	b.tokens = math.Min(b.capacity, b.tokens+now.Sub(b.last).Seconds()*b.rate)
	b.last = now
	want := float64(n)
	if want > b.tokens {
		want = math.Floor(b.tokens)
	}
	if want < 1 {
		return 0
	}
	b.tokens -= want
	return int(want)
}

type client struct {
	send      chan []byte
	done      chan struct{}
	closeOnce sync.Once
	bucket    *tokenBucket
	lastLimit atomic.Int64 // unix nanos of last {t:"limit"} sent, to throttle it
}

func (c *client) close() { c.closeOnce.Do(func() { close(c.done) }) }

// trySend never blocks and never touches a closed channel — the writer goroutine drains send
// until done fires, and broadcasts are best-effort (a slow client just misses a snapshot).
func (c *client) trySend(msg []byte) {
	select {
	case c.send <- msg:
	case <-c.done:
	default:
	}
}

type app struct {
	js       jetstream.JetStream
	cons     jetstream.Consumer
	subject  string
	publishC chan []byte

	global   *tokenBucket
	connRate float64
	maxBatch int
	globalTP int

	mu      sync.RWMutex
	clients map[*client]struct{}

	offered atomic.Int64 // transactions accepted since the last snapshot tick

	prom      *promClient
	processed *rateFromSeq // NATS fallback for processed TPS
	workers   *workerSet   // NATS fallback for replica count

	originPatterns []string
	limitMsg       []byte
}

func main() {
	var (
		listenAddr = env("LISTEN_ADDR", ":8080")
		natsURL    = env("NATS_URL", "nats://nats.nats.svc.cluster.local:4222")
		streamName = env("STREAM", "TRANSACTIONS")
		subject    = env("SUBJECT", "transactions")
		consumer   = env("CONSUMER", "txworker")
		hbSubject  = env("HEARTBEAT_SUBJECT", "demo.workers.heartbeat")
		promURL    = env("PROM_URL", "http://kube-prometheus-stack-prometheus.observability.svc.cluster.local:9090")
		workerNS   = env("WORKER_NAMESPACE", "infra-dev")
		workerDep  = env("WORKER_DEPLOYMENT", "load-demo-worker")
		globalTP   = envInt("MAX_TPS_GLOBAL", 500)
		connTP     = envInt("MAX_TPS_CONN", 200)
		maxBatch   = envInt("MAX_BATCH", 1000)
		publishers = envInt("PUBLISHERS", 16)
		origins    = env("ALLOWED_ORIGINS", "") // comma list; empty => same-origin only
	)

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	nc, err := nats.Connect(natsURL,
		nats.Name("load-demo-gateway"),
		nats.MaxReconnects(-1),
		nats.ReconnectWait(time.Second),
	)
	if err != nil {
		log.Fatalf("nats connect: %v", err)
	}
	defer nc.Drain()

	js, err := jetstream.New(nc, jetstream.WithPublishAsyncMaxPending(4096))
	if err != nil {
		log.Fatalf("jetstream: %v", err)
	}

	stream, err := js.CreateOrUpdateStream(ctx, jetstream.StreamConfig{
		Name:      streamName,
		Subjects:  []string{subject},
		Retention: jetstream.WorkQueuePolicy,
		Storage:   jetstream.MemoryStorage,
		MaxAge:    5 * time.Minute,
	})
	if err != nil {
		log.Fatalf("stream: %v", err)
	}
	// Create the durable consumer up front so KEDA can read its backlog even before any worker
	// has started; workers bind to this same durable.
	cons, err := stream.CreateOrUpdateConsumer(ctx, jetstream.ConsumerConfig{
		Durable:       consumer,
		AckPolicy:     jetstream.AckExplicitPolicy,
		AckWait:       30 * time.Second,
		MaxAckPending: 2048,
	})
	if err != nil {
		log.Fatalf("consumer: %v", err)
	}

	a := &app{
		js:        js,
		cons:      cons,
		subject:   subject,
		publishC:  make(chan []byte, 4096),
		global:    newBucket(float64(globalTP)),
		connRate:  float64(connTP),
		maxBatch:  maxBatch,
		globalTP:  globalTP,
		clients:   make(map[*client]struct{}),
		processed: &rateFromSeq{},
		workers:   newWorkerSet(3 * time.Second),
		limitMsg:  []byte(`{"t":"limit"}`),
	}
	if promURL != "" {
		a.prom = &promClient{base: strings.TrimRight(promURL, "/"), http: &http.Client{Timeout: 3 * time.Second},
			replicasQuery: `kube_deployment_status_replicas_available{namespace="` + workerNS + `",deployment="` + workerDep + `"}`}
	}

	// Worker heartbeats feed the NATS fallback for replica count.
	if _, err := nc.Subscribe(hbSubject, func(m *nats.Msg) {
		var hb struct {
			ID string `json:"id"`
		}
		if json.Unmarshal(m.Data, &hb) == nil && hb.ID != "" {
			a.workers.seen(hb.ID)
		}
	}); err != nil {
		log.Fatalf("heartbeat sub: %v", err)
	}

	for i := 0; i < publishers; i++ {
		go a.publishLoop(ctx)
	}
	go a.snapshotLoop(ctx)

	mux := http.NewServeMux()
	mux.HandleFunc("/loadgen", a.serveWS)
	mux.HandleFunc("/loadgen/ws", a.serveWS)
	mux.Handle("/metrics", promhttp.Handler())
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusOK) })

	a.originPatterns = splitCSV(origins)

	srv := &http.Server{Addr: listenAddr, Handler: mux}
	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("http server: %v", err)
		}
	}()
	log.Printf("loadgen-gateway on %s (global=%d/s conn=%d/s prom=%t)", listenAddr, globalTP, connTP, promURL != "")

	<-ctx.Done()
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_ = srv.Shutdown(shutdownCtx)
}

func (a *app) publishLoop(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		case payload := <-a.publishC:
			if _, err := a.js.Publish(ctx, a.subject, payload); err != nil && ctx.Err() == nil {
				// Transient publish errors are expected under heavy load; drop and move on.
			}
		}
	}
}

// emit accepts up to n transactions from a client, subject to the per-connection and global
// caps, and enqueues the accepted ones for publishing. Anything shed (by cap or a full publish
// buffer) triggers a throttled {t:"limit"} back to that client.
func (a *app) emit(c *client, n int) {
	if n <= 0 {
		return
	}
	if n > a.maxBatch {
		n = a.maxBatch
	}
	allowed := a.global.take(c.bucket.take(n))
	enqueued := 0
	full := false
	for i := 0; i < allowed && !full; i++ {
		select {
		case a.publishC <- txPayload:
			enqueued++
		default:
			full = true // publish buffer saturated: shed the rest as backpressure
		}
	}
	if enqueued > 0 {
		receivedTotal.Add(float64(enqueued))
		a.offered.Add(int64(enqueued))
	}
	if enqueued < n {
		a.notifyLimit(c)
	}
}

func (a *app) notifyLimit(c *client) {
	now := time.Now().UnixNano()
	last := c.lastLimit.Load()
	if now-last < int64(time.Second) {
		return
	}
	if c.lastLimit.CompareAndSwap(last, now) {
		c.trySend(a.limitMsg)
	}
}

func (a *app) add(c *client) {
	a.mu.Lock()
	a.clients[c] = struct{}{}
	n := len(a.clients)
	a.mu.Unlock()
	activeConns.Set(float64(n))
}

func (a *app) remove(c *client) {
	a.mu.Lock()
	delete(a.clients, c)
	n := len(a.clients)
	a.mu.Unlock()
	activeConns.Set(float64(n))
}

func (a *app) broadcast(msg []byte) {
	a.mu.RLock()
	for c := range a.clients {
		c.trySend(msg)
	}
	a.mu.RUnlock()
}

func (a *app) snapshotLoop(ctx context.Context) {
	t := time.NewTicker(time.Second)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			a.broadcast(a.snapshot(ctx))
		}
	}
}

func (a *app) snapshot(ctx context.Context) []byte {
	offered := a.offered.Swap(0) // count since last tick == per-second rate (1s interval)

	var backlog uint64
	var processedSeq uint64
	if info, err := a.cons.Info(ctx); err == nil {
		backlog = info.NumPending
		processedSeq = info.AckFloor.Consumer
	}

	// Processed TPS is the consumer ack-floor delta each tick: a genuine ~1s-resolution, system-wide
	// rate straight from NATS. Prometheus' rate() only refreshes per scrape (so it steps every few
	// seconds), which is why it's not used here.
	processedTps := a.processed.rate(processedSeq)

	// Replica count comes from near-real-time NATS worker heartbeats (updated within ~1s of a pod
	// starting/stopping). Prometheus' kube_deployment_status_replicas_available lags KEDA by the
	// kube-state-metrics scrape interval, so it's only a cold-start fallback before any heartbeat.
	replicas := float64(a.workers.count())
	if replicas <= 0 && a.prom != nil {
		if v, ok := a.prom.query(ctx, a.prom.replicasQuery); ok {
			replicas = v
		}
	}

	snap := map[string]any{
		"t":            "metrics",
		"offeredTps":   offered,
		"processedTps": math.Round(processedTps),
		"backlog":      backlog,
		"replicas":     int(math.Round(replicas)),
		"cap":          a.globalTP,
	}
	b, _ := json.Marshal(snap)
	return b
}

func (a *app) serveWS(w http.ResponseWriter, r *http.Request) {
	c, err := websocket.Accept(w, r, &websocket.AcceptOptions{OriginPatterns: a.originPatterns})
	if err != nil {
		return
	}
	cl := &client{
		send:   make(chan []byte, 8),
		done:   make(chan struct{}),
		bucket: newBucket(a.connRate),
	}
	a.add(cl)
	defer a.remove(cl)
	defer c.CloseNow()

	// Writer goroutine: the only place we write to the socket, so writes never race.
	go func() {
		for {
			select {
			case <-cl.done:
				return
			case msg := <-cl.send:
				wctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
				err := c.Write(wctx, websocket.MessageText, msg)
				cancel()
				if err != nil {
					cl.close()
					return
				}
			}
		}
	}()

	ctx := r.Context()
	for {
		typ, data, err := c.Read(ctx)
		if err != nil {
			break
		}
		if typ != websocket.MessageText {
			continue
		}
		var m struct {
			T string `json:"t"`
			N int    `json:"n"`
		}
		if json.Unmarshal(data, &m) != nil {
			continue
		}
		if m.T == "load" {
			a.emit(cl, m.N)
		}
	}
	cl.close()
}

// --- helpers ---

func splitCSV(s string) []string {
	if strings.TrimSpace(s) == "" {
		return nil
	}
	parts := strings.Split(s, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if p = strings.TrimSpace(p); p != "" {
			out = append(out, p)
		}
	}
	return out
}

// promClient does point-in-time Prometheus instant queries and returns the first sample value.
type promClient struct {
	base          string
	http          *http.Client
	replicasQuery string
}

func (p *promClient) query(ctx context.Context, expr string) (float64, bool) {
	u := p.base + "/api/v1/query?query=" + url.QueryEscape(expr)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return 0, false
	}
	resp, err := p.http.Do(req)
	if err != nil {
		return 0, false
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return 0, false
	}
	var pr struct {
		Status string `json:"status"`
		Data   struct {
			Result []struct {
				Value [2]json.RawMessage `json:"value"`
			} `json:"result"`
		} `json:"data"`
	}
	if json.Unmarshal(body, &pr) != nil || pr.Status != "success" || len(pr.Data.Result) == 0 {
		return 0, false
	}
	var s string
	if json.Unmarshal(pr.Data.Result[0].Value[1], &s) != nil {
		return 0, false
	}
	v, err := strconv.ParseFloat(s, 64)
	if err != nil {
		return 0, false
	}
	return v, true
}

// rateFromSeq turns a monotonically increasing sequence (the consumer ack floor) into a per-second
// rate by diffing successive samples. Used only as the no-Prometheus fallback for processed TPS.
type rateFromSeq struct {
	mu   sync.Mutex
	last uint64
	at   time.Time
}

func (r *rateFromSeq) rate(seq uint64) float64 {
	r.mu.Lock()
	defer r.mu.Unlock()
	now := time.Now()
	if r.at.IsZero() || seq < r.last {
		r.last, r.at = seq, now
		return 0
	}
	dt := now.Sub(r.at).Seconds()
	if dt <= 0 {
		return 0
	}
	rate := float64(seq-r.last) / dt
	r.last, r.at = seq, now
	return rate
}

// workerSet counts distinct worker ids seen recently (from NATS heartbeats). No-Prometheus
// fallback for replica count.
type workerSet struct {
	mu   sync.Mutex
	ttl  time.Duration
	seenAt map[string]time.Time
}

func newWorkerSet(ttl time.Duration) *workerSet {
	return &workerSet{ttl: ttl, seenAt: make(map[string]time.Time)}
}

func (s *workerSet) seen(id string) {
	s.mu.Lock()
	s.seenAt[id] = time.Now()
	s.mu.Unlock()
}

func (s *workerSet) count() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	cutoff := time.Now().Add(-s.ttl)
	n := 0
	for id, at := range s.seenAt {
		if at.Before(cutoff) {
			delete(s.seenAt, id)
			continue
		}
		n++
	}
	return n
}
