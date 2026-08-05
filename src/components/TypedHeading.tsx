"use client";

import { useEffect, useState } from "react";
import { clsx } from "@/lib/utils";

interface TypedHeadingProps {
  text: string;
  className?: string;
  speed?: number;
  as?: "h1" | "h2";
}

export function TypedHeading({ text, className, speed = 90, as = "h1" }: TypedHeadingProps) {
  const [count, setCount] = useState(0);
  const Tag = as;

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduce) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCount(text.length);
      return;
    }

    setCount(0);
    let i = 0;
    let timer: number;

    const step = () => {
      i += 1;
      setCount(i);
      if (i >= text.length) return;
      timer = window.setTimeout(step, speed);
    };

    timer = window.setTimeout(step, speed);
    return () => window.clearTimeout(timer);
  }, [text, speed]);

  const done = count >= text.length;

  return (
    <Tag className={clsx("font-mono", className)} aria-label={text}>
      <span aria-hidden="true">{text.slice(0, count)}</span>
      <span
        aria-hidden="true"
        className={clsx(
          "ml-0.5 inline-block w-[0.6ch] -translate-y-[2px] border-b-[0.18em] border-ink align-baseline",
          done ? "animate-blink" : "",
        )}
      >
        &nbsp;
      </span>
    </Tag>
  );
}
