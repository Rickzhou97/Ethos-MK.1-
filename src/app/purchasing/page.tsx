import { prisma } from "@/lib/db"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { formatCurrency, formatDate, prettifyEnum } from "@/lib/utils"
import { CreatePoDialog } from "@/components/purchasing/create-po-dialog"

export const dynamic = "force-dynamic"

function getPoStatusColor(status: string) {
  const colors: Record<string, string> = {
    DRAFT: "bg-gray-100 text-gray-700",
    SENT: "bg-blue-100 text-blue-700",
    PARTIALLY_RECEIVED: "bg-amber-100 text-amber-700",
    COMPLETE: "bg-green-100 text-green-700",
    CANCELLED: "bg-red-100 text-red-700",
  }
  return colors[status] || "bg-gray-100 text-gray-700"
}

async function getPurchaseOrders() {
  return prisma.purchaseOrder.findMany({
    orderBy: { dateRaised: "desc" },
    include: {
      project: { select: { id: true, projectNumber: true, name: true } },
      supplier: { select: { name: true } },
      _count: { select: { poLines: true } },
    },
  })
}

async function getFormData() {
  const [projects, suppliers] = await Promise.all([
    prisma.project.findMany({
      where: { projectStatus: { not: "COMPLETE" } },
      orderBy: { projectNumber: "desc" },
      select: { id: true, projectNumber: true, name: true },
    }),
    prisma.supplier.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ])
  return { projects, suppliers }
}

export default async function PurchasingPage() {
  const [pos, formData] = await Promise.all([getPurchaseOrders(), getFormData()])

  const totalValue = pos.reduce((sum, po) => sum + (Number(po.totalValue) || 0), 0)
  const openPOs = pos.filter((po) => po.status !== "COMPLETE" && po.status !== "CANCELLED").length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Purchase Orders</h1>
          <p className="text-sm text-gray-500">
            {pos.length} orders — {openPOs} open — {formatCurrency(totalValue)} total value
          </p>
        </div>
        <CreatePoDialog projects={formData.projects} suppliers={formData.suppliers} />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-gray-50/50">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">PO No.</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Project</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Supplier</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Raised</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Expected</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Value</th>
                  <th className="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500">Lines</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pos.map((po) => (
                  <tr key={po.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2.5 font-mono text-xs font-semibold text-gray-700">{po.poNumber}</td>
                    <td className="px-4 py-2.5">
                      {po.project ? (
                        <Link href={`/projects/${po.project.id}`} className="text-blue-600 hover:text-blue-700 text-sm">
                          {po.project.projectNumber} — {po.project.name}
                        </Link>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">{po.supplier?.name || "—"}</td>
                    <td className="px-4 py-2.5">
                      <Badge variant="secondary" className={getPoStatusColor(po.status)}>
                        {prettifyEnum(po.status)}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">{formatDate(po.dateRaised)}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">{formatDate(po.expectedDelivery)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-sm font-medium">
                      {po.totalValue ? formatCurrency(Number(po.totalValue)) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-center text-xs text-gray-600">{po._count.poLines}</td>
                  </tr>
                ))}
                {pos.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                      No purchase orders yet. Create your first PO above.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
