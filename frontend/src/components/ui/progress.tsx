import { cn } from "@/lib/utils";

interface ProgressProps {
  value: number;
  className?: string;
  showLabel?: boolean;
}

export function Progress({ value, className, showLabel }: ProgressProps) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div className={cn("space-y-1", className)}>
      <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showLabel && (
        <p className="text-xs text-muted-foreground text-right">{clamped}%</p>
      )}
    </div>
  );
}
