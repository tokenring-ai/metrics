import type Agent from "@tokenring-ai/agent/Agent";
import type { TokenRingService } from "@tokenring-ai/app/types";
import type { z } from "zod";
import type {
  AgentMetricsData,
  AgentMetricsListItem,
  ErrorRecordInput,
  LatencySampleInput,
  MetricsStorage,
  StoredAgentMetrics,
  TokenUsageInput,
} from "./MetricsStorage.ts";
import { emptyAgentMetricsData } from "./MetricsStorage.ts";
import { MetricsServiceConfigSchema } from "./schema.ts";
import { CostTrackingState } from "./state/costTrackingState.ts";

type MetricsServiceConfig = z.output<typeof MetricsServiceConfigSchema>;

export default class MetricsService implements TokenRingService {
  readonly name = "MetricsService";
  description = "Collects metrics about the agent's performance.";

  metricsProvider: MetricsStorage | null = null;

  private options = MetricsServiceConfigSchema.parse({});

  constructor(options?: MetricsServiceConfig) {
    if (options) this.options = options;
  }

  reconfigure(options: MetricsServiceConfig): void {
    this.options = options;
  }

  start(): void {
    if (!this.metricsProvider) {
      // Soft warning only — metrics still work in-memory without persistence.
      console.warn(`[${this.name}] No MetricsStorage provider registered; metrics will not be persisted`);
    }
  }

  attach(agent: Agent): void {
    agent.initializeState(CostTrackingState, {});
    void this.hydrateFromStorage(agent);
  }

  setMetricsProvider(provider: MetricsStorage): void {
    this.metricsProvider = provider;
  }

  // ── Cost (existing) ──────────────────────────────────────────────────────

  addCost(category: string, amount: number, agent: Agent): void {
    agent.mutateState(CostTrackingState, state => {
      state.addCost(category, amount);
    });
    this.schedulePersist(agent);
  }

  // ── Token usage (§1.1) ───────────────────────────────────────────────────

  /**
   * Record token usage for an agent.
   * Accepts LanguageModelUsage-compatible objects or flattened totals.
   */
  addUsage(usage: TokenUsageInput, agent: Agent, category?: string): void {
    agent.mutateState(CostTrackingState, state => {
      state.addUsage(usage, category);
    });
    this.schedulePersist(agent);
  }

  // ── Latency & throughput (§1.2) ──────────────────────────────────────────

  /**
   * Record a request latency sample.
   * Prefer AIResponseTiming fields: elapsedMs, tokensPerSec (as tokensPerSecond), and optional TTFT.
   */
  addLatency(sample: LatencySampleInput, agent: Agent): void {
    agent.mutateState(CostTrackingState, state => {
      state.addLatency(sample);
    });
    this.schedulePersist(agent);
  }

  // ── Errors & retries (§1.3) ──────────────────────────────────────────────

  recordError(agent: Agent, record: ErrorRecordInput = {}): void {
    agent.mutateState(CostTrackingState, state => {
      state.recordError(record);
    });
    this.schedulePersist(agent);
  }

  addRetries(count: number, agent: Agent): void {
    agent.mutateState(CostTrackingState, state => {
      state.addRetries(count);
    });
    this.schedulePersist(agent);
  }

  // ── Steps & tool calls (§1.4) ────────────────────────────────────────────

  addSteps(agent: Agent, count = 1): void {
    agent.mutateState(CostTrackingState, state => {
      state.addSteps(count);
    });
    this.schedulePersist(agent);
  }

  addToolCalls(agent: Agent, toolName?: string, count = 1): void {
    agent.mutateState(CostTrackingState, state => {
      state.addToolCalls(toolName, count);
    });
    this.schedulePersist(agent);
  }

  // ── Reset ────────────────────────────────────────────────────────────────

  resetAgentMetrics(agent: Agent): void {
    agent.mutateState(CostTrackingState, state => {
      state.reset();
    });
    if (this.metricsProvider) {
      void Promise.resolve(this.metricsProvider.deleteAgentMetrics(agent.id)).catch((err: unknown) => {
        console.warn(`[${this.name}] Failed to delete persisted metrics for ${agent.id}:`, err);
      });
    }
  }

  // ── Storage helpers ──────────────────────────────────────────────────────

  async persistAgentMetrics(agent: Agent): Promise<void> {
    if (!this.metricsProvider) return;

    let metrics: AgentMetricsData;
    try {
      metrics = agent.getState(CostTrackingState).toMetricsData();
    } catch {
      metrics = emptyAgentMetricsData();
    }

    await this.metricsProvider.storeAgentMetrics({
      agentId: agent.id,
      metrics,
      updatedAt: Date.now(),
    });
  }

  async retrieveAgentMetrics(agentId: string): Promise<StoredAgentMetrics | null> {
    if (!this.metricsProvider) return null;
    return this.metricsProvider.retrieveAgentMetrics(agentId);
  }

  async listAgentMetrics(): Promise<AgentMetricsListItem[]> {
    if (!this.metricsProvider) return [];
    return this.metricsProvider.listAgentMetrics();
  }

  private schedulePersist(agent: Agent): void {
    if (!this.metricsProvider) return;
    void this.persistAgentMetrics(agent).catch(err => {
      console.warn(`[${this.name}] Failed to persist metrics for ${agent.id}:`, err);
    });
  }

  private async hydrateFromStorage(agent: Agent): Promise<void> {
    if (!this.metricsProvider) return;
    try {
      const stored = await this.metricsProvider.retrieveAgentMetrics(agent.id);
      if (!stored) return;
      agent.mutateState(CostTrackingState, state => {
        // Only hydrate when session state is still empty so we don't clobber
        // checkpoint-restored or already-accumulated session metrics.
        const hasCosts = Object.keys(state.costs).length > 0;
        const hasTokens =
          state.tokens.totalInputTokens > 0 ||
          state.tokens.totalOutputTokens > 0 ||
          state.tokens.totalCachedTokens > 0 ||
          state.tokens.totalReasoningTokens > 0;
        const hasActivity = state.activity.totalSteps > 0 || state.activity.totalToolCalls > 0;
        if (hasCosts || hasTokens || hasActivity || state.latency.requestCount > 0) return;
        state.loadFromMetrics(stored.metrics);
      });
    } catch (err) {
      console.warn(`[${this.name}] Failed to hydrate metrics for ${agent.id}:`, err);
    }
  }
}
