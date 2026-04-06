import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenantUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { Permission } from "@prisma/client";

const DOCUMENT_TYPES = ["CUSTOMER", "DEAL"];
const DEFAULTS: Record<string, string> = { CUSTOMER: "CUST", DEAL: "DEAL" };

export async function GET() {
  try {
    const user = await requireTenantUser();

    const existing = await prisma.documentSequence.findMany({
      where: { tenantId: user.tenantId },
    });

    // Return all types, filling defaults for missing ones
    const sequences = DOCUMENT_TYPES.map((type) => {
      const found = existing.find((s) => s.type === type);
      return {
        type,
        prefix:        found?.prefix        ?? DEFAULTS[type],
        paddingLength: found?.paddingLength  ?? 5,
        lastNumber:    found?.lastNumber     ?? 0,
      };
    });

    return NextResponse.json({ sequences });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await requireTenantUser();
    const canManage = await hasPermission(user.tenantId, user.role, Permission.MANAGE_TENANT);
    if (!canManage) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { type, prefix, paddingLength } = await req.json();
    if (!DOCUMENT_TYPES.includes(type)) return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    if (!prefix?.trim()) return NextResponse.json({ error: "Prefix is required" }, { status: 400 });

    const seq = await prisma.documentSequence.upsert({
      where: { tenantId_type: { tenantId: user.tenantId, type } },
      update: { prefix: prefix.trim().toUpperCase(), paddingLength: Number(paddingLength) || 5 },
      create: {
        tenantId: user.tenantId,
        type,
        prefix: prefix.trim().toUpperCase(),
        paddingLength: Number(paddingLength) || 5,
        lastNumber: 0,
      },
    });

    return NextResponse.json({ sequence: seq });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
