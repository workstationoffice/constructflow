"use client";

import { useState } from "react";
import {
  Loader2, FolderOpen, Folder, ChevronRight, CheckCircle,
  AlertCircle, ArrowLeft, RefreshCw, Plus,
} from "lucide-react";

interface R2Folder { prefix: string; name: string }
interface BreadcrumbItem { prefix: string; name: string }

export interface R2Selection {
  prefix: string;   // full prefix stored in DB, e.g. "uploads/" or "media/deals/"
  displayPath: string; // human-readable path, e.g. "uploads / deals"
}

interface Props {
  r2AccountId: string;
  r2AccessKeyId: string;
  r2SecretAccessKey: string;
  r2BucketName: string;
  selection: R2Selection | null;
  onSelect: (s: R2Selection) => void;
}

export default function R2FolderPicker({
  r2AccountId,
  r2AccessKeyId,
  r2SecretAccessKey,
  r2BucketName,
  selection,
  onSelect,
}: Props) {
  const [open, setOpen]         = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [folders, setFolders]   = useState<R2Folder[]>([]);
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbItem[]>([]);
  const [newName, setNewName]   = useState("");
  const [creating, setCreating] = useState(false);

  const creds = { r2AccountId, r2AccessKeyId, r2SecretAccessKey, r2BucketName };

  const callBrowse = async (prefix?: string) => {
    const res = await fetch("/api/settings/r2", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...creds, action: "folders", prefix }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Request failed");
    return data;
  };

  const connect = async () => {
    if (!r2AccountId || !r2AccessKeyId || !r2SecretAccessKey || !r2BucketName) {
      setError("Please fill in all R2 credentials first.");
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

  const openFolder = async (folder: R2Folder) => {
    setLoading(true); setError("");
    try {
      const data = await callBrowse(folder.prefix);
      setBreadcrumb((p) => [...p, { prefix: folder.prefix, name: folder.name }]);
      setFolders(data.folders ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to open folder");
    } finally { setLoading(false); }
  };

  const navigateBreadcrumb = async (index: number) => {
    // index = -1 → bucket root
    const newBreadcrumb = index < 0 ? [] : breadcrumb.slice(0, index + 1);
    const prefix = index < 0 ? undefined : newBreadcrumb[index].prefix;
    setLoading(true); setError("");
    try {
      const data = await callBrowse(prefix);
      setBreadcrumb(newBreadcrumb);
      setFolders(data.folders ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to navigate");
    } finally { setLoading(false); }
  };

  const selectFolder = (folder: R2Folder) => {
    const pathParts = [...breadcrumb.map((b) => b.name), folder.name];
    onSelect({ prefix: folder.prefix, displayPath: pathParts.join(" / ") });
    setOpen(false);
  };

  const selectCurrentLocation = () => {
    if (breadcrumb.length === 0) {
      onSelect({ prefix: "", displayPath: "Bucket root" });
    } else {
      const last = breadcrumb[breadcrumb.length - 1];
      onSelect({
        prefix: last.prefix,
        displayPath: breadcrumb.map((b) => b.name).join(" / "),
      });
    }
    setOpen(false);
  };

  const createAndSelect = () => {
    const trimmed = newName.trim().replace(/^\/+|\/+$/g, "");
    if (!trimmed) return;
    const currentPrefix = breadcrumb.length > 0 ? breadcrumb[breadcrumb.length - 1].prefix : "";
    const fullPrefix = `${currentPrefix}${trimmed}/`;
    const displayParts = [...breadcrumb.map((b) => b.name), trimmed];
    onSelect({ prefix: fullPrefix, displayPath: displayParts.join(" / ") });
    setOpen(false);
    setNewName("");
  };

  const reset = () => {
    setOpen(false); setFolders([]); setBreadcrumb([]); setError(""); setNewName("");
  };

  // ── Selected badge ───────────────────────────────────────────────────────
  const selectedBadge = selection && (
    <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
      <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-xs text-emerald-700 font-semibold">Selected prefix</div>
        <div className="text-sm text-emerald-900 font-medium truncate">
          {selection.displayPath}{selection.prefix ? <span className="text-xs text-emerald-600 ml-1 font-mono">({selection.prefix})</span> : ""}
        </div>
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
            {loading ? "Connecting…" : "Browse Bucket Folders"}
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
      {/* Breadcrumb header */}
      <div className="bg-violet-50 px-4 py-3 flex items-center gap-3 border-b border-violet-100">
        <FolderOpen className="w-4 h-4 text-violet-600 shrink-0" />
        <div className="flex-1 flex items-center gap-1 flex-wrap text-xs font-semibold text-violet-800">
          <button onClick={() => navigateBreadcrumb(-1)} className="hover:underline text-violet-600">
            {r2BucketName}
          </button>
          {breadcrumb.map((b, i) => (
            <span key={b.prefix} className="flex items-center gap-1">
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
            <div key={f.prefix} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors">
              <Folder className="w-4 h-4 text-orange-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-900 truncate">{f.name}</div>
                <div className="text-xs text-slate-400 font-mono truncate">{f.prefix}</div>
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
            <div className="px-4 py-4 text-sm text-slate-400 text-center">No folders here yet</div>
          )}
        </div>
      )}

      {/* Create new folder + use current location */}
      {!loading && (
        <div className="px-4 py-3 border-t border-slate-100 bg-slate-50 space-y-2.5">
          {/* New folder row */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createAndSelect()}
              placeholder="New folder name…"
              className="flex-1 border border-slate-200 bg-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-violet-500 transition-colors"
            />
            <button type="button" onClick={createAndSelect} disabled={!newName.trim() || creating}
              className="flex items-center gap-1 text-xs font-semibold text-violet-600 bg-violet-50 hover:bg-violet-100 border border-violet-200 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-40">
              <Plus className="w-3 h-3" /> Create &amp; Select
            </button>
          </div>
          {/* Use current location */}
          <button type="button" onClick={selectCurrentLocation}
            className="flex items-center gap-2 text-sm font-semibold text-violet-600 hover:text-violet-800 transition-colors">
            <CheckCircle className="w-4 h-4" />
            Use this location ({breadcrumb.length === 0 ? "bucket root" : breadcrumb.map((b) => b.name).join(" / ")})
          </button>
        </div>
      )}
    </div>
  );
}
