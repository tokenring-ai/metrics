import { formatCount } from "./formatters.ts";

/** A compact key → count list shared by the overview and agent-breakdown views. */
export default function KeyValueList({ entries, emptyLabel }: { entries: Array<{ key: string; value: number }>; emptyLabel: string }) {
  if (entries.length === 0) {
    return <p className="text-xs text-muted">{emptyLabel}</p>;
  }
  return (
    <div className="space-y-1">
      {entries.map(e => (
        <div key={e.key} className="flex items-center justify-between gap-3 text-xs">
          <span className="truncate text-secondary font-medium" title={e.key}>
            {e.key}
          </span>
          <span className="tabular-nums text-muted shrink-0">{formatCount(e.value)}</span>
        </div>
      ))}
    </div>
  );
}
