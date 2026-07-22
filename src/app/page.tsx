import { Hero } from "@/components/sections/Hero";
import { LabDiagram } from "@/components/diagram/LabDiagram";

export default function Home() {
  return (
    <main className="fixed inset-0 overflow-hidden">
      {/* The diagram is the whole page — interactive from load. */}
      <LabDiagram />

      {/* Writeup floats over the canvas on the left; everything else is the
          interactive diagram (this layer ignores pointer events). */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 flex items-center p-4 sm:p-6">
        <Hero />
      </div>
    </main>
  );
}
