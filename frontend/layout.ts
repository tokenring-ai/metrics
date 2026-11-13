import type { AppManifest } from "@tokenring-ai/one-frontend/layout/types.ts";
import type { PluginLayoutManifest } from "@tokenring-ai/one-frontend/plugins/layoutTypes.ts";
import { DollarSign } from "lucide-react";
import {
  COST_SUMMARY_VIEW_ID,
  METRICS_AGENT_DETAIL_VIEW_ID,
  METRICS_AGENT_KIND,
  METRICS_AGENTS_VIEW_ID,
  METRICS_APP_ID,
  METRICS_HISTORY_VIEW_ID,
  METRICS_OVERVIEW_VIEW_ID,
  METRICS_PATH,
} from "./ids.ts";

/**
 * Metrics: the spend overview above the agent table and history (tabbed). An
 * agent's full breakdown opens on the right, and its chat opens beside it. One
 * route (`/metrics`); the panels are widgets and never own the URL.
 */
export const METRICS_APP: AppManifest = {
  id: METRICS_APP_ID,
  path: METRICS_PATH,
  label: "Metrics",
  shortLabel: "MT",
  description: "Live cost tracking across agents and models",
  group: "System",
  icon: DollarSign,
  iconClass: "text-emerald-500",
  gradient: "from-emerald-500 to-teal-600",
  views: [METRICS_OVERVIEW_VIEW_ID, METRICS_AGENTS_VIEW_ID, METRICS_HISTORY_VIEW_ID, METRICS_AGENT_DETAIL_VIEW_ID, "chat"],
  primaryKind: "widget",
  placement: { [METRICS_AGENT_KIND]: "right", agent: "right" },
  layout: {
    split: "column",
    sizes: [2, 3],
    children: [
      { presenter: "single", accepts: ["widget"], items: [METRICS_OVERVIEW_VIEW_ID], primary: true },
      { presenter: "tabs", accepts: ["widget"], items: [METRICS_AGENTS_VIEW_ID, METRICS_HISTORY_VIEW_ID] },
    ],
  },
};

export default {
  apps: [METRICS_APP],
  kinds: [{ id: METRICS_AGENT_KIND, label: "Agent metrics", plural: "agent metrics" }],
  // Shown on Home too (in its widget accordion), as on the old home dashboard.
  extends: [{ app: "home", views: [COST_SUMMARY_VIEW_ID], into: "widget" }],
} satisfies PluginLayoutManifest;
