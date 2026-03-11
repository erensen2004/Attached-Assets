import { useListRoles, useUpdateRoleStatus } from "@workspace/api-client-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Briefcase, Loader2, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { getListRolesQueryKey } from "@workspace/api-client-react";
import { format } from "date-fns";

export default function AdminRoles() {
  const { data: roles, isLoading } = useListRoles();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { mutate: updateStatus, isPending } = useUpdateRoleStatus({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListRolesQueryKey() });
        toast({ title: "Role published successfully" });
      }
    }
  });

  return (
    <DashboardLayout allowedRoles={["admin"]}>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Job Roles</h1>
        <p className="text-slate-500 mt-1">Review and approve pending roles</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-200">
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Role Title</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Company</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Created</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr><td colSpan={5} className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" /></td></tr>
              ) : roles?.map(role => (
                  <tr key={role.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900">{role.title}</div>
                    </td>
                    <td className="px-6 py-4 text-slate-600 font-medium">{role.companyName}</td>
                    <td className="px-6 py-4"><StatusBadge status={role.status} /></td>
                    <td className="px-6 py-4 text-sm text-slate-600">{format(new Date(role.createdAt), 'MMM d, yyyy')}</td>
                    <td className="px-6 py-4 text-right">
                      {role.status === 'pending_approval' && (
                        <Button 
                          size="sm" 
                          disabled={isPending}
                          className="rounded-lg h-8 bg-green-600 hover:bg-green-700"
                          onClick={() => updateStatus({ id: role.id, data: { status: 'published' }})}
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Approve
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
}
