import { requireTenantUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import EditCustomerForm from "./edit-form";

export default async function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireTenantUser();
  const { id } = await params;

  const customer = await prisma.customer.findFirst({
    where: { id, tenantId: user.tenantId },
    include: { contactPersons: true, addresses: { orderBy: { createdAt: "asc" } } },
  });

  if (!customer) notFound();

  return (
    <div className="max-w-2xl">
      <EditCustomerForm customer={customer as any} />
    </div>
  );
}
