"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AnalyticsFilters } from "@/hooks/useAnalytics";
import type { OrgTree } from "@/types";

export type OrgLevel = "DIVISION" | "DEPARTMENT" | "TEAM";

interface ReportFiltersProps {
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  orgLevel?: OrgLevel;
  onOrgLevelChange?: (value: OrgLevel) => void;
  showOrgLevel?: boolean;
  filters?: AnalyticsFilters;
  onFiltersChange?: (filters: AnalyticsFilters) => void;
  orgTree?: OrgTree | null;
  showOrgFilters?: boolean;
  allowDivisionLevel?: boolean;
}

const ALL = "__all__";

export function ReportFilters({
  from,
  to,
  onFromChange,
  onToChange,
  orgLevel,
  onOrgLevelChange,
  showOrgLevel,
  filters,
  onFiltersChange,
  orgTree,
  showOrgFilters,
  allowDivisionLevel = true,
}: ReportFiltersProps) {
  const divisions = orgTree?.divisions ?? [];
  const departments = [
    ...divisions.flatMap((d) => d.departments),
    ...(orgTree?.unassignedDepartments ?? []),
  ];
  const teams = departments.flatMap((d) => d.teams);

  function setFilter(key: keyof AnalyticsFilters, value: string) {
    if (!onFiltersChange) return;
    const next = { ...filters };
    if (value === ALL) delete next[key];
    else next[key] = value;
    onFiltersChange(next);
  }

  return (
    <div className="flex flex-wrap items-end gap-4">
      <div className="space-y-1.5">
        <Label htmlFor="analytics-from">From</Label>
        <Input
          id="analytics-from"
          type="date"
          value={from}
          onChange={(e) => onFromChange(e.target.value)}
          className="w-40"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="analytics-to">To</Label>
        <Input
          id="analytics-to"
          type="date"
          value={to}
          onChange={(e) => onToChange(e.target.value)}
          className="w-40"
        />
      </div>
      {showOrgFilters && onFiltersChange && (
        <>
          <div className="space-y-1.5">
            <Label>Division</Label>
            <Select
              value={filters?.divisionId ?? ALL}
              onValueChange={(v) => setFilter("divisionId", v)}
            >
              <SelectTrigger className="w-44">
                <SelectValue placeholder="All divisions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All divisions</SelectItem>
                {divisions.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Department</Label>
            <Select
              value={filters?.departmentId ?? ALL}
              onValueChange={(v) => setFilter("departmentId", v)}
            >
              <SelectTrigger className="w-44">
                <SelectValue placeholder="All departments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All departments</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Team</Label>
            <Select
              value={filters?.teamId ?? ALL}
              onValueChange={(v) => setFilter("teamId", v)}
            >
              <SelectTrigger className="w-44">
                <SelectValue placeholder="All teams" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All teams</SelectItem>
                {teams.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </>
      )}
      {showOrgLevel && orgLevel && onOrgLevelChange && (
        <div className="space-y-1.5">
          <Label>Org level</Label>
          <Select value={orgLevel} onValueChange={(v) => onOrgLevelChange(v as OrgLevel)}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {allowDivisionLevel && <SelectItem value="DIVISION">Division</SelectItem>}
              <SelectItem value="DEPARTMENT">Department</SelectItem>
              <SelectItem value="TEAM">Team</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
