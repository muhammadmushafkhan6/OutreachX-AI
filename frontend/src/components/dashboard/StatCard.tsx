import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: string;
  className?: string;
}

export function StatCard({ title, value, subtitle, icon: Icon, trend, className }: StatCardProps) {
  return (
    <Card className={cn("overflow-hidden rounded-[2rem] border-border bg-card shadow-sm hover:border-primary/30 transition-all group", className)}>
      <CardContent className="p-8">
        <div className="flex items-start justify-between">
          <div className="space-y-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground group-hover:text-primary transition-colors">{title}</p>
            <p className="text-4xl font-black tracking-tighter">{value}</p>
            {subtitle && (
              <p className="text-xs font-bold uppercase tracking-tight text-muted-foreground/60">{subtitle}</p>
            )}
            {trend && (
              <p className="text-xs font-black uppercase tracking-widest text-primary">{trend}</p>
            )}
          </div>
          <div className="rounded-2xl bg-primary/10 p-4 group-hover:scale-110 transition-transform">
            <Icon className="h-6 w-6 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
