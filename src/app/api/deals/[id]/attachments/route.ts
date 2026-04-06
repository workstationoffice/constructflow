import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenantUser } from "@/lib/auth";
import { uploadToR2, getR2Key, getR2CredsFromConfig } from "@/lib/r2";
import { uploadToCloudStorage } from "@/lib/storage";
import { StorageProvider } from "@prisma/client";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireTenantUser();
    const { id } = await params;

    const deal = await prisma.deal.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!deal) return NextResponse.json({ error: "Deal not found" }, { status: 404 });

    const storageConfig = await prisma.storageConfig.findUnique({
      where: { tenantId: user.tenantId },
    });
    const provider = storageConfig?.provider ?? StorageProvider.R2;

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const activityId = formData.get("activityId") as string | null;

    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    let url = "";
    let externalId: string | undefined;

    if (provider === StorageProvider.R2) {
      const creds = storageConfig ? getR2CredsFromConfig(storageConfig) : null;
      if (!creds) {
        return NextResponse.json(
          { error: "R2 storage is not configured. Please go to Settings → Storage and enter your Cloudflare R2 credentials." },
          { status: 422 }
        );
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      const key = getR2Key(user.tenantId, `deals/${id}`, file.name);
      url = await uploadToR2(key, buffer, file.type, creds);
    } else {
      if (!storageConfig)
        return NextResponse.json({ error: "Storage not configured." }, { status: 422 });
      const buffer = Buffer.from(await file.arrayBuffer());
      const result = await uploadToCloudStorage(file.name, buffer, file.type, storageConfig);
      url = result.url;
      externalId = result.externalId;
    }

    const attachment = await prisma.dealAttachment.create({
      data: {
        dealId: id,
        activityId: activityId ?? undefined,
        name: file.name,
        url,
        size: file.size,
        mimeType: file.type,
        provider,
        externalId,
        uploadedById: user.id,
      },
    });

    return NextResponse.json({ attachment }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
