"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronDown, DollarSign, Calendar, FileText, Users, AlertCircle } from "lucide-react";
import SiteLocationPicker from "@/components/deals/site-location-picker";

interface Stage { id: string; name: string; color: string }
interface TeamUser { id: string; name: string; role: string; department: string }
interface Deal {
  id: string;
  title: string;
  value: number;
  budget: number | null;
  stageId: string;
  siteLocation: string | null;
  siteLat: number | null;
  siteLng: number | null;
  requirements: string | null;
  nextContactDate: Date | string | null;
  estimatedCloseDate: Date | string | null;
  notes: string | null;
  customer: { id: string; name: string; companyName: string | null };
  assignees: { user: { id: string; name: string } }[];
}

const roleLabel = (r: string) => r.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

function formatNumberInput(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, "");
  return digits ? Number(digits).toLocaleString("en-US") : "";
}
function parseNumberInput(formatted: string): number {
  return parseFloat(formatted.replace(/,/g, "")) || 0;
}
function initNumberInput(n: number | null | undefined): string {
  if (n == null || n === 0) return "";
  return n.toLocaleString("en-US");
}
const deptColor: Record<string, string> = {
  SALES: "text-blue-600 bg-blue-50",
  DESIGN: "text-violet-600 bg-violet-50",
  OPERATIONS: "text-orange-600 bg-orange-50",
  MANAGEMENT: "text-rose-600 bg-rose-50",
};

function toDateInput(d: Date | string | null | undefined) {
  if (!d) return "";
  return new Date(d).toISOString().split("T")[0];
}

export default function EditDealForm({ deal, stages, users }: { deal: Deal; stages: Stage[]; users: TeamUser[] }) {
  const router = useRouter();

  const [stageId, setStageId] = useState(deal.stageId);
  const [title, setTitle] = useState(deal.title);
  const [value, setValue] = useState(initNumberInput(deal.value));
  const [budget, setBudget] = useState(initNumberInput(deal.budget));
  const [siteLocation, setSiteLocation] = useState(deal.siteLocation ?? "");
  const [siteLat, setSiteLat] = useState<number | null>(deal.siteLat ?? null);
  const [siteLng, setSiteLng] = useState<number | null>(deal.siteLng ?? null);
  const [requirements, setRequirements] = useState(deal.requirements ?? "");
  const [nextContactDate, setNextContactDate] = useState(toDateInput(deal.nextContactDate));
  const [estimatedCloseDate, setEstimatedCloseDate] = useState(toDateInput(deal.estimatedCloseDate));
  const [notes, setNotes] = useState(deal.notes ?? "");
  const [assigneeIds, setAssigneeIds] = useState<string[]>(deal.assignees.map((a) => a.user.id));
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const toggleAssignee = (id: string) => {
    setAssigneeIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: string[] = [];
    if (!value || parseNumberInput(value) <= 0) errs.push("Deal value is required");
    if (!budget || parseNumberInput(budget) <= 0) errs.push("Customer budget is required");
    if (!nextContactDate) errs.push("Next contact date is required");
    if (!estimatedCloseDate) errs.push("Estimated close date is required");
    if (errs.length > 0) { setErrors(errs); setLoading(false); return; }
    setErrors([]);
    setLoading(true);
    try {
      const res = await fetch(`/api/deals/${deal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stageId,
          title,
          value: parseNumberInput(value),
          budget: parseNumberInput(budget),
          siteLocation: siteLocation || null,
          siteLat: siteLat ?? null,
          siteLng: siteLng ?? null,
          requirements: requirements || null,
          nextContactDate: nextContactDate || null,
          estimatedCloseDate: estimatedCloseDate || null,
          notes: notes || null,
          assigneeIds,
        }),
      });
      const data = await res.json();
      if (data.errors) { setErrors(data.errors); setLoading(false); return; }
      if (!res.ok) throw new Error(data.error ?? "Failed to save");
      router.push(`/deals/${deal.id}`);
    } catch (e: any) {
      setErrors([e.message]);
      setLoading(false);
    }
  };

  const selectedStage = stages.find((s) => s.id === stageId);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors">
          <ArrowLeft className="w-4 h-4 text-slate-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Edit Deal</h1>
          <p className="text-slate-500 text-sm mt-0.5">{deal.customer.companyName ?? deal.customer.name}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {errors.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <div className="space-y-1">{errors.map((e) => <p key={e} className="text-sm text-red-700">{e}</p>)}</div>
          </div>
        )}

        {/* Stage */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
          <h2 className="font-semibold text-slate-900">Pipeline Stage</h2>
          <div className="relative">
            <select value={stageId} onChange={(e) => setStageId(e.target.value)}
              className="w-full border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-500 transition-colors appearance-none">
              {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none">
              {selectedStage && <span className="w-2 h-2 rounded-full" style={{ background: selectedStage.color }} />}
              <ChevronDown className="w-4 h-4 text-slate-400" />
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
          <h2 className="font-semibold text-slate-900 flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
              <FileText className="w-3.5 h-3.5 text-white" />
            </div>
            Deal Details
          </h2>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Deal Title <span className="text-red-500">*</span></label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} required
              className="w-full border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-500 transition-colors" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5 text-emerald-500" />Value (THB) <span className="text-red-500">*</span></label>
              <input type="text" inputMode="numeric" value={value} onChange={(e) => setValue(formatNumberInput(e.target.value))} placeholder="0"
                className="w-full border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-500 transition-colors text-right font-mono" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5 text-orange-500" />Budget (THB) <span className="text-red-500">*</span></label>
              <input type="text" inputMode="numeric" value={budget} onChange={(e) => setBudget(formatNumberInput(e.target.value))} placeholder="0"
                className="w-full border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-500 transition-colors text-right font-mono" />
            </div>
          </div>
          <SiteLocationPicker
            value={siteLocation}
            lat={siteLat}
            lng={siteLng}
            onChange={(loc, la, ln) => { setSiteLocation(loc); setSiteLat(la); setSiteLng(ln); }}
          />
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Requirements</label>
            <textarea value={requirements} onChange={(e) => setRequirements(e.target.value)} rows={3}
              className="w-full border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-500 transition-colors resize-none" />
          </div>
        </div>

        {/* Dates */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
          <h2 className="font-semibold text-slate-900 flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center">
              <Calendar className="w-3.5 h-3.5 text-white" />
            </div>
            Key Dates
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Next Contact Date <span className="text-red-500">*</span></label>
              <input type="date" value={nextContactDate} onChange={(e) => setNextContactDate(e.target.value)}
                className="w-full border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-500 transition-colors" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Est. Close Date <span className="text-red-500">*</span></label>
              <input type="date" value={estimatedCloseDate} onChange={(e) => setEstimatedCloseDate(e.target.value)}
                className="w-full border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-500 transition-colors" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              className="w-full border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-500 transition-colors resize-none" />
          </div>
        </div>

        {/* Assignees */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
          <h2 className="font-semibold text-slate-900 flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
              <Users className="w-3.5 h-3.5 text-white" />
            </div>
            Assigned To
          </h2>
          <div className="grid grid-cols-2 gap-2">
            {users.map((u) => {
              const selected = assigneeIds.includes(u.id);
              return (
                <button key={u.id} type="button" onClick={() => toggleAssignee(u.id)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border-2 text-left transition-all ${
                    selected ? "border-violet-500 bg-violet-50" : "border-slate-200 hover:border-slate-300"
                  }`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${selected ? "bg-violet-600 text-white" : "bg-slate-200 text-slate-600"}`}>
                    {u.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-slate-900 truncate">{u.name}</div>
                    <div className={`text-xs px-1.5 py-0.5 rounded-full inline-block mt-0.5 ${deptColor[u.department] ?? "text-slate-500 bg-slate-100"}`}>
                      {roleLabel(u.role)}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={() => router.back()}
            className="flex-1 py-3 rounded-xl border-2 border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={loading || !title}
            className="flex-1 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold hover:from-violet-700 hover:to-indigo-700 disabled:opacity-40 transition-all shadow-lg shadow-violet-100">
            {loading ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
