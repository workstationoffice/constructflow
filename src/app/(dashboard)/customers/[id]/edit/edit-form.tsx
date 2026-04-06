"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2, User, Phone, Mail, MessageCircle, MapPin,
  FileText, Plus, Trash2, ArrowLeft, Hash, AlertCircle, CheckCircle,
  Home, Truck, Star, Search, Loader2,
} from "lucide-react";
import ThaiAddressFields from "@/components/ui/thai-address-fields";

interface AddressRow {
  id?: string;
  label: string;
  address: string;
  subDistrict: string;
  district: string;
  province: string;
  postalCode: string;
  isDefaultBilling: boolean;
  isDefaultShipping: boolean;
}

interface ContactPersonRow {
  id?: string;
  name: string;
  position: string;
  phone: string;
  email: string;
  lineId: string;
  isPrimary: boolean;
}

interface Customer {
  id: string;
  type: "PERSONAL" | "COMPANY";
  name: string;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  lineId: string | null;
  taxId: string | null;
  notes: string | null;
  addresses: AddressRow[];
  contactPersons: ContactPersonRow[];
}

// ── Tax ID helpers ─────────────────────────────────────────────────────────
function formatTaxId(raw: string) { return raw.replace(/\D/g, "").slice(0, 13); }
function validateTaxId(v: string): string {
  if (!v) return "";
  if (v.length !== 13) return `Tax ID must be 13 digits (${v.length}/13)`;
  return "";
}

// ── Phone helpers ──────────────────────────────────────────────────────────
function parseStoredPhone(stored: string | null): string {
  if (!stored) return "";
  let d = stored.replace(/\D/g, "");
  if (d.startsWith("66")) d = d.slice(2);
  if (d.startsWith("0")) d = d.slice(1);
  return d.slice(0, 9);
}
function normalizePhoneInput(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("0")) d = d.slice(1);
  if (d.startsWith("66")) d = d.slice(2);
  return d.slice(0, 9);
}
function formatPhoneDisplay(digits: string): string {
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`;
}
function validatePhone(digits: string): string {
  if (!digits) return "";
  if (digits.length !== 9) return `Must be 9 digits after +66 (${digits.length}/9)`;
  if (!/^[689]/.test(digits)) return "Must start with 6, 8, or 9";
  return "";
}
function toStoredPhone(digits: string) { return digits ? `+66${digits}` : ""; }

const emptyAddress = (first = false): AddressRow => ({ label: "", address: "", subDistrict: "", district: "", province: "", postalCode: "", isDefaultBilling: first, isDefaultShipping: first });
const emptyContact = (): ContactPersonRow => ({ name: "", position: "", phone: "", email: "", lineId: "", isPrimary: false });

export default function EditCustomerForm({ customer }: { customer: Customer }) {
  const router = useRouter();

  const [type, setType]               = useState(customer.type);
  const [name, setName]               = useState(customer.name);
  const [companyName, setCompanyName] = useState(customer.companyName ?? "");
  const [taxId, setTaxId]             = useState(customer.taxId ?? "");
  const [notes, setNotes]             = useState(customer.notes ?? "");

  // Personal-only fields
  const [phoneDigits, setPhoneDigits] = useState(parseStoredPhone(customer.phone));
  const [email, setEmail]             = useState(customer.email ?? "");
  const [lineId, setLineId]           = useState(customer.lineId ?? "");

  const [addresses, setAddresses] = useState<AddressRow[]>(
    customer.addresses.length > 0
      ? customer.addresses.map((a) => ({
          ...a,
          label:       a.label ?? "",
          subDistrict: (a as any).subDistrict ?? "",
          district:    (a as any).district ?? "",
          province:    (a as any).province ?? "",
          postalCode:  (a as any).postalCode ?? "",
        }))
      : [emptyAddress(true)]
  );

  const [contacts, setContacts] = useState<ContactPersonRow[]>(
    customer.contactPersons.length > 0
      ? customer.contactPersons.map((c) => ({
          ...c,
          position: c.position ?? "",
          phone: parseStoredPhone(c.phone ?? null),
          email: c.email ?? "",
          lineId: c.lineId ?? "",
          isPrimary: (c as any).isPrimary ?? false,
        }))
      : [emptyContact()]
  );

  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState("");

  // DBD
  const [dbdLoading, setDbdLoading]   = useState(false);
  const [dbdResult, setDbdResult]     = useState<{ nameTh?: string; type?: string; status?: string; address?: string } | null>(null);
  const [dbdError, setDbdError]       = useState("");
  const [dbdConfirm, setDbdConfirm]   = useState(false);

  const taxIdError  = validateTaxId(taxId);
  const phoneError  = validatePhone(phoneDigits);

  const performDbd = async () => {
    setDbdConfirm(false);
    setDbdError(""); setDbdResult(null);
    setDbdLoading(true);
    try {
      const res  = await fetch(`/api/dbd-lookup?taxId=${taxId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "DBD lookup failed");
      setDbdResult(data);
      if (data.nameTh) setCompanyName(data.nameTh);
      if (data.address) {
        setAddresses([{ label: "สำนักงานใหญ่", address: data.address, subDistrict: "", district: "", province: "", postalCode: "", isDefaultBilling: true, isDefaultShipping: true }]);
      }
    } catch (e: any) { setDbdError(e.message); }
    finally { setDbdLoading(false); }
  };

  const lookupDbd = () => {
    if (taxIdError || !taxId) { setDbdError("Enter a valid 13-digit Tax ID first"); return; }
    setDbdError(""); setDbdResult(null);
    setDbdConfirm(true);
  };

  // ── Address helpers ────────────────────────────────────────────────────
  const updateAddress = (i: number, field: keyof AddressRow, value: any) => {
    setAddresses((prev) => {
      const next = prev.map((a, idx) => (idx === i ? { ...a, [field]: value } : a));
      if (field === "isDefaultBilling" && value === true)
        return next.map((a, idx) => ({ ...a, isDefaultBilling: idx === i }));
      if (field === "isDefaultShipping" && value === true)
        return next.map((a, idx) => ({ ...a, isDefaultShipping: idx === i }));
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (taxId && taxIdError) { setError(taxIdError); return; }
    if (type === "PERSONAL" && phoneDigits && phoneError) { setError(phoneError); return; }
    if (type === "PERSONAL" && !phoneDigits && !email && !lineId) { setError("Please provide at least one contact: Phone, Email, or LINE ID"); return; }

    setError("");
    setLoading(true);
    try {
      const filledContacts  = contacts.filter((c) => c.name.trim()).map(({ id: _id, ...rest }) => ({
        ...rest,
        phone: rest.phone ? toStoredPhone(normalizePhoneInput(rest.phone)) : undefined,
      }));
      const filledAddresses = addresses.filter((a) => a.address.trim() || a.subDistrict.trim() || a.province.trim()).map(({ id: _id, ...rest }) => rest);

      const res = await fetch(`/api/customers/${customer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          name: type === "COMPANY" ? companyName : name,
          companyName: type === "COMPANY" ? companyName || undefined : null,
          taxId: taxId || null,
          notes: notes || null,
          // Personal only
          ...(type === "PERSONAL"
            ? { phone: toStoredPhone(phoneDigits) || null, email: email || null, lineId: lineId || null }
            : { phone: null, email: null, lineId: null }),
          addresses: filledAddresses,
          contactPersons: filledContacts,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to update customer");
      router.push(`/customers/${customer.id}`);
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      {/* DBD Confirmation Dialog */}
      {dbdConfirm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                <Search className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h2 className="font-semibold text-slate-900">Get info from DBD?</h2>
                <p className="text-sm text-slate-500 mt-0.5">This will overwrite existing data.</p>
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800 space-y-1">
              <p className="font-medium">The following will be replaced:</p>
              <ul className="list-disc list-inside text-xs space-y-0.5 text-amber-700">
                <li>Company name</li>
                <li>Address (replaced with registered address)</li>
              </ul>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setDbdConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border-2 border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button type="button" onClick={performDbd}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold hover:from-amber-600 hover:to-orange-600 transition-all shadow-sm">
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors">
          <ArrowLeft className="w-4 h-4 text-slate-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Edit Customer</h1>
          <p className="text-slate-500 text-sm mt-0.5">{customer.companyName ?? customer.name}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        {/* ── Type toggle ──────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
          <h2 className="font-semibold text-slate-900 flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <User className="w-3.5 h-3.5 text-white" />
            </div>
            Customer Type
          </h2>
          <div className="flex gap-3">
            {(["COMPANY", "PERSONAL"] as const).map((t) => (
              <button key={t} type="button" onClick={() => setType(t)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${
                  type === t ? "border-violet-500 bg-violet-50 text-violet-700" : "border-slate-200 text-slate-500 hover:border-slate-300"
                }`}>
                {t === "COMPANY" ? <Building2 className="w-4 h-4" /> : <User className="w-4 h-4" />}
                {t === "COMPANY" ? "Company (นิติบุคคล)" : "Personal (บุคคลธรรมดา)"}
              </button>
            ))}
          </div>
        </div>

        {/* ── Tax ID ───────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
          <h2 className="font-semibold text-slate-900 flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
              <Hash className="w-3.5 h-3.5 text-white" />
            </div>
            {type === "COMPANY" ? "Tax ID &amp; DBD Lookup" : "Tax ID (เลขประจำตัวประชาชน)"}
          </h2>
          <div className="space-y-2">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  value={taxId}
                  onChange={(e) => { setTaxId(formatTaxId(e.target.value)); setDbdResult(null); setDbdError(""); }}
                  inputMode="numeric"
                  maxLength={13}
                  placeholder="0000000000000"
                  className={`w-full border-2 rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none transition-colors ${
                    taxId && taxIdError ? "border-red-400 bg-red-50" :
                    taxId && !taxIdError ? "border-emerald-400 bg-emerald-50" :
                    "border-slate-200 focus:border-violet-500"
                  }`}
                />
                {taxId && (
                  <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono font-semibold ${taxId.length === 13 ? "text-emerald-600" : "text-slate-400"}`}>
                    {taxId.length}/13
                  </span>
                )}
              </div>
              {type === "COMPANY" && (
                <button type="button" onClick={lookupDbd} disabled={dbdLoading || !!taxIdError || taxId.length !== 13}
                  className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:from-amber-600 hover:to-orange-600 disabled:opacity-40 transition-all whitespace-nowrap shadow-sm">
                  {dbdLoading ? <><Loader2 className="w-4 h-4 animate-spin" />Fetching...</> : <><Search className="w-4 h-4" />Get from DBD</>}
                </button>
              )}
            </div>
            {taxId && taxIdError  && <p className="text-xs text-red-600 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" />{taxIdError}</p>}
            {taxId && !taxIdError && <p className="text-xs text-emerald-600 flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" />Valid 13-digit Tax ID</p>}
            {dbdError && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /><p>{dbdError}</p>
              </div>
            )}
            {dbdResult && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 space-y-1">
                <p className="text-xs font-semibold text-emerald-700 flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5" />ดึงข้อมูลสำเร็จ — กรอกอัตโนมัติแล้ว</p>
                <div className="text-xs text-emerald-800 space-y-0.5">
                  {dbdResult.nameTh && <p><span className="font-medium">ชื่อ:</span> {dbdResult.nameTh}</p>}
                  {dbdResult.type   && <p><span className="font-medium">ประเภท:</span> {dbdResult.type}</p>}
                  {dbdResult.status && <p><span className="font-medium">สถานะ:</span> <span className={dbdResult.status.includes("ยัง") ? "text-emerald-700 font-semibold" : "text-orange-700"}>{dbdResult.status}</span></p>}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Basic Info ────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
          <h2 className="font-semibold text-slate-900 flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
              <Building2 className="w-3.5 h-3.5 text-white" />
            </div>
            {type === "COMPANY" ? "Company Information" : "Personal Information"}
          </h2>

          {type === "COMPANY" && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Company Name <span className="text-red-500">*</span></label>
              <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} required
                placeholder="e.g. บริษัท เอบีซี อินทีเรีย จำกัด"
                className="w-full border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-500 transition-colors" />
            </div>
          )}

          {type === "PERSONAL" && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Full Name <span className="text-red-500">*</span></label>
              <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="ชื่อ-นามสกุล"
                className="w-full border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-500 transition-colors" />
            </div>
          )}

          {/* Personal only: phone, email, LINE */}
          {type === "PERSONAL" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-blue-500" />Phone</label>
                  <div className={`flex items-center border-2 rounded-xl overflow-hidden transition-colors ${
                    phoneDigits && phoneError ? "border-red-400" :
                    phoneDigits && !phoneError ? "border-emerald-400" :
                    "border-slate-200 focus-within:border-violet-500"
                  }`}>
                    <span className="px-3 py-2.5 bg-slate-50 border-r border-slate-200 text-sm font-semibold text-slate-600 shrink-0 select-none">+66</span>
                    <input value={formatPhoneDisplay(phoneDigits)} onChange={(e) => setPhoneDigits(normalizePhoneInput(e.target.value))}
                      inputMode="tel" placeholder="81-234-5678" className="flex-1 px-3 py-2.5 text-sm focus:outline-none bg-white" />
                  </div>
                  {phoneDigits && phoneError  && <p className="text-xs text-red-600 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" />{phoneError}</p>}
                  {phoneDigits && !phoneError && <p className="text-xs text-emerald-600 flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" />+66{phoneDigits}</p>}
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-slate-400" />Email</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com"
                    className="w-full border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-500 transition-colors" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5"><MessageCircle className="w-3.5 h-3.5 text-green-500" />LINE ID</label>
                <input value={lineId} onChange={(e) => setLineId(e.target.value)} placeholder="@lineid"
                  className="w-full border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-500 transition-colors" />
              </div>
              {!phoneDigits && !email && !lineId && (
                <p className="text-xs text-amber-600 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" />At least one of Phone, Email, or LINE ID is required</p>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5"><FileText className="w-3.5 h-3.5 text-slate-400" />Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Internal notes..."
              className="w-full border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-500 transition-colors resize-none" />
          </div>
        </div>

        {/* ── Addresses ──────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-900 flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center">
                <MapPin className="w-3.5 h-3.5 text-white" />
              </div>
              Addresses
            </h2>
            <button type="button" onClick={() => setAddresses((p) => [...p, emptyAddress(false)])}
              className="flex items-center gap-1.5 text-xs text-violet-600 font-semibold bg-violet-50 hover:bg-violet-100 px-3 py-1.5 rounded-lg transition-colors">
              <Plus className="w-3.5 h-3.5" /> Add Address
            </button>
          </div>

          <div className="space-y-3">
            {addresses.map((a, i) => (
              <div key={i} className={`rounded-xl border-2 p-4 space-y-3 transition-colors ${
                a.isDefaultBilling && a.isDefaultShipping ? "border-violet-300 bg-violet-50/50" :
                a.isDefaultBilling  ? "border-blue-300 bg-blue-50/50" :
                a.isDefaultShipping ? "border-orange-300 bg-orange-50/50" :
                "border-slate-200 bg-slate-50"
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
                    {a.isDefaultBilling  && <span className="flex items-center gap-1 text-xs font-semibold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full"><Home className="w-3 h-3" />Default Billing</span>}
                    {a.isDefaultShipping && <span className="flex items-center gap-1 text-xs font-semibold text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full"><Truck className="w-3 h-3" />Default Shipping</span>}
                    {!a.isDefaultBilling && !a.isDefaultShipping && <span className="text-xs text-slate-400 font-medium">Address #{i + 1}</span>}
                  </div>
                  {addresses.length > 1 && (
                    <button type="button" onClick={() => setAddresses((p) => p.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600">Label</label>
                  <input value={a.label} onChange={(e) => updateAddress(i, "label", e.target.value)}
                    placeholder="e.g. สำนักงานใหญ่, สาขา 1"
                    className="w-full border border-slate-200 bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500 transition-colors" />
                </div>

                <ThaiAddressFields
                  value={{ address: a.address, subDistrict: a.subDistrict, district: a.district, province: a.province, postalCode: a.postalCode }}
                  onChange={(v) => setAddresses((prev) => prev.map((x, idx) => idx === i ? { ...x, ...v } : x))}
                />

                <div className="flex items-center gap-4 pt-1">
                  <label className={`flex items-center gap-2 cursor-pointer select-none text-sm font-medium rounded-lg px-3 py-1.5 transition-colors ${
                    a.isDefaultBilling ? "bg-blue-100 text-blue-700" : "text-slate-500 hover:bg-slate-100"
                  }`}>
                    <input type="checkbox" checked={a.isDefaultBilling} onChange={(e) => updateAddress(i, "isDefaultBilling", e.target.checked)}
                      className="accent-blue-600 w-3.5 h-3.5" />
                    <Home className="w-3.5 h-3.5" /> Default Billing
                  </label>
                  <label className={`flex items-center gap-2 cursor-pointer select-none text-sm font-medium rounded-lg px-3 py-1.5 transition-colors ${
                    a.isDefaultShipping ? "bg-orange-100 text-orange-700" : "text-slate-500 hover:bg-slate-100"
                  }`}>
                    <input type="checkbox" checked={a.isDefaultShipping} onChange={(e) => updateAddress(i, "isDefaultShipping", e.target.checked)}
                      className="accent-orange-500 w-3.5 h-3.5" />
                    <Truck className="w-3.5 h-3.5" /> Default Shipping
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Contact Persons (Company only) ───────────────────────────── */}
        {type === "COMPANY" && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-900 flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                  <User className="w-3.5 h-3.5 text-white" />
                </div>
                Contact Persons
              </h2>
              <button type="button" onClick={() => setContacts((p) => [...p, emptyContact()])}
                className="flex items-center gap-1.5 text-xs text-violet-600 font-semibold bg-violet-50 hover:bg-violet-100 px-3 py-1.5 rounded-lg transition-colors">
                <Plus className="w-3.5 h-3.5" /> Add Contact
              </button>
            </div>
            <div className="space-y-3">
              {contacts.map((c, i) => (
                <div key={i} className={`rounded-xl p-4 border ${c.isPrimary ? "border-amber-300 bg-amber-50/50" : "bg-slate-50 border-slate-200"}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {c.isPrimary
                        ? <span className="flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full"><Star className="w-3 h-3 fill-amber-500 text-amber-500" />Primary</span>
                        : <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Contact #{i + 1}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      {!c.isPrimary && (
                        <button type="button"
                          onClick={() => setContacts((p) => p.map((x, idx) => ({ ...x, isPrimary: idx === i })))}
                          className="text-xs text-amber-600 hover:text-amber-700 font-medium flex items-center gap-1">
                          <Star className="w-3 h-3" />Set Primary
                        </button>
                      )}
                      {contacts.length > 1 && (
                        <button type="button" onClick={() => setContacts((p) => p.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-600">Name <span className="text-red-400">*</span></label>
                      <input value={c.name} onChange={(e) => setContacts((p) => p.map((x, idx) => idx === i ? { ...x, name: e.target.value } : x))}
                        placeholder="Full name" className="w-full border border-slate-200 bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500 transition-colors" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-600">Position</label>
                      <input value={c.position} onChange={(e) => setContacts((p) => p.map((x, idx) => idx === i ? { ...x, position: e.target.value } : x))}
                        placeholder="e.g. Procurement Manager" className="w-full border border-slate-200 bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500 transition-colors" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-600">Phone</label>
                      <div className="flex items-center border border-slate-200 bg-white rounded-lg overflow-hidden focus-within:border-violet-500 transition-colors">
                        <span className="px-2 py-2 bg-slate-50 border-r border-slate-200 text-xs font-semibold text-slate-500 select-none">+66</span>
                        <input value={formatPhoneDisplay(normalizePhoneInput(c.phone))}
                          onChange={(e) => setContacts((p) => p.map((x, idx) => idx === i ? { ...x, phone: normalizePhoneInput(e.target.value) } : x))}
                          inputMode="tel" placeholder="81-234-5678" className="flex-1 px-2 py-2 text-sm focus:outline-none" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-600">Email</label>
                      <input value={c.email} onChange={(e) => setContacts((p) => p.map((x, idx) => idx === i ? { ...x, email: e.target.value } : x))}
                        placeholder="email@example.com" className="w-full border border-slate-200 bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500 transition-colors" />
                    </div>
                    <div className="col-span-2 space-y-1">
                      <label className="text-xs font-medium text-slate-600">LINE ID</label>
                      <input value={c.lineId} onChange={(e) => setContacts((p) => p.map((x, idx) => idx === i ? { ...x, lineId: e.target.value } : x))}
                        placeholder="LINE ID" className="w-full border border-slate-200 bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500 transition-colors" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button type="button" onClick={() => router.back()}
            className="flex-1 py-3 rounded-xl border-2 border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition-colors">
            Cancel
          </button>
          <button type="submit"
            disabled={loading || (type === "PERSONAL" && !name) || (type === "COMPANY" && !companyName) || !!(taxId && taxIdError) || !!(type === "PERSONAL" && phoneDigits && phoneError)}
            className="flex-1 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold hover:from-violet-700 hover:to-indigo-700 disabled:opacity-40 transition-all shadow-lg shadow-violet-100">
            {loading ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
