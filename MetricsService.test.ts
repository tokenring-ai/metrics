import { describe, expect, test } from "bun:test";
import type Agent from "@tokenring-ai/agent/Agent";
import MetricsService from "./MetricsService.ts";
import type { AgentMetrics, AgentMetricsListItem, MetricsStorage, StoredAgentMetrics } from "./MetricsStorage.ts";
import { CostTrackingState } from "./state/costTrackingState.ts";

function createMockAgent(id = "agent-1"): Agent {
  const states = new Map<string, unknown>();
  const agent = {
    id,
    displayName: `Agent ${id}`,
    config: { agentType: "code" },
    initializeState(Slice: new (args: unknown) => CostTrackingState, args: unknown) {
      const state = new Slice(args);
      states.set(state.name, state);
    },
    mutateState(_Slice: typeof CostTrackingState, mutator: (state: CostTrackingState) => void) {
      const state = states.get("CostTrackingState") as CostTrackingState | undefined;
      if (!state) throw new Error("CostTrackingState not initialized");
      mutator(state);
    },
    getState(_Slice: typeof CostTrackingState) {
      const state = states.get("CostTrackingState") as CostTrackingState | undefined;
      if (!state) throw new Error("CostTrackingState not initialized");
      return state;
    },
  };
  return agent as unknown as Agent;
}

function createMemoryStorage(): MetricsStorage & { store: Map<string, StoredAgentMetrics> } {
  const store = new Map<string, StoredAgentMetrics>();
  return {
    displayName: "memory",
    store,
    async storeAgentMetrics(data: AgentMetrics) {
      store.set(data.agentId, {
        agentId: data.agentId,
        metrics: data.metrics as StoredAgentMetrics["metrics"],
        updatedAt: data.updatedAt,
      });
    },
    async retrieveAgentMetrics(agentId: string) {
      return store.get(agentId) ?? null;
    },
    async listAgentMetrics(): Promise<AgentMetricsListItem[]> {
      return [...store.values()].map(row => ({
        agentId: row.agentId,
        totalCost: Object.values(row.metrics.costs).reduce((a, b) => a + b, 0),
        totalInputTokens: row.metrics.tokens.totalInputTokens,
        totalOutputTokens: row.metrics.tokens.totalOutputTokens,
        requestCount: row.metrics.latency.requestCount,
        totalSteps: row.metrics.activity.totalSteps,
        totalToolCalls: row.metrics.activity.totalToolCalls,
        updatedAt: row.updatedAt,
      }));
    },
    async deleteAgentMetrics(agentId: string) {
      store.delete(agentId);
    },
  };
}

describe("CostTrackingState", () => {
  test("tracks costs, usage, latency, errors, and activity", () => {
    const state = new CostTrackingState();
    state.addCost("Chat (openai:gpt)", 0.01);
    state.addUsage(
      {
        inputTokens: 100,
        outputTokens: 50,
        inputTokenDetails: { cacheReadTokens: 10 },
        outputTokenDetails: { reasoningTokens: 5 },
      },
      "Chat (openai:gpt)",
    );
    state.addLatency({ elapsedMs: 200, timeToFirstTokenMs: 40, tokensPerSecond: 25 });
    state.recordError({ provider: "openai", type: "rateLimit", retries: 2 });
    state.addSteps(3);
    state.addToolCalls("read_file", 2);

    expect(state.costs["Chat (openai:gpt)"]).toBe(0.01);
    expect(state.tokens.totalInputTokens).toBe(100);
    expect(state.tokens.totalOutputTokens).toBe(50);
    expect(state.tokens.totalCachedTokens).toBe(10);
    expect(state.tokens.totalReasoningTokens).toBe(5);
    expect(state.tokensByCategory["Chat (openai:gpt)"]?.totalInputTokens).toBe(100);
    expect(state.latency.requestCount).toBe(1);
    expect(state.latency.totalElapsedMs).toBe(200);
    expect(state.errors.errorsByProvider.openai).toBe(1);
    expect(state.errors.errorsByType.rateLimit).toBe(1);
    expect(state.errors.retryCount).toBe(2);
    expect(state.activity.totalSteps).toBe(3);
    expect(state.activity.totalToolCalls).toBe(2);
    expect(state.activity.toolCallsByName.read_file).toBe(2);
  });

  test("deserialize is backward compatible with costs-only data", () => {
    const state = new CostTrackingState();
    state.deserialize({ costs: { Chat: 1.5 } } as never);
    expect(state.costs.Chat).toBe(1.5);
    expect(state.tokens.totalInputTokens).toBe(0);
    expect(state.activity.totalSteps).toBe(0);
  });

  test("reset clears all metrics", () => {
    const state = new CostTrackingState({ Chat: 1 });
    state.addSteps(5);
    state.reset();
    expect(state.costs).toEqual({});
    expect(state.activity.totalSteps).toBe(0);
  });
});

describe("MetricsService", () => {
  test("tracks metrics in agent state and persists via storage provider", async () => {
    const service = new MetricsService();
    const storage = createMemoryStorage();
    service.setMetricsProvider(storage);

    const agent = createMockAgent("agent-42");
    service.attach(agent);

    service.addCost("Chat", 0.02, agent);
    service.addUsage({ inputTokens: 10, outputTokens: 5 }, agent, "Chat");
    service.addLatency({ elapsedMs: 100, tokensPerSecond: 50 }, agent);
    service.recordError(agent, { provider: "anthropic", type: "timeout" });
    service.addSteps(agent, 1);
    service.addToolCalls(agent, "search", 1);

    // Allow fire-and-forget persist to flush.
    await service.persistAgentMetrics(agent);

    const stored = await storage.retrieveAgentMetrics("agent-42");
    expect(stored).not.toBeNull();
    expect(stored!.metrics.costs.Chat).toBe(0.02);
    expect(stored!.metrics.tokens.totalInputTokens).toBe(10);
    expect(stored!.metrics.latency.requestCount).toBe(1);
    expect(stored!.metrics.errors.errorsByProvider.anthropic).toBe(1);
    expect(stored!.metrics.activity.toolCallsByName.search).toBe(1);

    const listed = await service.listAgentMetrics();
    expect(listed).toHaveLength(1);
    expect(listed[0]!.agentId).toBe("agent-42");
    expect(listed[0]!.totalCost).toBe(0.02);

    // Identity is stamped on persist so History can name agents after they exit.
    expect(stored!.metrics.identity).toEqual({ displayName: "Agent agent-42", agentType: "code" });
    // Every cost, usage and latency sample lands in the spend time series.
    const hourly = stored!.metrics.spendHistory.hourly;
    expect(hourly).toHaveLength(1);
    expect(hourly[0]!.cost).toBeCloseTo(0.02);
    expect(hourly[0]!.inputTokens).toBe(10);
    expect(hourly[0]!.requests).toBe(1);
  });

  test("resetAllAgentMetrics resets every live agent", () => {
    const service = new MetricsService();
    const a = createMockAgent("a");
    const b = createMockAgent("b");
    service.attach(a);
    service.attach(b);
    service.addCost("Chat", 1, a);
    service.addCost("Chat", 2, b);

    expect(service.resetAllAgentMetrics([a, b])).toBe(2);
    expect(a.getState(CostTrackingState).costs).toEqual({});
    expect(b.getState(CostTrackingState).spendHistory.hourly).toEqual([]);
  });

  test("listAllAgentMetrics falls back to [] when the provider cannot list full records", async () => {
    const service = new MetricsService();
    expect(await service.listAllAgentMetrics()).toEqual([]);
    const storage = createMemoryStorage();
    service.setMetricsProvider(storage);
    expect(service.hasPersistence).toBe(true);
    expect(await service.listAllAgentMetrics()).toEqual([]);
  });

  test("resetAgentMetrics clears state and deletes storage row", async () => {
    const service = new MetricsService();
    const storage = createMemoryStorage();
    service.setMetricsProvider(storage);

    const agent = createMockAgent("agent-reset");
    service.attach(agent);
    service.addCost("Chat", 1, agent);
    await service.persistAgentMetrics(agent);
    expect(storage.store.has("agent-reset")).toBe(true);

    service.resetAgentMetrics(agent);
    // wait for delete
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(agent.getState(CostTrackingState).costs).toEqual({});
    expect(storage.store.has("agent-reset")).toBe(false);
  });

  test("works without a storage provider", () => {
    const service = new MetricsService();
    const agent = createMockAgent();
    service.attach(agent);
    service.addCost("Chat", 0.5, agent);
    expect(agent.getState(CostTrackingState).costs.Chat).toBe(0.5);
  });
});
