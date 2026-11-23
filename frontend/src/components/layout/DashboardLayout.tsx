import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";

export function DashboardLayout() {
  const location = useLocation();
  const isMapPage = location.pathname === "/google-maps-leads";

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className={isMapPage ? "w-full max-w-full px-4 sm:px-8 py-5 pb-24 lg:pb-6" : "container mx-auto px-4 py-6 pb-24 lg:pb-6 max-w-7xl"}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
