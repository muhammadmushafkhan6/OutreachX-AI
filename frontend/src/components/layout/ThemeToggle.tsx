import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useThemeStore } from "@/stores/themeStore";

export function ThemeToggle() {
  const { dark, toggle } = useThemeStore();
  return (
    <Button 
      variant="ghost" 
      size="icon" 
      onClick={toggle} 
      aria-label="Toggle theme"
      className="text-foreground hover:bg-foreground/10"
    >
      {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </Button>
  );
}
