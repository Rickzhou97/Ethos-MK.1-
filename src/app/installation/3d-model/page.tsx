import { prisma } from "@/lib/db"
import SiteModelPage from "./site-model-page"

export const dynamic = "force-dynamic"

export default async function ThreeDModelPage() {
  // Fetch installation projects
  const projects = await prisma.project.findMany({
    where: { projectStatus: "INSTALLATION" },
    orderBy: [{ priority: "asc" }, { orderReceived: "asc" }],
    select: {
      id: true,
      projectNumber: true,
      name: true,
      siteLocation: true,
      products: {
        select: {
          id: true,
          partCode: true,
          description: true,
          installationTasks: {
            select: {
              id: true,
              stage: true,
              status: true,
              inspectionStatus: true,
              ncrId: true,
              crew: { select: { name: true } },
            },
            orderBy: { createdAt: "asc" },
          },
        },
      },
    },
  })

  const serialized = JSON.parse(JSON.stringify(projects))

  return <SiteModelPage projects={serialized} />
}
