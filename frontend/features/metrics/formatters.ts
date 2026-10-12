/** Format a USD cost with adaptive precision for small amounts. */
export function formatUsd(amount: number): string {
  if (!Number.isFinite(amount) || amount === 0) return "$0.00";

  // Always en-US so `$` + decimal point stay stable across host locales.
  const abs = Math.abs(amount);
  const body = abs.toLocaleString("en-US", {
    minimumFractionDigits: abs < 0.01 ? 4 : 2,
    maximumFractionDigits: abs < 0.01 ? 6 : 4,
  });
  return amount < 0 ? `-$${body}` : `$${body}`;
}

/** Compact token/count formatting (1.2k, 3.4M). */
export function formatCount(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "0";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) {
    const millions = abs / 1_000_000;
    return `${sign}${millions >= 10 ? millions.toFixed(0) : millions.toFixed(1)}M`;
  }
  if (abs >= 1_000) {
    const thousands = abs / 1_000;
    // Keep one decimal under 100k so 12.5k doesn't round away; whole numbers drop trailing .0
    const body = thousands >= 100 ? thousands.toFixed(0) : thousands.toFixed(1).replace(/\.0$/, "");
    return `${sign}${body}k`;
  }
  return `${sign}${Math.round(abs).toLocaleString("en-US")}`;
}

/** Format milliseconds as ms or seconds. */
export function formatMs(ms: number | undefined): string {
  if (ms === undefined || !Number.isFinite(ms) || ms <= 0) return "—";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(ms < 10_000 ? 2 : 1)}s`;
}

/** Format tokens/sec throughput. */
export function formatTps(tps: number | undefined): string {
  if (tps === undefined || !Number.isFinite(tps) || tps <= 0) return "—";
  return `${tps >= 100 ? Math.round(tps) : tps.toFixed(1)} tk/s`;
}

/** Sum values in a string→number record. */
export function sumRecord(record: Record<string, number> | undefined): number {
  if (!record) return 0;
  return Object.values(record).reduce((a, b) => a + b, 0);
}

/** Top N entries from a string→number record, sorted by value descending. */
export function topRecordEntries(record: Record<string, number> | undefined, limit = 5): Array<{ key: string; value: number }> {
  if (!record) return [];
  return Object.entries(record)
    .map(([key, value]) => ({ key, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

/** Format a 0–1 share as a percentage string. */
export function formatPercent(share: number, digits = 0): string {
  if (!Number.isFinite(share)) return "0%";
  const pct = share * 100;
  if (pct > 0 && pct < 1 && digits === 0) return "<1%";
  return `${pct.toFixed(digits)}%`;
}

/** Shorten a long agent id for display (first 8 chars). */
export function formatAgentIdShort(agentId: string): string {
  if (!agentId) return "—";
  return agentId.length <= 8 ? agentId : agentId.slice(0, 8);
}

/** Shorten model/category labels like "Chat (OpenAI:gpt-4o)" for display. */
export function shortCategoryLabel(category: string): string {
  const chatMatch = category.match(/^Chat\s*\((.+)\)$/i);
  if (chatMatch?.[1]) return chatMatch[1];
  const imageMatch = category.match(/^Image Generation\s*\((.+)\)$/i);
  if (imageMatch?.[1]) return `Image · ${imageMatch[1]}`;
  const videoMatch = category.match(/^Video Generation\s*\((.+)\)$/i);
  if (videoMatch?.[1]) return `Video · ${videoMatch[1]}`;
  const generateMatch = category.match(/^GenerateObject\s*\((.+)\)$/i);
  if (generateMatch?.[1]) return `Object · ${generateMatch[1]}`;
  return category;
}

/** Coarse bucket for color-coding category bars. */
export function categoryKind(category: string): "chat" | "image" | "video" | "other" {
  const lower = category.toLowerCase();
  if (lower.startsWith("chat") || lower.startsWith("generateobject")) return "chat";
  if (lower.startsWith("image")) return "image";
  if (lower.startsWith("video")) return "video";
  return "other";
}

export type CategoryShare = {
  category: string;
  amount: number;
  share: number;
};

/** Sort categories by amount descending and attach share of total. */
export function categoryShares(totalsByCategory: Record<string, number>, grandTotal: number): CategoryShare[] {
  const entries = Object.entries(totalsByCategory)
    .map(([category, amount]) => ({
      category,
      amount,
      share: grandTotal > 0 ? amount / grandTotal : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
  return entries;
}

/** Bucket spend into chat / media / other for summary cards. */
export function bucketTotals(totalsByCategory: Record<string, number>): {
  chat: number;
  media: number;
  other: number;
} {
  let chat = 0;
  let media = 0;
  let other = 0;
  for (const [category, amount] of Object.entries(totalsByCategory)) {
    const kind = categoryKind(category);
    if (kind === "chat") chat += amount;
    else if (kind === "image" || kind === "video") media += amount;
    else other += amount;
  }
  return { chat, media, other };
}

export type AgentFilter = "all" | "active" | "idle";

/** Filter agent cost rows by idle/active status. */
export function filterAgents<T extends { idle: boolean; displayName: string; agentType: string; agentId: string }>(
  agents: T[],
  filter: AgentFilter,
  search = "",
): T[] {
  const q = search.trim().toLowerCase();
  return agents.filter(agent => {
    if (filter === "active" && agent.idle) return false;
    if (filter === "idle" && !agent.idle) return false;
    if (!q) return true;
    return agent.displayName.toLowerCase().includes(q) || agent.agentType.toLowerCase().includes(q) || agent.agentId.toLowerCase().includes(q);
  });
}

/** Hover help for the abbreviations in the performance cards. */
export const TOKENS_TOOLTIP =
  "Input / output tokens. cached: input tokens served from the provider's prompt cache. reason: hidden reasoning (thinking) tokens the model produced.";
export const LATENCY_TOOLTIP =
  "Average request time. ttft: time to first token, how long until the reply started streaming. tk/s: output tokens per second while streaming.";

/** Hover help for abbreviated per-agent stat labels. */
export const STAT_LABEL_TOOLTIPS: Record<string, string> = {
  cached: "Input tokens served from the provider's prompt cache",
  reasoning: "Hidden reasoning (thinking) tokens the model produced",
  ttft: "Average time to first token",
  tps: "Average output tokens per second while streaming",
  p50: "Median request time",
  p95: "95th-percentile request time",
  p99: "99th-percentile request time",
  "ttft p50": "Median time to first token",
  "ttft p95": "95th-percentile time to first token",
  "ttft p99": "99th-percentile time to first token",
};

export type AgentSort = "spend" | "tokens" | "requests" | "errors" | "name";

export const AGENT_SORT_OPTIONS: ReadonlyArray<{ id: AgentSort; label: string }> = [
  { id: "spend", label: "Spend" },
  { id: "tokens", label: "Tokens" },
  { id: "requests", label: "Requests" },
  { id: "errors", label: "Errors" },
  { id: "name", label: "Name" },
];

type SortableAgent = {
  displayName: string;
  total: number;
  tokens: { totalInputTokens: number; totalOutputTokens: number };
  latency: { requestCount: number };
  errors: { errorsByProvider: Record<string, number>; errorsByType: Record<string, number> };
};

/** Sorts agent rows (copy) — numeric keys descending, name ascending; ties fall back to name. */
export function sortAgents<T extends SortableAgent>(agents: readonly T[], sort: AgentSort): T[] {
  const key = (agent: T): number => {
    switch (sort) {
      case "tokens":
        return agent.tokens.totalInputTokens + agent.tokens.totalOutputTokens;
      case "requests":
        return agent.latency.requestCount;
      case "errors":
        return Math.max(sumRecord(agent.errors.errorsByProvider), sumRecord(agent.errors.errorsByType));
      case "spend":
        return agent.total;
      default:
        return 0;
    }
  };
  return [...agents].sort((a, b) => key(b) - key(a) || a.displayName.localeCompare(b.displayName));
}

export type SpendRangeId = "1h" | "24h" | "7d" | "30d";

export const SPEND_RANGE_OPTIONS: ReadonlyArray<{ value: SpendRangeId; label: string; title: string }> = [
  { value: "1h", label: "1h", title: "Last hour, 5-minute buckets" },
  { value: "24h", label: "24h", title: "Last 24 hours, hourly buckets" },
  { value: "7d", label: "7d", title: "Last 7 days, 6-hour buckets" },
  { value: "30d", label: "30d", title: "Last 30 days, daily buckets" },
];

/** Label for a spend bucket start, at a precision that suits the range. Local time. */
export function formatBucketLabel(t: number, range: SpendRangeId): string {
  const date = new Date(t);
  switch (range) {
    case "1h":
    case "24h":
      return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    case "7d":
      return `${date.toLocaleDateString("en-US", { weekday: "short" })} ${date.toLocaleTimeString("en-US", { hour: "numeric" })}`;
    default:
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
}

export type ModelTokenRow = {
  category: string;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  reasoningTokens: number;
  cost: number;
  /** Share of all input+output tokens. */
  share: number;
};

/**
 * Join per-category token totals with per-category cost into model rows,
 * largest token volume first. Categories with cost but no tokens (image,
 * search) are left out; this is a token table.
 */
export function modelTokenRows(
  tokensByCategory: Record<string, { totalInputTokens: number; totalOutputTokens: number; totalCachedTokens: number; totalReasoningTokens: number }>,
  costsByCategory: Record<string, number>,
): ModelTokenRow[] {
  const rows = Object.entries(tokensByCategory).map(([category, usage]) => ({
    category,
    inputTokens: usage.totalInputTokens,
    outputTokens: usage.totalOutputTokens,
    cachedTokens: usage.totalCachedTokens,
    reasoningTokens: usage.totalReasoningTokens,
    cost: costsByCategory[category] ?? 0,
    share: 0,
  }));
  const total = rows.reduce((sum, row) => sum + row.inputTokens + row.outputTokens, 0);
  for (const row of rows) row.share = total > 0 ? (row.inputTokens + row.outputTokens) / total : 0;
  return rows
    .filter(row => row.inputTokens + row.outputTokens + row.cachedTokens + row.reasoningTokens > 0)
    .sort((a, b) => b.inputTokens + b.outputTokens - (a.inputTokens + a.outputTokens) || a.category.localeCompare(b.category));
}

export type HistorySort = "updated" | "spend" | "tokens" | "requests" | "name";

type SortableHistoryRow = {
  displayName: string;
  totalCost: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  requestCount: number;
  updatedAt: number;
};

/** Sorts History rows (copy). `asc` flips the natural direction (numbers/dates descend, names ascend). */
export function sortHistory<T extends SortableHistoryRow>(rows: readonly T[], sort: HistorySort, asc = false): T[] {
  const compare = (a: T, b: T): number => {
    switch (sort) {
      case "name":
        return a.displayName.localeCompare(b.displayName);
      case "spend":
        return b.totalCost - a.totalCost;
      case "tokens":
        return b.totalInputTokens + b.totalOutputTokens - (a.totalInputTokens + a.totalOutputTokens);
      case "requests":
        return b.requestCount - a.requestCount;
      default:
        return b.updatedAt - a.updatedAt;
    }
  };
  return [...rows].sort((a, b) => (asc ? -1 : 1) * compare(a, b) || a.displayName.localeCompare(b.displayName));
}

/** "just now", "5m ago", "3h ago", "2d ago", or a date beyond a week. */
export function formatRelativeTime(t: number, now = Date.now()): string {
  const diff = Math.max(0, now - t);
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
