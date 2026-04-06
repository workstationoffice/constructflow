"use client";

import { useState } from "react";
import { HardDrive, Kanban, Shield, Plus, Trash2, GripVertical, Building2, Globe, CheckCircle, Hash } from "lucide-react";

interface Stage { id: string; name: string; color: string; order: number; isActive: boolean }
interface StorageConfig {
  provider: string;
  r2AccountId?: string | null; r2AccessKeyId?: string | null; r2SecretAccessKey?: string | null;
  r2BucketName?: string | null; r2PublicUrl?: string | null;
  msClientId?: string | null; msClientSecret?: string | null; msTenantId?: string | null;
  sharepointSiteId?: string | null; sharepointDriveId?: string | null;
  onedriveFolder?: string | null;
  googleDriveFolderId?: string | null; googleServiceAccountEmail?: string | null; googleServiceAccountKey?: string | null;
}
interface Tenant { name: string; timezone: string }

const TIMEZONES = [
  { value: "Asia/Bangkok",    label: "Asia/Bangkok (UTC+7) — Thailand, Vietnam, Indonesia (WIB)" },
  { value: "Asia/Singapore",  label: "Asia/Singapore (UTC+8) — Singapore, Malaysia, Philippines" },
  { value: "Asia/Tokyo",      label: "Asia/Tokyo (UTC+9) — Japan, Korea" },
  { value: "Asia/Kolkata",    label: "Asia/Kolkata (UTC+5:30) — India" },
  { value: "Asia/Dubai",      label: "Asia/Dubai (UTC+4) — UAE, Oman" },
  { value: "Europe/London",   label: "Europe/London (UTC+0/+1)" },
  { value: "Europe/Paris",    label: "Europe/Paris (UTC+1/+2)" },
  { value: "America/New_York", label: "America/New_York (UTC-5/-4)" },
  { value: "America/Los_Angeles", label: "America/Los_Angeles (UTC-8/-7)" },
  { value: "UTC",             label: "UTC (UTC+0)" },
];

export function SettingsTabs({
  canManagePerms,
  canManageStorage,
  canManageStages,
  canManageTenant,
  storageConfig,
  stages: initialStages,
  tenant: initialTenant,
}: {
  canManagePerms: boolean;
  canManageStorage: boolean;
  canManageStages: boolean;
  canManageTenant: boolean;
  storageConfig: StorageConfig | null;
  stages: Stage[];
  tenant: Tenant;
}) {
  type Tab = "company" | "storage" | "pipeline" | "permissions" | "codes";
  const defaultTab: Tab = canManageTenant ? "company" : canManageStages ? "pipeline" : "storage";
  const [tab, setTab] = useState<Tab>(defaultTab);

  const [stages, setStages] = useState(initialStages);
  const [newStageName, setNewStageName] = useState("");
  const [newStageColor, setNewStageColor] = useState("#6366f1");
  const [storageProvider, setStorageProvider]   = useState(storageConfig?.provider ?? "R2");
  const [r2AccountId, setR2AccountId]           = useState(storageConfig?.r2AccountId ?? "");
  const [r2AccessKeyId, setR2AccessKeyId]       = useState(storageConfig?.r2AccessKeyId ?? "");
  const [r2SecretAccessKey, setR2SecretKey]     = useState(storageConfig?.r2SecretAccessKey ?? "");
  const [r2BucketName, setR2BucketName]         = useState(storageConfig?.r2BucketName ?? "");
  const [r2PublicUrl, setR2PublicUrl]           = useState(storageConfig?.r2PublicUrl ?? "");
  // Microsoft (SharePoint + OneDrive)
  const [msClientId, setMsClientId]             = useState(storageConfig?.msClientId ?? "");
  const [msClientSecret, setMsClientSecret]     = useState(storageConfig?.msClientSecret ?? "");
  const [msTenantId, setMsTenantId]             = useState(storageConfig?.msTenantId ?? "");
  const [sharepointSiteId, setSpSiteId]         = useState(storageConfig?.sharepointSiteId ?? "");
  const [sharepointDriveId, setSpDriveId]       = useState(storageConfig?.sharepointDriveId ?? "");
  const [onedriveFolder, setOnedriveFolder]     = useState(storageConfig?.onedriveFolder ?? "");
  // Google Drive
  const [gDriveFolderId, setGDriveFolderId]     = useState(storageConfig?.googleDriveFolderId ?? "");
  const [gSaEmail, setGSaEmail]                 = useState(storageConfig?.googleServiceAccountEmail ?? "");
  const [gSaKey, setGSaKey]                     = useState(storageConfig?.googleServiceAccountKey ?? "");
  const [storageSaved, setStorageSaved]         = useState(false);
  const [storageSaving, setStorageSaving]       = useState(false);
  const [stageSaving, setStageSaving] = useState(false);

  // Company settings
  const [companyName, setCompanyName] = useState(initialTenant.name);
  const [timezone, setTimezone] = useState(initialTenant.timezone);
  const [companySaving, setCompanySaving] = useState(false);
  const [companySaved, setCompanySaved] = useState(false);

  const saveCompany = async () => {
    setCompanySaving(true);
    await fetch("/api/settings/company", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: companyName, timezone }),
    });
    setCompanySaving(false);
    setCompanySaved(true);
    setTimeout(() => setCompanySaved(false), 3000);
  };

  const addStage = async () => {
    if (!newStageName.trim()) return;
    setStageSaving(true);
    const res = await fetch("/api/pipeline-stages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newStageName, color: newStageColor, order: stages.length }),
    });
    const data = await res.json();
    if (res.ok) { setStages([...stages, data.stage]); setNewStageName(""); }
    setStageSaving(false);
  };

  const saveStorage = async () => {
    setStorageSaving(true);
    await fetch("/api/settings/storage", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: storageProvider,
        r2AccountId, r2AccessKeyId, r2SecretAccessKey: r2SecretAccessKey || null, r2BucketName, r2PublicUrl,
        msClientId, msClientSecret: msClientSecret || null, msTenantId,
        sharepointSiteId, sharepointDriveId,
        onedriveFolder,
        googleDriveFolderId: gDriveFolderId, googleServiceAccountEmail: gSaEmail, googleServiceAccountKey: gSaKey || null,
      }),
    });
    setStorageSaving(false);
    setStorageSaved(true);
    setTimeout(() => setStorageSaved(false), 2000);
  };

  const tabs: { key: Tab; label: string; icon: React.ElementType; show: boolean }[] = [
    { key: "company",     label: "Company",        icon: Building2, show: canManageTenant },
    { key: "pipeline",    label: "Pipeline Stages", icon: Kanban,    show: canManageStages },
    { key: "storage",     label: "Storage",         icon: HardDrive, show: canManageStorage },
    { key: "codes",       label: "Document Codes",  icon: Hash,      show: canManageTenant },
    { key: "permissions", label: "Permissions",     icon: Shield,    show: canManagePerms },
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-slate-100 bg-slate-50">
        {tabs.filter((t) => t.show).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === key
                ? "border-violet-600 text-violet-600 bg-white"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      <div className="p-6">
        {/* Company Settings */}
        {tab === "company" && canManageTenant && (
          <div className="space-y-5 max-w-lg">
            <p className="text-sm text-slate-500">Configure your company workspace settings.</p>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-slate-400" /> Company Name
              </label>
              <input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-500 transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-blue-500" /> Timezone
              </label>
              <p className="text-xs text-slate-400">All dates and times in the app are displayed in this timezone.</p>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-500 transition-colors"
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>{tz.label}</option>
                ))}
              </select>
              <div className="mt-1 text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
                Current time in <strong>{timezone}</strong>:{" "}
                {new Intl.DateTimeFormat("en-GB", { timeZone: timezone, dateStyle: "medium", timeStyle: "short" }).format(new Date())}
              </div>
            </div>

            <button
              onClick={saveCompany}
              disabled={companySaving}
              className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:from-violet-700 hover:to-indigo-700 disabled:opacity-40 transition-all shadow-sm"
            >
              {companySaved ? (
                <><CheckCircle className="w-4 h-4" /> Saved!</>
              ) : companySaving ? "Saving..." : "Save Company Settings"}
            </button>
          </div>
        )}

        {/* Pipeline Stages */}
        {tab === "pipeline" && canManageStages && (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">Customize deal pipeline stages.</p>
            <div className="space-y-2">
              {stages.map((stage) => (
                <div key={stage.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <GripVertical className="w-4 h-4 text-slate-300 cursor-grab" />
                  <div className="w-4 h-4 rounded-full shrink-0 border border-white shadow-sm" style={{ background: stage.color }} />
                  <span className="flex-1 text-sm font-medium text-slate-700">{stage.name}</span>
                  <button className="text-slate-300 hover:text-red-500 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2 pt-2">
              <input type="color" value={newStageColor} onChange={(e) => setNewStageColor(e.target.value)}
                className="w-10 h-10 rounded-lg border-2 border-slate-200 cursor-pointer p-0.5" />
              <input type="text" value={newStageName} onChange={(e) => setNewStageName(e.target.value)}
                placeholder="New stage name..."
                className="flex-1 border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-500 transition-colors"
                onKeyDown={(e) => e.key === "Enter" && addStage()} />
              <button onClick={addStage} disabled={stageSaving || !newStageName.trim()}
                className="flex items-center gap-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:from-violet-700 hover:to-indigo-700 disabled:opacity-40 shadow-sm">
                <Plus className="w-4 h-4" /> Add
              </button>
            </div>
          </div>
        )}

        {/* Storage */}
        {tab === "storage" && canManageStorage && (
          <div className="space-y-5 max-w-lg">
            <p className="text-sm text-slate-500">Choose where deal attachments are stored and enter your credentials.</p>

            <div className="space-y-2">
              {[
                { value: "R2",           label: "Cloudflare R2",        desc: "S3-compatible object storage by Cloudflare" },
                { value: "SHAREPOINT",   label: "Microsoft SharePoint",  desc: "Store files in your SharePoint site" },
                { value: "ONEDRIVE",     label: "Microsoft OneDrive",    desc: "Store files in your OneDrive" },
                { value: "GOOGLE_DRIVE", label: "Google Drive",          desc: "Store files in your Google Drive" },
              ].map((opt) => (
                <label key={opt.value} className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-colors ${storageProvider === opt.value ? "border-violet-500 bg-violet-50" : "border-slate-200 hover:bg-slate-50"}`}>
                  <input type="radio" name="storage" value={opt.value} checked={storageProvider === opt.value}
                    onChange={() => setStorageProvider(opt.value)} className="mt-0.5 accent-violet-600" />
                  <div>
                    <div className="text-sm font-semibold text-slate-800">{opt.label}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{opt.desc}</div>
                  </div>
                </label>
              ))}
            </div>

            {/* R2 credentials */}
            {storageProvider === "R2" && (
              <CredentialPanel title="Cloudflare R2 Credentials" hint="Cloudflare Dashboard → R2 → Manage API Tokens" fields={[
                { label: "Account ID",       value: r2AccountId,       set: setR2AccountId,   ph: "abcdef1234567890abcdef1234567890" },
                { label: "Access Key ID",    value: r2AccessKeyId,     set: setR2AccessKeyId, ph: "your-access-key-id" },
                { label: "Secret Access Key",value: r2SecretAccessKey, set: setR2SecretKey,   ph: "your-secret-access-key", secret: true },
                { label: "Bucket Name",      value: r2BucketName,      set: setR2BucketName,  ph: "my-bucket" },
                { label: "Public URL",       value: r2PublicUrl,       set: setR2PublicUrl,   ph: "https://pub-xxxx.r2.dev" },
              ]} />
            )}

            {/* SharePoint credentials */}
            {storageProvider === "SHAREPOINT" && (
              <CredentialPanel title="SharePoint Credentials" hint="Azure Portal → App Registrations → API permissions → Microsoft Graph → Sites.ReadWrite.All (Application)" fields={[
                { label: "Azure Tenant ID",  value: msTenantId,       set: setMsTenantId,   ph: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" },
                { label: "Client ID",        value: msClientId,       set: setMsClientId,   ph: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" },
                { label: "Client Secret",    value: msClientSecret,   set: setMsClientSecret, ph: "your-client-secret-value", secret: true },
                { label: "SharePoint Site ID", value: sharepointSiteId, set: setSpSiteId,   ph: "contoso.sharepoint.com,abc123,def456" },
                { label: "Drive ID (optional)", value: sharepointDriveId, set: setSpDriveId, ph: "Leave blank to use the default document library" },
              ]} />
            )}

            {/* OneDrive credentials */}
            {storageProvider === "ONEDRIVE" && (
              <CredentialPanel title="OneDrive Credentials" hint="Azure Portal → App Registrations → API permissions → Microsoft Graph → Files.ReadWrite.All (Application)" fields={[
                { label: "Azure Tenant ID",  value: msTenantId,     set: setMsTenantId,       ph: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" },
                { label: "Client ID",        value: msClientId,     set: setMsClientId,       ph: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" },
                { label: "Client Secret",    value: msClientSecret, set: setMsClientSecret,   ph: "your-client-secret-value", secret: true },
                { label: "Upload Folder Path", value: onedriveFolder, set: setOnedriveFolder, ph: "BuildFlow/Deals" },
              ]} />
            )}

            {/* Google Drive credentials */}
            {storageProvider === "GOOGLE_DRIVE" && (
              <CredentialPanel title="Google Drive Credentials" hint="GCP Console → IAM → Service Accounts → Keys → Add Key (JSON). Share target folder with the service account email." fields={[
                { label: "Service Account Email", value: gSaEmail,       set: setGSaEmail,       ph: "my-sa@project.iam.gserviceaccount.com" },
                { label: "Private Key (PEM)",     value: gSaKey,         set: setGSaKey,         ph: "-----BEGIN RSA PRIVATE KEY-----\n...", secret: true, multiline: true },
                { label: "Folder ID",             value: gDriveFolderId, set: setGDriveFolderId, ph: "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs" },
              ]} />
            )}

            <button onClick={saveStorage} disabled={storageSaving}
              className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:from-violet-700 hover:to-indigo-700 disabled:opacity-40 shadow-sm transition-all">
              {storageSaved ? <><CheckCircle className="w-4 h-4" /> Saved!</> : storageSaving ? "Saving..." : "Save Storage Settings"}
            </button>
          </div>
        )}

        {/* Document Codes */}
        {tab === "codes" && canManageTenant && <DocumentCodesPanel />}

        {/* Permissions */}
        {tab === "permissions" && canManagePerms && (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">Manage role-based access permissions. Changes apply immediately.</p>
            <PermissionsMatrix />
          </div>
        )}
      </div>
    </div>
  );
}

const DOC_LABELS: Record<string, string> = { CUSTOMER: "Customer", DEAL: "Deal" };

function DocumentCodesPanel() {
  interface SeqRow { type: string; prefix: string; paddingLength: number; lastNumber: number }
  const [sequences, setSequences] = useState<SeqRow[] | null>(null);
  const [editing, setEditing]     = useState<Record<string, { prefix: string; paddingLength: string }>>({});
  const [saving, setSaving]       = useState<Record<string, boolean>>({});
  const [saved, setSaved]         = useState<Record<string, boolean>>({});

  useState(() => {
    fetch("/api/settings/document-sequences")
      .then((r) => r.json())
      .then((d) => {
        setSequences(d.sequences ?? []);
        const init: Record<string, { prefix: string; paddingLength: string }> = {};
        (d.sequences ?? []).forEach((s: SeqRow) => {
          init[s.type] = { prefix: s.prefix, paddingLength: String(s.paddingLength) };
        });
        setEditing(init);
      });
  });

  const save = async (type: string) => {
    setSaving((p) => ({ ...p, [type]: true }));
    const { prefix, paddingLength } = editing[type] ?? {};
    const res = await fetch("/api/settings/document-sequences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, prefix, paddingLength: Number(paddingLength) }),
    });
    setSaving((p) => ({ ...p, [type]: false }));
    if (res.ok) {
      setSaved((p) => ({ ...p, [type]: true }));
      setTimeout(() => setSaved((p) => ({ ...p, [type]: false })), 2000);
    }
  };

  if (!sequences) return <div className="text-sm text-slate-400">Loading...</div>;

  const preview = (type: string) => {
    const { prefix, paddingLength } = editing[type] ?? {};
    const pad = Math.max(1, Math.min(10, Number(paddingLength) || 5));
    return `${(prefix || type).toUpperCase()}-${"1".padStart(pad, "0")}`;
  };

  return (
    <div className="space-y-4 max-w-lg">
      <p className="text-sm text-slate-500">Configure the prefix and number format for auto-generated codes on each document type.</p>
      <div className="space-y-4">
        {sequences.map((seq) => (
          <div key={seq.type} className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-900">{DOC_LABELS[seq.type] ?? seq.type}</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {seq.lastNumber} codes issued so far
                </div>
              </div>
              <div className="text-xs font-mono font-semibold text-violet-600 bg-violet-50 px-2.5 py-1 rounded-lg border border-violet-200">
                {preview(seq.type)}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600">Prefix</label>
                <input
                  value={editing[seq.type]?.prefix ?? seq.prefix}
                  onChange={(e) => setEditing((p) => ({ ...p, [seq.type]: { ...p[seq.type], prefix: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") } }))}
                  maxLength={8}
                  placeholder="e.g. CUST"
                  className="w-full border border-slate-200 bg-white rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-violet-500 transition-colors uppercase"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600">Number padding</label>
                <select
                  value={editing[seq.type]?.paddingLength ?? String(seq.paddingLength)}
                  onChange={(e) => setEditing((p) => ({ ...p, [seq.type]: { ...p[seq.type], paddingLength: e.target.value } }))}
                  className="w-full border border-slate-200 bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500 transition-colors"
                >
                  {[3,4,5,6,7,8].map((n) => (
                    <option key={n} value={n}>{n} digits — {"0".repeat(n - 1)}1</option>
                  ))}
                </select>
              </div>
            </div>
            <button
              onClick={() => save(seq.type)}
              disabled={saving[seq.type]}
              className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:from-violet-700 hover:to-indigo-700 disabled:opacity-40 transition-all shadow-sm"
            >
              {saved[seq.type] ? <><CheckCircle className="w-4 h-4" /> Saved!</> : saving[seq.type] ? "Saving..." : "Save"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

interface CredentialField {
  label: string;
  value: string;
  set: (v: string) => void;
  ph: string;
  secret?: boolean;
  multiline?: boolean;
}

function CredentialPanel({ title, hint, fields }: { title: string; hint: string; fields: CredentialField[] }) {
  return (
    <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-3">
      <div>
        <div className="text-sm font-semibold text-slate-800">{title}</div>
        <div className="text-xs text-slate-500 mt-0.5">{hint}</div>
      </div>
      <div className="space-y-3">
        {fields.map((f) => (
          <div key={f.label} className="space-y-1">
            <label className="text-xs font-medium text-slate-600">{f.label}</label>
            {f.multiline ? (
              <textarea
                value={f.value}
                onChange={(e) => f.set(e.target.value)}
                placeholder={f.ph}
                rows={4}
                className="w-full border border-slate-200 bg-white rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-violet-500 transition-colors resize-y"
              />
            ) : (
              <input
                type={f.secret ? "password" : "text"}
                value={f.value}
                onChange={(e) => f.set(e.target.value)}
                placeholder={f.ph}
                className="w-full border border-slate-200 bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500 transition-colors"
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function PermissionsMatrix() {
  const [matrix, setMatrix] = useState<Record<string, Record<string, boolean>> | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useState(() => {
    fetch("/api/permissions")
      .then((r) => r.json())
      .then((data) => { setMatrix(data.matrix); setPermissions(data.allPermissions); setLoading(false); });
  });

  const toggle = async (role: string, permission: string, current: boolean) => {
    setMatrix((prev) => prev ? { ...prev, [role]: { ...prev[role], [permission]: !current } } : prev);
    await fetch("/api/permissions", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, permission, granted: !current }),
    });
  };

  if (loading || !matrix) return <div className="text-sm text-slate-400">Loading permissions...</div>;
  const roles = Object.keys(matrix);

  return (
    <div className="overflow-x-auto">
      <table className="text-xs w-full">
        <thead>
          <tr>
            <th className="text-left py-2 pr-4 font-semibold text-slate-600 sticky left-0 bg-white">Permission</th>
            {roles.map((role) => (
              <th key={role} className="px-2 py-2 font-semibold text-slate-600 text-center whitespace-nowrap">
                {role.replace(/_/g, " ")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {permissions.map((perm) => (
            <tr key={perm} className="hover:bg-slate-50">
              <td className="py-2 pr-4 text-slate-700 sticky left-0 bg-white whitespace-nowrap">
                {perm.replace(/_/g, " ").toLowerCase()}
              </td>
              {roles.map((role) => (
                <td key={role} className="px-2 py-2 text-center">
                  <input type="checkbox" checked={matrix[role][perm] ?? false}
                    onChange={() => toggle(role, perm, matrix[role][perm])}
                    className="rounded accent-violet-600" disabled={role === "COMPANY_ADMIN"} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
