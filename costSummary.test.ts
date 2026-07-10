import { describe, expect, test } from "bun:test";
import { aggregateCostSummary } from "./costSummary.ts";
import type { AgentCosts } from "./rpc/schema.ts";

function agent(partial: Partial<AgentCosts> & Pick<AgentCosts, "agentId" | "total" | "costs">): AgentCosts {
  return {
    displayName: partial.displayName ?? partial.agentId,
    agentType: partial.agentType ?? "code",
    idle: partial.idle ?? true,
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
      }),
      agent({
        agentId: "a2",
        total: 1,
        costs: { "Chat (m)": 1 },
      }),
    ]);

    expect(summary.grandTotal).toBe(4);
    expect(summary.totalsByCategory["Chat (m)"]).toBe(2);
    expect(summary.totalsByCategory["Image Generation (m)"]).toBe(2);
    expect(summary.agentCount).toBe(2);
    expect(summary.activeAgentCount).toBe(1);
    expect(summary.agents.map(a => a.agentId)).toEqual(["a1", "a2"]);
  });

  test("handles empty agent list", () => {
    const summary = aggregateCostSummary([]);
    expect(summary.grandTotal).toBe(0);
    expect(summary.agentCount).toBe(0);
    expect(summary.activeAgentCount).toBe(0);
    expect(summary.agents).toEqual([]);
    expect(summary.totalsByCategory).toEqual({});
  });
});
