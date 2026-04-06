import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenantUser } from "@/lib/auth";
import { logChange, logObjectChanges } from "@/lib/changelog";
import { ChangeLogEntity } from "@prisma/client";

function validateDeal(data: { nextContactDate?: string; estimatedCloseDate?: string }) {
  const errors: string[] = [];
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  if (data.nextContactDate) {
    const ncd = new Date(data.nextContactDate);
    if (ncd < now) errors.push("Next contact date cannot be in the past");
    if (data.estimatedCloseDate && ncd > new Date(data.estimatedCloseDate))
      errors.push("Next contact date cannot be later than estimated close date");
  }
  if (data.estimatedCloseDate && new Date(data.estimatedCloseDate) < now)
    errors.push("Estimated close date cannot be in the past");
  return errors;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireTenantUser();
    const { id } = await params;

    const deal = await prisma.deal.findFirst({
      where: { id, tenantId: user.tenantId },
      include: {
        customer: { include: { contactPersons: true } },
        stage: true,
        assignees: { include: { user: { select: { id: true, name: true, avatarUrl: true, role: true } } } },
        activities: {
          include: { attachments: true },
          orderBy: { createdAt: "desc" },
        },
        attachments: { orderBy: { createdAt: "desc" } },
        visits: {
          include: { user: { select: { id: true, name: true } }, site: true },
          orderBy: { checkInAt: "desc" },
        },
      },
    });

    if (!deal) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({ deal });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireTenantUser();
    const { id } = await params;
    const body = await req.json();
    const { assigneeIds, ...dealData } = body;

    const existing = await prisma.deal.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const errors = validateDeal({
      nextContactDate: dealData.nextContactDate,
      estimatedCloseDate: dealData.estimatedCloseDate,
    });
    if (errors.length > 0) return NextResponse.json({ errors }, { status: 422 });

    const updated = await prisma.deal.update({
      where: { id },
      data: {
        ...dealData,
        nextContactDate: dealData.nextContactDate ? new Date(dealData.nextContactDate) : dealData.nextContactDate === null ? null : undefined,
        estimatedCloseDate: dealData.estimatedCloseDate ? new Date(dealData.estimatedCloseDate) : dealData.estimatedCloseDate === null ? null : undefined,
        ...(assigneeIds && {
          assignees: {
            deleteMany: {},
            create: assigneeIds.map((uid: string) => ({ userId: uid })),
          },
        }),
      },
      include: { customer: true, stage: true, assignees: { include: { user: true } } },
    });

    await logObjectChanges({
      entityType: ChangeLogEntity.DEAL,
      entityId: id,
      userId: user.id,
      tenantId: user.tenantId,
      before: existing as any,
      after: updated as any,
    });

    return NextResponse.json({ deal: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireTenantUser();
    const { id } = await params;

    await prisma.deal.update({
      where: { id, tenantId: user.tenantId },
      data: { isActive: false },
    });
    await logChange({
      entityType: ChangeLogEntity.DEAL,
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
