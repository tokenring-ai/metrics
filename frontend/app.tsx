import type { PluginFrontendContribution } from "@tokenring-ai/one-frontend/plugins/types.ts";
import { lazy } from "react";
import { z } from "zod";
import manifest, {
  costSummaryViewManifest,
  METRICS_AGENTS_VIEW_ID,
  METRICS_DASHBOARD_ID,
  METRICS_HISTORY_VIEW_ID,
  METRICS_OVERVIEW_VIEW_ID,
  metricsAgentDetailViewManifest,
  metricsAgentsViewManifest,
  metricsHistoryViewManifest,
  metricsOverviewViewManifest,
} from "./manifest.ts";

const MetricsAgentDetailParams = z.object({ agentId: z.string().min(1).optional() });
type MetricsAgentDetailParams = z.infer<typeof MetricsAgentDetailParams>;

/**
 * The metrics frontend contributed to the TokenRing One frontend by this
 * plugin: dock views plus the Metrics dashboard they compose into.
 * Discovered by `frontend/src/plugins/registry.ts`.
 */
export default {
  ...manifest,
  views: [
    { ...costSummaryViewManifest, component: lazy(() => import("./views/CostSummaryView.tsx")) },
    { ...metricsOverviewViewManifest, component: lazy(() => import("./views/MetricsOverviewView.tsx")) },
    { ...metricsAgentsViewManifest, component: lazy(() => import("./views/MetricsAgentsView.tsx")) },
    { ...metricsHistoryViewManifest, component: lazy(() => import("./views/MetricsHistoryView.tsx")) },
    {
      ...metricsAgentDetailViewManifest,
      params: MetricsAgentDetailParams,
      instanceKey: (params: MetricsAgentDetailParams) => params.agentId ?? "none",
      component: lazy(() => import("./views/MetricsAgentDetailView.tsx")),
    },
  ],
  dashboards: [
    {
      ...manifest,
      id: METRICS_DASHBOARD_ID,
      routePath: "/metrics",
      defaultLayout: {
        kind: "column",
        sizes: [2, 3],
        children: [
          { kind: "panel", view: METRICS_OVERVIEW_VIEW_ID },
          {
            kind: "tabs",
            panels: [
              { kind: "panel", view: METRICS_AGENTS_VIEW_ID },
              { kind: "panel", view: METRICS_HISTORY_VIEW_ID },
            ],
          },
        ],
      },
      documentTitle: () => "Metrics",
    },
  ],
} satisfies PluginFrontendContribution;
