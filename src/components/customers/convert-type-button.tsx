"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, Building2, User, Loader2, AlertCircle } from "lucide-react";

interface Props {
  customerId: string;
  currentType: "PERSONAL" | "COMPANY";
  currentName: string;
  companyName: string | null;
}

export default function ConvertTypeButton({ customerId, currentType, currentName, companyName }: Props) {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState("");

  const targetType = currentType === "PERSONAL" ? "COMPANY" : "PERSONAL";

  const handleConvert = async () => {
    setLoading(true);
    setError("");
    try {
      const body: Record<string, unknown> = { type: targetType };

      if (targetType === "COMPANY") {
        // Use current name as company name if not set
        body.companyName = companyName || currentName;
      } else {
        // Use company name as the customer name
        body.name = companyName || currentName;
        body.companyName = null;
      }

      const res = await fetch(`/api/customers/${customerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Conversion failed");

      setShowConfirm(false);
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Conversion failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => { setShowConfirm(true); setError(""); }}
        className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors"
      >
        <ArrowLeftRight className="w-3.5 h-3.5" />
        Convert to {targetType === "COMPANY" ? "Company" : "Personal"}
      </button>

      {showConfirm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                <ArrowLeftRight className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h2 className="font-semibold text-slate-900">Convert to {targetType === "COMPANY" ? "Company" : "Personal"}?</h2>
                <p className="text-sm text-slate-500 mt-0.5">This changes how this customer is managed.</p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm">
              {targetType === "COMPANY" ? (
                <>
                  <div className="flex items-center gap-2 text-slate-700">
                    <Building2 className="w-4 h-4 text-violet-500 shrink-0" />
                    Company name will be set to <span className="font-medium">&quot;{companyName || currentName}&quot;</span>
                  </div>
                  <div className="text-slate-500 text-xs pl-6">Contact persons section will become available.</div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 text-slate-700">
                    <User className="w-4 h-4 text-violet-500 shrink-0" />
                    Customer name will be <span className="font-medium">&quot;{companyName || currentName}&quot;</span>
                  </div>
                  <div className="text-slate-500 text-xs pl-6">Existing contact persons will be hidden but not deleted.</div>
                </>
              )}
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <AlertCircle className="w-4 h-4 shrink-0" />{error}
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                disabled={loading}
                className="flex-1 py-2.5 rounded-xl border-2 border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition-colors disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConvert}
                disabled={loading}
                className="flex-1 py-2.5 rounded-xl bg-violet-600 text-white font-semibold hover:bg-violet-700 transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Converting...</> : "Confirm Convert"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
