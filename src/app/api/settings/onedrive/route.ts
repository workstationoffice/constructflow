import { NextRequest, NextResponse } from "next/server";
import { requireTenantUser } from "@/lib/auth";

async function getMsToken(clientId: string, clientSecret: string, tenantId: string): Promise<string> {
  const res = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        scope: "https://graph.microsoft.com/.default",
        grant_type: "client_credentials",
      }),
    }
  );
  const data = await res.json();
  if (!res.ok || !data.access_token)
    throw new Error(data.error_description ?? "Microsoft authentication failed. Check your Tenant ID, Client ID and Client Secret.");
  return data.access_token;
}

async function graphGet(token: string, url: string) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message ?? `Graph API error: ${res.status}`);
  return data;
}

// POST /api/settings/onedrive
// action: "folders" → list child folders (root or inside a folder)
export async function POST(req: NextRequest) {
  try {
    await requireTenantUser();

    const { action, msClientId, msClientSecret, msTenantId, folderId } = await req.json();

    if (!msClientId || !msClientSecret || !msTenantId)
      return NextResponse.json({ error: "Tenant ID, Client ID and Client Secret are required" }, { status: 400 });

    if (action === "folders") {
      const token = await getMsToken(msClientId, msClientSecret, msTenantId);

      // Browse the SharePoint root site's default drive (same drive used for uploads)
      const base = folderId
        ? `https://graph.microsoft.com/v1.0/sites/root/drive/items/${folderId}/children`
        : `https://graph.microsoft.com/v1.0/sites/root/drive/root/children`;
      const url = `${base}?$select=id,name,folder,webUrl&$filter=folder ne null&$top=100`;

      const data = await graphGet(token, url);
      const folders = (data.value ?? []).map((f: { id: string; name: string; folder: { childCount: number }; webUrl: string }) => ({
        id: f.id,
        name: f.name,
        childCount: f.folder?.childCount ?? 0,
        webUrl: f.webUrl,
      }));
      return NextResponse.json({ folders });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
