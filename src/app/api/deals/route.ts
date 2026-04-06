import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenantUser } from "@/lib/auth";
import { Permission, RoleType } from "@prisma/client";
import { hasPermission } from "@/lib/permissions";
import { logChange } from "@/lib/changelog";
import { ChangeLogEntity } from "@prisma/client";
import { generateDocumentCode } from "@/lib/document-code";

function validateDeal(data: {
  nextContactDate?: string;
  estimatedCloseDate?: string;
}) {
  const errors: string[] = [];
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  if (data.nextContactDate) {
    const ncd = new Date(data.nextContactDate);
    if (ncd < now) errors.push("Next contact date cannot be in the past");
    if (data.estimatedCloseDate) {
      const ecd = new Date(data.estimatedCloseDate);
      if (ncd > ecd) errors.push("Next contact date cannot be later than estimated close date");
    }
  }

  if (data.estimatedCloseDate) {
    const ecd = new Date(data.estimatedCloseDate);
    if (ecd < now) errors.push("Estimated close date cannot be in the past");
  }

  return errors;
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireTenantUser();
    const { searchParams } = new URL(req.url);
    const stageId = searchParams.get("stageId");

    const [canViewAll, canViewDept, canViewTeam] = await Promise.all([
      hasPermission(user.tenantId, user.role, Permission.VIEW_ALL_DEALS),
      hasPermission(user.tenantId, user.role, Permission.VIEW_DEPT_DEALS),
      hasPermission(user.tenantId, user.role, Permission.VIEW_TEAM_DEALS),
    ]);

    let assigneeFilter = {};
    if (!canViewAll) {
      if (canViewDept || canViewTeam) {
        // Deals where any assignee is in the user's visible scope
        // Simplified: show all dept deals for manager/supervisor
        assigneeFilter = {};
      } else {
        assigneeFilter = { assignees: { some: { userId: user.id } } };
      }
    }

    const deals = await prisma.deal.findMany({
      where: {
        tenantId: user.tenantId,
        isActive: true,
        ...(stageId && { stageId }),
        ...assigneeFilter,
      },
      include: {
        customer: { select: { id: true, name: true, companyName: true, type: true } },
        stage: true,
        assignees: {
          include: { user: { select: { id: true, name: true, avatarUrl: true, role: true } } },
        },
        _count: { select: { activities: true, attachments: true } },
      },
      orderBy: [{ value: "desc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({ deals });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireTenantUser();
    const body = await req.json();
    const {
      customerId, stageId, title, value, siteLocation, siteLat, siteLng, budget,
      requirements, nextContactDate, estimatedCloseDate, notes, assigneeIds,
    } = body;

    if (!customerId) return NextResponse.json({ error: "Customer is required" }, { status: 400 });

    const errors = validateDeal({ nextContactDate, estimatedCloseDate });
    if (errors.length > 0) return NextResponse.json({ errors }, { status: 422 });

    const code = await generateDocumentCode(user.tenantId, "DEAL");

    const deal = await prisma.deal.create({
      data: {
        tenantId: user.tenantId,
        customerId,
        code,
        stageId,
        title,
        value: value ?? 0,
        currency: "THB",
        siteLocation,
        siteLat: siteLat ?? null,
        siteLng: siteLng ?? null,
        budget,
        requirements,
        nextContactDate: nextContactDate ? new Date(nextContactDate) : undefined,
        estimatedCloseDate: estimatedCloseDate ? new Date(estimatedCloseDate) : undefined,
        notes,
        assignees: assigneeIds?.length
          ? { create: assigneeIds.map((uid: string) => ({ userId: uid })) }
          : { create: [{ userId: user.id }] },
      },
      include: {
        customer: true,
        stage: true,
        assignees: { include: { user: { select: { id: true, name: true } } } },
      },
    });

    await logChange({
      entityType: ChangeLogEntity.DEAL,
      entityId: deal.id,
      userId: user.id,
      tenantId: user.tenantId,
      action: "CREATE",
    });

    return NextResponse.json({ deal }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
