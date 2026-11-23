import { NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Globe,
  MapPin,
  Upload,
  FileText,
  Settings,
  CreditCard,
  LogOut,
  Zap,
  Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/authStore";
import { useState, useEffect } from "react";
import { Logo } from "./Logo";

const links = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/analyze", icon: Globe, label: "Website Analysis" },
  { to: "/google-maps-leads", icon: MapPin, label: "Google Map Leads Finder" },
  { to: "/bulk", icon: Upload, label: "Bulk CSV" },
  { to: "/results", icon: FileText, label: "Results" },
  { to: "/instagram", icon: Zap, label: "Instagram" },
  { to: "/settings", icon: Settings, label: "Settings" },
  { to: "/billing", icon: CreditCard, label: "Billing" },
];

export function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const isMapPage = location.pathname === "/google-maps-leads";
  const [collapsed, setCollapsed] = useState(isMapPage);

  useEffect(() => {
    if (isMapPage) {
      setCollapsed(true);
    }
  }, [isMapPage]);

  const isLinkActive = (to: string) => {
    const [pathname, searchStr] = to.split("?");
    if (location.pathname !== pathname) return false;
    if (!searchStr) return true;
    const linkParams = new URLSearchParams(searchStr);
    const currentParams = new URLSearchParams(location.search);
    for (const [k, v] of linkParams.entries()) {
      if (currentParams.get(k) !== v) return false;
    }
    return true;
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <>
      <aside
        className={cn(
          "hidden lg:flex flex-col border-r bg-card h-screen sticky top-0 transition-all duration-300 z-40",
          collapsed ? "w-[72px]" : "w-64"
        )}
      >
        <div className="flex h-20 items-center justify-center border-b px-4 relative">
          {!collapsed ? (
            <>
              <Logo className="w-auto h-auto scale-75" />
              <Button variant="ghost" size="icon" className="absolute right-2" onClick={() => setCollapsed(true)} title="Collapse Sidebar">
                <Menu className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <Button variant="ghost" size="icon" onClick={() => setCollapsed(false)} title="Expand Sidebar" className="hover:bg-primary/20 hover:text-primary">
              <Menu className="h-5 w-5 text-primary" />
            </Button>
          )}
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {links.map(({ to, icon: Icon, label }) => {
            const active = isLinkActive(to);
            return (
            <NavLink
              key={to}
              to={to}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ); })}
        </nav>

        <div className="border-t p-3 space-y-2">
          {!collapsed && user && (
            <div className="rounded-lg bg-muted/50 px-3 py-2 text-xs">
              <p className="font-medium truncate">{user.full_name}</p>
              <p className="text-muted-foreground truncate">{user.email}</p>
            </div>
          )}
          <Button
            variant="ghost"
            className={cn("w-full justify-start gap-3", collapsed && "justify-center px-0")}
            onClick={handleLogout}
          >
            <LogOut className="h-5 w-5" />
            {!collapsed && "Log out"}
          </Button>
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 border-t bg-card flex justify-around py-2 safe-area-pb">
        {links.slice(0, 5).map(({ to, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn("p-2 rounded-lg", isActive ? "text-primary" : "text-muted-foreground")
            }
          >
            <Icon className="h-5 w-5" />
          </NavLink>
        ))}
      </nav>
    </>
  );
}
