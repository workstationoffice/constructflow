"use client";

import { useRef, useState } from "react";
import {
  Paperclip, Upload, Trash2, Loader2, FileText, FileImage,
  FileSpreadsheet, FileCode, File, X,
} from "lucide-react";

interface Attachment {
  id: string;
  name: string;
  url: string;
  size?: number;
  mimeType?: string;
  provider: string;
  createdAt: string;
}

interface Props {
  dealId: string;
  initialAttachments: Attachment[];
}

function formatBytes(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileIcon({ mimeType, name }: { mimeType?: string; name: string }) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (mimeType?.startsWith("image/") || ["jpg","jpeg","png","gif","webp","svg"].includes(ext))
    return <FileImage className="w-5 h-5 text-blue-500" />;
  if (mimeType === "application/pdf" || ext === "pdf")
    return <FileText className="w-5 h-5 text-red-500" />;
  if (["xls","xlsx","csv"].includes(ext))
    return <FileSpreadsheet className="w-5 h-5 text-green-600" />;
  if (["doc","docx"].includes(ext))
    return <FileCode className="w-5 h-5 text-blue-600" />;
  return <File className="w-5 h-5 text-slate-400" />;
}

function isImage(mimeType?: string, name?: string): boolean {
  if (mimeType?.startsWith("image/")) return true;
  const ext = name?.split(".").pop()?.toLowerCase() ?? "";
  return ["jpg","jpeg","png","gif","webp"].includes(ext);
}

interface UploadingFile {
  id: string;
  name: string;
  progress: "uploading" | "error";
  error?: string;
}

export default function DealAttachmentsPanel({ dealId, initialAttachments }: Props) {
  const [attachments, setAttachments] = useState<Attachment[]>(initialAttachments);
  const [uploading, setUploading]     = useState<UploadingFile[]>([]);
  const [deleting, setDeleting]       = useState<Set<string>>(new Set());
  const inputRef                      = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList) => {
    const fileArray = Array.from(files);
    const pending: UploadingFile[] = fileArray.map((f) => ({
      id: `${f.name}-${Date.now()}`,
      name: f.name,
      progress: "uploading",
    }));
    setUploading((p) => [...p, ...pending]);

    await Promise.all(
      fileArray.map(async (file, i) => {
        const uid = pending[i].id;
        try {
          const fd = new FormData();
          fd.append("file", file);
          const res = await fetch(`/api/deals/${dealId}/attachments`, { method: "POST", body: fd });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error ?? "Upload failed");
          setAttachments((p) => [...p, data.attachment]);
          setUploading((p) => p.filter((u) => u.id !== uid));
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : "Upload failed";
          setUploading((p) => p.map((u) => u.id === uid ? { ...u, progress: "error", error: msg } : u));
        }
      })
    );
  };

  const handleDelete = async (attachment: Attachment) => {
    setDeleting((p) => new Set(p).add(attachment.id));
    try {
      const res = await fetch(`/api/deals/${dealId}/attachments/${attachment.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setAttachments((p) => p.filter((a) => a.id !== attachment.id));
    } finally {
      setDeleting((p) => { const n = new Set(p); n.delete(attachment.id); return n; });
    }
  };

  return (
    <div className="bg-white rounded-xl border">
      <div className="px-5 py-4 border-b flex items-center justify-between">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2">
          <Paperclip className="w-4 h-4 text-slate-400" />
          Attachments
          {attachments.length > 0 && (
            <span className="text-xs font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-full">
              {attachments.length}
            </span>
          )}
        </h3>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-1.5 text-xs font-semibold text-violet-600 bg-violet-50 hover:bg-violet-100 px-3 py-1.5 rounded-lg transition-colors"
        >
          <Upload className="w-3.5 h-3.5" /> Upload
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip"
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
      </div>

      {/* Uploading in-progress */}
      {uploading.length > 0 && (
        <div className="px-5 py-3 border-b space-y-2">
          {uploading.map((u) => (
            <div key={u.id} className="flex items-center gap-3 text-sm">
              {u.progress === "uploading"
                ? <Loader2 className="w-4 h-4 text-violet-500 animate-spin shrink-0" />
                : <X className="w-4 h-4 text-red-500 shrink-0" />}
              <span className={`flex-1 truncate ${u.progress === "error" ? "text-red-600" : "text-slate-600"}`}>
                {u.name}
              </span>
              {u.progress === "error"
                ? <span className="text-xs text-red-500">{u.error}</span>
                : <span className="text-xs text-slate-400">Uploading…</span>}
              {u.progress === "error" && (
                <button onClick={() => setUploading((p) => p.filter((x) => x.id !== u.id))}
                  className="text-slate-400 hover:text-slate-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Attachment list */}
      {attachments.length === 0 && uploading.length === 0 ? (
        <div
          className="p-8 text-center text-sm text-slate-400 border-2 border-dashed border-slate-200 m-4 rounded-xl cursor-pointer hover:border-violet-300 hover:text-violet-400 transition-colors"
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="w-6 h-6 mx-auto mb-2 opacity-40" />
          Click to upload floor plans, reference images, or documents
        </div>
      ) : (
        <div className="divide-y">
          {attachments.map((a) => (
            <div key={a.id} className="px-5 py-3 flex items-center gap-3">
              {isImage(a.mimeType, a.name) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.url} alt={a.name}
                  className="w-10 h-10 rounded-lg object-cover border border-slate-100 shrink-0" />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                  <FileIcon mimeType={a.mimeType} name={a.name} />
                </div>
              )}

              <div className="flex-1 min-w-0">
                <a href={a.url} target="_blank" rel="noopener noreferrer"
                  className="text-sm font-medium text-slate-900 hover:text-violet-600 truncate block">
                  {a.name}
                </a>
                <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                  {a.size && <span>{formatBytes(a.size)}</span>}
                  <span>{new Date(a.createdAt).toLocaleDateString()}</span>
                  <span className="uppercase font-medium text-slate-300">{a.provider}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleDelete(a)}
                disabled={deleting.has(a.id)}
                className="text-slate-300 hover:text-red-500 transition-colors disabled:opacity-40"
              >
                {deleting.has(a.id)
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Trash2 className="w-4 h-4" />}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
