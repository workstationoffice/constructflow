import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenantUser } from "@/lib/auth";
import { Permission } from "@prisma/client";
import { hasPermission } from "@/lib/permissions";
import { logChange } from "@/lib/changelog";
import { ChangeLogEntity } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const user = await requireTenantUser();
    const users = await prisma.user.findMany({
      where: { tenantId: user.tenantId },
      select: {
        id: true, clerkId: true, name: true, email: true, role: true, department: true,
        avatarUrl: true, isActive: true, lineGroupId: true, phone: true, createdAt: true,
      },
      orderBy: [{ department: "asc" }, { role: "asc" }, { name: "asc" }],
    });
    return NextResponse.json({ users });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireTenantUser();
    const canManage = await hasPermission(user.tenantId, user.role, Permission.MANAGE_USERS);
    if (!canManage) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const { clerkId, email, name, role, department, phone, lineGroupId } = body;

    const newUser = await prisma.user.create({
      data: {
        tenantId: user.tenantId,
        clerkId,
        email,
        name,
        role,
        department,
        phone,
        lineGroupId,
      },
    });

    await logChange({
      entityType: ChangeLogEntity.USER,
      entityId: newUser.id,
      userId: user.id,
      tenantId: user.tenantId,
      action: "CREATE",
    });

    return NextResponse.json({ user: newUser }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
