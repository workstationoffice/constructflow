"use client";

import { useState } from "react";
import { User, Plus, CheckCircle, Clock, X, Loader2, Copy, Check, Trash2, AlertTriangle } from "lucide-react";
import InviteUserModal from "@/components/users/invite-user-modal";

const roleLabels: Record<string, string> = {
  COMPANY_ADMIN:     "Company Admin",
  SALES_MANAGER:     "Sales Manager",
  SALES_SUPERVISOR:  "Sales Supervisor",
  SALES_EXECUTIVE:   "Sales Executive",
  DESIGN_MANAGER:    "Design Manager",
  DESIGN_SUPERVISOR: "Design Supervisor",
  DESIGN_OFFICER:    "Design Officer",
  FOREMAN_MANAGER:   "Foreman Manager",
  FOREMAN_SUPERVISOR:"Foreman Supervisor",
  FOREMAN:           "Foreman",
};

const deptPill: Record<string, string> = {
  MANAGEMENT: "bg-purple-100 text-purple-700",
  SALES:      "bg-blue-100 text-blue-700",
  DESIGN:     "bg-emerald-100 text-emerald-700",
  OPERATIONS: "bg-orange-100 text-orange-700",
};

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  avatarUrl: string | null;
  isActive: boolean;
  phone: string | null;
  clerkId: string;
}

interface Props {
  users: UserRow[];
  canManage: boolean;
}

export default function UsersClient({ users: initial, canManage }: Props) {
  const [users, setUsers] = useState(initial);
  const [showInvite, setShowInvite] = useState(false);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<UserRow | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<UserRow | null>(null);
  const [deleteInput, setDeleteInput]     = useState("");
  const [deleting, setDeleting]           = useState(false);
  const [deleteError, setDeleteError]     = useState("");

  const handleInviteSuccess = () => {
    fetch("/api/users")
      .then((r) => r.json())
      .then((d) => { if (d.users) setUsers(d.users); })
      .catch(() => {});
  };

  const copyInviteLink = (email: string, userId: string) => {
    const link = `${window.location.origin}/sign-up`;
    const text = `You've been invited to BuildFlow.\n\nSign up at: ${link}\n\nUse this email to register: ${email}`;
    navigator.clipboard.writeText(text);
    setCopied(userId);
    setTimeout(() => setCopied(null), 2000);
  };

  const cancelInvite = async () => {
    if (!confirmCancel) return;
    setCancelling(confirmCancel.id);
    setConfirmCancel(null);
    try {
      const res = await fetch("/api/invite", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: confirmCancel.id }),
      });
      if (res.ok) setUsers((prev) => prev.filter((u) => u.id !== confirmCancel.id));
    } finally {
      setCancelling(null);
    }
  };

  const openDeleteDialog = (u: UserRow) => {
    setConfirmDelete(u);
    setDeleteInput("");
    setDeleteError("");
  };

  const deleteUser = async () => {
    if (!confirmDelete) return;
    if (deleteInput !== confirmDelete.name) {
      setDeleteError("Name does not match. Please type the exact name.");
      return;
    }
    setDeleting(true);
    setDeleteError("");
    try {
      const res = await fetch(`/api/users/${confirmDelete.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) { setDeleteError(data.error ?? "Failed to delete"); return; }
      setUsers((prev) => prev.filter((u) => u.id !== confirmDelete.id));
      setConfirmDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  const pendingUsers = users.filter((u) => u.clerkId?.startsWith("pending_"));
  const activeUsers  = users.filter((u) => !u.clerkId?.startsWith("pending_"));

  return (
    <>
      {showInvite && (
        <InviteUserModal
          onClose={() => setShowInvite(false)}
          onSuccess={handleInviteSuccess}
        />
      )}

      {confirmCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setConfirmCancel(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <X className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Cancel Invitation</h3>
                <p className="text-sm text-slate-500">This cannot be undone</p>
              </div>
            </div>
            <p className="text-sm text-slate-600">
              Are you sure you want to cancel the invitation for{" "}
              <span className="font-semibold text-slate-900">{confirmCancel.name}</span>{" "}
              (<span className="text-slate-700">{confirmCancel.email}</span>)?
              They will no longer be able to join using this invitation.
            </p>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setConfirmCancel(null)}
                className="flex-1 py-2.5 rounded-xl border-2 border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors"
              >
                Keep Invitation
              </button>
              <button
                onClick={cancelInvite}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors"
              >
                Yes, Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !deleting && setConfirmDelete(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-5">
            {/* Header */}
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Delete User</h3>
                <p className="text-sm text-red-600 font-medium">This action is permanent and cannot be undone</p>
              </div>
            </div>

            {/* User info */}
            <div className="bg-slate-50 rounded-xl px-4 py-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                {confirmDelete.name[0]}
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-slate-900 truncate">{confirmDelete.name}</div>
                <div className="text-xs text-slate-500 truncate">{confirmDelete.email}</div>
              </div>
            </div>

            <p className="text-sm text-slate-600">
              Deleting this user will remove all their data including assignments and activity records. To confirm, type the user&apos;s full name below:
            </p>

            {/* Typed confirmation */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Type <span className="text-red-600 font-bold">{confirmDelete.name}</span> to confirm
              </label>
              <input
                type="text"
                value={deleteInput}
                onChange={(e) => { setDeleteInput(e.target.value); setDeleteError(""); }}
                onKeyDown={(e) => e.key === "Enter" && deleteUser()}
                placeholder={confirmDelete.name}
                autoFocus
                className={`w-full border-2 rounded-xl px-4 py-2.5 text-sm focus:outline-none transition-colors ${
                  deleteError ? "border-red-400 focus:border-red-500" : "border-slate-200 focus:border-red-400"
                }`}
              />
              {deleteError && <p className="text-xs text-red-500">{deleteError}</p>}
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl border-2 border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={deleteUser}
                disabled={deleting || deleteInput !== confirmDelete.name}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
              >
                {deleting
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Deleting…</>
                  : <><Trash2 className="w-4 h-4" /> Delete User</>}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Users</h1>
            <p className="text-slate-500 text-sm mt-0.5">{activeUsers.length} active · {pendingUsers.length} pending</p>
          </div>
          {canManage && (
            <button
              onClick={() => setShowInvite(true)}
              className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-sm hover:opacity-90 transition"
            >
              <Plus className="w-4 h-4" /> Invite User
            </button>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="divide-y divide-slate-50">
            {activeUsers.map((u) => (
              <div key={u.id} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shrink-0 text-white font-bold text-sm">
                  {u.avatarUrl ? (
                    <img src={u.avatarUrl} alt={u.name} className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    u.name[0]
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-slate-900 truncate">{u.name}</div>
                  <div className="text-sm text-slate-500 truncate">{u.email}</div>
                </div>
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${deptPill[u.department] ?? "bg-slate-100 text-slate-600"}`}>
                  {u.department.toLowerCase()}
                </span>
                <span className="text-xs text-slate-500 hidden md:block">{roleLabels[u.role] ?? u.role}</span>
                <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                {canManage && u.role !== "COMPANY_ADMIN" && (
                  <button
                    onClick={() => openDeleteDialog(u)}
                    title="Delete user"
                    className="text-slate-300 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {pendingUsers.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />
              <span className="text-sm font-semibold text-slate-700">Pending Invitations</span>
            </div>
            <div className="divide-y divide-slate-50">
              {pendingUsers.map((u) => (
                <div key={u.id} className="flex items-center gap-4 px-5 py-4">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                    <User className="w-5 h-5 text-slate-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-slate-700 truncate">{u.name}</div>
                    <div className="text-sm text-slate-400 truncate">{u.email}</div>
                  </div>
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${deptPill[u.department] ?? "bg-slate-100 text-slate-600"}`}>
                    {u.department.toLowerCase()}
                  </span>
                  <span className="text-xs text-slate-400 hidden md:block">{roleLabels[u.role] ?? u.role}</span>
                  <span className="text-xs text-amber-600 bg-amber-50 px-2.5 py-0.5 rounded-full font-medium shrink-0">Pending</span>
                  {canManage && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => copyInviteLink(u.email, u.id)}
                        title="Copy invite link"
                        className="flex items-center gap-1 text-xs text-slate-500 hover:text-violet-700 hover:bg-violet-50 px-2.5 py-1 rounded-lg transition-colors"
                      >
                        {copied === u.id
                          ? <><Check className="w-3.5 h-3.5 text-emerald-500" /> Copied!</>
                          : <><Copy className="w-3.5 h-3.5" /> Copy Link</>}
                      </button>
                      <button
                        onClick={() => setConfirmCancel(u)}
                        disabled={cancelling === u.id}
                        title="Cancel invitation"
                        className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-2.5 py-1 rounded-lg transition-colors disabled:opacity-40"
                      >
                        {cancelling === u.id
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <X className="w-3.5 h-3.5" />}
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
