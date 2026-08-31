"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import type { MoveNodeRequest, MoveNodeResponse, OrgTree } from "@/types";

export function useOrgTree(includeUsers = true) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["org-tree", includeUsers],
    queryFn: () =>
      api.get<OrgTree>(`/org/tree?includeUsers=${includeUsers ? "true" : "false"}`),
  });

  const moveNode = useMutation({
    mutationFn: (payload: MoveNodeRequest) =>
      api.patch<MoveNodeResponse>("/org/move-node", payload),
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
