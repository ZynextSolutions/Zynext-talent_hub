"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { ReportFilters, type OrgLevel } from "@/components/analytics/report-filters";
import { ReportShell } from "@/components/analytics/report-shell";
import { defaultDateRange, useAnalyticsByOrgLevel, useAnalyticsByRole, useAnalyticsDashboard, useAnalyticsSnapshots, useAssessmentAnalytics, useCourseAnalytics, useEngagementAnalytics, useLearnerAnalytics, useRoiAnalytics, useTrendsAnalytics, type AnalyticsFilters, type TrendGranularity } from "@/hooks/useAnalytics";
import { formatMoney, parseTrainingCurrency, type TrainingCurrency } from "@/lib/money";
import { useExportCompliancePackage, useSkillsAnalytics, useXapiStatements, useXapiStats } from "@/hooks/usePhase3";
import { useComplianceAnalytics } from "@/hooks/useCompliance";
import { useAuth } from "@/hooks/useAuth";
import { useOrgTree } from "@/hooks/useOrgTree";
import type { User } from "@/types";
import { Button } from "@/components/ui/button";
import {
  assessmentInsights,
  complianceInsights,
  executiveInsights,
  learnerInsights,
  learningInsights,
  organizationInsights,
} from "@/lib/analytics-insights";
import { formatDate, formatPercent } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EnrollmentAreaChart, EnrollmentBarChart, NamedBarChart } from "@/components/charts/lazy-charts";

const TABS = [
  "executive",
  "learning",
  "learners",
  "organization",
  "assessments",
  "compliance",
  "engagement",
  "trends",
  "skills",
  "xapi",
  "roi",
] as const;

type TabId = (typeof TABS)[number];

function isTab(value: string | null): value is TabId {
  return TABS.includes(value as TabId);
}

function formatPeriod(from: string, to: string) {
  return `${formatDate(`${from}T00:00:00`)} – ${formatDate(`${to}T00:00:00`)}`;
}

function reportScopeLabel(user: User | null): string {
  if (!user) return "Organization";
  if (user.role === "ORG_ADMIN") return "Organization";
  if (user.role === "MANAGER" || user.role === "INSTRUCTOR") {
    return user.departmentId ? "Your department" : "Your data";
  }
  return "Your data";
}

function formatRoiAmount(minor: number, currency: TrainingCurrency) {
  return formatMoney(minor, currency);
}

export function AnalyticsHub() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const requested = searchParams.get("tab");
  const tab: TabId = isTab(requested) ? requested : "executive";

  const { hasPermission, user } = useAuth();
  const allowed = hasPermission("analytics:read");
  const canExportCompliance = hasPermission("compliance:export");
  const canViewXapi = hasPermission("xapi:read");
  const isOrgAdmin = user?.role === "ORG_ADMIN";
  const { data: orgTree } = useOrgTree(false);

  const defaults = defaultDateRange();
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [orgLevel, setOrgLevel] = useState<OrgLevel>("DEPARTMENT");
  const [filters, setFilters] = useState<AnalyticsFilters>({});
  const [compliancePage, setCompliancePage] = useState(1);
  const [trendGranularity, setTrendGranularity] = useState<TrendGranularity>("week");

  const dashboard = useAnalyticsDashboard(from, to, allowed, filters);
  const compliance = useComplianceAnalytics(
    allowed && (tab === "executive" || tab === "compliance" || tab === "skills"),
    compliancePage,
  );
  const courses = useCourseAnalytics(from, to, allowed && tab === "learning", filters);
  const learners = useLearnerAnalytics(from, to, allowed && tab === "learners", filters);
  const engagement = useEngagementAnalytics(from, to, allowed && tab === "engagement", filters);
  const trends = useTrendsAnalytics(from, to, trendGranularity, allowed && tab === "trends", filters);
  const skillsAnalytics = useSkillsAnalytics(allowed && tab === "skills");
  const xapiStats = useXapiStats(from, to, allowed && tab === "xapi");
  const xapiStatements = useXapiStatements({ page: 1 }, allowed && tab === "xapi");
  const exportCompliance = useExportCompliancePackage();
  const roi = useRoiAnalytics(from, to, allowed && tab === "roi", filters);
  const snapshots = useAnalyticsSnapshots(30, allowed && tab === "executive");
  const org = useAnalyticsByOrgLevel(orgLevel, from, to, allowed && tab === "organization", filters);
  const byRole = useAnalyticsByRole(from, to, allowed && tab === "organization", filters);
  const assessments = useAssessmentAnalytics(from, to, allowed && tab === "assessments", filters);

  const period = formatPeriod(from, to);
  const scope = reportScopeLabel(user);

  function setTab(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "executive") params.delete("tab");
    else params.set("tab", next);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  if (!allowed) {
    return (
      <div className="flex flex-1 flex-col overflow-auto">
        <PageHeader title="Analytics" description="You do not have permission to view organization reports." />
      </div>
    );
  }

  const execInsights = executiveInsights(dashboard.data, compliance.data);
  const learnInsights = learningInsights(courses.data);
  const activityInsights = learnerInsights(learners.data);
  const orgInsights = organizationInsights(org.data, byRole.data);
  const quizInsights = assessmentInsights(assessments.data);
  const compInsights = complianceInsights(compliance.data);

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <PageHeader
        title="Analytics"
        description="Zynext Talent Hub reporting for HR, L&D, and executives."
        actions={
          <ReportFilters
            from={from}
            to={to}
            onFromChange={setFrom}
            onToChange={setTo}
            orgLevel={orgLevel}
            onOrgLevelChange={setOrgLevel}
            showOrgLevel={tab === "organization"}
            allowDivisionLevel={isOrgAdmin}
            filters={filters}
            onFiltersChange={setFilters}
            orgTree={orgTree}
            showOrgFilters={isOrgAdmin && tab !== "compliance"}
          />
        }
      />

      <div className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-6 py-8">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="h-auto w-full flex-wrap justify-start gap-1">
            <TabsTrigger value="executive">Executive</TabsTrigger>
            <TabsTrigger value="learning">Learning</TabsTrigger>
            <TabsTrigger value="learners">Learners</TabsTrigger>
            <TabsTrigger value="organization">Organization</TabsTrigger>
            <TabsTrigger value="assessments">Assessments</TabsTrigger>
            <TabsTrigger value="compliance">Compliance</TabsTrigger>
            <TabsTrigger value="engagement">Engagement</TabsTrigger>
            <TabsTrigger value="trends">Trends</TabsTrigger>
            <TabsTrigger value="skills">Skills</TabsTrigger>
            {canViewXapi && <TabsTrigger value="xapi">xAPI</TabsTrigger>}
            <TabsTrigger value="roi">ROI</TabsTrigger>
          </TabsList>

          <TabsContent value="executive" className="mt-6">
            <ReportShell
              title="Executive summary"
              period={period}
              scope={scope}
              loading={dashboard.isLoading}
              kpis={[
                {
                  label: "Period-active learners",
                  value: dashboard.data?.kpis.period.activeUserCount ?? 0,
                  hint: `${dashboard.data?.kpis.lifetime.activeUserCount ?? 0} accounts marked active (lifetime)`,
                },
                {
                  label: "Distinct enrolled",
                  value: dashboard.data?.kpis.lifetime.enrolledUserCount ?? 0,
                  hint: `${dashboard.data?.kpis.lifetime.enrollmentCount ?? 0} enrollment rows (lifetime)`,
                },
                {
                  label: "Completion",
                  value: formatPercent(dashboard.data?.kpis.lifetime.completionRate ?? 0),
                  hint: "Lifetime rate",
                },
                {
                  label: "Compliance",
                  value: formatPercent(dashboard.data?.kpis.lifetime.complianceRate ?? 0),
                  hint: "Completed among enrollments with a due date or assignment",
                },
                {
                  label: "Period hours",
                  value: dashboard.data?.kpis.period.estimatedLearningHours ?? 0,
                  hint: "From lesson duration / playback position in range",
                  proxy: true,
                },
                {
                  label: "Period certificates",
                  value: dashboard.data?.kpis.period.certificatesIssued ?? 0,
                  hint: `${dashboard.data?.kpis.lifetime.certificatesIssued ?? 0} lifetime total`,
                },
                {
                  label: "Overdue",
                  value: dashboard.data?.kpis.lifetime.overdueCount ?? 0,
                  hint: "Current snapshot",
                },
                {
                  label: "Due soon",
                  value: dashboard.data?.kpis.lifetime.dueSoonCount ?? 0,
                  hint: "Current snapshot",
                },
              ]}
              risks={execInsights.risks}
              recommendations={execInsights.recommendations}
            >
              <div className="grid gap-6 lg:grid-cols-5">
                <Card className="lg:col-span-3 shadow-luxury">
                  <CardHeader>
                    <CardTitle className="text-base">Enrollment trend</CardTitle>
                  </CardHeader>
                  <CardContent className="h-72">
                    {dashboard.isLoading ? (
                      <Skeleton className="h-full w-full" />
                    ) : (
                      <EnrollmentBarChart data={dashboard.data?.enrollmentsOverTime ?? []} />
                    )}
                  </CardContent>
                </Card>
                <Card className="lg:col-span-2 shadow-luxury">
                  <CardHeader>
                    <CardTitle className="text-base">Top departments</CardTitle>
                  </CardHeader>
                  <CardContent className="h-72">
                    {dashboard.isLoading ? (
                      <Skeleton className="h-full w-full" />
                    ) : dashboard.data?.topDepartments?.length ? (
                      <NamedBarChart
                        valueLabel="Enrollments"
                        data={(dashboard.data.topDepartments ?? []).map((d) => ({
                          name: d.name,
                          value: d.enrollmentCount,
                        }))}
                      />
                    ) : (
                      <p className="text-muted-foreground text-sm">No department enrollments yet.</p>
                    )}
                  </CardContent>
                </Card>
              </div>
              <Card className="shadow-luxury">
                <CardHeader>
                  <CardTitle className="text-base">Daily snapshot history</CardTitle>
                  <CardDescription>
                    Captured metrics from the nightly analytics snapshot job (most recent first).
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Completion</TableHead>
                        <TableHead className="text-right">Compliance</TableHead>
                        <TableHead className="text-right">Active learners</TableHead>
                        <TableHead className="text-right">Learning hrs</TableHead>
                        <TableHead className="text-right">Overdue</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {snapshots.data?.length ? (
                        snapshots.data.map((row) => (
                          <TableRow key={row.date}>
                            <TableCell className="font-medium tabular-nums">{row.date}</TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatPercent(row.metrics.completionRate ?? 0)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatPercent(row.metrics.complianceRate ?? 0)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {row.metrics.periodActiveUsers ?? 0}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {row.metrics.periodLearningHours ?? 0}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {row.metrics.overdueCount ?? 0}
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <EmptyRow
                          cols={6}
                          loading={snapshots.isLoading}
                          label="No snapshots yet. Run the analytics snapshot job to capture daily metrics."
                        />
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </ReportShell>
          </TabsContent>

          <TabsContent value="learning" className="mt-6">
            <ReportShell
              title="Learning effectiveness"
              period={period}
              scope={scope}
              loading={courses.isLoading}
              kpis={[
                {
                  label: "Completion",
                  value: formatPercent(courses.data?.kpis.lifetime.completionRate ?? 0),
                  hint: "Lifetime",
                },
                {
                  label: "Avg days to complete",
                  value: courses.data?.kpis.lifetime.avgDaysToComplete ?? 0,
                },
                { label: "Drop-off", value: formatPercent(courses.data?.kpis.lifetime.dropOffRate ?? 0) },
                { label: "Pass rate", value: formatPercent(courses.data?.kpis.period.passRate ?? 0), hint: "In period" },
                { label: "Avg score", value: courses.data?.kpis.period.avgScore ?? 0, hint: "In period" },
                {
                  label: "Period enrollments",
                  value: courses.data?.kpis.period.enrollmentCount ?? 0,
                },
              ]}
              risks={learnInsights.risks}
              recommendations={learnInsights.recommendations}
            >
              <div className="grid gap-6 lg:grid-cols-2">
                <RankingTable
                  title="Most completed"
                  rows={(courses.data?.mostCompleted ?? []).map((c) => ({
                    id: c.courseId,
                    name: c.title,
                    meta: `${c.completed} / ${c.enrolled}`,
                    value: formatPercent(c.completionRate),
                  }))}
                  empty="No completions yet."
                  loading={courses.isLoading}
                />
                <RankingTable
                  title="Least completed"
                  rows={(courses.data?.leastCompleted ?? []).map((c) => ({
                    id: c.courseId,
                    name: c.title,
                    meta: `${c.dropOffCount} stale`,
                    value: formatPercent(c.completionRate),
                  }))}
                  empty="No course data yet."
                  loading={courses.isLoading}
                />
              </div>
              <Card className="shadow-luxury">
                <CardHeader>
                  <CardTitle className="text-base">All courses</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Course</TableHead>
                        <TableHead className="text-right">Enrolled</TableHead>
                        <TableHead className="text-right">Completed</TableHead>
                        <TableHead className="text-right">Rate</TableHead>
                        <TableHead className="text-right">Avg days</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {courses.data?.courses?.length ? (
                        courses.data.courses.map((c) => (
                          <TableRow key={c.courseId}>
                            <TableCell className="font-medium">{c.title}</TableCell>
                            <TableCell className="text-right tabular-nums">{c.enrolled}</TableCell>
                            <TableCell className="text-right tabular-nums">{c.completed}</TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatPercent(c.completionRate)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{c.avgDaysToComplete}</TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <EmptyRow cols={5} loading={courses.isLoading} />
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </ReportShell>
          </TabsContent>

          <TabsContent value="learners" className="mt-6">
            <ReportShell
              title="Learner activity"
              period={period}
              scope={scope}
              loading={learners.isLoading}
              kpis={[
                {
                  label: "Active",
                  value: learners.data?.kpis.period.activeCount ?? 0,
                  hint: "Login or progress in period",
                },
                { label: "Inactive", value: learners.data?.kpis.period.inactiveCount ?? 0 },
                {
                  label: "Period hours (proxy)",
                  value: learners.data?.kpis.period.estimatedLearningHours ?? 0,
                  hint: "Lesson duration / playback position",
                  proxy: true,
                },
                {
                  label: "Last login ≤ 7 days",
                  value: learners.data?.kpis.lifetime.lastLoginLast7Days ?? 0,
                  hint: "Recency, not login frequency",
                  proxy: true,
                },
                { label: "Not started", value: learners.data?.buckets.notStarted ?? 0 },
                { label: "In progress", value: learners.data?.buckets.inProgress ?? 0 },
                { label: "Completed", value: learners.data?.buckets.completed ?? 0 },
              ]}
              risks={activityInsights.risks}
              recommendations={activityInsights.recommendations}
            >
              <div className="grid gap-6 lg:grid-cols-2">
                <Card className="shadow-luxury">
                  <CardHeader>
                    <CardTitle className="text-base">Top performers</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Learner</TableHead>
                          <TableHead className="text-right">Completed</TableHead>
                          <TableHead className="text-right">Avg progress</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {learners.data?.topPerformers?.length ? (
                          learners.data.topPerformers.map((row) => (
                            <TableRow key={row.userId}>
                              <TableCell className="font-medium">{row.name}</TableCell>
                              <TableCell className="text-right tabular-nums">{row.completedCount}</TableCell>
                              <TableCell className="text-right tabular-nums">{row.avgProgress}%</TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <EmptyRow cols={3} loading={learners.isLoading} />
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
                <Card className="shadow-luxury">
                  <CardHeader>
                    <CardTitle className="text-base">At risk</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Learner</TableHead>
                          <TableHead>Reason</TableHead>
                          <TableHead className="text-right">Progress</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {learners.data?.atRisk?.length ? (
                          learners.data.atRisk.map((row) => (
                            <TableRow key={row.userId}>
                              <TableCell className="font-medium">{row.name}</TableCell>
                              <TableCell className="text-muted-foreground text-sm">{row.reason}</TableCell>
                              <TableCell className="text-right tabular-nums">{row.progressPercent}%</TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <EmptyRow cols={3} loading={learners.isLoading} label="No at-risk learners." />
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            </ReportShell>
          </TabsContent>

          <TabsContent value="organization" className="mt-6">
            <ReportShell
              title="Organization breakdown"
              period={period}
              scope={`${orgLevel.charAt(0)}${orgLevel.slice(1).toLowerCase()}s`}
              loading={org.isLoading}
              kpis={[
                { label: "Units", value: org.data?.rows.length ?? 0 },
                {
                  label: "Avg completion",
                  value: formatPercent(average(org.data?.rows.map((r) => r.completionRate) ?? [])),
                },
                {
                  label: "Avg participation",
                  value: formatPercent(average(org.data?.rows.map((r) => r.participationRate ?? 0) ?? [])),
                },
                { label: "Roles tracked", value: byRole.data?.rows.length ?? 0 },
              ]}
              risks={orgInsights.risks}
              recommendations={orgInsights.recommendations}
            >
              <Card className="shadow-luxury">
                <CardHeader>
                  <CardTitle className="text-base">By {orgLevel.toLowerCase()}</CardTitle>
                </CardHeader>
                <CardContent>
                  <OrgTable data={org.data} loading={org.isLoading} />
                </CardContent>
              </Card>
              <Card className="shadow-luxury">
                <CardHeader>
                  <CardTitle className="text-base">By role</CardTitle>
                </CardHeader>
                <CardContent>
                  <OrgTable data={byRole.data} loading={byRole.isLoading} />
                </CardContent>
              </Card>
            </ReportShell>
          </TabsContent>

          <TabsContent value="assessments" className="mt-6">
            <ReportShell
              title="Assessments"
              period={period}
              scope={scope}
              loading={assessments.isLoading}
              kpis={[
                { label: "Attempts", value: assessments.data?.kpis.totalAttempts ?? 0 },
                { label: "Passed", value: assessments.data?.kpis.passed ?? 0 },
                { label: "Failed", value: assessments.data?.kpis.failed ?? 0 },
                { label: "Pass rate", value: formatPercent(assessments.data?.kpis.passRate ?? 0) },
                { label: "Avg score", value: assessments.data?.kpis.avgScore ?? 0 },
                { label: "Retake rate", value: formatPercent(assessments.data?.kpis.retakeRate ?? 0) },
              ]}
              risks={quizInsights.risks}
              recommendations={quizInsights.recommendations}
            >
              <Card className="shadow-luxury">
                <CardHeader>
                  <CardTitle className="text-base">Hardest quizzes</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Assessment</TableHead>
                        <TableHead className="text-right">Attempts</TableHead>
                        <TableHead className="text-right">Pass rate</TableHead>
                        <TableHead className="text-right">Avg score</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {assessments.data?.hardest?.length ? (
                        assessments.data.hardest.map((row) => (
                          <TableRow key={row.assessmentId}>
                            <TableCell className="font-medium">{row.title}</TableCell>
                            <TableCell className="text-right tabular-nums">{row.attempts}</TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatPercent(row.passRate)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{row.avgScore}</TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <EmptyRow cols={4} loading={assessments.isLoading} />
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </ReportShell>
          </TabsContent>

          <TabsContent value="compliance" className="mt-6">
            <ReportShell
              title="Compliance"
              period="Current compliance status"
              scope={scope}
              loading={compliance.isLoading}
              kpis={[
                { label: "Overdue", value: compliance.data?.overdueCount ?? 0 },
                { label: "Due soon", value: compliance.data?.dueSoonCount ?? 0 },
                { label: "On track", value: compliance.data?.onTrackCount ?? 0 },
                {
                  label: "Mandatory completion",
                  value: formatPercent(compliance.data?.mandatoryCompletionRate ?? 0),
                  hint: `${compliance.data?.mandatoryCompleted ?? 0} / ${compliance.data?.mandatoryTotal ?? 0} with due date or assignment`,
                },
                { label: "Risk departments", value: compliance.data?.riskDepartments?.length ?? 0 },
                { label: "Expiring certificates", value: compliance.data?.expiringCerts?.length ?? 0 },
              ]}
              risks={compInsights.risks}
              recommendations={compInsights.recommendations}
              actions={
                canExportCompliance ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={exportCompliance.isPending}
                    onClick={() => exportCompliance.mutate({ from, to })}
                  >
                    Export compliance package
                  </Button>
                ) : undefined
              }
            >
              {(compliance.data?.riskDepartments?.length ?? 0) > 0 && (
                <RankingTable
                  title="Risk departments"
                  rows={(compliance.data?.riskDepartments ?? []).map((d) => ({
                    id: d.id,
                    name: d.name,
                    meta: `${d.dueSoonCount} due soon`,
                    value: `${d.overdueCount} overdue`,
                  }))}
                  empty="No department risk."
                  loading={compliance.isLoading}
                />
              )}
              <Card className="shadow-luxury">
                <CardHeader>
                  <CardTitle className="text-base">Due-date assignments</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Learner</TableHead>
                        <TableHead>Course</TableHead>
                        <TableHead>Due</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {compliance.data?.items?.length ? (
                        compliance.data.items.map((item) => (
                          <TableRow key={item.enrollmentId}>
                            <TableCell>{item.userName}</TableCell>
                            <TableCell>{item.courseTitle}</TableCell>
                            <TableCell className="text-sm tabular-nums">
                              {item.dueAt ? item.dueAt.slice(0, 10) : "—"}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  item.complianceStatus === "OVERDUE"
                                    ? "destructive"
                                    : item.complianceStatus === "DUE_SOON"
                                      ? "secondary"
                                      : "outline"
                                }
                              >
                                {item.complianceStatus.replace("_", " ")}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <EmptyRow
                          cols={4}
                          loading={compliance.isLoading}
                          label="No due-date assignments tracked yet."
                        />
                      )}
                    </TableBody>
                  </Table>
                  {(compliance.data?.pagination?.totalPages ?? 1) > 1 && (
                    <div className="mt-4 flex items-center justify-between gap-2">
                      <p className="text-muted-foreground text-sm">
                        Page {compliance.data?.pagination?.page ?? 1} of{" "}
                        {compliance.data?.pagination?.totalPages ?? 1} ·{" "}
                        {compliance.data?.pagination?.total ?? 0} total
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={compliancePage <= 1}
                          onClick={() => setCompliancePage((p) => Math.max(1, p - 1))}
                        >
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={
                            compliancePage >= (compliance.data?.pagination?.totalPages ?? 1)
                          }
                          onClick={() => setCompliancePage((p) => p + 1)}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card className="shadow-luxury">
                <CardHeader>
                  <CardTitle className="text-base">Certificates nearing recertification</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Learner</TableHead>
                        <TableHead>Course</TableHead>
                        <TableHead>Expires</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {compliance.data?.expiringCerts?.length ? (
                        compliance.data.expiringCerts.map((c) => (
                          <TableRow key={c.certificateId}>
                            <TableCell>{c.userName}</TableCell>
                            <TableCell>{c.courseTitle}</TableCell>
                            <TableCell className="tabular-nums">{c.expiresAt.slice(0, 10)}</TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <EmptyRow
                          cols={3}
                          loading={compliance.isLoading}
                          label="No recertify intervals set, or none expire within 90 days."
                        />
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </ReportShell>
          </TabsContent>

          <TabsContent value="engagement" className="mt-6">
            <ReportShell
              title="Engagement"
              period={period}
              scope={scope}
              loading={engagement.isLoading}
              gapNote="Learning hours use accumulated watch time from lesson playback. Login metrics come from sign-in events."
              kpis={[
                {
                  label: "Logins in period",
                  value: engagement.data?.kpis.period.totalLogins ?? 0,
                  hint: "Password, MFA, and SSO sign-ins",
                },
                {
                  label: "Active users",
                  value: engagement.data?.kpis.period.activeUsers ?? 0,
                  hint: "Distinct users with at least one login",
                },
                {
                  label: "WAU",
                  value: engagement.data?.kpis.wau ?? 0,
                  hint: "Weekly active users (last 7 days)",
                },
                {
                  label: "MAU",
                  value: engagement.data?.kpis.mau ?? 0,
                  hint: "Monthly active users (last 30 days)",
                },
              ]}
              risks={
                engagement.data && engagement.data.kpis.mau === 0
                  ? [{ severity: "medium", message: "No login activity recorded in the selected window." }]
                  : []
              }
              recommendations={[
                {
                  message: "Compare WAU/MAU trends over time to spot adoption drops after assignments or org changes.",
                },
              ]}
            >
              {(engagement.data?.trend?.length ?? 0) > 0 && (
                <Card className="shadow-luxury">
                  <CardHeader>
                    <CardTitle className="text-base">Daily logins</CardTitle>
                  </CardHeader>
                  <CardContent className="h-72">
                    <NamedBarChart
                      data={engagement.data!.trend.map((row) => ({
                        name: row.date.slice(5),
                        value: row.logins,
                      }))}
                      valueLabel="Logins"
                    />
                  </CardContent>
                </Card>
              )}
            </ReportShell>
          </TabsContent>

          <TabsContent value="trends" className="mt-6">
            <ReportShell
              title="Trends & forecast"
              period={period}
              scope={scope}
              loading={trends.isLoading}
              kpis={[
                {
                  label: "90-day completions",
                  value: trends.data?.forecast.trailing90dCompletions ?? 0,
                  hint: "Completed in trailing window",
                },
                {
                  label: "Velocity / week",
                  value: trends.data?.forecast.velocityPerWeek ?? 0,
                  hint: "Trailing completion rate",
                },
                {
                  label: "30-day projection",
                  value: trends.data?.forecast.projectedCompletions30d ?? 0,
                  hint: "Linear forecast from 90-day pace",
                },
                {
                  label: "Granularity",
                  value: trends.data?.granularity ?? trendGranularity,
                  hint: "Bucket size for time series",
                },
              ]}
              risks={[]}
              recommendations={[
                {
                  message: "Compare enrollment vs completion trends to spot backlog growth before due dates pile up.",
                },
              ]}
            >
              <div className="mb-4 flex flex-wrap items-end gap-4">
                <div className="space-y-1.5">
                  <Label>Granularity</Label>
                  <Select
                    value={trendGranularity}
                    onValueChange={(v) => setTrendGranularity(v as TrendGranularity)}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="day">Daily</SelectItem>
                      <SelectItem value="week">Weekly</SelectItem>
                      <SelectItem value="month">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="shadow-luxury">
                  <CardHeader>
                    <CardTitle className="text-base">Enrollments vs completions</CardTitle>
                  </CardHeader>
                  <CardContent className="h-72">
                    {trends.isLoading ? (
                      <Skeleton className="h-full w-full" />
                    ) : (
                      <EnrollmentAreaChart
                        data={(trends.data?.series.enrollments ?? []).map((row, idx) => ({
                          date: row.period.slice(5),
                          enrolled: row.value,
                          completed: trends.data?.series.completions[idx]?.value ?? 0,
                        }))}
                      />
                    )}
                  </CardContent>
                </Card>
                <Card className="shadow-luxury">
                  <CardHeader>
                    <CardTitle className="text-base">Active users (logins)</CardTitle>
                  </CardHeader>
                  <CardContent className="h-72">
                    {trends.isLoading ? (
                      <Skeleton className="h-full w-full" />
                    ) : (
                      <NamedBarChart
                        valueLabel="Active users"
                        data={(trends.data?.series.engagement ?? []).map((row) => ({
                          name: row.period.slice(5),
                          value: row.activeUsers,
                        }))}
                      />
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card className="mt-4 shadow-luxury">
                <CardHeader>
                  <CardTitle className="text-base">Enrollment cohorts</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Month</TableHead>
                        <TableHead className="text-right">Enrolled</TableHead>
                        <TableHead className="text-right">Completed</TableHead>
                        <TableHead className="text-right">Rate</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(trends.data?.cohorts ?? []).length ? (
                        trends.data!.cohorts.map((row) => (
                          <TableRow key={row.month}>
                            <TableCell>{row.month}</TableCell>
                            <TableCell className="text-right tabular-nums">{row.enrolled}</TableCell>
                            <TableCell className="text-right tabular-nums">{row.completed}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatPercent(row.completionRate * 100)}</TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <EmptyRow cols={4} loading={trends.isLoading} label="No cohort data in range." />
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </ReportShell>
          </TabsContent>

          <TabsContent value="skills" className="mt-6">
            <ReportShell
              title="Skills & competencies"
              period={period}
              scope={scope}
              loading={skillsAnalytics.isLoading}
              kpis={[
                { label: "Skills tracked", value: skillsAnalytics.data?.kpis.skillCount ?? 0 },
                { label: "Demonstrations", value: skillsAnalytics.data?.kpis.demonstratedCount ?? 0 },
                { label: "Coverage gaps", value: skillsAnalytics.data?.kpis.gapCount ?? 0 },
              ]}
              risks={
                (skillsAnalytics.data?.kpis.gapCount ?? 0) > 0
                  ? [{ severity: "medium", message: "Some role-required skills are not yet demonstrated." }]
                  : []
              }
              recommendations={[
                { message: "Map skills to courses and role requirements to tighten gap reporting." },
              ]}
            >
              <Card className="shadow-luxury">
                <CardHeader>
                  <CardTitle className="text-base">Skill coverage</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Skill</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Demonstrated</TableHead>
                        <TableHead className="text-right">Required</TableHead>
                        <TableHead className="text-right">Gap</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {skillsAnalytics.data?.skills?.length ? (
                        skillsAnalytics.data.skills.map((row) => (
                          <TableRow key={row.skillId}>
                            <TableCell className="font-medium">{row.skillName}</TableCell>
                            <TableCell className="text-muted-foreground">{row.category ?? "—"}</TableCell>
                            <TableCell className="text-right tabular-nums">{row.demonstratedCount}</TableCell>
                            <TableCell className="text-right tabular-nums">{row.requiredCount}</TableCell>
                            <TableCell className="text-right tabular-nums">{row.gapCount}</TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <EmptyRow cols={5} loading={skillsAnalytics.isLoading} label="No skills configured yet." />
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </ReportShell>
          </TabsContent>

          {canViewXapi && (
            <TabsContent value="xapi" className="mt-6">
              <ReportShell
                title="xAPI statements"
                period={period}
                scope={scope}
                loading={xapiStats.isLoading}
                kpis={[
                  { label: "Statements", value: xapiStats.data?.total ?? 0, hint: "In selected period" },
                  { label: "Verb types", value: xapiStats.data?.verbs.length ?? 0 },
                ]}
                risks={[]}
                recommendations={[
                  { message: "Statements are recorded on course completion and assessment pass/fail events." },
                ]}
              >
                <div className="grid gap-4 lg:grid-cols-2">
                  <Card className="shadow-luxury">
                    <CardHeader>
                      <CardTitle className="text-base">Verbs</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Verb</TableHead>
                            <TableHead className="text-right">Count</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {xapiStats.data?.verbs?.length ? (
                            xapiStats.data.verbs.map((row) => (
                              <TableRow key={row.verb}>
                                <TableCell className="font-mono text-sm">{row.verb}</TableCell>
                                <TableCell className="text-right tabular-nums">{row.count}</TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <EmptyRow cols={2} loading={xapiStats.isLoading} label="No statements in range." />
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                  <Card className="shadow-luxury">
                    <CardHeader>
                      <CardTitle className="text-base">Recent statements</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Verb</TableHead>
                            <TableHead>Activity</TableHead>
                            <TableHead>Time</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {xapiStatements.data?.items?.length ? (
                            xapiStatements.data.items.slice(0, 8).map((row) => (
                              <TableRow key={row.id}>
                                <TableCell className="font-mono text-xs">{row.verb}</TableCell>
                                <TableCell className="max-w-[140px] truncate font-mono text-xs">
                                  {row.activityId ?? "—"}
                                </TableCell>
                                <TableCell className="text-muted-foreground text-xs tabular-nums">
                                  {row.createdAt.slice(0, 16).replace("T", " ")}
                                </TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <EmptyRow cols={3} loading={xapiStatements.isLoading} label="No statements yet." />
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </div>
              </ReportShell>
            </TabsContent>
          )}

          <TabsContent value="roi" className="mt-6">
            <ReportShell
              title="Training ROI"
              period={period}
              scope={scope}
              loading={roi.isLoading}
              kpis={[
                {
                  label: "Completions",
                  value: roi.data?.kpis.completions ?? 0,
                  hint: "Courses completed in period",
                },
                {
                  label: "Total spend",
                  value: formatRoiAmount(
                    roi.data?.kpis.totalCostCents ?? 0,
                    parseTrainingCurrency(roi.data?.kpis.currency),
                  ),
                  hint: "Course cost or org default per completion",
                },
                {
                  label: "Cost / completion",
                  value: formatRoiAmount(
                    roi.data?.kpis.costPerCompletionCents ?? 0,
                    parseTrainingCurrency(roi.data?.kpis.currency),
                  ),
                },
                {
                  label: "Priced completions",
                  value: roi.data?.kpis.pricedCompletions ?? 0,
                  hint: "Completions with a non-zero cost",
                },
              ]}
              risks={
                (roi.data?.kpis.pricedCompletions ?? 0) === 0
                  ? [{ severity: "medium", message: "Set course costs or an org default to compute ROI." }]
                  : []
              }
              recommendations={[
                { message: "Assign per-course costs in Course Studio → About for finer-grained ROI." },
              ]}
            >
              <Card className="shadow-luxury">
                <CardHeader>
                  <CardTitle className="text-base">Spend by course</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Course</TableHead>
                        <TableHead className="text-right">Completions</TableHead>
                        <TableHead className="text-right">Unit cost</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {roi.data?.courses?.length ? (
                        roi.data.courses.map((row) => (
                          <TableRow key={row.courseId}>
                            <TableCell className="font-medium">{row.title}</TableCell>
                            <TableCell className="text-right tabular-nums">{row.completions}</TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatRoiAmount(row.costCents, parseTrainingCurrency(roi.data?.kpis.currency))}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatRoiAmount(row.totalCents, parseTrainingCurrency(roi.data?.kpis.currency))}
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <EmptyRow cols={4} loading={roi.isLoading} label="No priced completions in range." />
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </ReportShell>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function average(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function EmptyRow({
  cols,
  loading,
  label = "No data yet.",
}: {
  cols: number;
  loading?: boolean;
  label?: string;
}) {
  return (
    <TableRow>
      <TableCell colSpan={cols} className="text-muted-foreground h-16 text-center text-sm">
        {loading ? "Loading…" : label}
      </TableCell>
    </TableRow>
  );
}

function RankingTable({
  title,
  rows,
  empty,
  loading,
}: {
  title: string;
  rows: Array<{ id: string; name: string; meta: string; value: string }>;
  empty: string;
  loading?: boolean;
}) {
  return (
    <Card className="shadow-luxury">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Detail</TableHead>
              <TableHead className="text-right">Value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length ? (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{row.meta}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.value}</TableCell>
                </TableRow>
              ))
            ) : (
              <EmptyRow cols={3} loading={loading} label={empty} />
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function OrgTable({ data, loading }: { data?: { rows: Array<{ id: string; name: string; userCount: number; enrollmentCount: number; completionRate: number; avgProgress: number; participationRate?: number }> }; loading?: boolean }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead className="text-right">Users</TableHead>
          <TableHead className="text-right">Enrollments</TableHead>
          <TableHead className="text-right">Participation</TableHead>
          <TableHead className="text-right">Completion</TableHead>
          <TableHead className="text-right">Avg progress</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data?.rows?.length ? (
          [...data.rows]
            .sort((a, b) => b.completionRate - a.completionRate)
            .map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.name}</TableCell>
                <TableCell className="text-right tabular-nums">{row.userCount}</TableCell>
                <TableCell className="text-right tabular-nums">{row.enrollmentCount}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatPercent(row.participationRate ?? 0)}
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatPercent(row.completionRate)}</TableCell>
                <TableCell className="text-right tabular-nums">{row.avgProgress}%</TableCell>
              </TableRow>
            ))
        ) : (
          <EmptyRow cols={6} loading={loading} label="No data for this level." />
        )}
      </TableBody>
    </Table>
  );
}
