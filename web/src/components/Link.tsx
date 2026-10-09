import type { ReactNode } from "react";
import { navigate, routePath, type Route } from "../lib/route";

/** In-app link: a real href (⌘-click opens a new tab) that navigates without reloading. */
export function Link({ to, children, className }: { to: Route; children: ReactNode; className?: string }) {
  return (
    <a
      href={routePath(to)}
      className={className}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        navigate(to);
      }}
    >
      {children}
    </a>
  );
}
