import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Landing } from "@/pages/Landing";
import { Login } from "@/pages/Login";
import { Register } from "@/pages/Register";
import { Dashboard } from "@/pages/Dashboard";
import { SingleAnalysis } from "@/pages/SingleAnalysis";
import { BulkUpload } from "@/pages/BulkUpload";
import { Results } from "@/pages/Results";
import { Settings } from "@/pages/Settings";
import { Billing } from "@/pages/Billing";
import InstagramAccountsPage from "@/pages/InstagramAccounts";

import GoogleMapLeadsFinder from "@/pages/GoogleMapLeadsFinder";

import { useThemeStore } from "@/stores/themeStore";

export default function App() {
  const setDark = useThemeStore((s) => s.setDark);

  useEffect(() => {
    setDark(true);
  }, [setDark]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/analyze" element={<SingleAnalysis />} />
          <Route path="/google-maps-leads" element={<GoogleMapLeadsFinder />} />

          <Route path="/bulk" element={<BulkUpload />} />
          <Route path="/results" element={<Results />} />
          <Route path="/instagram" element={<InstagramAccountsPage />} />

          <Route path="/settings" element={<Settings />} />
          <Route path="/billing" element={<Billing />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster richColors position="top-right" closeButton />
    </BrowserRouter>
  );
}
