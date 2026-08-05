"use client";

import { useState } from "react";
import { Hero } from "@/components/Hero";
import { LabDiagram } from "@/components/diagram/LabDiagram";

export default function Home() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <main className="fixed inset-0 overflow-hidden">
      <LabDiagram writeupCollapsed={collapsed} />

      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 flex items-start p-3 sm:items-center sm:p-6">
        <Hero collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      </div>
    </main>
  );
}
