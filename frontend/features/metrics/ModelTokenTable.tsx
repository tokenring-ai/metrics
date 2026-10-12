import { formatCount, formatPercent, formatUsd, modelTokenRows, shortCategoryLabel } from "./formatters.ts";

type TokenTotals = { totalInputTokens: number; totalOutputTokens: number; totalCachedTokens: number; totalReasoningTokens: number };

/** Per-model token split: input, output, cached, reasoning and cost for each chat/model category. */
export default function ModelTokenTable({
  tokensByCategory,
  costsByCategory,
  emptyLabel = "No model token usage recorded yet.",
}: {
  tokensByCategory: Record<string, TokenTotals>;
  costsByCategory: Record<string, number>;
  emptyLabel?: string;
}) {
  const rows = modelTokenRows(tokensByCategory, costsByCategory);
  if (rows.length === 0) return <p className="text-xs text-muted">{emptyLabel}</p>;

  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-xs tabular-nums" data-testid="metrics-model-tokens">
        <thead>
          <tr className="text-muted text-left">
            <th scope="col" className="font-medium px-1 pb-2">
              Model
            </th>
            <th scope="col" className="font-medium px-1 pb-2 text-right">
              In
            </th>
            <th scope="col" className="font-medium px-1 pb-2 text-right">
              Out
            </th>
            <th scope="col" className="font-medium px-1 pb-2 text-right" title="Input tokens served from the provider's prompt cache">
              Cached
            </th>
            <th scope="col" className="font-medium px-1 pb-2 text-right" title="Hidden reasoning (thinking) tokens">
              Reason
            </th>
            <th scope="col" className="font-medium px-1 pb-2 text-right">
              Cost
            </th>
            <th scope="col" className="font-medium px-1 pb-2 text-right" title="Share of all input + output tokens">
              Share
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-primary/60">
          {rows.map(row => (
            <tr key={row.category} data-testid="metrics-model-row">
              <th scope="row" className="font-medium text-primary text-left px-1 py-1.5 max-w-[14rem] truncate" title={row.category}>
                {shortCategoryLabel(row.category)}
              </th>
              <td className="px-1 py-1.5 text-right text-secondary">{formatCount(row.inputTokens)}</td>
              <td className="px-1 py-1.5 text-right text-secondary">{formatCount(row.outputTokens)}</td>
              <td className="px-1 py-1.5 text-right text-muted">{formatCount(row.cachedTokens)}</td>
              <td className="px-1 py-1.5 text-right text-muted">{formatCount(row.reasoningTokens)}</td>
              <td className="px-1 py-1.5 text-right text-secondary">{formatUsd(row.cost)}</td>
              <td className="px-1 py-1.5 text-right text-muted">{formatPercent(row.share)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
