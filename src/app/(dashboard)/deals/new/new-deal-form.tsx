"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Search, X, ChevronDown, User, DollarSign, Calendar, FileText, Users, AlertCircle } from "lucide-react";
import SiteLocationPicker from "@/components/deals/site-location-picker";

interface Stage { id: string; name: string; color: string; order: number }
interface TeamUser { id: string; name: string; role: string; department: string }
interface CustomerOption { id: string; name: string; companyName: string | null }

interface Props {
  stages: Stage[];
  users: TeamUser[];
  defaultStageId: string;
  currentUserId: string;
  preloadedCustomer?: CustomerOption | null;
}

const roleLabel = (r: string) => r.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

function formatNumberInput(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, "");
  return digits ? Number(digits).toLocaleString("en-US") : "";
}
function parseNumberInput(formatted: string): number {
  return parseFloat(formatted.replace(/,/g, "")) || 0;
}
const deptColor: Record<string, string> = {
  SALES: "text-blue-600 bg-blue-50",
  DESIGN: "text-violet-600 bg-violet-50",
  OPERATIONS: "text-orange-600 bg-orange-50",
  MANAGEMENT: "text-rose-600 bg-rose-50",
};

export default function NewDealForm({ stages, users, defaultStageId, currentUserId, preloadedCustomer }: Props) {
  const router = useRouter();

  const [customer, setCustomer] = useState<CustomerOption | null>(preloadedCustomer ?? null);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<CustomerOption[]>([]);
  const [customerOpen, setCustomerOpen] = useState(false);

  const [stageId, setStageId] = useState(defaultStageId);
  const [title, setTitle] = useState("");
  const [value, setValue] = useState("");
  const [budget, setBudget] = useState("");
  const [siteLocation, setSiteLocation] = useState("");
  const [siteLat, setSiteLat] = useState<number | null>(null);
  const [siteLng, setSiteLng] = useState<number | null>(null);
  const [requirements, setRequirements] = useState("");
  const [nextContactDate, setNextContactDate] = useState("");
  const [estimatedCloseDate, setEstimatedCloseDate] = useState("");
  const [notes, setNotes] = useState("");
  const [assigneeIds, setAssigneeIds] = useState<string[]>([currentUserId]);

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const searchTimer = useRef<ReturnType<typeof setTimeout>>();

  // Customer autocomplete
  useEffect(() => {
    if (!customerQuery.trim()) { setCustomerResults([]); return; }
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      const res = await fetch(`/api/customers?q=${encodeURIComponent(customerQuery)}`);
      const data = await res.json();
      setCustomerResults(data.customers ?? []);
    }, 300);
  }, [customerQuery]);

  const selectCustomer = (c: CustomerOption) => {
    setCustomer(c);
    setCustomerQuery("");
    setCustomerResults([]);
    setCustomerOpen(false);
  };

  const toggleAssignee = (id: string) => {
    setAssigneeIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: string[] = [];
    if (!customer) errs.push("Please select a customer");
    if (!value || parseNumberInput(value) <= 0) errs.push("Deal value is required");
    if (!budget || parseNumberInput(budget) <= 0) errs.push("Customer budget is required");
    if (!nextContactDate) errs.push("Next contact date is required");
    if (!estimatedCloseDate) errs.push("Estimated close date is required");
    if (errs.length > 0) { setErrors(errs); return; }
    setErrors([]);
    setLoading(true);
    try {
      const res = await fetch("/api/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: customer!.id,
          stageId,
          title,
          value: parseNumberInput(value),
          budget: parseNumberInput(budget),
          siteLocation: siteLocation || undefined,
          siteLat: siteLat ?? undefined,
          siteLng: siteLng ?? undefined,
          requirements: requirements || undefined,
          nextContactDate,
          estimatedCloseDate,
          notes: notes || undefined,
          assigneeIds,
        }),
      });
      const data = await res.json();
      if (data.errors) { setErrors(data.errors); setLoading(false); return; }
      if (!res.ok) throw new Error(data.error ?? "Failed to create deal");
      router.push(`/deals/${data.deal.id}`);
    } catch (e: any) {
      setErrors([e.message]);
      setLoading(false);
    }
  };

  const selectedStage = stages.find((s) => s.id === stageId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors">
          <ArrowLeft className="w-4 h-4 text-slate-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">New Deal</h1>
          <p className="text-slate-500 text-sm mt-0.5">Create a new deal in the pipeline</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {errors.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              {errors.map((e) => <p key={e} className="text-sm text-red-700">{e}</p>)}
            </div>
          </div>
        )}

        {/* Customer + Stage */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
          <h2 className="font-semibold text-slate-900 flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <User className="w-3.5 h-3.5 text-white" />
            </div>
            Customer &amp; Stage
          </h2>

          {/* Customer autocomplete */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Customer <span className="text-red-500">*</span></label>
            {customer ? (
              <div className="flex items-center gap-3 bg-violet-50 border-2 border-violet-200 rounded-xl px-4 py-2.5">
                <div className="flex-1">
                  <div className="font-semibold text-slate-900 text-sm">{customer.companyName ?? customer.name}</div>
                  {customer.companyName && <div className="text-xs text-slate-500">{customer.name}</div>}
                </div>
                <button type="button" onClick={() => setCustomer(null)} className="text-slate-400 hover:text-red-500 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <div className="flex items-center border-2 border-slate-200 rounded-xl focus-within:border-violet-500 transition-colors overflow-hidden">
                  <Search className="w-4 h-4 text-slate-400 ml-4 shrink-0" />
                  <input
                    value={customerQuery}
                    onChange={(e) => { setCustomerQuery(e.target.value); setCustomerOpen(true); }}
                    onFocus={() => setCustomerOpen(true)}
                    placeholder="Search customer by name or company..."
                    className="flex-1 px-3 py-2.5 text-sm focus:outline-none"
                  />
                </div>
                {customerOpen && customerResults.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden">
                    {customerResults.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => selectCustomer(c)}
                        className="w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0"
                      >
                        <div className="font-medium text-slate-900 text-sm">{c.companyName ?? c.name}</div>
                        {c.companyName && <div className="text-xs text-slate-500">{c.name}</div>}
                      </button>
                    ))}
                  </div>
                )}
                {customerOpen && customerQuery && customerResults.length === 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white rounded-xl border border-slate-200 shadow-lg px-4 py-3">
                    <p className="text-sm text-slate-400">No customers found</p>
                    <button type="button" onClick={() => router.push("/customers/new")} className="text-xs text-violet-600 hover:underline mt-1">
                      + Create new customer
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Stage */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Pipeline Stage <span className="text-red-500">*</span></label>
            <div className="relative">
              <select
                value={stageId}
                onChange={(e) => setStageId(e.target.value)}
                className="w-full border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-500 transition-colors appearance-none"
              >
                {stages.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none">
                {selectedStage && <span className="w-2 h-2 rounded-full" style={{ background: selectedStage.color }} />}
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Deal Details */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
          <h2 className="font-semibold text-slate-900 flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
              <FileText className="w-3.5 h-3.5 text-white" />
            </div>
            Deal Details
          </h2>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Deal Title <span className="text-red-500">*</span></label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="e.g. Luxury Condo Interior Design - Unit 12A"
              className="w-full border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-500 transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-emerald-500" />Deal Value (THB) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={value}
                onChange={(e) => setValue(formatNumberInput(e.target.value))}
                placeholder="0"
                className="w-full border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-500 transition-colors text-right font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-orange-500" />Customer Budget (THB) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={budget}
                onChange={(e) => setBudget(formatNumberInput(e.target.value))}
                placeholder="0"
                className="w-full border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-500 transition-colors text-right font-mono"
              />
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
            <textarea
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
              rows={3}
              placeholder="Customer requirements, scope of work..."
              className="w-full border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-500 transition-colors resize-none"
            />
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
              <input
                type="date"
                value={nextContactDate}
                onChange={(e) => setNextContactDate(e.target.value)}
                className="w-full border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-500 transition-colors"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Est. Close Date <span className="text-red-500">*</span></label>
              <input
                type="date"
                value={estimatedCloseDate}
                onChange={(e) => setEstimatedCloseDate(e.target.value)}
                className="w-full border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-500 transition-colors"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Additional notes..."
              className="w-full border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-500 transition-colors resize-none"
            />
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
                <button
                  key={u.id}
                  type="button"
                  onClick={() => toggleAssignee(u.id)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border-2 text-left transition-all ${
                    selected ? "border-violet-500 bg-violet-50" : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    selected ? "bg-violet-600 text-white" : "bg-slate-200 text-slate-600"
                  }`}>
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
          <button type="submit" disabled={loading || !title || !customer}
            className="flex-1 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold hover:from-violet-700 hover:to-indigo-700 disabled:opacity-40 transition-all shadow-lg shadow-violet-100">
            {loading ? "Creating..." : "Create Deal"}
          </button>
        </div>
      </form>
    </div>
  );
}
