import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenantUser } from "@/lib/auth";
import { deleteFromR2, getR2CredsFromConfig } from "@/lib/r2";
import { StorageProvider } from "@prisma/client";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  try {
    const user = await requireTenantUser();
    const { id, attachmentId } = await params;

    const attachment = await prisma.dealAttachment.findFirst({
      where: { id: attachmentId, dealId: id, deal: { tenantId: user.tenantId } },
    });

    if (!attachment) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Delete from storage
    if (attachment.provider === StorageProvider.R2 && attachment.url) {
      try {
        const storageConfig = await prisma.storageConfig.findUnique({
          where: { tenantId: user.tenantId },
        });
        const creds = storageConfig ? getR2CredsFromConfig(storageConfig) : null;
        if (creds) {
          const key = attachment.url.replace(`${creds.publicUrl}/`, "");
          await deleteFromR2(key, creds);
        }
      } catch {
        // Don't fail if storage delete fails — still remove the DB record
      }
    }

    await prisma.dealAttachment.delete({ where: { id: attachmentId } });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
