import { prisma } from "@/lib/db"
import { CrewManagement } from "@/components/installation/crew-management"

export const dynamic = "force-dynamic"

async function getCrews() {
  return prisma.installCrew.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      members: {
        where: { endDate: null },
        include: {
          worker: { select: { id: true, name: true, role: true } },
        },
        orderBy: { startDate: "asc" },
      },
    },
  })
}

async function getAvailableWorkers() {
  return prisma.worker.findMany({
    where: { isAvailable: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, role: true },
  })
}

export default async function CrewsPage() {
  const [crews, workers] = await Promise.all([getCrews(), getAvailableWorkers()])
  const serializedCrews = JSON.parse(JSON.stringify(crews))
  const serializedWorkers = JSON.parse(JSON.stringify(workers))

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Crew Management</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage installation crews and member assignments
        </p>
      </div>
      <CrewManagement initialCrews={serializedCrews} availableWorkers={serializedWorkers} />
    </div>
  )
}
