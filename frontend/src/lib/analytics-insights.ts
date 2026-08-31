import { formatPercent } from "@/lib/utils";
import type {
  AssessmentAnalytics,
  ComplianceAnalytics,
  CourseAnalytics,
  DashboardAnalytics,
  LearnerAnalytics,
  OrgLevelAnalytics,
} from "@/types";
import type { ReportInsight } from "@/components/analytics/report-shell";

export function executiveInsights(
  dash?: DashboardAnalytics,
  compliance?: ComplianceAnalytics
): { risks: ReportInsight[]; recommendations: ReportInsight[] } {
  const risks: ReportInsight[] = (dash?.riskAlerts ?? []).map((a) => ({
    severity: a.severity,
    message: a.message,
  }));
  const recommendations: ReportInsight[] = [];
  const overdue = dash?.kpis.lifetime.overdueCount ?? compliance?.overdueCount ?? 0;
  const dueSoon = dash?.kpis.lifetime.dueSoonCount ?? compliance?.dueSoonCount ?? 0;
  const riskDepts = compliance?.riskDepartments?.filter((d) => d.overdueCount > 0) ?? [];

  if (overdue > 0) {
    recommendations.push({
      message: `Send reminders for ${overdue} overdue enrollment${overdue === 1 ? "" : "s"}.`,
    });
  }
  if (dueSoon > 0) {
    recommendations.push({
      message: `Schedule nudges for ${dueSoon} item${dueSoon === 1 ? "" : "s"} due in the next 7 days.`,
    });
  }
  if (riskDepts.length >= 1) {
    recommendations.push({
      message: `${riskDepts.length} department${riskDepts.length === 1 ? "" : "s"} have overdue training — assign follow-up to managers.`,
    });
  }
  if ((dash?.kpis.lifetime.completionRate ?? 0) < 0.25 && (dash?.kpis.lifetime.enrollmentCount ?? 0) > 0) {
    recommendations.push({
      message: "Completion is under 25%. Review course length and assignment due dates.",
    });
  }
  return { risks, recommendations };
}

export function learningInsights(data?: CourseAnalytics): {
  risks: ReportInsight[];
  recommendations: ReportInsight[];
} {
  const risks: ReportInsight[] = [];
  const recommendations: ReportInsight[] = [];
  if (!data) return { risks, recommendations };
  if (data.kpis.lifetime.dropOffRate >= 0.2) {
    risks.push({
      severity: "high",
      message: `${formatPercent(data.kpis.lifetime.dropOffRate)} of enrollments look stale (no recent progress).`,
    });
    recommendations.push({ message: "Target drop-off courses with reminders or shorter modules." });
  }
  if (data.kpis.lifetime.avgDaysToComplete > 21) {
    risks.push({
      severity: "medium",
      message: `Average time to complete is ${data.kpis.lifetime.avgDaysToComplete} days.`,
    });
  }
  const weak = data.leastCompleted.filter((c) => c.enrolled >= 2 && c.completionRate < 0.25);
  if (weak.length) {
    recommendations.push({
      message: `Review ${weak
        .slice(0, 2)
        .map((c) => c.title)
        .join(" and ")} — lowest completion.`,
    });
  }
  return { risks, recommendations };
}

export function learnerInsights(data?: LearnerAnalytics): {
  risks: ReportInsight[];
  recommendations: ReportInsight[];
} {
  const risks: ReportInsight[] = [];
  const recommendations: ReportInsight[] = [];
  if (!data) return { risks, recommendations };
  if (data.kpis.period.inactiveCount > 0) {
    risks.push({
      severity: "medium",
      message: `${data.kpis.period.inactiveCount} learner${data.kpis.period.inactiveCount === 1 ? "" : "s"} had no login or progress in the selected period.`,
    });
  }
  if (data.kpis.lifetime.staleLoginCount > 0) {
    risks.push({
      severity: "medium",
      message: `${data.kpis.lifetime.staleLoginCount} active account${data.kpis.lifetime.staleLoginCount === 1 ? "" : "s"} have not logged in for 14+ days (recency, not session time).`,
    });
  }
  if (data.atRisk.length) {
    recommendations.push({
      message: `Follow up with ${data.atRisk.length} at-risk learner${data.atRisk.length === 1 ? "" : "s"} in the table below.`,
    });
  }
  if (data.buckets.notStarted > data.buckets.inProgress + data.buckets.completed) {
    recommendations.push({ message: "Most enrollments have not started — consider kickoff reminders." });
  }
  return { risks, recommendations };
}

export function organizationInsights(
  org?: OrgLevelAnalytics,
  byRole?: OrgLevelAnalytics
): { risks: ReportInsight[]; recommendations: ReportInsight[] } {
  const risks: ReportInsight[] = [];
  const recommendations: ReportInsight[] = [];
  const weak = (org?.rows ?? []).filter((r) => r.enrollmentCount > 0 && r.completionRate < 0.2);
  if (weak.length) {
    risks.push({
      severity: "high",
      message: `${weak.length} unit${weak.length === 1 ? "" : "s"} are below 20% completion.`,
    });
    recommendations.push({
      message: `Coach ${weak
        .slice(0, 3)
        .map((r) => r.name)
        .join(", ")} — assign reminders.`,
    });
  }
  const lowParticipation = (org?.rows ?? []).filter(
    (r) => r.userCount > 0 && (r.participationRate ?? 0) < 0.3
  );
  if (lowParticipation.length) {
    recommendations.push({
      message: `${lowParticipation.length} unit${lowParticipation.length === 1 ? "" : "s"} have low participation — expand assignments.`,
    });
  }
  void byRole;
  return { risks, recommendations };
}

export function assessmentInsights(data?: AssessmentAnalytics): {
  risks: ReportInsight[];
  recommendations: ReportInsight[];
} {
  const risks: ReportInsight[] = [];
  const recommendations: ReportInsight[] = [];
  if (!data) return { risks, recommendations };
  if (data.kpis.totalAttempts === 0) {
    return {
      risks: [{ severity: "low", message: "No assessment attempts in this period." }],
      recommendations: [{ message: "Assign a quiz or ask learners to complete existing finals." }],
    };
  }
  if (data.kpis.passRate < 0.6) {
    risks.push({
      severity: "high",
      message: `Pass rate is ${formatPercent(data.kpis.passRate)} — content or passing score may need review.`,
    });
  }
  if (data.kpis.retakeRate > 0.4) {
    risks.push({
      severity: "medium",
      message: `${formatPercent(data.kpis.retakeRate)} of attempts are retakes.`,
    });
  }
  const hard = data.hardest.filter((h) => h.attempts >= 2 && h.passRate < 0.5);
  if (hard.length) {
    recommendations.push({
      message: `Rewrite or coach on ${hard
        .slice(0, 2)
        .map((h) => h.title)
        .join(" and ")}.`,
    });
  }
  return { risks, recommendations };
}

export function complianceInsights(data?: ComplianceAnalytics): {
  risks: ReportInsight[];
  recommendations: ReportInsight[];
} {
  const risks: ReportInsight[] = [];
  const recommendations: ReportInsight[] = [];
  if (!data) return { risks, recommendations };
  if (data.overdueCount > 0) {
    risks.push({
      severity: "high",
      message: `${data.overdueCount} mandatory enrollment${data.overdueCount === 1 ? "" : "s"} overdue.`,
    });
  }
  const hotDepts = (data.riskDepartments ?? []).filter((d) => d.overdueCount > 0);
  if (hotDepts.length) {
    risks.push({
      severity: "high",
      message: `${hotDepts.length} department${hotDepts.length === 1 ? "" : "s"} have overdue items.`,
    });
    recommendations.push({
      message: `${hotDepts.length} department${hotDepts.length === 1 ? "" : "s"} above risk threshold — assign reminders.`,
    });
  }
  if ((data.expiringCerts?.length ?? 0) > 0) {
    risks.push({
      severity: "medium",
      message: `${data.expiringCerts!.length} certificate${data.expiringCerts!.length === 1 ? "" : "s"} expire within 90 days (from recertify interval).`,
    });
    recommendations.push({ message: "Schedule recertification for certificates approaching expiry." });
  }
  if (data.dueSoonCount > 0) {
    recommendations.push({ message: `Notify ${data.dueSoonCount} learner${data.dueSoonCount === 1 ? "" : "s"} due within 7 days.` });
  }
  return { risks, recommendations };
}
