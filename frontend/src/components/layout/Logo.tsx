import { cn } from "@/lib/utils";
import { useThemeStore } from "@/stores/themeStore";

interface LogoProps {
  className?: string;
  variant?: "white" | "black" | "auto";
}

export function Logo({ className, variant = "auto" }: LogoProps) {
  const isDark = useThemeStore((s) => s.dark);
  const actualVariant = variant === "auto" ? (isDark ? "white" : "black") : variant;
  
  return (
    <div className={cn("flex items-center justify-center whitespace-nowrap", className)}>
      <img 
        src="/logo.png" 
        alt="OutreachX Logo" 
        className="h-16 md:h-20 w-auto"
      />
    </div>
  );
}

export function BrandText({ className }: LogoProps) {
  return null; // Removed as it's now part of the SVG logo
}
