import { requireTenantUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { formatCurrency, formatDateTime, isDealAlert } from "@/lib/utils";
import { User, Building2, Phone, Mail, MessageCircle, MapPin, AlertCircle, Home, Truck, Star } from "lucide-react";
import Link from "next/link";
import ConvertTypeButton from "@/components/customers/convert-type-button";

export default async function Customer360Page({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireTenantUser();
  const { id } = await params;

  const customer = await prisma.customer.findFirst({
    where: { id, tenantId: user.tenantId },
    include: {
      owner: { select: { id: true, name: true } },
      contactPersons: true,
      addresses: { orderBy: { createdAt: "asc" } },
      deals: {
        where: { isActive: true },
        include: {
          stage: true,
          assignees: { include: { user: { select: { id: true, name: true } } } },
          activities: { orderBy: { createdAt: "desc" }, take: 3 },
        },
        orderBy: { value: "desc" },
      },
    },
  });

  if (!customer) notFound();

  const dealIds = customer.deals.map((d) => d.id);
  const [visits, changelog] = await Promise.all([
    prisma.visit.findMany({
      where: { dealId: { in: dealIds } },
      include: { user: { select: { name: true } }, site: true },
      orderBy: { checkInAt: "desc" },
      take: 10,
    }),
    prisma.changeLog.findMany({
      where: { entityType: "CUSTOMER", entityId: id },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { user: { select: { name: true } } },
    }),
  ]);

  const totalPipelineValue = customer.deals.reduce((s, d) => s + d.value, 0);
  const totalBudget = customer.deals.reduce((s, d) => s + (d.budget ?? 0), 0);

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
          {customer.type === "COMPANY" ? <Building2 className="w-7 h-7 text-slate-500" /> : <User className="w-7 h-7 text-slate-500" />}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">{customer.companyName ?? customer.name}</h1>
            {customer.code && (
              <span className="text-sm font-mono font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">{customer.code}</span>
            )}
          </div>
          {customer.companyName && <p className="text-slate-500">{customer.name}</p>}
          <div className="flex flex-wrap gap-4 mt-2 text-sm text-slate-500">
            {customer.type === "PERSONAL" && customer.email && <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{customer.email}</span>}
            {customer.type === "PERSONAL" && customer.phone && <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{customer.phone}</span>}
            {customer.taxId && <span>Tax ID: {customer.taxId}</span>}
            <span>Owner: {customer.owner.name}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ConvertTypeButton
            customerId={id}
            currentType={customer.type as "PERSONAL" | "COMPANY"}
            currentName={customer.name}
            companyName={customer.companyName}
          />
          <Link href={`/customers/${id}/edit`} className="text-sm text-blue-600 hover:underline">Edit</Link>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border p-4">
          <div className="text-sm text-slate-500">Total Deals</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{customer.deals.length}</div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="text-sm text-slate-500">Pipeline Value</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{formatCurrency(totalPipelineValue)}</div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="text-sm text-slate-500">Total Budget</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{formatCurrency(totalBudget)}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Contacts + Addresses */}
        <div className="space-y-4">
          {/* Contact Persons — COMPANY only */}
          {customer.type === "COMPANY" && <div className="bg-white rounded-xl border">
            <div className="px-5 py-4 border-b font-semibold text-slate-900">Contact Persons</div>
            <div className="divide-y">
              {customer.contactPersons.length === 0 ? (
                <div className="p-4 text-sm text-slate-400">No contacts added</div>
              ) : (
                customer.contactPersons.map((c) => (
                  <div key={c.id} className="px-5 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-sm text-slate-900">{c.name}</span>
                      {(c as any).isPrimary && <span className="flex items-center gap-0.5 text-xs font-semibold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full"><Star className="w-3 h-3 fill-amber-500 text-amber-500" />Primary</span>}
                    </div>
                    {c.position && <div className="text-xs text-slate-500">{c.position}</div>}
                    <div className="flex flex-wrap gap-3 mt-1 text-xs text-slate-400">
                      {c.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{c.phone}</span>}
                      {c.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{c.email}</span>}
                      {c.lineId && <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" />{c.lineId}</span>}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>}

          {/* Addresses */}
          <div className="bg-white rounded-xl border">
            <div className="px-5 py-4 border-b font-semibold text-slate-900">Addresses</div>
            <div className="divide-y">
              {customer.addresses.length === 0 ? (
                <div className="p-4 text-sm text-slate-400">No addresses added</div>
              ) : (
                customer.addresses.map((a) => (
                  <div key={a.id} className="px-5 py-3">
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                      {a.label && <span className="text-xs font-semibold text-slate-600">{a.label}</span>}
                      {a.isDefaultBilling  && <span className="flex items-center gap-0.5 text-xs font-semibold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded-full"><Home className="w-3 h-3" />Billing</span>}
                      {a.isDefaultShipping && <span className="flex items-center gap-0.5 text-xs font-semibold text-orange-700 bg-orange-100 px-1.5 py-0.5 rounded-full"><Truck className="w-3 h-3" />Shipping</span>}
                    </div>
                    <div className="text-xs text-slate-500 flex items-start gap-1 mt-0.5">
                      <MapPin className="w-3 h-3 mt-0.5 shrink-0 text-slate-400" />
                      <div>
                        {a.address && <div>{a.address}</div>}
                        {((a as any).subDistrict || (a as any).district) && (
                          <div>{[(a as any).subDistrict, (a as any).district].filter(Boolean).join(" · ")}</div>
                        )}
                        {((a as any).province || (a as any).postalCode) && (
                          <div>{[(a as any).province, (a as any).postalCode].filter(Boolean).join(" ")}</div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Deals */}
        <div className="lg:col-span-2 bg-white rounded-xl border">
          <div className="px-5 py-4 border-b flex items-center justify-between">
            <span className="font-semibold text-slate-900">Deals</span>
            <Link href={`/deals/new?customerId=${id}`} className="text-xs text-blue-600 hover:underline">+ Add Deal</Link>
          </div>
          <div className="divide-y">
            {customer.deals.map((deal) => (
              <Link key={deal.id} href={`/deals/${deal.id}`} className="block px-5 py-4 hover:bg-slate-50">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {isDealAlert(deal) && <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                      <span className="font-medium text-sm text-slate-900">{deal.title}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs px-2 py-0.5 rounded-full text-white" style={{ background: deal.stage.color }}>
                        {deal.stage.name}
                      </span>
                      <span className="text-xs text-slate-500">{deal.assignees.map((a) => a.user.name).join(", ")}</span>
                    </div>
                  </div>
                  <span className="font-semibold text-slate-700 text-sm shrink-0">{formatCurrency(deal.value)}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Visit History */}
      {visits.length > 0 && (
        <div className="bg-white rounded-xl border">
          <div className="px-5 py-4 border-b font-semibold text-slate-900">Visit History</div>
          <div className="divide-y">
            {visits.map((v) => (
              <div key={v.id} className="px-5 py-3 flex items-center gap-3">
                <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-900">{v.user.name}</div>
                  <div className="text-xs text-slate-500">{v.site?.name ?? "Unknown site"} • {v.checkInAt ? formatDateTime(v.checkInAt) : ""}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
                  <span className="text-slate-500"> from <span className="text-slate-700">{log.oldValue}</span> to <span className="text-slate-700">{log.newValue}</span></span>
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
