// Minimal path routing (Firebase Hosting serves index.html for every path).
import { useEffect, useState } from "react";

export type Route =
  | { page: "dashboard" }
  | { page: "log" }
  | { page: "category"; slug: string }
  | { page: "manage"; id?: string };

export function parseRoute(path: string): Route {
  const parts = path.split("/").filter(Boolean);
  if (parts[0] === "log") return { page: "log" };
  if (parts[0] === "category" && parts[1]) return { page: "category", slug: parts[1] };
  if (parts[0] === "manage") return parts[1] ? { page: "manage", id: decodeURIComponent(parts[1]) } : { page: "manage" };
  return { page: "dashboard" };
}

export function routePath(route: Route): string {
  switch (route.page) {
    case "dashboard":
      return "/";
    case "log":
      return "/log";
    case "category":
      return `/category/${route.slug}`;
    case "manage":
      return route.id ? `/manage/${encodeURIComponent(route.id)}` : "/manage";
  }
}

const NAVIGATE = "app:navigate";

export function navigate(route: Route) {
  const path = routePath(route);
  if (path !== location.pathname) history.pushState(null, "", path);
  window.dispatchEvent(new Event(NAVIGATE));
  window.scrollTo(0, 0);
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(location.pathname));
  useEffect(() => {
    const update = () => setRoute(parseRoute(location.pathname));
    window.addEventListener("popstate", update);
    window.addEventListener(NAVIGATE, update);
    return () => {
      window.removeEventListener("popstate", update);
      window.removeEventListener(NAVIGATE, update);
    };
  }, []);
  return route;
}
