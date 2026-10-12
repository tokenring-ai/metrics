import type { AgentCosts, AgentHistoryItem } from "@tokenring-ai/metrics/rpc/schema";
import type { CsvColumn } from "../../lib/csv.ts";
import { sumRecord } from "./formatters.ts";

/** Raw numbers (no currency symbols or k/M suffixes) so the CSV sums cleanly in a spreadsheet. */
export const agentsCsvColumns: CsvColumn<AgentCosts>[] = [
  { header: "Agent ID", value: a => a.agentId },
  { header: "Name", value: a => a.displayName },
  { header: "Type", value: a => a.agentType },
  { header: "Status", value: a => (a.idle ? "idle" : "active") },
  { header: "Cost (USD)", value: a => a.total },
  { header: "Input tokens", value: a => a.tokens.totalInputTokens },
  { header: "Output tokens", value: a => a.tokens.totalOutputTokens },
  { header: "Cached tokens", value: a => a.tokens.totalCachedTokens },
  { header: "Reasoning tokens", value: a => a.tokens.totalReasoningTokens },
  { header: "Requests", value: a => a.latency.requestCount },
  { header: "Avg latency (ms)", value: a => Math.round(a.latency.avgElapsedMs) },
  { header: "p95 latency (ms)", value: a => (a.latency.p95ElapsedMs === undefined ? "" : Math.round(a.latency.p95ElapsedMs)) },
  { header: "Avg TTFT (ms)", value: a => Math.round(a.latency.avgTimeToFirstTokenMs) },
  { header: "Steps", value: a => a.activity.totalSteps },
  { header: "Tool calls", value: a => a.activity.totalToolCalls },
  { header: "Errors", value: a => Math.max(sumRecord(a.errors.errorsByProvider), sumRecord(a.errors.errorsByType)) },
  { header: "Retries", value: a => a.errors.retryCount },
];

export const historyCsvColumns: CsvColumn<AgentHistoryItem>[] = [
  { header: "Agent ID", value: r => r.agentId },
  { header: "Name", value: r => r.displayName },
  { header: "Type", value: r => r.agentType },
  { header: "Running", value: r => (r.live ? "yes" : "no") },
  { header: "Cost (USD)", value: r => r.totalCost },
  { header: "Input tokens", value: r => r.totalInputTokens },
  { header: "Output tokens", value: r => r.totalOutputTokens },
  { header: "Requests", value: r => r.requestCount },
  { header: "Steps", value: r => r.totalSteps },
  { header: "Tool calls", value: r => r.totalToolCalls },
  { header: "Last updated (UTC)", value: r => new Date(r.updatedAt).toISOString() },
];
