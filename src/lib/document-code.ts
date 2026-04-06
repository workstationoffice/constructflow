import { prisma } from "./prisma";

const DEFAULTS: Record<string, { prefix: string; paddingLength: number }> = {
  CUSTOMER: { prefix: "CUST", paddingLength: 5 },
  DEAL:     { prefix: "DEAL", paddingLength: 5 },
};

export async function generateDocumentCode(
  tenantId: string,
  type: string
): Promise<string> {
  const def = DEFAULTS[type] ?? { prefix: type.slice(0, 4).toUpperCase(), paddingLength: 5 };

  // Upsert + atomic increment in a single operation (no race condition)
  const seq = await prisma.documentSequence.upsert({
    where: { tenantId_type: { tenantId, type } },
    update: { lastNumber: { increment: 1 } },
    create: {
      tenantId,
      type,
      prefix: def.prefix,
      paddingLength: def.paddingLength,
      lastNumber: 1,
    },
    select: { prefix: true, paddingLength: true, lastNumber: true },
  });

  const number = seq.lastNumber;
  const padded = String(number).padStart(seq.paddingLength, "0");
  return `${seq.prefix}-${padded}`;
}
