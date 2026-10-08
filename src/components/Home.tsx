"use client";

import { useState } from "react";
import { Hero } from "@/components/Hero";
import { LoadLab } from "@/components/LoadLab";
import { LabDiagram } from "@/components/diagram/LabDiagram";
import { useLoadgen } from "@/lib/loadgen/useLoadgen";

export function Home({ stars }: { stars: number | null }) {
  const [heroCollapsed, setHeroCollapsed] = useState(false);
  const [labCollapsed, setLabCollapsed] = useState(true);
  const loadgen = useLoadgen();

  const replicas = loadgen.metrics
    ? Math.max(1, Math.min(5, loadgen.metrics.replicas))
    : 1;

  // This tab is actively generating load (drives the purple live-load path in the diagram).
  const localLoad = loadgen.bursting && loadgen.slider > 0;

  // Opening one panel auto-closes the other (they bookend the diagram).
  const toggleHero = () => {
    const opening = heroCollapsed;
    setHeroCollapsed(!heroCollapsed);
    if (opening) setLabCollapsed(true);
  };
  const toggleLab = () => {
    const opening = labCollapsed;
    setLabCollapsed(!labCollapsed);
    if (opening) setHeroCollapsed(true);
  };
  const openLab = () => {
    setHeroCollapsed(true);
    setLabCollapsed(false);
  };

  return (
    <main className="fixed inset-0 overflow-hidden">
      <LabDiagram
        writeupCollapsed={heroCollapsed}
        localLoad={localLoad}
        replicas={replicas}
        stars={stars}
      />

      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 flex items-start p-3 sm:items-center sm:p-6">
        <Hero collapsed={heroCollapsed} onToggle={toggleHero} onRunDemo={openLab} />
      </div>

      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 flex items-start justify-end p-3 sm:items-center sm:p-6">
        <LoadLab
          collapsed={labCollapsed}
          onToggle={toggleLab}
          loadgen={loadgen}
        />
      </div>
    </main>
  );
}
