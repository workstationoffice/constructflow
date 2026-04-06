"use client";

import { useState } from "react";
import {
  Loader2, FolderOpen, Folder, ChevronRight, CheckCircle,
  AlertCircle, ArrowLeft, RefreshCw,
} from "lucide-react";

interface DriveFolder { id: string; name: string }
interface BreadcrumbItem { id: string; name: string }

export interface GoogleDriveSelection {
  folderId: string;
  folderPath: string; // human-readable breadcrumb e.g. "My Drive / BuildFlow"
}

interface Props {
  googleServiceAccountEmail: string;
  googleServiceAccountKey: string;
  selection: GoogleDriveSelection | null;
  onSelect: (s: GoogleDriveSelection) => void;
}

export default function GoogleDriveFolderPicker({
  googleServiceAccountEmail,
  googleServiceAccountKey,
  selection,
  onSelect,
}: Props) {
  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbItem[]>([]);

  const creds = { googleServiceAccountEmail, googleServiceAccountKey };

  const callBrowse = async (folderId?: string) => {
    const res = await fetch("/api/settings/google-drive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...creds, action: "folders", folderId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Request failed");
    return data;
  };

  const connect = async () => {
    if (!googleServiceAccountEmail || !googleServiceAccountKey) {
      setError("Please fill in Service Account Email and Private Key first.");
      return;
    }
    setLoading(true); setError("");
    try {
      const data = await callBrowse();
      setFolders(data.folders ?? []);
      setBreadcrumb([]);
      setOpen(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Connection failed");
    } finally { setLoading(false); }
  };

  const openFolder = async (folder: DriveFolder) => {
    setLoading(true); setError("");
    try {
      const data = await callBrowse(folder.id);
      setBreadcrumb((p) => [...p, { id: folder.id, name: folder.name }]);
      setFolders(data.folders ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to open folder");
    } finally { setLoading(false); }
  };

  const navigateBreadcrumb = async (index: number) => {
    // index = -1 means root
    const newBreadcrumb = index < 0 ? [] : breadcrumb.slice(0, index + 1);
    const folderId = index < 0 ? undefined : newBreadcrumb[index].id;
    setLoading(true); setError("");
    try {
      const data = await callBrowse(folderId);
      setBreadcrumb(newBreadcrumb);
      setFolders(data.folders ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to navigate");
    } finally { setLoading(false); }
  };

  const selectFolder = (folder: DriveFolder) => {
    const pathParts = [...breadcrumb.map((b) => b.name), folder.name];
    onSelect({ folderId: folder.id, folderPath: pathParts.join(" / ") });
    setOpen(false);
  };

  const selectCurrentLocation = () => {
    if (breadcrumb.length === 0) {
      onSelect({ folderId: "root", folderPath: "My Drive (root)" });
    } else {
      const last = breadcrumb[breadcrumb.length - 1];
      onSelect({
        folderId: last.id,
        folderPath: breadcrumb.map((b) => b.name).join(" / "),
      });
    }
    setOpen(false);
  };

  const reset = () => {
    setOpen(false); setFolders([]); setBreadcrumb([]); setError("");
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

  // ── Idle ─────────────────────────────────────────────────────────────────
  if (!open) {
    return (
      <div className="space-y-3">
        {selectedBadge}
        {!selection && (
          <button type="button" onClick={connect} disabled={loading}
            className="flex items-center gap-2 text-sm font-semibold text-violet-600 bg-violet-50 hover:bg-violet-100 border border-violet-200 px-4 py-2.5 rounded-xl transition-colors disabled:opacity-40">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderOpen className="w-4 h-4" />}
            {loading ? "Connecting…" : "Browse Google Drive Folders"}
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
      {/* Header / breadcrumb */}
      <div className="bg-violet-50 px-4 py-3 flex items-center gap-3 border-b border-violet-100">
        <FolderOpen className="w-4 h-4 text-violet-600 shrink-0" />
        <div className="flex-1 text-sm font-semibold text-violet-800 flex items-center gap-1 flex-wrap text-xs">
          <button onClick={() => navigateBreadcrumb(-1)} className="hover:underline text-violet-600 font-semibold">
            My Drive
          </button>
          {breadcrumb.map((b, i) => (
            <span key={b.id} className="flex items-center gap-1">
              <ChevronRight className="w-3 h-3 text-violet-400" />
              <button onClick={() => navigateBreadcrumb(i)} className="hover:underline text-violet-700">{b.name}</button>
            </span>
          ))}
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
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button type="button" onClick={() => selectFolder(f)}
                  className="text-xs font-semibold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg transition-colors">
                  Select
                </button>
                <button type="button" onClick={() => openFolder(f)}
                  className="text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1">
                  Open <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}

          {folders.length === 0 && (
            <div className="px-4 py-6 text-sm text-slate-400 text-center">No sub-folders here</div>
          )}
        </div>
      )}

      {/* Use current location */}
      {!loading && (
        <div className="px-4 py-3 border-t border-slate-100 bg-slate-50">
          <button type="button" onClick={selectCurrentLocation}
            className="flex items-center gap-2 text-sm font-semibold text-violet-600 hover:text-violet-800 transition-colors">
            <CheckCircle className="w-4 h-4" />
            Use this location ({breadcrumb.length === 0 ? "My Drive (root)" : breadcrumb.map((b) => b.name).join(" / ")})
          </button>
        </div>
      )}
    </div>
  );
}
