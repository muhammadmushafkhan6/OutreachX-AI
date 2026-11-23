import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";
import type { JobStatus } from "@/types";

const statusStyles: Record<JobStatus, string> = {
  queued: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  processing: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  scraping: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  ai_analyzing: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  failed: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

export function Badge({
  className,
  status,
  children,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { status?: JobStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
        status && statusStyles[status],
        className
      )}
      {...props}
    >
      {children ?? status?.replace("_", " ")}
    </span>
  );
}
