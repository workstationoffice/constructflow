import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenantUser } from "@/lib/auth";
import { uploadToR2, getR2Key, getR2CredsFromConfig } from "@/lib/r2";
import { sendCheckInEmail } from "@/lib/resend";
import { sendCheckInLineNotification } from "@/lib/line";
import { VisitStatus, RoleType } from "@prisma/client";
import { format } from "date-fns";

function getDeviceType(userAgent: string) {
  return /mobile|android|iphone|ipad/i.test(userAgent) ? "MOBILE" : "DESKTOP";
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireTenantUser();
    const userAgent = req.headers.get("user-agent") ?? "";
    const deviceType = getDeviceType(userAgent);

    const formData = await req.formData();
    const latitude = parseFloat(formData.get("latitude") as string);
    const longitude = parseFloat(formData.get("longitude") as string);
    const address = formData.get("address") as string;
    const siteId = formData.get("siteId") as string | null;
    const dealId = formData.get("dealId") as string | null;
    const isUnplanned = formData.get("isUnplanned") === "true";
    const selfieFile = formData.get("selfie") as File | null;

    // Foreman must provide a registered site
    const foremanRoles: RoleType[] = [RoleType.FOREMAN, RoleType.FOREMAN_SUPERVISOR, RoleType.FOREMAN_MANAGER];
    if (foremanRoles.includes(user.role) && !siteId) {
      return NextResponse.json({ error: "Foreman must select a registered site" }, { status: 400 });
    }

    // Upload selfie
    let selfieUrl: string | undefined;
    if (selfieFile) {
      const storageConfig = await prisma.storageConfig.findUnique({ where: { tenantId: user.tenantId } });
      const r2Creds = storageConfig ? getR2CredsFromConfig(storageConfig) : null;
      if (r2Creds) {
        const buffer = Buffer.from(await selfieFile.arrayBuffer());
        const key = getR2Key(user.tenantId, "selfies", `${user.id}.jpg`);
        selfieUrl = await uploadToR2(key, buffer, selfieFile.type, r2Creds);
      }
    }

    // Create or update visit
    let visit;
    if (!isUnplanned) {
      // Find existing planned visit for today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const planned = await prisma.visit.findFirst({
        where: {
          userId: user.id,
          tenantId: user.tenantId,
          status: VisitStatus.PLANNED,
          createdAt: { gte: today, lt: tomorrow },
        },
      });

      if (planned) {
        visit = await prisma.visit.update({
          where: { id: planned.id },
          data: {
            status: VisitStatus.CHECKED_IN,
            checkInAt: new Date(),
            checkInLat: latitude,
            checkInLng: longitude,
            checkInAddress: address,
            checkInSelfieUrl: selfieUrl,
            checkInDevice: deviceType as any,
            siteId: siteId ?? planned.siteId,
            dealId: dealId ?? planned.dealId,
          },
        });
      } else {
        visit = await prisma.visit.create({
          data: {
            tenantId: user.tenantId,
            userId: user.id,
            siteId: siteId ?? undefined,
            dealId: dealId ?? undefined,
            isUnplanned: false,
            status: VisitStatus.CHECKED_IN,
            checkInAt: new Date(),
            checkInLat: latitude,
            checkInLng: longitude,
            checkInAddress: address,
            checkInSelfieUrl: selfieUrl,
            checkInDevice: deviceType as any,
          },
        });
      }
    } else {
      visit = await prisma.visit.create({
        data: {
          tenantId: user.tenantId,
          userId: user.id,
          siteId: siteId ?? undefined,
          dealId: dealId ?? undefined,
          isUnplanned: true,
          status: VisitStatus.CHECKED_IN,
          checkInAt: new Date(),
          checkInLat: latitude,
          checkInLng: longitude,
          checkInAddress: address,
          checkInSelfieUrl: selfieUrl,
          checkInDevice: deviceType as any,
        },
      });
    }

    // Fetch site and deal info for notifications
    const [site, deal] = await Promise.all([
      siteId ? prisma.site.findUnique({ where: { id: siteId } }) : null,
      dealId ? prisma.deal.findUnique({ where: { id: dealId } }) : null,
    ]);

    const siteName = site?.name ?? address ?? "Unknown location";
    const checkInTime = format(new Date(), "dd/MM/yyyy HH:mm");

    // Find supervisor and manager to notify
    const supervisorRoles: Record<RoleType, RoleType[]> = {
      SALES_EXECUTIVE: [RoleType.SALES_SUPERVISOR, RoleType.SALES_MANAGER],
      SALES_SUPERVISOR: [RoleType.SALES_MANAGER],
      SALES_MANAGER: [RoleType.COMPANY_ADMIN],
      DESIGN_OFFICER: [RoleType.DESIGN_SUPERVISOR, RoleType.DESIGN_MANAGER],
      DESIGN_SUPERVISOR: [RoleType.DESIGN_MANAGER],
      DESIGN_MANAGER: [RoleType.COMPANY_ADMIN],
      FOREMAN: [RoleType.FOREMAN_SUPERVISOR, RoleType.FOREMAN_MANAGER],
      FOREMAN_SUPERVISOR: [RoleType.FOREMAN_MANAGER],
      FOREMAN_MANAGER: [RoleType.COMPANY_ADMIN],
      COMPANY_ADMIN: [],
    };

    const notifyRoles = supervisorRoles[user.role] ?? [];
    const notifyUsers = notifyRoles.length > 0
      ? await prisma.user.findMany({
          where: { tenantId: user.tenantId, role: { in: notifyRoles }, isActive: true },
          select: { email: true, lineGroupId: true },
        })
      : [];

    const emails = notifyUsers.map((u) => u.email).filter(Boolean);
    const lineGroupIds = [...new Set([
      ...(notifyUsers.map((u) => u.lineGroupId).filter(Boolean) as string[]),
      ...(user.lineGroupId ? [user.lineGroupId] : []),
    ])];

    const notifData = {
      workerName: user.name,
      workerRole: user.role,
      siteName,
      checkInTime,
      latitude,
      longitude,
      selfieUrl,
      dealTitle: deal?.title,
    };

    // Send notifications in parallel (non-blocking)
    await Promise.allSettled([
      emails.length > 0 ? sendCheckInEmail(emails, notifData) : Promise.resolve(),
      ...lineGroupIds.map((gid) => sendCheckInLineNotification(gid, notifData)),
    ]);

    return NextResponse.json({ visit }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
