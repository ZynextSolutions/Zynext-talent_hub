"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { withTenantQuery } from "@/lib/tenant-query";
import type { MoveNodeRequest, MoveNodeResponse, OrgTree } from "@/types";

export function useOrgTree(includeUsers = true, organizationId?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["org-tree", includeUsers, organizationId ?? null],
    queryFn: () =>
      api.get<OrgTree>(
        withTenantQuery(
          `/org/tree?includeUsers=${includeUsers ? "true" : "false"}`,
          organizationId,
        ),
      ),
    enabled: organizationId !== undefined ? Boolean(organizationId) : true,
  });

  const moveNode = useMutation({
    mutationFn: (payload: MoveNodeRequest) =>
      api.patch<MoveNodeResponse>(withTenantQuery("/org/move-node", organizationId), payload),
    onSuccess: (data) => {
      if (data.unchanged) return;
      queryClient.invalidateQueries({ queryKey: ["org-tree"] });
      if (data.enrollmentsAdded) {
        toast.success(`Moved node — ${data.enrollmentsAdded} enrollments updated`);
      }
    },
    onError: () => {
      toast.error("Failed to move node");
    },
  });

  return { ...query, moveNode };
}
