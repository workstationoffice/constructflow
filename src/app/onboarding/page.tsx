"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Building2, Zap, CheckCircle, ArrowRight, User, Hash, Mail } from "lucide-react";

export default function OnboardingPage() {
  const router = useRouter();
  const [yourName, setYourName]       = useState("");
  const [companyName, setCompanyName] = useState("");
  const [slug, setSlug]               = useState("");
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState("");
  const [pendingInvite, setPendingInvite] = useState<{ company: string; role: string } | null>(null);
  const [checkingInvite, setCheckingInvite] = useState(true);

  // Check for pending invite on mount
  useEffect(() => {
    fetch("/api/onboarding/check-invite")
      .then((r) => r.json())
      .then((d) => {
        if (d.invite) setPendingInvite(d.invite);
      })
      .catch(() => {})
      .finally(() => setCheckingInvite(false));
  }, []);

  const handleCompanyName = (val: string) => {
    setCompanyName(val);
    setSlug(val.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, ""));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          pendingInvite
            ? { yourName, companyName: "", slug: "" }
            : { companyName, slug, yourName }
        ),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.push("/dashboard");
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  };

  const filled = pendingInvite
    ? [yourName].filter(Boolean).length
    : [yourName, companyName, slug].filter(Boolean).length;

  const steps = pendingInvite
    ? ["Your name"]
    : ["Your name", "Company name", "Company ID"];

  if (checkingInvite) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="animate-spin w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-slate-100">

      {/* ── Left panel ────────────────────────────────── */}
      <div className="hidden lg:flex w-96 bg-gradient-to-b from-indigo-950 via-violet-950 to-purple-950 flex-col justify-between p-10 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
            <Zap className="w-4 h-4 text-yellow-300" />
          </div>
          <span className="text-base font-bold text-white tracking-tight">BuildFlow</span>
        </div>

        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-white leading-snug">
              Built for interior design &amp; construction teams
            </h2>
            <p className="text-white/55 mt-3 text-sm leading-relaxed">
              Track your field team&apos;s visits, manage deals, and keep every project on track — all in one place.
            </p>
          </div>
          <div className="space-y-3">
            {[
              "GPS check-in with selfie verification",
              "Kanban CRM with deal pipeline",
              "Google & Microsoft Calendar sync",
              "LINE & email notifications",
            ].map((f) => (
              <div key={f} className="flex items-center gap-2.5">
                <div className="w-5 h-5 rounded-full bg-emerald-400/20 flex items-center justify-center shrink-0">
                  <CheckCircle className="w-3 h-3 text-emerald-400" />
                </div>
                <span className="text-white/70 text-sm">{f}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-white/25 text-xs">© 2025 BuildFlow</p>
      </div>

      {/* ── Right panel ───────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">

          {/* Invite banner */}
          {pendingInvite && (
            <div className="mb-6 bg-emerald-50 border border-emerald-200 rounded-2xl px-5 py-4 flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-500 flex items-center justify-center shrink-0 mt-0.5">
                <Mail className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="font-semibold text-emerald-900">You&apos;ve been invited!</p>
                <p className="text-emerald-700 text-sm mt-0.5">
                  Join <strong>{pendingInvite.company}</strong> as <strong>{pendingInvite.role}</strong>
                </p>
              </div>
            </div>
          )}

          {/* Progress dots */}
          <div className="flex items-center gap-3 mb-8 justify-center">
            {steps.map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  i < filled ? "bg-emerald-500 text-white" :
                  i === filled ? "bg-violet-600 text-white" :
                  "bg-white border-2 border-slate-200 text-slate-400"
                }`}>
                  {i < filled ? <CheckCircle className="w-3.5 h-3.5" /> : i + 1}
                </div>
                <span className={`text-xs font-medium hidden sm:block ${i <= filled ? "text-slate-700" : "text-slate-400"}`}>{s}</span>
                {i < steps.length - 1 && <div className={`w-8 h-0.5 rounded-full ${i < filled ? "bg-violet-400" : "bg-slate-200"}`} />}
              </div>
            ))}
          </div>

          {/* Card */}
          <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="bg-gradient-to-r from-violet-600 to-indigo-600 px-8 py-6">
              <div className="w-11 h-11 bg-white/20 rounded-2xl flex items-center justify-center mb-3">
                <Building2 className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-xl font-bold text-white">
                {pendingInvite ? "Accept your invitation" : "Set up your workspace"}
              </h1>
              <p className="text-white/65 text-sm mt-0.5">Takes less than a minute</p>
            </div>

            <form onSubmit={handleSubmit} className="px-8 py-6 space-y-5">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm">{error}</div>
              )}

              {/* Your name */}
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                  <User className="w-3.5 h-3.5 text-violet-500" /> Your name
                </label>
                <input
                  type="text"
                  value={yourName}
                  onChange={(e) => setYourName(e.target.value)}
                  placeholder="e.g. Somchai Jaidee"
                  required
                  className="w-full border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-500 transition-colors placeholder:text-slate-300"
                />
              </div>

              {/* Company fields only for new tenant */}
              {!pendingInvite && (
                <>
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                      <Building2 className="w-3.5 h-3.5 text-pink-500" /> Company name
                    </label>
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => handleCompanyName(e.target.value)}
                      placeholder="e.g. ABC Interior Design Co."
                      required
                      className="w-full border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-500 transition-colors placeholder:text-slate-300"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                      <Hash className="w-3.5 h-3.5 text-blue-500" /> Company ID
                      <span className="text-slate-400 font-normal text-xs">(used in URLs)</span>
                    </label>
                    <div className="flex items-center border-2 border-slate-200 rounded-xl overflow-hidden focus-within:border-violet-500 transition-colors">
                      <span className="text-xs text-slate-400 bg-slate-50 border-r border-slate-200 px-3 py-2.5 font-mono shrink-0">app/</span>
                      <input
                        type="text"
                        value={slug}
                        onChange={(e) => setSlug(e.target.value)}
                        placeholder="abc-interior"
                        required
                        className="flex-1 px-3 py-2.5 text-sm font-mono focus:outline-none placeholder:text-slate-300"
                      />
                    </div>
                  </div>
                </>
              )}

              <button
                type="submit"
                disabled={loading || !yourName || (!pendingInvite && (!companyName || !slug))}
                className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white py-3 rounded-xl font-semibold hover:from-violet-700 hover:to-indigo-700 disabled:opacity-40 transition-all flex items-center justify-center gap-2 shadow-lg shadow-violet-100"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    Setting up...
                  </span>
                ) : (
                  <>
                    {pendingInvite ? "Join Company" : "Launch workspace"}
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
