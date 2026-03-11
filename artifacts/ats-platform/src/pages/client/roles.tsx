import { useState } from "react";
import { useListRoles, useCreateRole } from "@workspace/api-client-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Briefcase, Plus, Loader2, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { getListRolesQueryKey } from "@workspace/api-client-react";
import { Link } from "wouter";

export default function ClientRoles() {
  const { data: roles, isLoading } = useListRoles();
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({ title: "", description: "", skills: "" });

  const { mutate: createRole, isPending } = useCreateRole({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListRolesQueryKey() });
        setIsOpen(false);
        setFormData({ title: "", description: "", skills: "" });
        toast({ title: "Role created and sent for approval" });
      }
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createRole({ data: formData });
  };

  return (
    <DashboardLayout allowedRoles={["client"]}>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">My Job Roles</h1>
          <p className="text-slate-500 mt-1">Manage open positions and track candidates</p>
        </div>
        
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-xl shadow-md h-11 px-6">
              <Plus className="w-4 h-4 mr-2" />
              Open New Position
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-xl rounded-2xl">
            <DialogHeader><DialogTitle>Open New Position</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold">Job Title</label>
                <Input required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="Senior Frontend Engineer" className="h-11 rounded-xl" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold">Job Description</label>
                <Textarea required value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} rows={4} className="rounded-xl resize-none" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold">Required Skills (Comma separated)</label>
                <Input value={formData.skills} onChange={e => setFormData({...formData, skills: e.target.value})} placeholder="React, TypeScript, Node.js" className="h-11 rounded-xl" />
              </div>
              <Button disabled={isPending} type="submit" className="w-full h-11 rounded-xl mt-6">
                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit for Approval"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
           <div className="col-span-full flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : roles?.length === 0 ? (
          <div className="col-span-full text-center p-12 bg-white rounded-2xl border border-slate-200 text-slate-500">
            You haven't opened any positions yet.
          </div>
        ) : roles?.map(role => (
          <div key={role.id} className="bg-white rounded-2xl p-6 shadow-lg shadow-black/5 border border-slate-100 hover:shadow-xl transition-all flex flex-col">
            <div className="flex justify-between items-start mb-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <Briefcase className="w-6 h-6" />
              </div>
              <StatusBadge status={role.status} />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">{role.title}</h3>
            <p className="text-sm text-slate-500 line-clamp-2 mb-6 flex-1">{role.description}</p>
            
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between mt-auto">
              <div className="flex items-center gap-2 text-slate-600 font-medium">
                <Users className="w-4 h-4" />
                {role.candidateCount} Candidates
              </div>
              <Link href={`/client/roles/${role.id}/candidates`}>
                <Button variant="ghost" size="sm" className="rounded-lg">View Details</Button>
              </Link>
            </div>
          </div>
        ))}
      </div>
    </DashboardLayout>
  );
}
