import StatusBadge from "@tokenring-ai/one-frontend/components/ui/StatusBadge.tsx";
import type { LiveStreamStatus } from "@tokenring-ai/one-frontend/hooks/useLiveStreamStatus.ts";
import { cn } from "@tokenring-ai/one-frontend/lib/utils.ts";
import formatError from "@tokenring-ai/utility/error/formatError";
import { AlertTriangle, Loader2 } from "lucide-react";

/** Live / connecting / reconnecting / error badge for a Metrics view header. */
export function LiveStatusBadge({ status, showSpinner }: { status: LiveStreamStatus; showSpinner: boolean }) {
  // Never show "Live" without a snapshot — covers first connect and paused/waiting gaps.
  if (status === "error") {
    return (
      <StatusBadge
        label="Error"
        icon={<AlertTriangle className="w-3 h-3" />}
        colorClass="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30"
        gap="md"
        data-testid="metrics-live-status"
      />
    );
  }
  if (status === "reconnecting") {
    return (
      <StatusBadge
        label="Reconnecting"
        dotColor="bg-amber-500"
        colorClass="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
        gap="md"
        data-testid="metrics-live-status"
      />
    );
  }
  if (status === "connecting") {
    return (
      <StatusBadge
        label="Connecting"
        icon={<Loader2 className={cn("w-3 h-3", showSpinner && "animate-spin")} />}
        colorClass="bg-tertiary text-muted border-primary"
        gap="md"
        data-testid="metrics-live-status"
      />
    );
  }
  return (
    <StatusBadge
      label="Live"
      dotColor="bg-emerald-500"
      pulse
      colorClass="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
      gap="md"
      data-testid="metrics-live-status"
    />
  );
}

/** Shown while the stream is down but a previous snapshot is still on screen. */
export function StaleBanner({ error, className }: { error: unknown; className?: string }) {
  return (
    <div
      className={cn("px-3 py-2 text-xs text-warning bg-warning/10 border border-warning/30 rounded-lg", className)}
      role="status"
      data-testid="metrics-stale-banner"
    >
      Live updates interrupted: {formatError(error, { includeStack: false }).split("\n")[0]}. Showing last known snapshot.
    </div>
  );
}
