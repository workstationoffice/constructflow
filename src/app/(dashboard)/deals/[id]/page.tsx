import { requireTenantUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { formatCurrency, formatDate, formatDateTime, getDealAlerts } from "@/lib/utils";
import { AlertCircle, MapPin, Paperclip, Navigation } from "lucide-react";
import Link from "next/link";
import DealAttachmentsPanel from "@/components/deals/attachments-panel";
import ProgressUpdatePanel from "@/components/deals/progress-update-panel";

export default async function DealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireTenantUser();
  const { id } = await params;

  const deal = await prisma.deal.findFirst({
    where: { id, tenantId: user.tenantId },
    include: {
      customer: { include: { contactPersons: true } },
      stage: true,
      assignees: { include: { user: { select: { id: true, name: true, role: true, avatarUrl: true } } } },
      activities: {
        include: { attachments: true },
        orderBy: { createdAt: "desc" },
      },
      attachments: { orderBy: { createdAt: "desc" } },
      visits: {
        include: { user: { select: { name: true } }, site: true },
        orderBy: { checkInAt: "desc" },
      },
    },
  });

  if (!deal) notFound();

  const changelog = await prisma.changeLog.findMany({
    where: { entityType: "DEAL", entityId: id },
    orderBy: { createdAt: "desc" },
    take: 30,
    include: { user: { select: { name: true } } },
  });

  const alerts = getDealAlerts(deal);

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs px-2 py-0.5 rounded-full text-white font-medium" style={{ background: deal.stage.color }}>
              {deal.stage.name}
            </span>
            <Link href={`/customers/${deal.customer.id}`} className="text-sm text-slate-500 hover:underline">
              {deal.customer.companyName ?? deal.customer.name}
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">{deal.title}</h1>
            {deal.code && (
              <span className="text-sm font-mono font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">{deal.code}</span>
            )}
          </div>
          <div className="text-2xl font-semibold text-blue-600 mt-1">{formatCurrency(deal.value)}</div>
        </div>
        <Link href={`/deals/${id}/edit`} className="text-sm text-blue-600 hover:underline shrink-0">Edit</Link>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="bg-red-50 border border-red-300 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            {alerts.map((a) => <div key={a} className="text-sm text-red-700">{a}</div>)}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Deal Info */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border p-5 space-y-3">
            <h3 className="font-semibold text-slate-900">Deal Details</h3>
            {[
              { label: "Budget", value: deal.budget ? formatCurrency(deal.budget) : "—" },
              { label: "Next Contact", value: deal.nextContactDate ? formatDate(deal.nextContactDate) : "—" },
              { label: "Est. Close Date", value: deal.estimatedCloseDate ? formatDate(deal.estimatedCloseDate) : "—" },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between text-sm">
                <span className="text-slate-500">{label}</span>
                <span className="text-slate-900 font-medium text-right">{value}</span>
              </div>
            ))}
            {/* Site Location */}
            {deal.siteLocation && (
              <div className="pt-1 border-t border-slate-100">
                <div className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> Site Location
                </div>
                <div className="text-sm font-medium text-slate-900">{deal.siteLocation}</div>
                {deal.siteLat != null && deal.siteLng != null && (
                  <>
                    <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                      <Navigation className="w-3 h-3" />
                      {(deal.siteLat as number).toFixed(6)}, {(deal.siteLng as number).toFixed(6)}
                    </div>
                    {process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`https://maps.googleapis.com/maps/api/staticmap?center=${deal.siteLat},${deal.siteLng}&zoom=15&size=320x160&markers=color:red|${deal.siteLat},${deal.siteLng}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&scale=2`}
                        alt="Site location map"
                        className="w-full h-32 object-cover rounded-xl mt-2 border border-slate-100"
                      />
                    )}
                    <a
                      href={`https://www.google.com/maps?q=${deal.siteLat},${deal.siteLng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-1"
                    >
                      <MapPin className="w-3 h-3" /> Open in Google Maps
                    </a>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Assignees */}
          <div className="bg-white rounded-xl border p-5">
            <h3 className="font-semibold text-slate-900 mb-3">Assigned To</h3>
            <div className="space-y-2">
              {deal.assignees.map(({ user: u }) => (
                <div key={u.id} className="flex items-center gap-2 text-sm">
                  <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs font-medium text-slate-600">
                    {u.name[0]}
                  </div>
                  <span className="text-slate-800">{u.name}</span>
                  <span className="text-xs text-slate-400 ml-auto">{u.role.replace(/_/g, " ").toLowerCase()}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Requirements */}
          {deal.requirements && (
            <div className="bg-white rounded-xl border p-5">
              <h3 className="font-semibold text-slate-900 mb-2">Requirements</h3>
              <p className="text-sm text-slate-600 whitespace-pre-wrap">{deal.requirements}</p>
            </div>
          )}
          {/* Attachments */}
          <DealAttachmentsPanel
            dealId={id}
            initialAttachments={deal.attachments.map((a) => ({
              id: a.id,
              name: a.name,
              url: a.url,
              size: a.size ?? undefined,
              mimeType: a.mimeType ?? undefined,
              provider: a.provider as string,
              createdAt: a.createdAt.toISOString(),
            }))}
          />
        </div>

        {/* Activities */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl border">
            <div className="px-5 py-4 border-b flex items-center justify-between gap-3">
              <h3 className="font-semibold text-slate-900">Activity</h3>
              <div className="flex items-center gap-2">
                <ProgressUpdatePanel dealId={id} dealTitle={deal.title} />
                <Link href={`/deals/${id}/activity/new`} className="text-xs text-slate-500 hover:text-slate-700 hover:underline">+ Log activity</Link>
              </div>
            </div>
            <div className="divide-y">
              {deal.activities.length === 0 ? (
                <div className="p-6 text-center text-sm text-slate-400">No activities yet</div>
              ) : (
                deal.activities.map((act) => {
                  const isProgress = act.type === "PROGRESS_UPDATE";
                  return (
                    <div
                      key={act.id}
                      className={`px-5 py-4 ${isProgress ? "bg-violet-50/40 border-l-4 border-l-violet-400" : ""}`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full capitalize font-medium ${
                          isProgress
                            ? "bg-violet-100 text-violet-700"
                            : "bg-slate-100 text-slate-600"
                        }`}>
                          {act.type.toLowerCase().replace(/_/g, " ")}
                        </span>
                        <span className="text-xs text-slate-400">{formatDateTime(act.createdAt)}</span>
                      </div>
                      <div className="font-medium text-sm text-slate-900">{act.title}</div>
                      {act.description && <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">{act.description}</p>}
                      {act.attachments.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {act.attachments.map((a) => (
                            <a key={a.id} href={a.url} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1 text-xs text-blue-600 hover:underline bg-white border border-blue-100 px-2 py-1 rounded-lg">
                              <Paperclip className="w-3 h-3" />{a.name}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Visit history for this deal */}
          {deal.visits.length > 0 && (
            <div className="bg-white rounded-xl border">
              <div className="px-5 py-4 border-b font-semibold text-slate-900">Site Visits</div>
              <div className="divide-y">
                {deal.visits.map((v) => (
                  <div key={v.id} className="px-5 py-3 flex items-center gap-3 text-sm">
                    <MapPin className="w-4 h-4 text-slate-400" />
                    <div>
                      <span className="font-medium text-slate-900">{v.user.name}</span>
                      <span className="text-slate-500 ml-2">{v.site?.name ?? "Unknown"}</span>
                      <span className="text-slate-400 ml-2">{v.checkInAt ? formatDateTime(v.checkInAt) : ""}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Changelog */}
      {changelog.length > 0 && (
        <div className="bg-white rounded-xl border">
          <div className="px-5 py-4 border-b font-semibold text-slate-900">Change History</div>
          <div className="divide-y">
            {changelog.map((log) => (
              <div key={log.id} className="px-5 py-3 text-sm">
                <span className="font-medium">{log.user?.name ?? "System"}</span>
                <span className="text-slate-500"> {log.action.toLowerCase()}d </span>
                {log.field && <span className="text-slate-700">{log.field}</span>}
                {log.oldValue && log.newValue && (
                  <span className="text-slate-500">: <span className="line-through text-red-400">{log.oldValue}</span> → <span className="text-green-600">{log.newValue}</span></span>
                )}
                <span className="text-slate-400 ml-2 text-xs">{formatDateTime(log.createdAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
