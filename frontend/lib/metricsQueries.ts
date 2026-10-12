import type { SpendRange } from "@tokenring-ai/metrics/rpc/schema";
import { metricsRPCClient, useTypedSWR } from "@tokenring-ai/one-frontend/rpc.ts";

/**
 * SWR hooks for the Metrics RPC methods the shared `rpc.ts` does not wrap.
 * Keys share the `/metrics/` prefix so a reset can revalidate every one of
 * them with a single `mutate(key => key.startsWith("/metrics/"))`.
 */

/** How often the spend chart and history poll; spend accrues per request, so this is plenty. */
const POLL_MS = 15_000;

export const METRICS_KEY_PREFIX = "/metrics/";

export function useSpendSeries(range: SpendRange) {
  return useTypedSWR(`${METRICS_KEY_PREFIX}spend/${range}`, () => metricsRPCClient.getSpendSeries({ range }), {
    refreshInterval: POLL_MS,
    keepPreviousData: true,
  });
}

export function useMetricsHistory() {
  return useTypedSWR(`${METRICS_KEY_PREFIX}history`, () => metricsRPCClient.listAgentMetricsHistory({}), { refreshInterval: POLL_MS });
}

export function useAgentMetricsHistory(agentId: string | undefined) {
  return useTypedSWR(agentId ? `${METRICS_KEY_PREFIX}history/${agentId}` : null, () => metricsRPCClient.getAgentMetricsHistory({ agentId: agentId! }), {
    refreshInterval: POLL_MS,
  });
}

/** SWR key filter matching every key above. */
export function isMetricsKey(key: unknown): boolean {
  return typeof key === "string" && key.startsWith(METRICS_KEY_PREFIX);
}
