// tx-worker consumes dummy transactions from a NATS JetStream WorkQueue stream and does a
// tunable amount of real CPU work per message. It is the workload KEDA scales on backlog: each
// pod processes messages single-threaded (one Fetch loop), so throughput scales ~linearly with
// replica count, and a burst of load that outpaces the current pods grows the backlog until
// KEDA adds more. Exposes transactions_processed_total for Prometheus and a lightweight NATS
// heartbeat so the gateway can count live workers without Prometheus (local dev / fallback).
package main

import (
	"context"
	"crypto/sha256"
	"encoding/binary"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"sync/atomic"
	"syscall"
	"time"

	"github.com/nats-io/nats.go"
	"github.com/nats-io/nats.go/jetstream"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

var (
	processed = promauto.NewCounter(prometheus.CounterOpts{
		Name: "transactions_processed_total",
		Help: "Total dummy transactions processed by this worker.",
	})
	processedCount atomic.Uint64 // mirrors the counter for the heartbeat payload
	sink           atomic.Uint64 // keeps the CPU spin from being optimised away
)

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

func main() {
	var (
		natsURL     = env("NATS_URL", "nats://nats.nats.svc.cluster.local:4222")
		streamName  = env("STREAM", "TRANSACTIONS")
		subject     = env("SUBJECT", "transactions")
		consumer    = env("CONSUMER", "txworker")
		hbSubject   = env("HEARTBEAT_SUBJECT", "demo.workers.heartbeat")
		workIters   = envInt("WORK_ITERS", 150000)
		metricsAddr = env("METRICS_ADDR", ":9090")
	)

	id, _ := os.Hostname()

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	nc, err := nats.Connect(natsURL,
		nats.Name("load-demo-worker/"+id),
		nats.MaxReconnects(-1),
		nats.ReconnectWait(time.Second),
	)
	if err != nil {
		log.Fatalf("nats connect: %v", err)
	}
	defer nc.Drain()

	js, err := jetstream.New(nc)
	if err != nil {
		log.Fatalf("jetstream: %v", err)
	}

	// Ensure the stream + durable consumer exist (idempotent; the gateway ensures the same, so
	// whichever starts first creates them). WorkQueue + in-memory: acked messages are dropped,
	// so NumPending is the true backlog KEDA scales on.
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
	cons, err := stream.CreateOrUpdateConsumer(ctx, jetstream.ConsumerConfig{
		Durable:       consumer,
		AckPolicy:     jetstream.AckExplicitPolicy,
		AckWait:       30 * time.Second,
		MaxAckPending: 2048,
	})
	if err != nil {
		log.Fatalf("consumer: %v", err)
	}

	// Metrics + health server.
	mux := http.NewServeMux()
	mux.Handle("/metrics", promhttp.Handler())
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusOK) })
	srv := &http.Server{Addr: metricsAddr, Handler: mux}
	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("metrics server: %v", err)
		}
	}()

	go heartbeat(ctx, nc, hbSubject, id)

	log.Printf("tx-worker %s consuming %s/%s (work_iters=%d)", id, streamName, consumer, workIters)

	// Single-threaded Fetch loop: one core of processing per pod, so system throughput tracks
	// replica count and backlog cleanly drives KEDA.
	for ctx.Err() == nil {
		// Small batches keep per-message ack latency well under AckWait even when WORK_ITERS is
		// high, avoiding spurious redeliveries.
		batch, err := cons.Fetch(10, jetstream.FetchMaxWait(2*time.Second))
		if err != nil {
			if ctx.Err() != nil {
				break
			}
			time.Sleep(200 * time.Millisecond)
			continue
		}
		for msg := range batch.Messages() {
			spin(workIters, msg.Data())
			processed.Inc()
			processedCount.Add(1)
			_ = msg.Ack()
		}
		if err := batch.Error(); err != nil && ctx.Err() == nil {
			time.Sleep(200 * time.Millisecond)
		}
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_ = srv.Shutdown(shutdownCtx)
}

func heartbeat(ctx context.Context, nc *nats.Conn, subject, id string) {
	t := time.NewTicker(2 * time.Second)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			b, _ := json.Marshal(map[string]any{"id": id, "processed": processedCount.Load()})
			_ = nc.Publish(subject, b)
		}
	}
}

// spin does a tunable amount of real CPU work per transaction (repeated SHA-256), so processing
// a transaction has a real, configurable cost. Raising WORK_ITERS lowers per-pod throughput and
// makes a given offered load spread across more pods.
func spin(iters int, seed []byte) {
	h := sha256.New()
	buf := make([]byte, 32)
	copy(buf, seed)
	for i := 0; i < iters; i++ {
		h.Reset()
		binary.LittleEndian.PutUint64(buf, uint64(i))
		h.Write(buf)
		buf = h.Sum(buf[:0])
	}
	sink.Add(uint64(buf[0]))
}
