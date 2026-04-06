import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenantUser } from "@/lib/auth";
import { Permission, RoleType } from "@prisma/client";
import { hasPermission } from "@/lib/permissions";
import { logChange } from "@/lib/changelog";
import { ChangeLogEntity } from "@prisma/client";
import { generateDocumentCode } from "@/lib/document-code";

export async function GET(req: NextRequest) {
  try {
    const user = await requireTenantUser();
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") ?? "";
    const canManage = await hasPermission(user.tenantId, user.role, Permission.MANAGE_CUSTOMERS);

    // Sales executives only see their own customers
    const ownerFilter =
      user.role === RoleType.SALES_EXECUTIVE ? { ownerId: user.id } : {};

    const customers = await prisma.customer.findMany({
      where: {
        tenantId: user.tenantId,
        isActive: true,
        ...ownerFilter,
        ...(q && {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { companyName: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        }),
      },
      include: {
        owner: { select: { id: true, name: true } },
        contactPersons: true,
        _count: { select: { deals: true } },
      },
      orderBy: { name: "asc" },
      take: q ? 20 : undefined,
    });

    return NextResponse.json({ customers });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireTenantUser();
    const body = await req.json();
    const { addresses, contactPersons, ...rest } = body;

    const code = await generateDocumentCode(user.tenantId, "CUSTOMER");

    const customer = await prisma.customer.create({
      data: {
        tenantId: user.tenantId,
        ownerId: user.id,
        code,
        ...rest,
        contactPersons: contactPersons?.filter((c: any) => c.name?.trim()).length
          ? { create: contactPersons.filter((c: any) => c.name?.trim()) }
          : undefined,
        addresses: addresses?.filter((a: any) => a.address?.trim() || a.subDistrict?.trim() || a.province?.trim()).length
          ? { create: addresses.filter((a: any) => a.address?.trim() || a.subDistrict?.trim() || a.province?.trim()).map(({ id: _id, ...a }: any) => a) }
          : undefined,
      },
      include: { contactPersons: true, addresses: true },
    });

    await logChange({
      entityType: ChangeLogEntity.CUSTOMER,
      entityId: customer.id,
      userId: user.id,
      tenantId: user.tenantId,
      action: "CREATE",
    });

    return NextResponse.json({ customer }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
