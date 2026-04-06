"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  TrendingUp, X, Upload, Loader2, CalendarPlus, File, FileText,
  FileImage, FileSpreadsheet, FileCode, Check, AlertCircle,
} from "lucide-react";

interface Site { id: string; name: string }

interface Props {
  dealId: string;
  dealTitle: string;
}

function FileIcon({ mimeType, name }: { mimeType?: string; name: string }) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (mimeType?.startsWith("image/") || ["jpg","jpeg","png","gif","webp","svg"].includes(ext))
    return <FileImage className="w-4 h-4 text-blue-500" />;
  if (mimeType === "application/pdf" || ext === "pdf")
    return <FileText className="w-4 h-4 text-red-500" />;
  if (["xls","xlsx","csv"].includes(ext))
    return <FileSpreadsheet className="w-4 h-4 text-green-600" />;
  if (["doc","docx"].includes(ext))
    return <FileCode className="w-4 h-4 text-blue-600" />;
  return <File className="w-4 h-4 text-slate-400" />;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Default datetime-local value = now + 1 day, at 09:00
function defaultVisitDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function ProgressUpdatePanel({ dealId, dealTitle }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [scheduleVisit, setScheduleVisit] = useState(false);
  const [visitTitle, setVisitTitle] = useState("");
  const [visitDate, setVisitDate] = useState("");
  const [visitSiteId, setVisitSiteId] = useState("");
  const [sites, setSites] = useState<Site[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const openModal = async () => {
    setTitle("");
    setDescription("");
    setFiles([]);
    setScheduleVisit(false);
    setVisitTitle(`Visit — ${dealTitle}`);
    setVisitDate(defaultVisitDate());
    setVisitSiteId("");
    setError(null);
    setOpen(true);
    const res = await fetch("/api/sites");
    const data = await res.json();
    setSites(data.sites ?? []);
  };

  const addFiles = (incoming: FileList | File[]) => {
    const arr = Array.from(incoming);
    setFiles((prev) => {
      const names = new Set(prev.map((f) => f.name));
      return [...prev, ...arr.filter((f) => !names.has(f.name))];
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  };

  const submit = async () => {
    if (!title.trim()) { setError("Please enter a progress update title."); return; }
    if (scheduleVisit && !visitDate) { setError("Please select a date for the visit."); return; }

    setSubmitting(true);
    setError(null);

    try {
      // 1. Create PROGRESS_UPDATE activity
      const actRes = await fetch(`/api/deals/${dealId}/activities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "PROGRESS_UPDATE",
          title: title.trim(),
          description: description.trim() || undefined,
        }),
      });
      const actData = await actRes.json();
      if (!actRes.ok) throw new Error(actData.error ?? "Failed to save progress update");
      const activityId: string = actData.activity.id;

      // 2. Upload attachments linked to this activity
      for (const file of files) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("activityId", activityId);
        const uploadRes = await fetch(`/api/deals/${dealId}/attachments`, { method: "POST", body: fd });
        if (!uploadRes.ok) {
          const d = await uploadRes.json();
          // Non-fatal — record but continue
          console.warn("Attachment upload failed:", d.error);
        }
      }

      // 3. Create visit plan if requested
      if (scheduleVisit) {
        const planRes = await fetch("/api/calendar-sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: visitTitle.trim() || `Visit — ${dealTitle}`,
            plannedDate: new Date(visitDate).toISOString(),
            dealId,
            siteId: visitSiteId || undefined,
          }),
        });
        if (!planRes.ok) {
          const d = await planRes.json();
          throw new Error(d.error ?? "Failed to schedule visit");
        }
      }

      setOpen(false);
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* Trigger button */}
      <button
        type="button"
        onClick={openModal}
        className="flex items-center gap-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-xs font-semibold px-3.5 py-2 rounded-xl hover:from-violet-700 hover:to-indigo-700 shadow-sm transition-all"
      >
        <TrendingUp className="w-3.5 h-3.5" />
        Update Progress
      </button>

      {/* Modal backdrop */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => !submitting && setOpen(false)}
          />

          {/* Modal panel */}
          <div className="relative bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[92dvh]">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-violet-600" />
                <h2 className="font-semibold text-slate-900">Update Deal Progress</h2>
              </div>
              <button
                type="button"
                onClick={() => !submitting && setOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body (scrollable) */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

              {/* Progress title */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">
                  Progress Update <span className="text-red-500">*</span>
                </label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Site measurement completed, design concept approved…"
                  className="w-full border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-500 transition-colors"
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">Details <span className="text-slate-400 font-normal">(optional)</span></label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add more context, notes from the client, next steps…"
                  rows={3}
                  className="w-full border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-500 transition-colors resize-none"
                />
              </div>

              {/* File attachments */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">
                  Attachments <span className="text-slate-400 font-normal">(optional)</span>
                </label>

                {/* Drop zone */}
                <div
                  className={`border-2 border-dashed rounded-xl p-4 text-center transition-colors cursor-pointer ${
                    dragging ? "border-violet-400 bg-violet-50" : "border-slate-200 hover:border-violet-300 hover:bg-slate-50"
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={handleDrop}
                >
                  <Upload className="w-5 h-5 mx-auto mb-1.5 text-slate-400" />
                  <p className="text-xs text-slate-500">
                    Drop files here or <span className="text-violet-600 font-medium">click to browse</span>
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">Images, PDFs, documents…</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip"
                  className="hidden"
                  onChange={(e) => e.target.files && addFiles(e.target.files)}
                />

                {/* Queued files */}
                {files.length > 0 && (
                  <div className="space-y-1.5">
                    {files.map((f, i) => (
                      <div key={i} className="flex items-center gap-2.5 bg-slate-50 rounded-lg px-3 py-2 text-sm">
                        <FileIcon name={f.name} />
                        <span className="flex-1 truncate text-slate-700">{f.name}</span>
                        <span className="text-xs text-slate-400 shrink-0">{formatBytes(f.size)}</span>
                        <button
                          type="button"
                          onClick={() => setFiles((p) => p.filter((_, j) => j !== i))}
                          className="text-slate-300 hover:text-red-500 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Schedule next visit */}
              <div className={`rounded-xl border-2 transition-colors ${scheduleVisit ? "border-indigo-300 bg-indigo-50" : "border-slate-200"}`}>
                {/* Toggle header */}
                <button
                  type="button"
                  onClick={() => setScheduleVisit((v) => !v)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
                >
                  <div className={`w-9 h-5 rounded-full flex items-center transition-colors shrink-0 ${scheduleVisit ? "bg-indigo-500" : "bg-slate-300"}`}>
                    <div className={`w-4 h-4 rounded-full bg-white shadow-sm mx-0.5 transition-transform ${scheduleVisit ? "translate-x-4" : "translate-x-0"}`} />
                  </div>
                  <CalendarPlus className={`w-4 h-4 shrink-0 ${scheduleVisit ? "text-indigo-600" : "text-slate-400"}`} />
                  <div>
                    <div className={`text-sm font-semibold ${scheduleVisit ? "text-indigo-800" : "text-slate-700"}`}>
                      Schedule next visit
                    </div>
                    <div className="text-xs text-slate-500">Automatically create a planned visit for this deal</div>
                  </div>
                </button>

                {/* Visit details — revealed when toggled */}
                {scheduleVisit && (
                  <div className="px-4 pb-4 space-y-3 border-t border-indigo-200">
                    <div className="pt-3 space-y-1.5">
                      <label className="text-xs font-semibold text-indigo-700">Visit Title</label>
                      <input
                        value={visitTitle}
                        onChange={(e) => setVisitTitle(e.target.value)}
                        placeholder="e.g. Site measurement visit"
                        className="w-full border border-indigo-200 bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400 transition-colors"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-indigo-700">Date &amp; Time <span className="text-red-500">*</span></label>
                      <input
                        type="datetime-local"
                        value={visitDate}
                        onChange={(e) => setVisitDate(e.target.value)}
                        className="w-full border border-indigo-200 bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400 transition-colors"
                      />
                    </div>

                    {sites.length > 0 && (
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-indigo-700">Site <span className="text-slate-400 font-normal">(optional)</span></label>
                        <select
                          value={visitSiteId}
                          onChange={(e) => setVisitSiteId(e.target.value)}
                          className="w-full border border-indigo-200 bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400 transition-colors"
                        >
                          <option value="">— No specific site —</option>
                          {sites.map((s) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  {error}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={submitting}
                className="text-sm font-medium text-slate-600 hover:text-slate-900 px-4 py-2 rounded-xl hover:bg-slate-100 transition-colors disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={submitting || !title.trim()}
                className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:from-violet-700 hover:to-indigo-700 disabled:opacity-40 shadow-sm transition-all"
              >
                {submitting ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                ) : (
                  <><Check className="w-4 h-4" /> Save Update{scheduleVisit ? " & Schedule Visit" : ""}</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
