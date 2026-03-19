import { prisma } from "@/lib/db"
import { DepartmentBoard, type DeptProject } from "@/components/departments/department-board"
import InstallationMap from "@/components/installation/installation-map"
import type { MapProject, MapCrew } from "@/components/installation/installation-map"

export const dynamic = 'force-dynamic'

export default async function InstallationPage() {
  const projects = await prisma.project.findMany({
    where: { projectStatus: "INSTALLATION" },
    orderBy: [{ priority: "asc" }, { orderReceived: "asc" }],
    select: {
      id: true,
      projectNumber: true,
      name: true,
      projectStatus: true,
      departmentStatus: true,
      priority: true,
      contractValue: true,
      targetCompletion: true,
      siteLocation: true,
      siteLatitude: true,
      siteLongitude: true,
      p2Date: true,
      p3Date: true,
      p4Date: true,
      customer: { select: { name: true } },
      coordinator: { select: { name: true } },
      projectManager: { select: { name: true } },
      _count: { select: { products: true } },
      installationTasks: {
        select: {
          id: true,
          stage: true,
          status: true,
          inspectionStatus: true,
          crew: { select: { id: true, name: true, code: true } },
        },
      },
    },
  })

  const crews = await prisma.installCrew.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      code: true,
      members: {
        where: { endDate: null },
        select: { worker: { select: { name: true } } },
      },
      _count: { select: { tasks: true } },
    },
    orderBy: { name: "asc" },
  })

  const serialized: DeptProject[] = JSON.parse(JSON.stringify(projects))

  const mapProjects: MapProject[] = JSON.parse(JSON.stringify(
    projects.map((p) => ({
      id: p.id,
      projectNumber: p.projectNumber,
      name: p.name,
      projectStatus: p.projectStatus,
      departmentStatus: p.departmentStatus,
      siteLocation: p.siteLocation ?? null,
      siteLatitude: p.siteLatitude ? Number(p.siteLatitude) : null,
      siteLongitude: p.siteLongitude ? Number(p.siteLongitude) : null,
      priority: p.priority ?? null,
      targetCompletion: p.targetCompletion ? p.targetCompletion.toISOString() : null,
      customer: p.customer ?? null,
      _count: { products: p._count?.products ?? 0 },
      installationTasks: p.installationTasks.map((t) => ({
        id: t.id,
        stage: t.stage,
        status: t.status,
        inspectionStatus: t.inspectionStatus ?? null,
        crew: t.crew,
      })),
    }))
  ))

  const mapCrews: MapCrew[] = JSON.parse(JSON.stringify(
    crews.map((c) => ({
      id: c.id,
      name: c.name,
      code: c.code,
      members: c.members.map((m) => ({ worker: { name: m.worker.name } })),
      _count: { tasks: c._count.tasks },
    }))
  ))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Installation Department</h1>
          <p className="text-sm text-gray-500 mt-1">
            {serialized.length} project{serialized.length !== 1 ? "s" : ""} in installation phase
          </p>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-gray-500">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-blue-500" /> Active</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-amber-500" /> Pending</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-green-500" /> Complete</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-gray-800" /> MME HQ</span>
        </div>
      </div>

      <InstallationMap projects={mapProjects} crews={mapCrews} />

      <DepartmentBoard
        projects={serialized}
        departmentLabel="Installation"
        doneLabel="Ready for Review"
      />
    </div>
  )
}
