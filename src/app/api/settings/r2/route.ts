import { NextRequest, NextResponse } from "next/server";
import AWS from "aws-sdk";
import { requireTenantUser } from "@/lib/auth";

// POST /api/settings/r2
// action: "folders" → list virtual folders (common prefixes) at the given prefix level
export async function POST(req: NextRequest) {
  try {
    await requireTenantUser();

    const { action, r2AccountId, r2AccessKeyId, r2SecretAccessKey, r2BucketName, prefix } = await req.json();

    if (!r2AccountId || !r2AccessKeyId || !r2SecretAccessKey || !r2BucketName)
      return NextResponse.json({ error: "Account ID, Access Key ID, Secret Access Key and Bucket Name are required" }, { status: 400 });

    if (action === "folders") {
      const s3 = new AWS.S3({
        endpoint: `https://${r2AccountId}.r2.cloudflarestorage.com`,
        accessKeyId: r2AccessKeyId,
        secretAccessKey: r2SecretAccessKey,
        region: "auto",
        signatureVersion: "v4",
      });

      const result = await s3.listObjectsV2({
        Bucket: r2BucketName,
        Delimiter: "/",
        Prefix: prefix ?? "",
        MaxKeys: 200,
      }).promise();

      const folders = (result.CommonPrefixes ?? []).map((cp) => {
        const full = cp.Prefix ?? "";
        // Strip the parent prefix to get just the folder name segment
        const relative = prefix ? full.slice(prefix.length) : full;
        const name = relative.replace(/\/$/, "");
        return { prefix: full, name };
      });

      return NextResponse.json({ folders });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
