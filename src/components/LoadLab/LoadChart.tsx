"use client";

import { useEffect, useRef } from "react";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";

const OFFERED = "#63b8cf"; // blue
const PROCESSED = "#b794f6"; // purple
const BACKLOG = "#e0913f"; // orange
const WORKERS = "#e6c34a"; // yellow
const AXIS = "#8a8a8a";
const GRID = "rgba(138,138,138,0.12)";
const FONT = "10px ui-monospace, SFMono-Regular, Menlo, monospace";
const WINDOW_SEC = 60; // visible time span
const Y_EASE = 0.08; // how quickly the left axis top follows the data peak (per frame)
const WORKERS_MAX = 6; // right axis: fixed headroom above max replicas (5)
// Series sharing the left (TPS + backlog) axis; workers lives on its own right axis.
const PRIMARY_SERIES = [1, 2, 3];

interface LoadChartProps {
  data: uPlot.AlignedData;
  height?: number;
}

export function LoadChart({ data, height = 150 }: LoadChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const plotRef = useRef<uPlot | null>(null);
  const dataRef = useRef<uPlot.AlignedData>(data);
  const yTopRef = useRef(10);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const opts: uPlot.Options = {
      width: el.clientWidth || 320,
      height,
      padding: [8, 4, 0, 0],
      // Scales are driven manually in the rAF loop so nothing snaps to the data extent.
      scales: {
        x: { time: true, auto: false },
        y: { auto: false }, // offered / processed / backlog
        w: { auto: false }, // workers
      },
      legend: { show: false },
      cursor: { show: false },
      series: [
        {},
        { label: "offered", scale: "y", stroke: OFFERED, width: 1.5, points: { show: false } },
        { label: "processed", scale: "y", stroke: PROCESSED, width: 1.5, points: { show: false } },
        { label: "backlog", scale: "y", stroke: BACKLOG, width: 1.5, points: { show: false } },
        { label: "workers", scale: "w", stroke: WORKERS, width: 1.5, points: { show: false } },
      ],
      axes: [
        {
          stroke: AXIS,
          grid: { stroke: GRID, width: 1 },
          ticks: { stroke: GRID, width: 1 },
          font: FONT,
          size: 26,
        },
        {
          scale: "y",
          stroke: PROCESSED,
          grid: { stroke: GRID, width: 1 },
          ticks: { stroke: GRID, width: 1 },
          font: FONT,
          size: 32,
        },
        {
          scale: "w",
          side: 1,
          stroke: WORKERS,
          grid: { show: false },
          ticks: { stroke: GRID, width: 1 },
          font: FONT,
          size: 26,
          values: (_u, splits) => splits.map((v) => (Number.isInteger(v) ? String(v) : "")),
        },
      ],
    };

    const plot = new uPlot(opts, dataRef.current, el);
    plotRef.current = plot;

    // Advance the time window every frame so the lines scroll smoothly instead of jumping when a
    // sample lands. The left-axis top eases toward the data peak so it never snaps either.
    let raf = 0;
    const frame = () => {
      const now = Date.now() / 1000;

      let peak = 10;
      const d = dataRef.current;
      for (const s of PRIMARY_SERIES) {
        const arr = d[s] as (number | null)[] | undefined;
        if (!arr) continue;
        for (let i = 0; i < arr.length; i++) {
          const v = arr[i];
          if (v != null && v > peak) peak = v;
        }
      }
      const target = peak * 1.15;
      yTopRef.current += (target - yTopRef.current) * Y_EASE;

      plot.batch(() => {
        plot.setScale("x", { min: now - WINDOW_SEC, max: now });
        plot.setScale("y", { min: 0, max: yTopRef.current });
        plot.setScale("w", { min: 0, max: WORKERS_MAX });
      });
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      if (w > 0) plot.setSize({ width: w, height });
    });
    ro.observe(el);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      plot.destroy();
      plotRef.current = null;
    };
  }, [height]);

  useEffect(() => {
    dataRef.current = data;
    // resetScales = false: appending a point must not re-fit the axes (the rAF loop owns them).
    plotRef.current?.setData(data, false);
  }, [data]);

  return <div ref={containerRef} className="w-full" style={{ height }} />;
}
