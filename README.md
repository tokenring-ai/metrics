# @tokenring-ai/metrics

## Overview

Metrics tracking package for TokenRing that provides comprehensive cost tracking and performance metrics for AI agents. This package integrates with the Token Ring agent system to collect, persist, and display metrics about agent operations including AI chat costs, image generation costs, and other resource usage.

## Key Features

- **Cost Tracking**: Sum and track costs by category (AI Chat, Image Generation, Web Search, etc.)
- **State Persistence**: Costs are persisted across sessions using the agent's state management system
- **Agent Integration**: Seamlessly integrates with Token Ring agents via the MetricsService
- **Command Interface**: Provides `/costs` command to display current cost metrics
- **Type-Safe**: Fully typed with TypeScript and Zod schemas
- **Plugin Architecture**: Installable as a Token Ring plugin for easy integration

## Installation

```bash
bun add @tokenring-ai/metrics
```

## Dependencies

- `@tokenring-ai/agent`: Agent orchestration and state management
- `@tokenring-ai/app`: Application framework and plugin system
- `@tokenring-ai/utility`: Shared utilities
- `zod`: Schema validation

## Core Components

### MetricsService

The core service that collects and manages metrics data.

**Location**: `MetricsService.ts`

**Purpose**: Collects metrics about the agent's performance, particularly cost tracking.

**Methods**:

```typescript
class MetricsService implements TokenRingService {
  readonly name = "MetricsService";
  readonly description = "Collects metrics about the agent's performance.";

  constructor(options: MetricsServiceConfig)

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

**Properties**:

- `costs: Record<string, number>` - Map of cost categories to amounts

**Methods**:

```typescript
class CostTrackingState extends AgentStateSlice {
  costs: Costs;

  constructor(initialCosts?: Costs);

  /**
   * Reset all costs to zero
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
   * Display costs as formatted lines
   * @returns Array of formatted cost strings
   */
  show(): string[];
}
```

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
const costLines = costState.show();
console.log(costLines.join('\n'));

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

## Configuration

The package accepts a configuration object via the plugin or service constructor:

```typescript
import { MetricsServiceConfigSchema } from '@tokenring-ai/metrics/schema';

// Current schema (empty, can be extended)
const config = {
  metrics: {}
};
```

The configuration is validated using Zod schema (`MetricsServiceConfigSchema`).

## Chat Commands

### `/costs`

Displays total costs incurred by the Agent.

**Description**: Shows cumulative costs from the beginning of the current session, including AI Chat, Image Generation, Web Search, and other tracked categories.

**Output Format**:

```
Overall Costs: $0.0475
- AI Chat Cost: $0.0025
- Image Generation Cost: $0.0350
- Web Search Cost: $0.0100
```

**Notes**:

- Costs are summed from the beginning of the current session until the current time
- Costs are displayed in USD with 4 decimal places
- Categories are dynamically tracked based on what costs are added

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

### With Other Packages

The metrics package is designed to work with:

- **@tokenring-ai/ai-client**: Track AI chat and image generation costs
- **@tokenring-ai/websearch**: Track web search costs
- **Custom Services**: Any service that needs to track costs can call `addCost()`

## Testing and Development

### Running Tests

```bash
cd pkg/metrics
bun test
```

### Running Tests in Watch Mode

```bash
bun test --watch
```

### Running Tests with Coverage

```bash
bun test --coverage
```

### Building

```bash
bun run build
```

## Tech Stack

- **Runtime**: Bun
- **Language**: TypeScript
- **Testing**: Vitest
- **Validation**: Zod
- **State Management**: Agent state slices

## License

MIT License - see LICENSE file for details.

## Related Components

- [@tokenring-ai/agent](../agent/README.md) - Core agent orchestration
- [@tokenring-ai/app](../app/README.md) - Application framework
- [@tokenring-ai/ai-client](../ai-client/README.md) - AI client for cost tracking integration
