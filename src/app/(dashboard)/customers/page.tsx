import { requireTenantUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { RoleType } from "@prisma/client";
import Link from "next/link";
import { User, Building2, Plus, Search, Kanban } from "lucide-react";

export default async function CustomersPage() {
  const user = await requireTenantUser();

  const ownerFilter = user.role === RoleType.SALES_EXECUTIVE ? { ownerId: user.id } : {};

  const customers = await prisma.customer.findMany({
    where: { tenantId: user.tenantId, isActive: true, ...ownerFilter },
    include: {
      owner: { select: { id: true, name: true } },
      _count: { select: { deals: true, contactPersons: true } },
    },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Customers</h1>
          <p className="text-slate-500 text-sm mt-0.5">{customers.length} total</p>
        </div>
        <Link
          href="/customers/new"
          className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-sm hover:opacity-90 transition"
        >
          <Plus className="w-4 h-4" /> New Customer
        </Link>
      </div>

      {customers.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-16 text-center">
          <div className="w-14 h-14 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
            <User className="w-7 h-7 text-white" />
          </div>
          <p className="text-slate-700 font-semibold">No customers yet</p>
          <p className="text-slate-400 text-sm mt-1">Start adding customers to your CRM</p>
          <Link
            href="/customers/new"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold mt-4 shadow-sm hover:opacity-90 transition"
          >
            <Plus className="w-4 h-4" /> Add first customer
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="divide-y divide-slate-50">
            {customers.map((c) => (
              <Link
                key={c.id}
                href={`/customers/${c.id}`}
                className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors"
              >
                {/* Avatar */}
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                  c.type === "COMPANY"
                    ? "bg-gradient-to-br from-blue-500 to-cyan-500"
                    : "bg-gradient-to-br from-violet-500 to-purple-600"
                }`}>
                  {c.type === "COMPANY"
                    ? <Building2 className="w-5 h-5 text-white" />
                    : <User className="w-5 h-5 text-white" />
                  }
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900 truncate">{c.companyName ?? c.name}</span>
                    {(c as any).code && (
                      <span className="text-xs font-mono font-medium text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">{(c as any).code}</span>
                    )}
                  </div>
                  {c.companyName && (
                    <div className="text-sm text-slate-500 truncate">{c.name}</div>
                  )}
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {c._count.deals > 0 && (
                    <span className="flex items-center gap-1 text-xs text-violet-600 bg-violet-50 px-2.5 py-1 rounded-full font-medium">
                      <Kanban className="w-3 h-3" /> {c._count.deals} deal{c._count.deals !== 1 ? "s" : ""}
                    </span>
                  )}
                  {c._count.contactPersons > 0 && (
                    <span className="flex items-center gap-1 text-xs text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full font-medium">
                      <User className="w-3 h-3" /> {c._count.contactPersons}
                    </span>
                  )}
                  <span className="text-xs text-slate-400 hidden md:block">{c.owner.name}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
