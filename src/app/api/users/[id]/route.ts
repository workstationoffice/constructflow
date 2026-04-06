import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenantUser } from "@/lib/auth";
import { Permission } from "@prisma/client";
import { hasPermission } from "@/lib/permissions";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireTenantUser();
    const canManage = await hasPermission(user.tenantId, user.role, Permission.MANAGE_USERS);
    if (!canManage) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;

    // Cannot delete yourself
    if (id === user.id)
      return NextResponse.json({ error: "You cannot delete your own account" }, { status: 400 });

    const target = await prisma.user.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Cannot delete another COMPANY_ADMIN
    if (target.role === "COMPANY_ADMIN")
      return NextResponse.json({ error: "Cannot delete a Company Admin" }, { status: 400 });

    await prisma.user.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
