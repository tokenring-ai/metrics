import { describe, expect, test } from "bun:test";
import { aggregateCostSummary } from "./costSummary.ts";
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
        latency: { requestCount: 2, avgElapsedMs: 200, avgTimeToFirstTokenMs: 40, avgTokensPerSecond: 30 },
        errors: { errorsByProvider: { openai: 1 }, errorsByType: { timeout: 1 }, retryCount: 2 },
        activity: { totalSteps: 3, totalToolCalls: 4, toolCallsByName: { read_file: 4 } },
      }),
      agent({
        agentId: "a2",
        total: 1,
        costs: { "Chat (m)": 1 },
        tokens: { totalInputTokens: 20, totalOutputTokens: 10, totalCachedTokens: 0, totalReasoningTokens: 0 },
        latency: { requestCount: 1, avgElapsedMs: 100, avgTimeToFirstTokenMs: 20, avgTokensPerSecond: 20 },
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
});
