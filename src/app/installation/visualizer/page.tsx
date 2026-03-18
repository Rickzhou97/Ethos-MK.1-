import { prisma } from "@/lib/db"
import { DesignVisualizer } from "@/components/installation/design-visualizer"

export const dynamic = "force-dynamic"

async function getVisualizerData() {
  const projects = await prisma.project.findMany({
    where: { projectStatus: "INSTALLATION" },
    orderBy: { projectNumber: "asc" },
    select: {
      id: true,
      projectNumber: true,
      name: true,
      products: {
        select: {
          id: true,
          partCode: true,
          description: true,
          installStatus: true,
          installTargetDate: true,
          installPlannedStart: true,
          installCompletionDate: true,
          installEstimatedHours: true,
        },
        orderBy: { partCode: "asc" },
      },
      documents: {
        where: { documentType: "DRAWING" },
        select: {
          id: true,
          filename: true,
          filePath: true,
          description: true,
          uploadedAt: true,
        },
        orderBy: { uploadedAt: "desc" },
      },
    },
  })

  return projects
}

export default async function VisualizerPage() {
  const projects = await getVisualizerData()

  return (
    <div className="h-[calc(100vh-4rem)]">
      <DesignVisualizer projects={projects} />
    </div>
  )
}
