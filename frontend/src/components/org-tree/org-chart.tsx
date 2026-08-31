"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  Building2,
  ChevronDown,
  ChevronRight,
  Download,
  Layers,
  Maximize2,
  Minus,
  Plus,
  RefreshCw,
  User,
  Users,
} from "lucide-react";
import { toPng } from "html-to-image";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useOrgTree } from "@/components/org-tree/use-org-tree";
import { buildOrgChartTree, countOrgChartNodes, type OrgChartNode } from "@/lib/org-chart-tree";
import { cn } from "@/lib/utils";
import type { NodeType } from "@/types";
import styles from "@/components/org-tree/org-chart.module.css";

const MIN_SCALE = 0.25;
const MAX_SCALE = 2.5;
const ZOOM_STEP = 1.15;

const typeIcons: Record<NodeType, React.ElementType> = {
  ORGANIZATION: Building2,
  DIVISION: Layers,
  DEPARTMENT: Building2,
  TEAM: Users,
  USER: User,
};

const typeStyles: Record<NodeType, string> = {
  ORGANIZATION: "border-indigo/40 bg-indigo/10 ring-indigo/20",
  DIVISION: "border-violet-400/40 bg-violet-500/10 ring-violet-400/20",
  DEPARTMENT: "border-blue-400/40 bg-blue-500/10 ring-blue-400/20",
  TEAM: "border-emerald-400/40 bg-emerald-500/10 ring-emerald-400/20",
  USER: "border-border bg-card ring-border/50",
};

const iconColors: Record<NodeType, string> = {
  ORGANIZATION: "text-indigo",
  DIVISION: "text-violet-400",
  DEPARTMENT: "text-blue-400",
  TEAM: "text-emerald-400",
  USER: "text-muted-foreground",
};

function ChartNodeCard({
  node,
  expanded,
  onToggle,
  hasChildren,
}: {
  node: OrgChartNode;
  expanded: boolean;
  onToggle: () => void;
  hasChildren: boolean;
}) {
  const Icon = typeIcons[node.type];

  return (
    <div
      className={cn(
        "relative z-10 w-[168px] rounded-xl border px-3 py-2.5 text-center shadow-sm ring-1 transition-shadow hover:shadow-md",
        typeStyles[node.type]
      )}
    >
      {hasChildren && (
        <button
          type="button"
          onClick={onToggle}
          className="text-muted-foreground hover:text-foreground absolute -bottom-3 left-1/2 z-20 flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full border border-border bg-background shadow-sm"
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>
      )}
      <div className="flex flex-col items-center gap-1.5">
        <div
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg bg-background/60",
            iconColors[node.type]
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <p className="line-clamp-2 text-sm font-semibold leading-tight">{node.name}</p>
        {node.subtitle && (
          <p className="text-muted-foreground text-[11px] leading-tight">{node.subtitle}</p>
        )}
        {node.role && (
          <Badge variant="secondary" className="text-[10px]">
            {node.role.replace("_", " ")}
          </Badge>
        )}
        {node.email && (
          <p className="text-muted-foreground line-clamp-1 w-full text-[10px]">{node.email}</p>
        )}
      </div>
    </div>
  );
}

function ChartBranch({
  node,
  collapsed,
  onToggle,
}: {
  node: OrgChartNode;
  collapsed: Set<string>;
  onToggle: (id: string) => void;
}) {
  const hasChildren = node.children.length > 0;
  const expanded = !collapsed.has(node.id);

  return (
    <li className={cn(!expanded && hasChildren && styles.collapsed)}>
      <ChartNodeCard
        node={node}
        expanded={expanded}
        onToggle={() => onToggle(node.id)}
        hasChildren={hasChildren}
      />
      {hasChildren && expanded && (
        <ul>
          {node.children.map((child) => (
            <ChartBranch key={child.id} node={child} collapsed={collapsed} onToggle={onToggle} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function OrgChart() {
  const { data, isLoading, isError, refetch, isFetching } = useOrgTree();
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const viewportRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  const root = useMemo(() => (data ? buildOrgChartTree(data) : null), [data]);
  const nodeCount = root ? countOrgChartNodes(root) : 0;

  const zoomAt = useCallback(
    (factor: number, clientX?: number, clientY?: number) => {
      const vp = viewportRef.current;
      if (!vp) return;

      const rect = vp.getBoundingClientRect();
      const vx = (clientX ?? rect.left + rect.width / 2) - rect.left;
      const vy = (clientY ?? rect.top + rect.height / 2) - rect.top;

      setScale((prevScale) => {
        const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, prevScale * factor));
        const ratio = nextScale / prevScale;
        setPan((prev) => ({
          x: vx - (vx - prev.x) * ratio,
          y: vy - (vy - prev.y) * ratio,
        }));
        return nextScale;
      });
    },
    []
  );

  const resetView = useCallback(() => {
    setScale(1);
    setPan({ x: 0, y: 0 });
  }, []);

  function toggleCollapse(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function expandAll() {
    setCollapsed(new Set());
  }

  function collapseBelowOrg() {
    if (!root) return;
    const ids = new Set<string>();
    function walk(node: OrgChartNode) {
      if (node.type !== "ORGANIZATION" && node.children.length > 0) {
        ids.add(node.id);
      }
      node.children.forEach(walk);
    }
    walk(root);
    setCollapsed(ids);
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0 && e.button !== 1) return;
    const target = e.target as HTMLElement;
    if (target.closest("button, a, input, [data-no-pan]")) return;

    setIsPanning(true);
    panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!isPanning) return;
    setPan({
      x: panStart.current.panX + e.clientX - panStart.current.x,
      y: panStart.current.panY + e.clientY - panStart.current.y,
    });
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (isPanning && e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setIsPanning(false);
  }

  function handleWheel(e: React.WheelEvent<HTMLDivElement>) {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 1 / ZOOM_STEP : ZOOM_STEP;
    zoomAt(factor, e.clientX, e.clientY);
  }

  async function exportPng() {
    if (!exportRef.current) return;
    setIsExporting(true);
    try {
      const bg = getComputedStyle(document.documentElement)
        .getPropertyValue("--background")
        .trim();
      const dataUrl = await toPng(exportRef.current, {
        backgroundColor: bg ? `hsl(${bg})` : "#09090b",
        pixelRatio: 2,
        cacheBust: true,
      });
      const link = document.createElement("a");
      const slug = data?.organization.name.replace(/\s+/g, "-").toLowerCase() ?? "org";
      link.download = `${slug}-org-chart.png`;
      link.href = dataUrl;
      link.click();
      toast.success("Chart exported as PNG");
    } catch {
      toast.error("Failed to export chart");
    } finally {
      setIsExporting(false);
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="mx-auto h-64 w-full max-w-3xl" />
        </CardContent>
      </Card>
    );
  }

  if (isError || !data || !root) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-12">
          <p className="text-muted-foreground text-sm">Unable to load organization chart.</p>
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-luxury">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-base font-medium">Organization chart</CardTitle>
          <p className="text-muted-foreground mt-1 text-xs">
            {nodeCount} nodes · drag to pan · scroll to zoom
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => zoomAt(ZOOM_STEP)}>
            <Plus className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => zoomAt(1 / ZOOM_STEP)}>
            <Minus className="h-4 w-4" />
          </Button>
          <span className="text-muted-foreground min-w-[3rem] text-center text-xs tabular-nums">
            {Math.round(scale * 100)}%
          </span>
          <Button variant="outline" size="sm" onClick={resetView}>
            <Maximize2 className="mr-2 h-4 w-4" />
            Reset
          </Button>
          <Button variant="outline" size="sm" onClick={expandAll}>
            Expand all
          </Button>
          <Button variant="outline" size="sm" onClick={collapseBelowOrg}>
            Collapse teams
          </Button>
          <Button variant="outline" size="sm" onClick={exportPng} disabled={isExporting}>
            <Download className="mr-2 h-4 w-4" />
            {isExporting ? "Exporting…" : "PNG"}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div
          ref={viewportRef}
          className={cn(styles.viewport, isPanning && styles.viewportGrabbing)}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onWheel={handleWheel}
        >
          <div
            className={styles.transformLayer}
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
            }}
          >
            <div ref={exportRef} className={styles.scrollInner}>
              <div className={styles.tree}>
                <ul>
                  <ChartBranch node={root} collapsed={collapsed} onToggle={toggleCollapse} />
                </ul>
              </div>
            </div>
          </div>
        </div>
        <div className="text-muted-foreground flex flex-wrap items-center gap-4 border-t border-border px-6 py-3 text-xs">
          {(["ORGANIZATION", "DIVISION", "DEPARTMENT", "TEAM", "USER"] as NodeType[]).map((type) => {
            const Icon = typeIcons[type];
            return (
              <span key={type} className="flex items-center gap-1.5">
                <Icon className={cn("h-3.5 w-3.5", iconColors[type])} />
                {type.charAt(0) + type.slice(1).toLowerCase().replace("_", " ")}
              </span>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
