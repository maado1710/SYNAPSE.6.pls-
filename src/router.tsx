import { createRouter } from "@tanstack/react-router";
import { AppErrorComponent } from "@/lib/error-component";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  // Static hosts (e.g. GitHub Pages project sites) serve the app from a sub-path like /repo/.
  const base = import.meta.env.BASE_URL.replace(/\/+$/, "");
  return createRouter({
    routeTree,
    defaultErrorComponent: AppErrorComponent,
    basepath: base || undefined,
  });
}
