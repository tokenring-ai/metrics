import { describe, expect, test } from "bun:test";
import { buildHistoryList, collectSpendHistories } from "./history.ts";
import {
  AgentMetricsDataSchema,
  bucketSpendSeries,
  recordSpendSample,
  SPEND_FINE_BUCKET_MS,
  SPEND_HOURLY_RETENTION_MS,
  SpendHistorySchema,
  type StoredAgentMetrics,
} from "./MetricsStorage.ts";
import type { AgentCosts } from "./rpc/schema.ts";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
// A fixed instant well past the epoch so window maths never goes negative.
const NOW = Date.UTC(2026, 9, 12, 15, 37, 0);

describe("recordSpendSample", () => {
  test("accumulates into aligned buckets at both resolutions", () => {
    const history = SpendHistorySchema.parse({});
    recordSpendSample(history, { cost: 1 }, NOW);
    recordSpendSample(history, { cost: 2, inputTokens: 10 }, NOW + 60_000);
    recordSpendSample(history, { requests: 1 }, NOW + 10 * 60_000);

    expect(history.hourly).toHaveLength(1);
    expect(history.hourly[0]).toEqual({ t: Date.UTC(2026, 9, 12, 15), cost: 3, inputTokens: 10, outputTokens: 0, requests: 1 });
    // 15:37 and 15:38 share the 15:35 bucket; 15:47 starts the 15:45 one.
    expect(history.fine.map(p => p.t)).toEqual([Date.UTC(2026, 9, 12, 15, 35), Date.UTC(2026, 9, 12, 15, 45)]);
    expect(history.fine[0]!.cost).toBe(3);
  });

  test("inserts out-of-order samples in place and prunes past retention", () => {
    const history = SpendHistorySchema.parse({});
    recordSpendSample(history, { cost: 1 }, NOW);
    recordSpendSample(history, { cost: 1 }, NOW - 2 * HOUR);
    expect(history.hourly.map(p => p.t)).toEqual([Date.UTC(2026, 9, 12, 13), Date.UTC(2026, 9, 12, 15)]);

    recordSpendSample(history, { cost: 5 }, NOW + SPEND_HOURLY_RETENTION_MS + HOUR);
    expect(history.hourly).toHaveLength(1);
    expect(history.hourly[0]!.cost).toBe(5);
    expect(history.fine).toHaveLength(1);
  });
});

describe("bucketSpendSeries", () => {
  test("1h uses 12 five-minute buckets ending at the bucket containing now", () => {
    const history = SpendHistorySchema.parse({});
    recordSpendSample(history, { cost: 1 }, NOW);
    recordSpendSample(history, { cost: 4 }, NOW - 2 * HOUR); // outside the window
    const series = bucketSpendSeries([history], "1h", NOW);
    expect(series.bucketMs).toBe(SPEND_FINE_BUCKET_MS);
    expect(series.buckets).toHaveLength(12);
    expect(series.buckets.at(-1)!.cost).toBe(1);
    expect(series.totals.cost).toBe(1);
    expect(series.end).toBeGreaterThan(NOW);
  });

  test("sums several agents and coarsens hourly buckets for 7d and 30d", () => {
    const a = SpendHistorySchema.parse({});
    const b = SpendHistorySchema.parse({});
    recordSpendSample(a, { cost: 1, outputTokens: 5 }, NOW);
    recordSpendSample(b, { cost: 2 }, NOW - HOUR);
    recordSpendSample(b, { cost: 3 }, NOW - 3 * DAY);

    const day = bucketSpendSeries([a, b], "24h", NOW);
    expect(day.buckets).toHaveLength(24);
    expect(day.totals.cost).toBe(3);

    const week = bucketSpendSeries([a, b], "7d", NOW);
    expect(week.buckets).toHaveLength(28);
    expect(week.bucketMs).toBe(6 * HOUR);
    expect(week.totals).toEqual({ cost: 6, inputTokens: 0, outputTokens: 5, requests: 0 });
    // 14:00 and 15:00 share the 12:00–18:00 bucket.
    expect(week.buckets.at(-1)!.cost).toBe(3);

    const month = bucketSpendSeries([a, b], "30d", NOW);
    expect(month.buckets).toHaveLength(30);
    expect(month.buckets.at(-1)!.cost).toBe(3);
    expect(month.buckets.at(-4)!.cost).toBe(3);
  });
});

function liveAgent(agentId: string, total: number): AgentCosts {
  return {
    agentId,
    displayName: `Live ${agentId}`,
    agentType: "code",
    idle: false,
    costs: {},
    total,
    tokens: { totalInputTokens: 1, totalOutputTokens: 2, totalCachedTokens: 0, totalReasoningTokens: 0 },
    tokensByCategory: {},
    latency: { requestCount: 3, avgElapsedMs: 0, avgTimeToFirstTokenMs: 0, avgTokensPerSecond: 0 },
    errors: { errorsByProvider: {}, errorsByType: {}, retryCount: 0 },
    activity: { totalSteps: 4, totalToolCalls: 5, toolCallsByName: {} },
  };
}

describe("history merging", () => {
  test("live agents override stored rows and sort first", () => {
    const rows = buildHistoryList(
      [liveAgent("a", 9)],
      [
        { agentId: "a", totalCost: 1, totalInputTokens: 0, totalOutputTokens: 0, requestCount: 0, totalSteps: 0, totalToolCalls: 0, updatedAt: 10 },
        {
          agentId: "old",
          displayName: "Old agent",
          agentType: "research",
          totalCost: 2,
          totalInputTokens: 0,
          totalOutputTokens: 0,
          requestCount: 0,
          totalSteps: 0,
          totalToolCalls: 0,
          updatedAt: 5,
        },
        { agentId: "anon", totalCost: 0, totalInputTokens: 0, totalOutputTokens: 0, requestCount: 0, totalSteps: 0, totalToolCalls: 0, updatedAt: 1 },
      ],
      100,
    );
    expect(rows.map(r => r.agentId)).toEqual(["a", "old", "anon"]);
    expect(rows[0]).toMatchObject({ live: true, totalCost: 9, requestCount: 3, updatedAt: 100 });
    expect(rows[1]).toMatchObject({ live: false, displayName: "Old agent", agentType: "research" });
    expect(rows[2]).toMatchObject({ displayName: "anon", agentType: "unknown" });
  });

  test("spend histories take live state over stored records", () => {
    const liveHistory = SpendHistorySchema.parse({ hourly: [{ t: 0, cost: 1 }] });
    const stored = (agentId: string, cost: number): StoredAgentMetrics => ({
      agentId,
      updatedAt: 0,
      metrics: AgentMetricsDataSchema.parse({ spendHistory: { hourly: [{ t: 0, cost }] } }),
    });
    const histories = collectSpendHistories(new Map([["a", liveHistory]]), [stored("a", 50), stored("b", 2)]);
    expect(histories.map(h => h.hourly[0]!.cost)).toEqual([1, 2]);
  });
});
