import { AgentStateSlice } from "@tokenring-ai/agent/types";
import deepClone from "@tokenring-ai/utility/object/deepClone";
import markdownList from "@tokenring-ai/utility/string/markdownList";
import { z } from "zod";
import {
  type ActivityMetrics,
  ActivityMetricsSchema,
  type AgentMetricsData,
  AgentMetricsDataSchema,
  addTokenTotals,
  type ErrorMetrics,
  ErrorMetricsSchema,
  type ErrorRecordInput,
  type LatencyMetrics,
  LatencyMetricsSchema,
  type LatencySampleInput,
  latencySummary,
  normalizeTokenUsageInput,
  pushBoundedSample,
  type TokenUsageByCategory,
  TokenUsageByCategorySchema,
  type TokenUsageInput,
  type TokenUsageTotals,
  TokenUsageTotalsSchema,
} from "../MetricsStorage.ts";

type Costs = Record<string, number>;

const serializationSchema = z
  .object({
    costs: z.record(z.string(), z.number()).default({}),
    tokens: TokenUsageTotalsSchema,
    tokensByCategory: TokenUsageByCategorySchema.default({}),
    latency: LatencyMetricsSchema,
    errors: ErrorMetricsSchema,
    activity: ActivityMetricsSchema,
  })
  .prefault({});

export class CostTrackingState extends AgentStateSlice<typeof serializationSchema> {
  costs: Costs;
  tokens: TokenUsageTotals;
  tokensByCategory: TokenUsageByCategory;
  latency: LatencyMetrics;
  errors: ErrorMetrics;
  activity: ActivityMetrics;

  constructor(readonly initialCosts: Costs = {}) {
    super("CostTrackingState", serializationSchema);
    this.costs = deepClone(initialCosts);
    this.tokens = TokenUsageTotalsSchema.parse({});
    this.tokensByCategory = {};
    this.latency = LatencyMetricsSchema.parse({});
    this.errors = ErrorMetricsSchema.parse({});
    this.activity = ActivityMetricsSchema.parse({});
  }

  reset(): void {
    this.costs = {};
    this.tokens = TokenUsageTotalsSchema.parse({});
    this.tokensByCategory = {};
    this.latency = LatencyMetricsSchema.parse({});
    this.errors = ErrorMetricsSchema.parse({});
    this.activity = ActivityMetricsSchema.parse({});
  }

  addCost(category: string, amount: number): void {
    this.costs[category] = (this.costs[category] ?? 0) + amount;
  }

  addUsage(usage: TokenUsageInput, category?: string): void {
    const delta = normalizeTokenUsageInput(usage);
    this.tokens = addTokenTotals(this.tokens, delta);
    if (category) {
      const existing = this.tokensByCategory[category] ?? TokenUsageTotalsSchema.parse({});
      this.tokensByCategory[category] = addTokenTotals(existing, delta);
    }
  }

  addLatency(sample: LatencySampleInput): void {
    this.latency.requestCount += 1;
    this.latency.totalElapsedMs += sample.elapsedMs;
    this.latency.recentElapsedMs = pushBoundedSample(this.latency.recentElapsedMs, sample.elapsedMs);

    if (sample.timeToFirstTokenMs !== undefined) {
      this.latency.totalTimeToFirstTokenMs += sample.timeToFirstTokenMs;
      this.latency.timeToFirstTokenCount += 1;
      this.latency.recentTimeToFirstTokenMs = pushBoundedSample(this.latency.recentTimeToFirstTokenMs, sample.timeToFirstTokenMs);
    }

    if (sample.tokensPerSecond !== undefined) {
      this.latency.totalTokensPerSecond += sample.tokensPerSecond;
      this.latency.tokensPerSecondCount += 1;
    }
  }

  recordError(record: ErrorRecordInput = {}): void {
    if (record.provider) {
      this.errors.errorsByProvider[record.provider] = (this.errors.errorsByProvider[record.provider] ?? 0) + 1;
    }
    if (record.type) {
      this.errors.errorsByType[record.type] = (this.errors.errorsByType[record.type] ?? 0) + 1;
    }
    if (record.retries !== undefined && record.retries > 0) {
      this.errors.retryCount += record.retries;
    }
  }

  addRetries(count: number): void {
    this.errors.retryCount += count;
  }

  addSteps(count = 1): void {
    this.activity.totalSteps += count;
  }

  addToolCalls(toolName?: string, count = 1): void {
    this.activity.totalToolCalls += count;
    if (toolName) {
      this.activity.toolCallsByName[toolName] = (this.activity.toolCallsByName[toolName] ?? 0) + count;
    }
  }

  /** Replace in-memory metrics with a previously stored aggregate. */
  loadFromMetrics(data: AgentMetricsData): void {
    const parsed = AgentMetricsDataSchema.parse(data);
    this.costs = { ...parsed.costs };
    this.tokens = { ...parsed.tokens };
    this.tokensByCategory = deepClone(parsed.tokensByCategory);
    this.latency = deepClone(parsed.latency);
    this.errors = deepClone(parsed.errors);
    this.activity = deepClone(parsed.activity);
  }

  toMetricsData(): AgentMetricsData {
    return AgentMetricsDataSchema.parse({
      costs: this.costs,
      tokens: this.tokens,
      tokensByCategory: this.tokensByCategory,
      latency: this.latency,
      errors: this.errors,
      activity: this.activity,
    });
  }

  serialize(): z.output<typeof serializationSchema> {
    return this.toMetricsData();
  }

  deserialize(data: z.output<typeof serializationSchema>): void {
    // Backward compatible: older checkpoints only had `costs`.
    const parsed = serializationSchema.parse(data);
    this.costs = { ...parsed.costs };
    this.tokens = { ...parsed.tokens };
    this.tokensByCategory = deepClone(parsed.tokensByCategory);
    this.latency = deepClone(parsed.latency);
    this.errors = deepClone(parsed.errors);
    this.activity = deepClone(parsed.activity);
  }

  show(): string {
    const totalCost = Object.values(this.costs).reduce((a, b) => a + b, 0);
    const latency = latencySummary(this.latency);
    const lines = [
      `Overall Costs: $${totalCost.toLocaleString(undefined, { minimumFractionDigits: 4 })}`,
      ...Object.entries(this.costs).map(([key, value]) => `${key} Cost: $${value.toLocaleString(undefined, { minimumFractionDigits: 4 })}`),
      `Tokens: in=${this.tokens.totalInputTokens} out=${this.tokens.totalOutputTokens} cached=${this.tokens.totalCachedTokens} reasoning=${this.tokens.totalReasoningTokens}`,
      `Latency: requests=${latency.requestCount} avgMs=${latency.avgElapsedMs.toFixed(1)} p95Ms=${latency.p95ElapsedMs?.toFixed(1) ?? "n/a"}`,
      `Errors: providers=${Object.values(this.errors.errorsByProvider).reduce((a, b) => a + b, 0)} retries=${this.errors.retryCount}`,
      `Activity: steps=${this.activity.totalSteps} toolCalls=${this.activity.totalToolCalls}`,
    ];
    return `${lines[0]}\n${markdownList(lines.slice(1))}`;
  }
}
