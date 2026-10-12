import type { ViewManifest } from "@tokenring-ai/one-frontend/dock/types.ts";
import type { PluginFrontendManifest } from "@tokenring-ai/one-frontend/plugins/types.ts";
import { DollarSign, History, ReceiptText } from "lucide-react";

/** Id of the dashboard this plugin owns. */
export const METRICS_DASHBOARD_ID = "metrics";
/** Headline view referenced by the Home dashboard's default layout — do not rename. */
export const COST_SUMMARY_VIEW_ID = "metrics-cost-summary";
export const METRICS_OVERVIEW_VIEW_ID = "metrics-overview";
export const METRICS_AGENTS_VIEW_ID = "metrics-agents";
export const METRICS_HISTORY_VIEW_ID = "metrics-history";
export const METRICS_AGENT_DETAIL_VIEW_ID = "metrics-agent-detail";

/** Dock view contributed to the main dashboard. */
export const costSummaryViewManifest = {
  id: COST_SUMMARY_VIEW_ID,
  title: "Cost & tokens",
  description: "Spend, tokens and latency across agents",
  icon: DollarSign,
  availableOn: ["home", "any"],
  defaultSize: { width: 360, height: 260 },
  minimumSize: { width: 240, height: 120 },
  tags: ["cost", "ops"],
} satisfies ViewManifest;

/** Live totals, spend mix and per-category breakdown for the Metrics dashboard. */
export const metricsOverviewViewManifest = {
  id: METRICS_OVERVIEW_VIEW_ID,
  title: "Spend overview",
  description: "Live totals, spend mix and per-category breakdown across agents",
  icon: DollarSign,
  availableOn: ["any"],
  defaultSize: { width: 520, height: 380 },
  minimumSize: { width: 300, height: 200 },
  tags: ["cost", "ops"],
} satisfies ViewManifest;

/** Per-agent table with filters, search and expandable breakdowns. */
export const metricsAgentsViewManifest = {
  id: METRICS_AGENTS_VIEW_ID,
  title: "Agent spend",
  description: "Per-agent cost, tokens and errors with filters",
  icon: DollarSign,
  availableOn: ["any"],
  // Wider default: the rows carry chips, mini stats and inline actions.
  defaultSize: { width: 680, height: 420 },
  minimumSize: { width: 360, height: 220 },
  tags: ["cost", "ops"],
} satisfies ViewManifest;

/** Cross-session list of every agent with recorded metrics, sortable and exportable. */
export const metricsHistoryViewManifest = {
  id: METRICS_HISTORY_VIEW_ID,
  title: "History",
  description: "Past and running agents with their spend, tokens and requests",
  icon: History,
  availableOn: ["any"],
  defaultSize: { width: 620, height: 400 },
  minimumSize: { width: 340, height: 200 },
  tags: ["cost", "ops", "history"],
} satisfies ViewManifest;

/** One agent's full metrics breakdown, running or stored. Opened from History. */
export const metricsAgentDetailViewManifest = {
  id: METRICS_AGENT_DETAIL_VIEW_ID,
  title: "Agent metrics",
  description: "Full cost, token, latency and error breakdown for one agent",
  icon: ReceiptText,
  // Programmatic only: it needs an agent id.
  availableOn: [],
  defaultSize: { width: 420, height: 480 },
  minimumSize: { width: 280, height: 200 },
  tags: ["cost", "ops"],
} satisfies ViewManifest;

/**
 * Metadata for the metrics frontend shipped by this plugin. The frontend merges
 * this into its registry and derives the SPA server routes from it.
 */
export default {
  id: METRICS_DASHBOARD_ID,
  path: "/metrics",
  label: "Metrics",
  shortLabel: "MT",
  description: "Live cost tracking across agents and models",
  group: "System",
  icon: DollarSign,
  iconClass: "text-emerald-500",
  gradient: "from-emerald-500 to-teal-600",
  views: [costSummaryViewManifest, metricsOverviewViewManifest, metricsAgentsViewManifest, metricsHistoryViewManifest, metricsAgentDetailViewManifest],
} satisfies PluginFrontendManifest;
