import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";

interface AddressEntry {
  subdistrict: string;
  district: string;
  province: string;
  zipcode: number;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { AddressService } = require("thailand-address");

let svc: InstanceType<typeof AddressService> | null = null;

function getSvc() {
  if (!svc) {
    const dbPath = path.join(
      process.cwd(),
      "node_modules/thailand-address/lib/database/db.json"
    );
    const rawDb = JSON.parse(fs.readFileSync(dbPath, "utf-8"));
    svc = new AddressService();
    // Pass parsed object (not path) so it won't try to require() it
    // Fourth arg true = preprocess (decompress the packed format)
    svc.loadData(rawDb, "json", false, true);
  }
  return svc;
}

export async function GET(req: NextRequest) {
  try {
    const q = new URL(req.url).searchParams.get("q") ?? "";
    if (q.length < 2) return NextResponse.json({ results: [] });

    const service = getSvc();

    const bySubdistrict: AddressEntry[] = service.query({ subdistrict: q });
    const byDistrict: AddressEntry[]    = service.query({ district: q });
    const byProvince: AddressEntry[]    = service.query({ province: q });
    const byZip: AddressEntry[]         = /^\d+$/.test(q)
      ? service.query({ zipcode: q })
      : [];

    const seen = new Set<string>();
    const combined: AddressEntry[] = [];
    for (const entry of [...bySubdistrict, ...byDistrict, ...byProvince, ...byZip]) {
      const key = `${entry.subdistrict}|${entry.district}|${entry.province}|${entry.zipcode}`;
      if (!seen.has(key)) {
        seen.add(key);
        combined.push(entry);
        if (combined.length >= 10) break;
      }
    }

    const results = combined.map((e) => ({
      subdistrict: e.subdistrict,
      district:    e.district,
      province:    e.province,
      zipcode:     e.zipcode,
    }));

    return NextResponse.json({ results });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
