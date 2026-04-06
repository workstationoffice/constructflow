import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenantUser } from "@/lib/auth";
import { getDepartmentFromRole } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { Permission, RoleType } from "@prisma/client";
import { sendInviteEmail } from "@/lib/resend";

export async function POST(req: NextRequest) {
  try {
    const user = await requireTenantUser();
    const canManage = await hasPermission(user.tenantId, user.role, Permission.MANAGE_USERS);
    if (!canManage) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { email, name, role } = await req.json();
    if (!email || !name || !role) {
      return NextResponse.json({ error: "email, name and role are required" }, { status: 400 });
    }

    const department = getDepartmentFromRole(role as RoleType);

    // Check if already exists
    const existing = await prisma.user.findFirst({
      where: { tenantId: user.tenantId, email },
    });
    if (existing) {
      return NextResponse.json({ error: "A user with this email already exists in your company" }, { status: 409 });
    }

    // Create pending user (clerkId = "pending_" + random)
    const pendingClerkId = `pending_${crypto.randomUUID()}`;
    const invited = await prisma.user.create({
      data: {
        tenantId: user.tenantId,
        clerkId: pendingClerkId,
        email,
        name,
        role: role as RoleType,
        department,
        isActive: false,
      },
    });

    // Send invite email
    const tenant = await prisma.tenant.findUnique({ where: { id: user.tenantId } });
    await sendInviteEmail({
      to: email,
      name,
      inviterName: user.name,
      companyName: tenant?.name ?? "your company",
    });

    return NextResponse.json({ user: invited }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await requireTenantUser();
    const canManage = await hasPermission(user.tenantId, user.role, Permission.MANAGE_USERS);
    if (!canManage) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { userId } = await req.json();
    if (!userId) return NextResponse.json({ error: "userId is required" }, { status: 400 });

    const pending = await prisma.user.findFirst({
      where: { id: userId, tenantId: user.tenantId },
    });
    if (!pending) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!pending.clerkId?.startsWith("pending_"))
      return NextResponse.json({ error: "User is not a pending invitation" }, { status: 400 });

    await prisma.user.delete({ where: { id: userId } });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
