import { prisma } from "@/lib/db"
import { DepartmentBoard, type DeptProject } from "@/components/departments/department-board"
import InstallationMap from "@/components/installation/installation-map"
import type { MapProject, MapCrew } from "@/components/installation/installation-map"

export const dynamic = 'force-dynamic'

async function getInstallationProjects() {
  return prisma.project.findMany({
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
      p2Date: true,
      p3Date: true,
      p4Date: true,
      customer: { select: { name: true } },
      coordinator: { select: { name: true } },
      projectManager: { select: { name: true } },
      _count: { select: { products: true } },
    },
  })
}

export default async function InstallationPage() {
  const projects = await getInstallationProjects()
  const serialized: DeptProject[] = JSON.parse(JSON.stringify(projects))

  // Build map-compatible project data
  // (no siteLatitude/siteLongitude or installationTasks in schema yet —
  //  the map component handles geocoding from siteLocation strings and
  //  gracefully shows empty states for missing data)
  const mapProjects: MapProject[] = projects.map((p) => ({
    id: p.id,
    projectNumber: p.projectNumber,
    name: p.name,
    projectStatus: p.projectStatus,
    departmentStatus: p.departmentStatus,
    siteLocation: p.siteLocation ?? null,
    siteLatitude: null,
    siteLongitude: null,
    priority: p.priority ?? null,
    targetCompletion: p.targetCompletion ? p.targetCompletion.toISOString() : null,
    customer: p.customer ?? null,
    _count: { products: p._count?.products ?? 0 },
    installationTasks: [],
  }))

  // No Crew model in schema yet — pass empty array; the map handles this gracefully
  const mapCrews: MapCrew[] = []

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
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-gray-300" /> To Do</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-blue-400" /> Ongoing</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-amber-400" /> Review</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-green-400" /> Done</span>
        </div>
      </div>

      {/* Interactive UK map */}
      <InstallationMap projects={mapProjects} crews={mapCrews} />

      {/* Existing kanban board */}
      <DepartmentBoard
        projects={serialized}
        departmentLabel="Installation"
        doneLabel="Ready for Review"
      />
    </div>
  )
}
