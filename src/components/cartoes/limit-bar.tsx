import { cn } from "@/lib/utils";

interface LimitBarProps {
  used: number;
  total: number;
  showLabel?: boolean;
}

export function LimitBar({ used, total, showLabel = false }: LimitBarProps) {
  const pct = total > 0 ? Math.min((used / total) * 100, 100) : 0;
  const rounded = Math.round(pct);

  const color =
    pct >= 90
      ? "bg-destructive"
      : pct >= 70
      ? "bg-yellow-500"
      : "bg-green-500";

  return (
    <div className="w-full space-y-1.5">
      {showLabel && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Limite utilizado</span>
          <span
            className={cn(
              "font-semibold",
              pct >= 90
                ? "text-destructive"
                : pct >= 70
                ? "text-yellow-600 dark:text-yellow-400"
                : "text-green-600 dark:text-green-400"
            )}
          >
            {rounded}%
          </span>
        </div>
      )}
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all duration-500", color)}
          style={{ width: `${pct}%` }}
        />
      </div>
      {!showLabel && (
        <p className="text-right text-[10px] text-muted-foreground">{rounded}% utilizado</p>
      )}
    </div>
  );
}
