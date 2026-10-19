import * as Plot from "@observablehq/plot";
import { useEffect, useRef, useState } from "react";

/** Renders an Observable Plot chart, re-rendering when the options or the container width change. */
export function PlotFigure({ options }: { options: (width: number) => Plot.PlotOptions }) {
  const ref = useRef<HTMLDivElement>(null);
  const width = useWidth(ref);
  useEffect(() => {
    if (!ref.current || width === 0) return;
    const chart = Plot.plot(options(width));
    ref.current.replaceChildren(chart);
    return () => chart.remove();
  }, [options, width]);
  return <div ref={ref} className="plot" />;
}

export function useWidth(ref: React.RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}

/** Whether the page is in dark mode, following the system setting. */
export function useDarkMode(): boolean {
  const query = "(prefers-color-scheme: dark)";
  const [dark, setDark] = useState(() => matchMedia(query).matches);
  useEffect(() => {
    const mq = matchMedia(query);
    const onChange = () => setDark(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return dark;
}
