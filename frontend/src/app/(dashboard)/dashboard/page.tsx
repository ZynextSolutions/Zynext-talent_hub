"use client";

import { AdminDashboard } from "@/components/dashboard/admin-dashboard";
import { LearnerHome } from "@/components/learner/learner-home";
import { useAuth } from "@/hooks/useAuth";

export default function DashboardPage() {
  const { hasPermission } = useAuth();
  const canReadAnalytics = hasPermission("analytics:read");

  if (canReadAnalytics) {
    return <AdminDashboard />;
  }

  return <LearnerHome />;
}
