import { describe, expect, test } from "bun:test";
import { agentCostsFromMetrics, aggregateCostSummary } from "./costSummary.ts";
import { AgentMetricsDataSchema } from "./MetricsStorage.ts";
import type { AgentCosts } from "./rpc/schema.ts";

function agent(partial: Partial<AgentCosts> & Pick<AgentCosts, "agentId" | "total" | "costs">): AgentCosts {
  return {
    displayName: partial.displayName ?? partial.agentId,
    agentType: partial.agentType ?? "code",
    idle: partial.idle ?? true,
    tokens: partial.tokens ?? {
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCachedTokens: 0,
      totalReasoningTokens: 0,
    },
    tokensByCategory: partial.tokensByCategory ?? {},
    latency: partial.latency ?? {
      requestCount: 0,
      avgElapsedMs: 0,
      avgTimeToFirstTokenMs: 0,
      avgTokensPerSecond: 0,
    },
    errors: partial.errors ?? {
      errorsByProvider: {},
      errorsByType: {},
      retryCount: 0,
    },
    activity: partial.activity ?? {
      totalSteps: 0,
      totalToolCalls: 0,
      toolCallsByName: {},
    },
    ...partial,
  };
}

describe("aggregateCostSummary", () => {
  test("aggregates totals by category and grand total", () => {
    const summary = aggregateCostSummary([
      agent({
        agentId: "a1",
        total: 3,
        costs: { "Chat (m)": 1, "Image Generation (m)": 2 },
        idle: false,
        tokens: { totalInputTokens: 100, totalOutputTokens: 50, totalCachedTokens: 10, totalReasoningTokens: 5 },
        latency: {
          requestCount: 2,
          avgElapsedMs: 200,
          avgTimeToFirstTokenMs: 40,
          avgTokensPerSecond: 30,
          p50ElapsedMs: 180,
          p95ElapsedMs: 300,
          p99ElapsedMs: 400,
        },
        errors: { errorsByProvider: { openai: 1 }, errorsByType: { timeout: 1 }, retryCount: 2 },
        activity: { totalSteps: 3, totalToolCalls: 4, toolCallsByName: { read_file: 4 } },
      }),
      agent({
        agentId: "a2",
        total: 1,
        costs: { "Chat (m)": 1 },
        tokens: { totalInputTokens: 20, totalOutputTokens: 10, totalCachedTokens: 0, totalReasoningTokens: 0 },
        latency: {
          requestCount: 1,
          avgElapsedMs: 100,
          avgTimeToFirstTokenMs: 20,
          avgTokensPerSecond: 20,
          p50ElapsedMs: 90,
          p95ElapsedMs: 150,
          p99ElapsedMs: 180,
        },
        activity: { totalSteps: 1, totalToolCalls: 1, toolCallsByName: { search: 1 } },
      }),
    ]);

    expect(summary.grandTotal).toBe(4);
    expect(summary.totalsByCategory["Chat (m)"]).toBe(2);
    expect(summary.totalsByCategory["Image Generation (m)"]).toBe(2);
    expect(summary.agentCount).toBe(2);
    expect(summary.activeAgentCount).toBe(1);
    expect(summary.agents.map(a => a.agentId)).toEqual(["a1", "a2"]);

    expect(summary.tokens.totalInputTokens).toBe(120);
    expect(summary.tokens.totalOutputTokens).toBe(60);
    expect(summary.tokens.totalCachedTokens).toBe(10);
    expect(summary.tokens.totalReasoningTokens).toBe(5);

    expect(summary.latency.requestCount).toBe(3);
    expect(summary.latency.avgElapsedMs).toBeCloseTo((200 * 2 + 100) / 3);
    expect(summary.latency.p50ElapsedMs).toBeCloseTo((180 * 2 + 90) / 3);
    expect(summary.latency.p95ElapsedMs).toBeCloseTo((300 * 2 + 150) / 3);
    expect(summary.latency.p99ElapsedMs).toBeCloseTo((400 * 2 + 180) / 3);

    expect(summary.errors.errorsByProvider.openai).toBe(1);
    expect(summary.errors.retryCount).toBe(2);

    expect(summary.activity.totalSteps).toBe(4);
    expect(summary.activity.totalToolCalls).toBe(5);
    expect(summary.activity.toolCallsByName.read_file).toBe(4);
    expect(summary.activity.toolCallsByName.search).toBe(1);
  });

  test("handles empty agent list", () => {
    const summary = aggregateCostSummary([]);
    expect(summary.grandTotal).toBe(0);
    expect(summary.agentCount).toBe(0);
    expect(summary.activeAgentCount).toBe(0);
    expect(summary.agents).toEqual([]);
    expect(summary.totalsByCategory).toEqual({});
    expect(summary.tokens.totalInputTokens).toBe(0);
    expect(summary.latency.requestCount).toBe(0);
    expect(summary.activity.totalSteps).toBe(0);
  });

  test("aggregates tokens per model category and TTFT percentiles", () => {
    const usage = (input: number, output: number) => ({
      totalInputTokens: input,
      totalOutputTokens: output,
      totalCachedTokens: 0,
      totalReasoningTokens: 0,
    });
    const latency = (ttft: number) => ({
      requestCount: 1,
      avgElapsedMs: 100,
      avgTimeToFirstTokenMs: ttft,
      avgTokensPerSecond: 0,
      p50TimeToFirstTokenMs: ttft,
      p95TimeToFirstTokenMs: ttft * 2,
      p99TimeToFirstTokenMs: ttft * 3,
    });
    const summary = aggregateCostSummary([
      agent({ agentId: "a", total: 0, costs: {}, tokensByCategory: { "Chat (x)": usage(10, 1), "Chat (y)": usage(5, 5) }, latency: latency(100) }),
      agent({ agentId: "b", total: 0, costs: {}, tokensByCategory: { "Chat (x)": usage(20, 2) }, latency: latency(300) }),
    ]);
    expect(summary.tokensByCategory["Chat (x)"]).toEqual(usage(30, 3));
    expect(summary.tokensByCategory["Chat (y)"]).toEqual(usage(5, 5));
    expect(summary.latency.p50TimeToFirstTokenMs).toBe(200);
    expect(summary.latency.p99TimeToFirstTokenMs).toBe(600);
  });
});

describe("agentCostsFromMetrics", () => {
  test("projects a stored record, including TTFT percentiles", () => {
    const metrics = AgentMetricsDataSchema.parse({
      costs: { "Chat (x)": 0.5 },
      tokensByCategory: { "Chat (x)": { totalInputTokens: 7 } },
      latency: {
        requestCount: 2,
        totalElapsedMs: 400,
        recentElapsedMs: [100, 300],
        recentTimeToFirstTokenMs: [50, 150],
        timeToFirstTokenCount: 2,
        totalTimeToFirstTokenMs: 200,
      },
    });
    const row = agentCostsFromMetrics(metrics, { agentId: "z", displayName: "Z", agentType: "code", idle: true });
    expect(row.total).toBe(0.5);
    expect(row.tokensByCategory["Chat (x)"]?.totalInputTokens).toBe(7);
    expect(row.latency.p50TimeToFirstTokenMs).toBe(100);
    expect(row.latency.p99TimeToFirstTokenMs).toBeCloseTo(149);
    expect(row.latency.p99ElapsedMs).toBeCloseTo(298);
  });

  test("returns empty metrics for an agent without state", () => {
    const row = agentCostsFromMetrics(null, { agentId: "n", displayName: "N", agentType: "code", idle: true });
    expect(row.total).toBe(0);
    expect(row.tokensByCategory).toEqual({});
  });
});
