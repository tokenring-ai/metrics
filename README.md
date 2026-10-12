# @tokenring-ai/metrics

## Overview

Metrics tracking package for TokenRing that provides comprehensive cost
tracking and performance metrics for AI agents. This package integrates with
the TokenRing agent system to collect, persist, and display metrics about agent
operations including AI chat costs, image generation costs, and other resource
usage.

## Key Features

- **Cost Tracking**: Sum and track costs by category (AI Chat, Image
  Generation, Web Search, etc.)
- **State Persistence**: Costs are persisted across sessions using the agent's
  state management system
- **Agent Integration**: Seamlessly integrates with TokenRing agents via the
  `MetricsService`
- **Command Interface**: Provides `/costs` command to display current cost
  metrics
- **RPC Endpoints**: Query and stream cost summaries for dashboard integration
- **Spend over time**: Every cost, token and request sample is bucketed per
  agent (5-minute buckets for a day, hourly buckets for 31 days) and summed
  across live and stored agents for 1h / 24h / 7d / 30d charts
- **Cross-session history**: Persisted metrics (via a `MetricsStorage`
  provider such as `@tokenring-ai/bun-storage`) are listed alongside running
  agents, each stamped with the agent's name and type
- **Per-model tokens**: Input / output / cached / reasoning tokens per cost
  category (one per model), next to that category's cost
- **Latency percentiles**: p50 / p95 / p99 request time and time to first
  token, over each agent's last 100 requests
- **Metrics dashboard**: Overview, Agent spend (CSV export, per-agent and
  global reset), History (sortable, CSV export) and a per-agent detail view
- **Type-Safe**: Fully typed with TypeScript and Zod schemas
- **Plugin Architecture**: Installable as a TokenRing plugin for easy
  integration

## Installation

```bash
bun add @tokenring-ai/metrics
```

## Chat Commands

| Command | Description |
|---------|-------------|
| `/costs` | Displays total costs incurred by the Agent |

### `/costs`

Displays total costs incurred by the Agent, including AI Chat, Image
Generation, and Web Search costs.

**Output Format:**

```text
Overall Costs: $0.0475
 - AI Chat Cost: $0.0025
 - Image Generation Cost: $0.0350
 - Web Search Cost: $0.0100
```

**Notes:**

- Costs are summed from the beginning of the current session until the current
  time
- Costs are displayed in USD with a minimum of 4 decimal places
- Categories are dynamically tracked based on what costs are added

## Tools

No tools defined in this package.

## Configuration

The package accepts a configuration object via the plugin or service
constructor. The current schema is empty, designed for future extensibility.

### Environment Variables

This package does not require any environment variables.

### Sample Configuration

```yaml
metrics: {}
```

The configuration is validated using the Zod schema
`MetricsServiceConfigSchema`.

## Core Components

### CostTrackingState

State slice for tracking costs across sessions.

**Location**: `state/costTrackingState.ts`

**Purpose**: Persists cost data in the agent's state with
serialization/deserialization support.

**Properties:**

- `costs: Record<string, number>` - Map of cost categories to amounts

**Constructor:**

```typescript
constructor(readonly initialCosts: Costs = {})
```

The `initialCosts` parameter provides seed cost data at construction time and is
deep-cloned into the `costs` property.

**Methods:**

```typescript
class CostTrackingState extends AgentStateSlice<typeof serializationSchema> {
  costs: Costs;

  constructor(readonly initialCosts: Costs = {});

  /**
   * Clear all costs by resetting the costs record to an empty object
   */
  reset(): void;

  /**
   * Serialize state for persistence
   */
  serialize(): { costs: Record<string, number> };

  /**
   * Deserialize state from persisted data
   */
  deserialize(data: { costs: Record<string, number> }): void;

  /**
   * Display costs as a formatted string
   * @returns Formatted cost string with overall total and per-category
   *          breakdown
   */
  show(): string;
}
```

### Cost Summary Helpers

Utility functions for reading and aggregating agent cost data.

**Location**: `costSummary.ts`

#### `readAgentCosts(agent: Agent): AgentCosts`

Reads the current cost tracking state from an agent and returns an
`AgentCosts` object. Handles cases where the state may not be initialized.

```typescript
import { readAgentCosts } from "@tokenring-ai/metrics/costSummary";

const costs = readAgentCosts(agent);
// { agentId, displayName, agentType, idle, costs, total }
```

#### `aggregateCostSummary(agentCosts: AgentCosts[]): CostSummary`

Aggregates cost data from multiple agents into a single `CostSummary`. Agents
are sorted by total cost (descending).

```typescript
import { aggregateCostSummary } from "@tokenring-ai/metrics/costSummary";

const allAgentCosts = agents.map(a => readAgentCosts(a));
const summary = aggregateCostSummary(allAgentCosts);
// { agents, totalsByCategory, grandTotal, agentCount, activeAgentCount }
```

### RPC Schema

Zod schemas for RPC communication.

**Location**: `rpc/schema.ts`

- `AgentCostsSchema` - Schema for individual agent cost data
- `CostSummarySchema` - Schema for aggregated cost summary

## Services

### MetricsService

The core service that collects and manages metrics data. Implements the
`TokenRingService` interface.

**Location**: `MetricsService.ts`

**Purpose**: Collects metrics about the agent's performance, particularly cost
tracking.

```typescript
class MetricsService implements TokenRingService {
  readonly name = "MetricsService";
  description = "Collects metrics about the agent's performance.";

  constructor(options?: MetricsServiceConfig);

  /**
   * Update configuration at runtime (called by the plugin system when
   * configuration changes)
   */
  reconfigure(options: MetricsServiceConfig): void;

  /**
   * Attach the service to an agent and initialize cost tracking state
   */
  attach(agent: Agent): void;

  /**
   * Add a cost entry for a specific category
   * @param category - The cost category (e.g., 'AI Chat', 'Image Generation')
   * @param amount - The cost amount in USD
   * @param agent - The agent instance to update
   */
  addCost(category: string, amount: number, agent: Agent): void;
}
```

**State Management:**

- State is initialized when the agent attaches the `MetricsService`
- Costs are automatically persisted through the agent's state system
- State is included in agent checkpoints for recovery
- Costs accumulate within a session and can be reset with `reset()`

## RPC Endpoints

Registered at `/rpc/metrics` when `RpcService` is available:

| Method | Type | Description |
|--------|------|-------------|
| `getCostSummary` | query | Snapshot of all agent costs and category totals |
| `streamCostSummary` | stream | Live updates (~2s poll) of the cost summary |
| `getAgentCosts` | query | Costs for a single agent by `agentId` |
| `resetAgentCosts` | mutation | Clear cost counters for one agent |
| `resetAllAgentCosts` | mutation | Clear counters for every running agent; returns `{ status, resetCount }` |
| `getSpendSeries` | query | `{ range: "1h" \| "24h" \| "7d" \| "30d" }` → bucketed cost / tokens / requests |
| `listAgentMetricsHistory` | query | Running and stored agents with totals; `persisted: false` when no storage |
| `getAgentMetricsHistory` | query | Full `AgentCosts` breakdown for a running or stored agent |

### Spend series buckets

| Range | Bucket | Source resolution |
|-------|--------|-------------------|
| `1h` | 5 minutes (12) | `spendHistory.fine` |
| `24h` | 1 hour (24) | `spendHistory.hourly` |
| `7d` | 6 hours (28) | `spendHistory.hourly` |
| `30d` | 1 day (30) | `spendHistory.hourly` |

Buckets are aligned to UTC epoch multiples and empty buckets are included, so
the chart has a stable x axis. Live agents contribute their in-memory history;
stored agents that are no longer running contribute their persisted history
(requires a provider implementing the optional
`MetricsStorage.listAllAgentMetrics()`). Spend recorded before this feature
existed has no timestamps and is not charted.

### `getAgentCosts` and `resetAgentCosts` Result Types

Both methods return a discriminated union on `status`:

- `{ status: "success", agent: AgentCosts }` (for `getAgentCosts`) or
  `{ status: "success" }` (for `resetAgentCosts`) when the agent is found
- `{ status: "agentNotFound" }` when no agent matches the given `agentId`

### RPC Schema Types

#### AgentCosts

Represents cost data for a single agent:

```typescript
interface AgentCosts {
  agentId: string;
  displayName: string;
  agentType: string;
  idle: boolean;
  costs: Record<string, number>;
  total: number;
  tokens: TokenUsageTotals;
  /** Token totals per cost category (per model). */
  tokensByCategory: Record<string, TokenUsageTotals>;
  /** avg / p50 / p95 / p99 request time and time to first token. */
  latency: LatencySummary;
  errors: ErrorMetricsSummary;
  activity: ActivityMetricsSummary;
}
```

#### CostSummary

Aggregated cost summary across all agents:

```typescript
interface CostSummary {
  agents: AgentCosts[];
  totalsByCategory: Record<string, number>;
  grandTotal: number;
  agentCount: number;
  activeAgentCount: number;
  tokens: TokenUsageTotals;
  tokensByCategory: Record<string, TokenUsageTotals>;
  latency: LatencySummary; // request-weighted mean of per-agent percentiles
  errors: ErrorMetricsSummary;
  activity: ActivityMetricsSummary;
}
```

## Frontend

The Metrics dashboard (`/metrics`, `frontend/app.tsx`) contributes these views:

| View id | Content |
|---------|---------|
| `metrics-cost-summary` | Compact cost card for the Home dashboard |
| `metrics-overview` | Totals, latency percentiles, spend-over-time chart (range + cost/tokens toggle), spend mix, tokens-by-model table, categories |
| `metrics-agents` | Running agents with filters, sort, expandable breakdown, per-agent reset, **Reset all** (confirmed) and **CSV** export of the shown rows |
| `metrics-history` | Every agent with stored or live metrics, sortable columns, search and **CSV** export; a row opens the detail view |
| `metrics-agent-detail` | Instanceable (`{ agentId }`): full breakdown for one running or stored agent |

Charts are drawn with plain CSS bars, like the rest of the views. Hooks for
the non-streaming RPC methods live in `frontend/lib/metricsQueries.ts`; CSV
building (RFC 4180 quoting, formula-injection guard) in `frontend/lib/csv.ts`.

## Exports

| Export | Description |
|--------|-------------|
| `MetricsService` | Core metrics service class (default export) |
| `AgentCosts` | Type for individual agent cost data |
| `CostSummary` | Type for aggregated cost summary |
| `CostTrackingState` | Agent state slice for cost tracking |

## Usage Examples

### Plugin Registration

Install the plugin in your TokenRing application:

```typescript
import metricsPlugin from "@tokenring-ai/metrics/plugin";

app.install(metricsPlugin, {
  metrics: {}, // Empty config, can be extended
});
```

### Manual Service Registration

```typescript
import { MetricsService } from "@tokenring-ai/metrics";

app.addService(new MetricsService());
```

### Adding Costs

```typescript
// In your service or tool implementation
metricsService.addCost("AI Chat", 0.0025, agent);
metricsService.addCost("Image Generation", 0.035, agent);
metricsService.addCost("Web Search", 0.01, agent);
```

### Retrieving Costs

```typescript
import { CostTrackingState } from "@tokenring-ai/metrics";

// Get cost tracking state from agent
const costState = agent.getState(CostTrackingState);

// Display formatted costs
console.log(costState.show());

// Output:
// Overall Costs: $0.0475
//  - AI Chat Cost: $0.0025
//  - Image Generation Cost: $0.0350
//  - Web Search Cost: $0.0100
```

### Resetting Costs

```typescript
import { CostTrackingState } from "@tokenring-ai/metrics";

// Reset all costs for a new session
const costState = agent.getState(CostTrackingState);
costState.reset();
```

## Integration

### With Agent System

The `MetricsService` integrates with the agent system by:

1. Implementing the `TokenRingService` interface
2. Attaching to agents via the `attach()` method
3. Initializing `CostTrackingState` on agent attach
4. Providing `addCost()` method for external cost tracking

### With Plugin System

The package exports a `TokenRingPlugin` that:

1. Registers `MetricsService` with the app
2. Waits for `AgentCommandService` to be available, then registers the `/costs`
   command
3. Waits for `RpcService` to be available, then registers the `/rpc/metrics`
   endpoint
4. Supports live reconfiguration via `reconfigure()`

### With Other Packages

The metrics package is designed to work with:

- **AI client packages**: Track AI chat and image generation costs via
  `addCost()`
- **Custom Services**: Any service that needs to track costs can call
  `addCost()`

## Testing

### Test Files

- `costSummary.test.ts` - Unit tests for `aggregateCostSummary` and
  `agentCostsFromMetrics`, covering category and per-model token aggregation,
  latency and TTFT percentiles, and the empty agent list edge case
- `spendSeries.test.ts` - Spend sample bucketing, retention and range
  coarsening, plus History merging of live and stored agents
- `MetricsService.test.ts` - State tracking, persistence (identity and spend
  history), per-agent and global reset
- `frontend/views/metricsViews.test.tsx` - Dashboard views, including the
  spend chart, model table, history sort / detail and CSV export
- `frontend/lib/csv.test.ts`, `frontend/features/metrics/formatters.test.ts`

### Running Tests

```bash
cd plugin/metrics
bun run test
```

### Running Tests in Watch Mode

```bash
bun run test:watch
```

### Running Tests with Coverage

```bash
bun run test:coverage
```

### Building

```bash
bun run build
```

## Dependencies

- `@tokenring-ai/agent` - Agent orchestration and state management
- `@tokenring-ai/app` - Application framework and plugin system
- `@tokenring-ai/rpc` - RPC endpoint support
- `@tokenring-ai/utility` - Shared utilities (`deepClone`, `markdownList`)
- `zod` - Schema validation

## License

MIT License - see LICENSE file for details.
