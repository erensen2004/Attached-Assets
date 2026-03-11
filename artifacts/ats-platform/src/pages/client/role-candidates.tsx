import { useListCandidates, useUpdateCandidateStatus } from "@workspace/api-client-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { StatusBadge } from "@/components/ui/status-badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserCircle, Loader2, ArrowLeft } from "lucide-react";
import { useRoute, Link } from "wouter";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { getListCandidatesQueryKey } from "@workspace/api-client-react";

export default function ClientRoleCandidates() {
  const [, params] = useRoute("/client/roles/:id/candidates");
  const roleId = Number(params?.id);
  
  const { data: candidates, isLoading } = useListCandidates({ roleId });
  const queryClient = useQueryClient();
  const { mutate: updateStatus } = useUpdateCandidateStatus({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListCandidatesQueryKey({ roleId }) })
    }
  });

  return (
    <DashboardLayout allowedRoles={["client"]}>
      <div className="mb-8">
        <Link href="/client/roles" className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-primary transition-colors mb-4">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Roles
        </Link>
        <h1 className="text-3xl font-bold text-slate-900">Role Candidates</h1>
        <p className="text-slate-500 mt-1">Review submitted candidates and update pipeline status</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-200">
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Candidate</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Vendor</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Submitted</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider w-48">Update Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr><td colSpan={5} className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" /></td></tr>
              ) : candidates?.length === 0 ? (
                <tr><td colSpan={5} className="p-12 text-center text-slate-500">No candidates submitted yet.</td></tr>
              ) : candidates?.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 text-slate-600">
                          <UserCircle className="w-6 h-6" />
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900">{c.firstName} {c.lastName}</div>
                          <div className="text-sm text-slate-500">{c.email} • {c.phone}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600 font-medium">{c.vendorCompanyName}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{format(new Date(c.submittedAt), 'MMM d, yyyy')}</td>
                    <td className="px-6 py-4"><StatusBadge status={c.status} /></td>
                    <td className="px-6 py-4">
                      <Select 
                        value={c.status} 
                        onValueChange={(v: any) => updateStatus({ id: c.id, data: { status: v }})}
                      >
                        <SelectTrigger className="h-9 rounded-lg">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="submitted">Submitted</SelectItem>
                          <SelectItem value="screening">Screening</SelectItem>
                          <SelectItem value="interview">Interview</SelectItem>
                          <SelectItem value="offer">Offer</SelectItem>
                          <SelectItem value="hired">Hired</SelectItem>
                          <SelectItem value="rejected">Rejected</SelectItem>
                        </SelectContent>
                      </Select>
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
