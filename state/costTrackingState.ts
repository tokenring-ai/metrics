import {AgentStateSlice} from "@tokenring-ai/agent/types";
import markdownList from "@tokenring-ai/utility/string/markdownList";
import {z} from "zod";

type Costs = Record<string, number>;

const serializationSchema = z
  .object({
    costs: z.record(z.string(), z.number()).default({}),
  })
  .prefault({});

export class CostTrackingState extends AgentStateSlice<
  typeof serializationSchema
> {
  costs: Costs;

  constructor(readonly initialCosts: Costs = {}) {
    super("CostTrackingState", serializationSchema);
    this.costs = initialCosts;
  }

  reset(): void {
    this.costs = {};
  }

  serialize(): z.output<typeof serializationSchema> {
    return {costs: this.costs};
  }

  deserialize(data: z.output<typeof serializationSchema>): void {
    this.costs = data.costs;
  }

  show(): string {
    const totalCost = Object.values(this.costs).reduce((a, b) => a + b, 0);
    return `Overall Costs: $${totalCost.toLocaleString(undefined, {minimumFractionDigits: 4})}
${markdownList(Object.entries(this.costs).map(
      ([key, value]) => `${key} Cost: $${value.toLocaleString(undefined, {minimumFractionDigits: 4})}`,
    ))}`;
  }
}
