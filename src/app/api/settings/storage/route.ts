import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenantUser } from "@/lib/auth";
import { Permission, StorageProvider } from "@prisma/client";
import { hasPermission } from "@/lib/permissions";

export async function GET() {
  try {
    const user = await requireTenantUser();
    const config = await prisma.storageConfig.findUnique({
      where: { tenantId: user.tenantId },
    });
    return NextResponse.json({ config });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await requireTenantUser();
    const canManage = await hasPermission(user.tenantId, user.role, Permission.MANAGE_STORAGE);
    if (!canManage) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const {
      provider,
      r2AccountId, r2AccessKeyId, r2SecretAccessKey, r2BucketName, r2PublicUrl,
      msClientId, msClientSecret, msTenantId,
      sharepointSiteId, sharepointDriveId,
      onedriveFolder,
      googleDriveFolderId, googleServiceAccountEmail, googleServiceAccountKey,
    } = body;

    const fields = {
      provider: provider ?? StorageProvider.R2,
      r2AccountId:       r2AccountId       || null,
      r2AccessKeyId:     r2AccessKeyId     || null,
      r2SecretAccessKey: r2SecretAccessKey || null,
      r2BucketName:      r2BucketName      || null,
      r2PublicUrl:       r2PublicUrl        || null,
      msClientId:        msClientId         || null,
      msClientSecret:    msClientSecret     || null,
      msTenantId:        msTenantId         || null,
      sharepointSiteId:  sharepointSiteId  || null,
      sharepointDriveId: sharepointDriveId || null,
      onedriveFolder:    onedriveFolder     || null,
      googleDriveFolderId:          googleDriveFolderId          || null,
      googleServiceAccountEmail:    googleServiceAccountEmail    || null,
      googleServiceAccountKey:      googleServiceAccountKey      || null,
    };

    const config = await prisma.storageConfig.upsert({
      where: { tenantId: user.tenantId },
      update: fields,
      create: { tenantId: user.tenantId, ...fields },
    });

    return NextResponse.json({ config });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
