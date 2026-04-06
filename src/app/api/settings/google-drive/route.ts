import { NextRequest, NextResponse } from "next/server";
import { createSign } from "node:crypto";
import { requireTenantUser } from "@/lib/auth";

function buildJwt(serviceAccountEmail: string, privateKeyPem: string): string {
  const now = Math.floor(Date.now() / 1000);
  const encode = (obj: object) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  const header  = encode({ alg: "RS256", typ: "JWT" });
  const payload = encode({
    iss: serviceAccountEmail,
    scope: "https://www.googleapis.com/auth/drive.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  });
  const pem = privateKeyPem.replace(/\\n/g, "\n");
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${payload}`);
  const sig = signer.sign(pem, "base64url");
  return `${header}.${payload}.${sig}`;
}

async function getToken(email: string, key: string): Promise<string> {
  const jwt = buildJwt(email, key);
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.access_token)
    throw new Error(data.error_description ?? "Google authentication failed. Check your Service Account Email and Private Key.");
  return data.access_token;
}

// POST /api/settings/google-drive
// action: "folders" → list subfolders of folderId (or root/"My Drive" if omitted)
export async function POST(req: NextRequest) {
  try {
    await requireTenantUser();

    const { action, googleServiceAccountEmail, googleServiceAccountKey, folderId } = await req.json();

    if (!googleServiceAccountEmail || !googleServiceAccountKey)
      return NextResponse.json({ error: "Service Account Email and Private Key are required" }, { status: 400 });

    const token = await getToken(googleServiceAccountEmail, googleServiceAccountKey);

    if (action === "folders") {
      const parent = folderId ?? "root";
      const q = encodeURIComponent(
        `mimeType='application/vnd.google-apps.folder' and '${parent}' in parents and trashed=false`
      );
      const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&pageSize=100&orderBy=name`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? `Drive API error: ${res.status}`);
      const folders = (data.files ?? []).map((f: { id: string; name: string }) => ({
        id: f.id,
        name: f.name,
      }));
      return NextResponse.json({ folders });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
