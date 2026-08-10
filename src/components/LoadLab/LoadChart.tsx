"use client";

import { useEffect, useRef } from "react";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";

const OFFERED = "#63b8cf";
const PROCESSED = "#8fca9d";
const AXIS = "#8a8a8a";
const GRID = "rgba(138,138,138,0.12)";
const FONT = "10px ui-monospace, SFMono-Regular, Menlo, monospace";

interface LoadChartProps {
  data: uPlot.AlignedData;
  height?: number;
}

export function LoadChart({ data, height = 150 }: LoadChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const plotRef = useRef<uPlot | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const opts: uPlot.Options = {
      width: el.clientWidth || 320,
      height,
      padding: [8, 10, 0, 0],
      scales: {
        x: { time: true },
        y: { range: (_u, _min, max) => [0, Math.max(10, max) * 1.15] },
      },
      legend: { show: false },
      cursor: { show: false },
      series: [
        {},
        { label: "offered", stroke: OFFERED, width: 1.5, points: { show: false } },
        {
          label: "processed",
          stroke: PROCESSED,
          width: 1.5,
          fill: "rgba(143,202,157,0.10)",
          points: { show: false },
        },
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
          stroke: AXIS,
          grid: { stroke: GRID, width: 1 },
          ticks: { stroke: GRID, width: 1 },
          font: FONT,
          size: 32,
        },
      ],
    };

    const plot = new uPlot(opts, [[], [], []], el);
    plotRef.current = plot;

    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      if (w > 0) plot.setSize({ width: w, height });
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      plot.destroy();
      plotRef.current = null;
    };
  }, [height]);

  useEffect(() => {
    plotRef.current?.setData(data);
  }, [data]);

  return <div ref={containerRef} className="w-full" style={{ height }} />;
}
