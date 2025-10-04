import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export function useOdooSync() {
  const queryClient = useQueryClient();

  const syncMutation = useMutation({
    mutationFn: async ({ start, end }: { start?: string; end?: string } = {}) => {
      const response = await apiRequest("POST", "/api/sync/odoo", { start, end });
      return response.json();
    },
    onSuccess: () => {
      // Invalidate and refetch appointments after sync
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/staff"] });
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
    },
  });

  const testConnection = useQuery({
    queryKey: ["/api/test-odoo"],
    enabled: false, // Only run when manually triggered
  });

  return {
    syncWithOdoo: syncMutation.mutate,
    isSyncing: syncMutation.isPending,
    syncError: syncMutation.error,
    syncResult: syncMutation.data,
    testConnection: testConnection.refetch,
    connectionStatus: testConnection.data,
  };
}
