import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { Department, RoleType } from "@prisma/client";

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const clerkUser = await currentUser();
    if (!clerkUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { companyName, slug, yourName } = body;

    if (!yourName) {
      return NextResponse.json({ error: "Your name is required" }, { status: 400 });
    }

    const email = clerkUser.emailAddresses[0]?.emailAddress ?? "";

    // Check for pending invite first — activate the user and skip tenant creation
    const pendingUser = await prisma.user.findFirst({
      where: { email, clerkId: { startsWith: "pending_" }, isActive: false },
      include: { tenant: true },
    });

    if (pendingUser) {
      await prisma.user.update({
        where: { id: pendingUser.id },
        data: { clerkId: userId, isActive: true, name: yourName || pendingUser.name },
      });
      return NextResponse.json({ success: true, tenantId: pendingUser.tenantId }, { status: 200 });
    }

    // No pending invite — require company fields
    if (!companyName || !slug) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 });
    }

    // Check slug is unique
    const existing = await prisma.tenant.findUnique({ where: { slug } });
    if (existing) {
      return NextResponse.json({ error: "Company ID already taken, please choose another" }, { status: 409 });
    }

    // Check user doesn't already have a record
    const existingUser = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (existingUser) {
      return NextResponse.json({ error: "Account already set up" }, { status: 409 });
    }

    // Create tenant + admin user in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: { name: companyName, slug },
      });

      const user = await tx.user.create({
        data: {
          clerkId: userId,
          tenantId: tenant.id,
          email,
          name: yourName,
          department: Department.MANAGEMENT,
          role: RoleType.COMPANY_ADMIN,
        },
      });

      // Seed default pipeline stages for this tenant
      const defaultStages = [
        { name: "Lead", color: "#94a3b8", order: 0 },
        { name: "Qualified", color: "#3b82f6", order: 1 },
        { name: "Proposal", color: "#8b5cf6", order: 2 },
        { name: "Negotiation", color: "#f59e0b", order: 3 },
        { name: "Won", color: "#22c55e", order: 4 },
        { name: "Lost", color: "#ef4444", order: 5 },
      ];
      await tx.pipelineStage.createMany({
        data: defaultStages.map((s) => ({ ...s, tenantId: tenant.id })),
      });

      return { tenant, user };
    });

    return NextResponse.json({ success: true, tenantId: result.tenant.id }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
