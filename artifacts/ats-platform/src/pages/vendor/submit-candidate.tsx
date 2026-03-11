import { useState } from "react";
import { useSubmitCandidate, useGetRole } from "@workspace/api-client-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ArrowLeft, Send } from "lucide-react";
import { useRoute, Link, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

export default function VendorSubmitCandidate() {
  const [, params] = useRoute("/vendor/submit/:roleId");
  const roleId = Number(params?.roleId);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: role, isLoading: roleLoading } = useGetRole(roleId);
  const [formData, setFormData] = useState({ firstName: "", lastName: "", email: "", phone: "", expectedSalary: "" });

  const { mutate: submit, isPending } = useSubmitCandidate({
    mutation: {
      onSuccess: () => {
        toast({ title: "Candidate submitted successfully!" });
        setLocation("/vendor/candidates");
      },
      onError: (err: any) => {
        toast({ 
          title: "Submission failed", 
          description: err?.message || "This candidate might already be submitted for this role.",
          variant: "destructive" 
        });
      }
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submit({
      data: {
        ...formData,
        expectedSalary: formData.expectedSalary ? Number(formData.expectedSalary) : undefined,
        roleId
      }
    });
  };

  return (
    <DashboardLayout allowedRoles={["vendor"]}>
       <div className="max-w-2xl mx-auto">
        <Link href="/vendor/positions" className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-primary transition-colors mb-6">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Positions
        </Link>
        
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Submit Candidate</h1>
          {roleLoading ? <Loader2 className="w-4 h-4 animate-spin mt-2" /> : (
            <p className="text-slate-500 mt-1">For <span className="font-semibold text-primary">{role?.title}</span> at {role?.companyName}</p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-lg shadow-black/5 border border-slate-100 p-8 space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold">First Name</label>
              <Input required value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} className="h-12 rounded-xl" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Last Name</label>
              <Input required value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} className="h-12 rounded-xl" />
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-semibold">Email Address</label>
            <Input type="email" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="h-12 rounded-xl" />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold">Phone Number</label>
              <Input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="h-12 rounded-xl" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Expected Salary ($)</label>
              <Input type="number" value={formData.expectedSalary} onChange={e => setFormData({...formData, expectedSalary: e.target.value})} className="h-12 rounded-xl" />
            </div>
          </div>

          <Button disabled={isPending} type="submit" className="w-full h-12 rounded-xl mt-4 text-base shadow-md">
            {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Send className="w-4 h-4 mr-2"/> Submit Profile</>}
          </Button>
        </form>
      </div>
    </DashboardLayout>
  );
}
