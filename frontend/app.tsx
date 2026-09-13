import manifest from "./manifest.ts";
import MetricsApp from "./MetricsApp.tsx";
import type { PluginAppDefinition } from "@tokenring-ai/one-frontend/plugins/types.ts";

/**
 * The metrics app contributed to the TokenRing One frontend by this
 * plugin. Discovered by `frontend/src/plugins/registry.ts`.
 */
export default {
  ...manifest,
  routePath: "/metrics",
  component: MetricsApp,
} satisfies PluginAppDefinition;
