import { prisma } from "@/lib/db"
import { CrewManagement } from "@/components/installation/crew-management"

export const dynamic = "force-dynamic"

export default async function CrewsPage() {
  // Crews with active members and equipment
  const crews = await prisma.installCrew.findMany({
    include: {
      members: {
        where: { endDate: null },
        include: { worker: { select: { id: true, name: true, role: true } } },
        orderBy: { startDate: "asc" },
      },
      equipment: {
        orderBy: { name: "asc" },
      },
    },
    orderBy: { name: "asc" },
  })

  // All workers (to determine which are unassigned)
  const allWorkers = await prisma.worker.findMany({
    where: { isAvailable: true },
    orderBy: { name: "asc" },
  })

  // Unassigned equipment (crewId is null)
  const poolEquipment = await prisma.crewEquipment.findMany({
    where: { crewId: null },
    orderBy: { name: "asc" },
  })

  // Find assigned worker IDs
  const assignedWorkerIds = new Set(
    crews.flatMap((c) => c.members.map((m) => m.worker.id))
  )
  const poolWorkers = allWorkers.filter((w) => !assignedWorkerIds.has(w.id))

  const serialized = JSON.parse(
    JSON.stringify({ crews, poolWorkers, poolEquipment, allWorkers })
  )

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Crew Management</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage installation crews, members, and equipment — drag resources between crews and the pool
        </p>
      </div>
      <CrewManagement
        initialCrews={serialized.crews}
        initialPoolWorkers={serialized.poolWorkers}
        initialPoolEquipment={serialized.poolEquipment}
        allWorkers={serialized.allWorkers}
      />
    </div>
  )
}
