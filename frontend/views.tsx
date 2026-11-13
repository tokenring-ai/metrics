import { defineView } from "@tokenring-ai/one-frontend/layout/define.ts";
import type { PluginLayoutViews } from "@tokenring-ai/one-frontend/plugins/layoutTypes.ts";
import { DollarSign, History, ReceiptText } from "lucide-react";
import { lazy } from "react";
import {
  COST_SUMMARY_VIEW_ID,
  METRICS_AGENT_DETAIL_VIEW_ID,
  METRICS_AGENT_KIND,
  METRICS_AGENTS_VIEW_ID,
  METRICS_HISTORY_VIEW_ID,
  METRICS_OVERVIEW_VIEW_ID,
} from "./ids.ts";

const CostSummaryPane = lazy(() => import("./panes/CostSummaryPane.tsx"));
const MetricsOverviewPane = lazy(() => import("./panes/MetricsOverviewPane.tsx"));
const MetricsAgentsPane = lazy(() => import("./panes/MetricsAgentsPane.tsx"));
const MetricsHistoryPane = lazy(() => import("./panes/MetricsHistoryPane.tsx"));
const MetricsAgentDetailPane = lazy(() => import("./panes/MetricsAgentDetailPane.tsx"));

export default {
  views: [
    defineView({
      id: COST_SUMMARY_VIEW_ID,
      kind: "widget",
      title: "Cost & tokens",
      description: "Spend, tokens and latency across agents",
      icon: DollarSign,
      component: CostSummaryPane,
    }),
    defineView({
      id: METRICS_OVERVIEW_VIEW_ID,
      kind: "widget",
      title: "Spend overview",
      description: "Live totals, spend mix and per-category breakdown across agents",
      icon: DollarSign,
      component: MetricsOverviewPane,
    }),
    defineView({
      id: METRICS_AGENTS_VIEW_ID,
      kind: "widget",
      title: "Agent spend",
      description: "Per-agent cost, tokens and errors with filters",
      icon: DollarSign,
      component: MetricsAgentsPane,
    }),
    defineView({
      id: METRICS_HISTORY_VIEW_ID,
      kind: "widget",
      title: "History",
      description: "Past and running agents with their spend, tokens and requests",
      icon: History,
      component: MetricsHistoryPane,
    }),
    defineView({
      id: METRICS_AGENT_DETAIL_VIEW_ID,
      kind: METRICS_AGENT_KIND,
      title: "Agent metrics",
      description: "Full cost, token, latency and error breakdown for one agent",
      icon: ReceiptText,
      instanceKey: p => p["agentId"] ?? "none",
      component: MetricsAgentDetailPane,
    }),
  ],
} satisfies PluginLayoutViews;
