"use client";

import { useState } from "react";
import {
  Loader2, FolderOpen, Folder, ChevronRight, CheckCircle,
  AlertCircle, ArrowLeft, RefreshCw, Building2, HardDrive,
} from "lucide-react";

interface Site   { id: string; name: string; webUrl: string }
interface Drive  { id: string; name: string; driveType: string }
interface Folder { id: string; name: string; childCount: number; webUrl: string }

export interface SharePointSelection {
  siteId: string;
  driveId: string;
  folderId: string;
  folderPath: string; // human-readable breadcrumb e.g. "Documents / BuildFlow"
}

interface BreadcrumbItem { id: string; name: string }

interface Props {
  msClientId: string;
  msClientSecret: string;
  msTenantId: string;
  selection: SharePointSelection | null;
  onSelect: (s: SharePointSelection) => void;
}

export default function SharePointFolderPicker({ msClientId, msClientSecret, msTenantId, selection, onSelect }: Props) {
  const [step, setStep]       = useState<"idle" | "sites" | "drives" | "folders">("idle");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  const [sites,   setSites]   = useState<Site[]>([]);
  const [drives,  setDrives]  = useState<Drive[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);

  const [selectedSite,  setSelectedSite]  = useState<Site  | null>(null);
  const [selectedDrive, setSelectedDrive] = useState<Drive | null>(null);
  const [breadcrumb, setBreadcrumb]       = useState<BreadcrumbItem[]>([]); // folder breadcrumb

  const creds = { msClientId, msClientSecret, msTenantId };

  const callBrowse = async (body: Record<string, unknown>) => {
    const res = await fetch("/api/settings/sharepoint", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...creds, ...body }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Request failed");
    return data;
  };

  const connect = async () => {
    if (!msClientId || !msClientSecret || !msTenantId) {
      setError("Please fill in Tenant ID, Client ID and Client Secret first.");
      return;
    }
    setLoading(true); setError("");
    try {
      const data = await callBrowse({ action: "connect" });
      setSites(data.sites ?? []);
      setStep("sites");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Connection failed");
    } finally { setLoading(false); }
  };

  const selectSite = async (site: Site) => {
    setSelectedSite(site);
    setLoading(true); setError("");
    try {
      const data = await callBrowse({ action: "drives", siteId: site.id });
      setDrives(data.drives ?? []);
      setStep("drives");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load drives");
    } finally { setLoading(false); }
  };

  const selectDrive = async (drive: Drive) => {
    setSelectedDrive(drive);
    setBreadcrumb([]);
    setLoading(true); setError("");
    try {
      const data = await callBrowse({ action: "folders", driveId: drive.id });
      setFolders(data.folders ?? []);
      setStep("folders");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load folders");
    } finally { setLoading(false); }
  };

  const openFolder = async (folder: Folder) => {
    if (!selectedDrive) return;
    setLoading(true); setError("");
    try {
      const data = await callBrowse({ action: "folders", driveId: selectedDrive.id, folderId: folder.id });
      setBreadcrumb((p) => [...p, { id: folder.id, name: folder.name }]);
      setFolders(data.folders ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to open folder");
    } finally { setLoading(false); }
  };

  const navigateBreadcrumb = async (index: number) => {
    // index = -1 means root of drive
    if (!selectedDrive) return;
    const newBreadcrumb = breadcrumb.slice(0, index + 1);
    const folderId = index < 0 ? undefined : newBreadcrumb[index].id;
    setLoading(true); setError("");
    try {
      const data = await callBrowse({ action: "folders", driveId: selectedDrive.id, folderId });
      setBreadcrumb(newBreadcrumb);
      setFolders(data.folders ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to navigate");
    } finally { setLoading(false); }
  };

  const selectCurrentFolder = () => {
    if (!selectedSite || !selectedDrive) return;
    const currentFolderId = breadcrumb.length > 0 ? breadcrumb[breadcrumb.length - 1].id : "root";
    const pathParts = [selectedDrive.name, ...breadcrumb.map((b) => b.name)];
    onSelect({
      siteId: selectedSite.id,
      driveId: selectedDrive.id,
      folderId: currentFolderId,
      folderPath: pathParts.join(" / "),
    });
    setStep("idle");
  };

  const selectFolder = (folder: Folder) => {
    if (!selectedSite || !selectedDrive) return;
    const pathParts = [selectedDrive.name, ...breadcrumb.map((b) => b.name), folder.name];
    onSelect({
      siteId: selectedSite.id,
      driveId: selectedDrive.id,
      folderId: folder.id,
      folderPath: pathParts.join(" / "),
    });
    setStep("idle");
  };

  const reset = () => {
    setStep("idle"); setSites([]); setDrives([]); setFolders([]);
    setSelectedSite(null); setSelectedDrive(null); setBreadcrumb([]);
    setError("");
  };

  // ── Selected folder badge ────────────────────────────────────────────────
  const selectedBadge = selection && (
    <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
      <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-xs text-emerald-700 font-semibold">Selected folder</div>
        <div className="text-sm text-emerald-900 font-medium truncate">{selection.folderPath}</div>
      </div>
      <button type="button" onClick={reset}
        className="text-xs text-emerald-600 hover:text-emerald-800 font-medium shrink-0">Change</button>
    </div>
  );

  // ── Idle — show connect button ───────────────────────────────────────────
  if (step === "idle") {
    return (
      <div className="space-y-3">
        {selectedBadge}
        {!selection && (
          <button type="button" onClick={connect} disabled={loading}
            className="flex items-center gap-2 text-sm font-semibold text-violet-600 bg-violet-50 hover:bg-violet-100 border border-violet-200 px-4 py-2.5 rounded-xl transition-colors disabled:opacity-40">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderOpen className="w-4 h-4" />}
            {loading ? "Connecting…" : "Browse SharePoint Folders"}
          </button>
        )}
        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 text-sm text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            {error}
          </div>
        )}
      </div>
    );
  }

  // ── Picker panel ─────────────────────────────────────────────────────────
  return (
    <div className="border-2 border-violet-200 rounded-xl overflow-hidden bg-white">
      {/* Picker header */}
      <div className="bg-violet-50 px-4 py-3 flex items-center gap-3 border-b border-violet-100">
        <FolderOpen className="w-4 h-4 text-violet-600 shrink-0" />
        <div className="flex-1 text-sm font-semibold text-violet-800">
          {step === "sites"   && "Select a SharePoint Site"}
          {step === "drives"  && `${selectedSite?.name} — Select a Document Library`}
          {step === "folders" && (
            <div className="flex items-center gap-1 flex-wrap text-xs">
              <button onClick={() => setStep("drives")} className="hover:underline text-violet-600">{selectedDrive?.name}</button>
              {breadcrumb.map((b, i) => (
                <span key={b.id} className="flex items-center gap-1">
                  <ChevronRight className="w-3 h-3 text-violet-400" />
                  <button onClick={() => navigateBreadcrumb(i)} className="hover:underline text-violet-700">{b.name}</button>
                </span>
              ))}
            </div>
          )}
        </div>
        <button type="button" onClick={reset} className="text-violet-400 hover:text-violet-600 transition-colors">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-red-50 px-4 py-3 text-sm text-red-700 border-b border-red-100">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />{error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-5 h-5 text-violet-500 animate-spin" />
        </div>
      ) : (
        <div className="max-h-60 overflow-y-auto divide-y divide-slate-50">
          {/* Sites */}
          {step === "sites" && sites.map((s) => (
            <button key={s.id} type="button" onClick={() => selectSite(s)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left">
              <Building2 className="w-4 h-4 text-blue-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-900 truncate">{s.name}</div>
                <div className="text-xs text-slate-400 truncate">{s.webUrl}</div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
            </button>
          ))}
          {step === "sites" && sites.length === 0 && (
            <div className="px-4 py-6 text-sm text-slate-400 text-center">No sites found</div>
          )}

          {/* Drives */}
          {step === "drives" && (
            <>
              <button type="button" onClick={() => setStep("sites")}
                className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-slate-50 transition-colors text-left text-sm text-slate-500 border-b border-slate-100">
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Sites
              </button>
              {drives.map((d) => (
                <button key={d.id} type="button" onClick={() => selectDrive(d)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left">
                  <HardDrive className="w-4 h-4 text-indigo-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-900 truncate">{d.name}</div>
                    <div className="text-xs text-slate-400">{d.driveType}</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                </button>
              ))}
            </>
          )}

          {/* Folders */}
          {step === "folders" && (
            <>
              {breadcrumb.length > 0 && (
                <button type="button" onClick={() => navigateBreadcrumb(breadcrumb.length - 2)}
                  className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-slate-50 transition-colors text-left text-sm text-slate-500 border-b border-slate-100">
                  <ArrowLeft className="w-3.5 h-3.5" /> Back
                </button>
              )}
              {folders.map((f) => (
                <div key={f.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors">
                  <Folder className="w-4 h-4 text-amber-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-900 truncate">{f.name}</div>
                    {f.childCount > 0 && (
                      <div className="text-xs text-slate-400">{f.childCount} sub-folder{f.childCount !== 1 ? "s" : ""}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button type="button" onClick={() => selectFolder(f)}
                      className="text-xs font-semibold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg transition-colors">
                      Select
                    </button>
                    {f.childCount > 0 && (
                      <button type="button" onClick={() => openFolder(f)}
                        className="text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1">
                        Open <ChevronRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {folders.length === 0 && (
                <div className="px-4 py-6 text-sm text-slate-400 text-center">No sub-folders here</div>
              )}
            </>
          )}
        </div>
      )}

      {/* Use current folder */}
      {step === "folders" && !loading && (
        <div className="px-4 py-3 border-t border-slate-100 bg-slate-50">
          <button type="button" onClick={selectCurrentFolder}
            className="flex items-center gap-2 text-sm font-semibold text-violet-600 hover:text-violet-800 transition-colors">
            <CheckCircle className="w-4 h-4" />
            Use this location ({[selectedDrive?.name, ...breadcrumb.map((b) => b.name)].join(" / ")})
          </button>
        </div>
      )}
    </div>
  );
}
