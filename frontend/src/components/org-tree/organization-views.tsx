"use client";

import { GitBranch, Network } from "lucide-react";
import { OrgChart } from "@/components/org-tree/org-chart";
import { OrgTree } from "@/components/org-tree/org-tree";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function OrganizationViews() {
  return (
    <Tabs defaultValue="tree" className="w-full">
      <TabsList>
        <TabsTrigger value="tree" className="gap-2">
          <GitBranch className="h-4 w-4" />
          Tree view
        </TabsTrigger>
        <TabsTrigger value="chart" className="gap-2">
          <Network className="h-4 w-4" />
          Org chart
        </TabsTrigger>
      </TabsList>
      <TabsContent value="tree" className="mt-6">
        <OrgTree />
      </TabsContent>
      <TabsContent value="chart" className="mt-6">
        <OrgChart />
      </TabsContent>
    </Tabs>
  );
}
