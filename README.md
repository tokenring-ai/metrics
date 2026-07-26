# @tokenring-ai/metrics

## Overview

Metrics tracking package for TokenRing that provides comprehensive cost tracking and performance metrics for AI agents. This package integrates with the Token Ring agent system to collect, persist, and display metrics about agent operations including AI chat costs, image generation costs, and other resource usage.

**Key features:**

- Cost tracking and aggregation by category
- State persistence across sessions
- Seamless agent integration via MetricsService
- Chat command interface for cost display
- RPC endpoint for live cost summaries (web Metrics dashboard)
- Type-safe implementation with TypeScript and Zod

**Integration points:**

- @tokenring-ai/agent - Agent orchestration and state management
- @tokenring-ai/app - Application framework and plugin system
- @tokenring-ai/rpc - RPC endpoint for remote cost queries
- @tokenring-ai/utility - Shared utilities

## Installation

```bash
bun add @tokenring-ai/metrics
```

## Dependencies

- `@tokenring-ai/agent` - Agent orchestration and state management
- `@tokenring-ai/app` - Application framework and plugin system
- `@tokenring-ai/rpc` - RPC endpoint support
- `@tokenring-ai/utility` - Shared utilities
- `@tokenring-ai/ai-client` - AI client integration
- `@tokenring-ai/chat` - Chat integration
- `zod` - Schema validation

## Features

- **Cost Tracking**: Sum and track costs by category (AI Chat, Image Generation, Web Search, etc.)
- **State Persistence**: Costs are persisted across sessions using the agent's state management system
- **Agent Integration**: Seamlessly integrates with Token Ring agents via the MetricsService
- **Command Interface**: Provides `/costs` command to display current cost metrics
- **RPC Endpoints**: Query and stream cost summaries for dashboard integration
- **Type-Safe**: Fully typed with TypeScript and Zod schemas
- **Plugin Architecture**: Installable as a Token Ring plugin for easy integration

## Chat Commands

| Command | Description |
|---------|-------------|
| `/costs` | Displays total costs incurred by the Agent |

### `/costs`

Displays total costs incurred by the Agent, including AI Chat, Image Generation, Web Search, and other tracked categories.

**Output Format:**

```text
Overall Costs: $0.0475
- AI Chat Cost: $0.0025
- Image Generation Cost: $0.0350
- Web Search Cost: $0.0100
```

**Notes:**

- Costs are summed from the beginning of the current session until the current time
- Costs are displayed in USD with 4 decimal places
- Categories are dynamically tracked based on what costs are added

## Tools

This package does not define any tools.

## Configuration

The package accepts a configuration object via the plugin or service constructor. The current schema is empty, designed for future extensibility.

### ENV Variables

This package does not require any environment variables.

### Configuration Example

```yaml
metrics: {}
```

The configuration is validated using Zod schema (`MetricsServiceConfigSchema`).

## RPC

Registered at `/rpc/metrics` when `RpcService` is available:

| Method | Type | Description |
|--------|------|-------------|
| `getCostSummary` | query | Snapshot of all agent costs and category totals |
| `streamCostSummary` | stream | Live updates (~2s poll) of the cost summary |
| `getAgentCosts` | query | Costs for a single agent by agentId |
| `resetAgentCosts` | mutation | Clear cost counters for one agent |

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
}
```

## Core Components

### MetricsService

The core service that collects and manages metrics data.

**Location**: `MetricsService.ts`

**Purpose**: Collects metrics about the agent's performance, particularly cost tracking.

**Methods:**

```typescript
class MetricsService implements TokenRingService {
  readonly name = "MetricsService";
  description = "Collects metrics about the agent's performance.";

  constructor(options: z.output<typeof MetricsServiceConfigSchema>);

  /**
   * Attach the service to an agent and initialize state
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

### CostTrackingState

State slice for tracking costs across sessions.

**Location**: `state/costTrackingState.ts`

**Purpose**: Persists cost data in the agent's state with serialization/deserialization support.

**Properties:**

- `costs: Record<string, number>` - Map of cost categories to amounts
- `initialCosts: Costs` - Initial costs provided at construction (readonly)

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
   * Display costs as formatted string
   * @returns Formatted cost string with overall total and per-category breakdown
   */
  show(): string;
}
```

### Cost Summary Helpers

Utility functions for reading and aggregating agent cost data.

**Location**: `costSummary.ts`

#### `readAgentCosts(agent: Agent): AgentCosts`

Reads the current cost tracking state from an agent and returns an `AgentCosts` object. Handles cases where the state may not be initialized.

```typescript
import { readAgentCosts } from '@tokenring-ai/metrics/costSummary';

const costs = readAgentCosts(agent);
// { agentId, displayName, agentType, idle, costs, total }
```

#### `aggregateCostSummary(agentCosts: AgentCosts[]): CostSummary`

Aggregates cost data from multiple agents into a single `CostSummary`. Agents are sorted by total cost (descending).

```typescript
import { aggregateCostSummary } from '@tokenring-ai/metrics/costSummary';

const allAgentCosts = agents.map(a => readAgentCosts(a));
const summary = aggregateCostSummary(allAgentCosts);
// { agents, totalsByCategory, grandTotal, agentCount, activeAgentCount }
```

### RPC Schema

Zod schemas for RPC communication.

**Location**: `rpc/schema.ts`

- `AgentCostsSchema` - Schema for individual agent cost data
- `CostSummarySchema` - Schema for aggregated cost summary

## Exports

| Export | Description |
|--------|-------------|
| `MetricsService` | Core metrics service class (default export) |
| `AgentCosts` | Type for individual agent cost data |
| `CostSummary` | Type for aggregated cost summary |
| `CostTrackingState` | Agent state slice for cost tracking |

## Usage Examples

### Plugin Registration

Install the plugin in your Token Ring application:

```typescript
import metricsPlugin from '@tokenring-ai/metrics/plugin';

app.install(metricsPlugin, {
  metrics: {} // Empty config, can be extended
});
```

### Manual Service Registration

```typescript
import { MetricsService } from '@tokenring-ai/metrics';

app.addServices(new MetricsService({}));
```

### Adding Costs

```typescript
// In your service or tool implementation
metricsService.addCost('AI Chat', 0.0025, agent);
metricsService.addCost('Image Generation', 0.035, agent);
metricsService.addCost('Web Search', 0.01, agent);
```

### Retrieving Costs

```typescript
// Get cost tracking state from agent
const costState = agent.getState(CostTrackingState);

// Display formatted costs
console.log(costState.show());

// Output:
// Overall Costs: $0.0475
// - AI Chat Cost: $0.0025
// - Image Generation Cost: $0.0350
// - Web Search Cost: $0.0100
```

### Resetting Costs

```typescript
// Reset all costs for a new session
const costState = agent.getState(CostTrackingState);
costState.reset();
```

## State Management

The package uses the `CostTrackingState` class to manage cost data:

- **Initialization**: State is initialized when the agent attaches the MetricsService
- **Persistence**: Costs are automatically persisted through the agent's state system
- **Checkpoint Generation**: State is included in agent checkpoints for recovery
- **Session Tracking**: Costs accumulate within a session and can be reset with `reset()`

## Integration

### With Agent System

The MetricsService integrates with the agent system by:

1. Implementing `TokenRingService` interface
2. Attaching to agents via `attach()` method
3. Initializing `CostTrackingState` on agent attach
4. Providing `addCost()` method for external cost tracking

### With Plugin System

The package exports a `TokenRingPlugin` that:

1. Registers `MetricsService` with the app
2. Waits for `AgentCommandService` to be available
3. Registers the `/costs` command with agent command service
4. Waits for `RpcService` to be available
5. Registers the `/rpc/metrics` endpoint

### With Other Packages

The metrics package is designed to work with:

- **@tokenring-ai/ai-client**: Track AI chat and image generation costs
- **@tokenring-ai/websearch**: Track web search costs
- **Custom Services**: Any service that needs to track costs can call `addCost()`

## Testing and Development

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

## Tech Stack

- **Runtime**: Bun
- **Language**: TypeScript
- **Testing**: Bun test
- **Validation**: Zod
- **State Management**: Agent state slices

## License

MIT License - see LICENSE file for details.

## Related Components

- [@tokenring-ai/agent](../agent/README.md) - Core agent orchestration
- [@tokenring-ai/app](../app/README.md) - Application framework
- [@tokenring-ai/rpc](../rpc/README.md) - RPC framework
- [@tokenring-ai/utility](../utility/README.md) - Shared utilities (deepClone, markdownList)
