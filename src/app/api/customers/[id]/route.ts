import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenantUser } from "@/lib/auth";
import { logChange, logObjectChanges } from "@/lib/changelog";
import { ChangeLogEntity } from "@prisma/client";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireTenantUser();
    const { id } = await params;

    const customer = await prisma.customer.findFirst({
      where: { id, tenantId: user.tenantId },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        contactPersons: true,
        addresses: { orderBy: { createdAt: "asc" } },
        deals: {
          include: {
            stage: true,
            assignees: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
            activities: { orderBy: { createdAt: "desc" }, take: 5 },
          },
          where: { isActive: true },
          orderBy: { createdAt: "desc" },
        },
        changelog: {
          orderBy: { createdAt: "desc" },
          take: 50,
          include: { user: { select: { id: true, name: true } } },
        },
      },
    });

    if (!customer) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Compute Customer 360 summary
    const totalDeals = customer.deals.length;
    const totalPipelineValue = customer.deals.reduce((sum, d) => sum + d.value, 0);
    const totalBudget = customer.deals.reduce((sum, d) => sum + (d.budget ?? 0), 0);

    // All visits tied to this customer's deals
    const dealIds = customer.deals.map((d) => d.id);
    const visits = await prisma.visit.findMany({
      where: { dealId: { in: dealIds } },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { checkInAt: "desc" },
      take: 20,
    });

    return NextResponse.json({ customer, summary: { totalDeals, totalPipelineValue, totalBudget }, visits });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireTenantUser();
    const { id } = await params;
    const body = await req.json();

    const existing = await prisma.customer.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { contactPersons, addresses, ...customerData } = body;

    const updated = await prisma.customer.update({
      where: { id },
      data: {
        ...customerData,
        ...(contactPersons !== undefined && {
          contactPersons: {
            deleteMany: {},
            create: contactPersons
              .filter((c: any) => c.name?.trim())
              .map(({ id: _id, ...rest }: any) => rest),
          },
        }),
        ...(addresses !== undefined && {
          addresses: {
            deleteMany: {},
            create: addresses
              .filter((a: any) => a.address?.trim())
              .map(({ id: _id, ...rest }: any) => rest),
          },
        }),
      },
      include: { contactPersons: true, addresses: true },
    });

    await logObjectChanges({
      entityType: ChangeLogEntity.CUSTOMER,
      entityId: id,
      userId: user.id,
      tenantId: user.tenantId,
      before: existing as any,
      after: updated as any,
    });

    return NextResponse.json({ customer: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireTenantUser();
    const { id } = await params;

    await prisma.customer.update({
      where: { id, tenantId: user.tenantId },
      data: { isActive: false },
    });

    await logChange({
      entityType: ChangeLogEntity.CUSTOMER,
      entityId: id,
      userId: user.id,
      tenantId: user.tenantId,
      action: "DELETE",
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
