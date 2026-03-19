"use client"

import { useState } from "react"
import SiteModelViewer, {
  type InstallPoint,
} from "@/components/installation/site-model-viewer"

interface Task {
  id: string
  stage: string
  status: string
  inspectionStatus: string | null
  ncrId: string | null
  crew: { name: string } | null
}

interface Product {
  id: string
  partCode: string
  description: string
  installationTasks: Task[]
}

interface Project {
  id: string
  projectNumber: string
  name: string
  siteLocation: string | null
  products: Product[]
}

// Wall positions around the substation building
const WALL_POSITIONS: {
  pos: [number, number, number]
  rot: [number, number, number]
  wall: string
}[] = [
  // Front wall (z = +4.01)
  { pos: [-6, 1.5, 4.01], rot: [0, 0, 0], wall: "Front" },
  { pos: [-2, 1.5, 4.01], rot: [0, 0, 0], wall: "Front" },
  { pos: [2, 1.5, 4.01], rot: [0, 0, 0], wall: "Front" },
  { pos: [6, 1.5, 4.01], rot: [0, 0, 0], wall: "Front" },
  // Right side wall (x = +10.01)
  {
    pos: [10.01, 1.5, 0],
    rot: [0, Math.PI / 2, 0],
    wall: "Right",
  },
  {
    pos: [10.01, 1.5, -3],
    rot: [0, Math.PI / 2, 0],
    wall: "Right",
  },
  // Back wall (z = -4.01)
  { pos: [-6, 1.5, -4.01], rot: [0, Math.PI, 0], wall: "Back" },
  { pos: [-2, 1.5, -4.01], rot: [0, Math.PI, 0], wall: "Back" },
]

function deriveStatus(
  tasks: Task[]
): InstallPoint["status"] {
  if (tasks.length === 0) return "not_started"
  const hasNcr = tasks.some((t) => t.ncrId)
  if (hasNcr) return "ncr"
  const allCompleted =
    tasks.length > 0 &&
    tasks.every(
      (t) => t.status === "COMPLETED" && t.inspectionStatus === "ACCEPTED"
    )
  if (allCompleted) return "completed"
  const hasInProgress = tasks.some((t) => t.status === "IN_PROGRESS")
  if (hasInProgress) return "in_progress"
  return "not_started"
}

export default function SiteModelPage({
  projects,
}: {
  projects: Project[]
}) {
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    projects[0]?.id ?? ""
  )
  const [selectedPoint, setSelectedPoint] = useState<InstallPoint | null>(null)

  const project = projects.find((p) => p.id === selectedProjectId)
  const products = project?.products ?? []

  const installPoints: InstallPoint[] = products.map((product, i) => {
    const wp = WALL_POSITIONS[i % WALL_POSITIONS.length]
    const tasks = product.installationTasks || []
    const lastTask = tasks[tasks.length - 1]

    return {
      id: product.id,
      label: product.partCode || "Product",
      productDescription: product.description,
      position: wp.pos,
      rotation: wp.rot,
      size: [2.5, 2.8] as [number, number],
      status: deriveStatus(tasks),
      stage: lastTask?.stage || undefined,
      crewName: lastTask?.crew?.name || undefined,
    }
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            3D Site Model{" "}
            {project
              ? `\u2014 ${project.name || project.projectNumber}`
              : ""}
          </h1>
          {project?.siteLocation && (
            <p className="text-sm text-gray-500 mt-0.5">
              {project.siteLocation}
            </p>
          )}
        </div>

        {projects.length > 1 && (
          <select
            value={selectedProjectId}
            onChange={(e) => {
              setSelectedProjectId(e.target.value)
              setSelectedPoint(null)
            }}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm bg-white"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.projectNumber} — {p.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="flex gap-4">
        {/* 3D Viewer */}
        <div className="flex-1 min-w-0">
          <SiteModelViewer
            installPoints={installPoints}
            onPointClick={(point) => setSelectedPoint(point)}
          />

          {/* Legend */}
          <div className="flex items-center gap-5 mt-3 text-xs text-gray-600">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
              Not Started
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              In Progress
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
              Completed
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
              NCR
            </span>
          </div>
        </div>

        {/* Details panel */}
        <div className="w-72 shrink-0">
          <div className="rounded-xl border border-gray-200 bg-white p-4 h-[600px] flex flex-col">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">
              Details
            </h2>

            {selectedPoint ? (
              <div className="space-y-3">
                <div>
                  <div className="text-xs text-gray-500">Product</div>
                  <div className="text-sm font-medium">
                    {selectedPoint.productDescription}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {selectedPoint.label}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-gray-500">Status</div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{
                        backgroundColor:
                          selectedPoint.status === "not_started"
                            ? "#f97316"
                            : selectedPoint.status === "in_progress"
                            ? "#3b82f6"
                            : selectedPoint.status === "completed"
                            ? "#22c55e"
                            : "#ef4444",
                      }}
                    />
                    <span className="text-sm font-medium capitalize">
                      {selectedPoint.status.replace("_", " ")}
                    </span>
                  </div>
                </div>

                {selectedPoint.stage && (
                  <div>
                    <div className="text-xs text-gray-500">Stage</div>
                    <div className="text-sm font-medium capitalize">
                      {selectedPoint.stage.toLowerCase().replace("_", " ")}
                    </div>
                  </div>
                )}

                {selectedPoint.crewName && (
                  <div>
                    <div className="text-xs text-gray-500">Crew</div>
                    <div className="text-sm font-medium">
                      {selectedPoint.crewName}
                    </div>
                  </div>
                )}

                <div>
                  <div className="text-xs text-gray-500">Opening Size</div>
                  <div className="text-sm font-medium">
                    {selectedPoint.size[0]}m x {selectedPoint.size[1]}m
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-sm text-gray-400 text-center px-4">
                  Click a highlighted opening on the 3D model to see
                  installation details
                </p>
              </div>
            )}

            {/* Product count summary */}
            <div className="mt-auto pt-3 border-t border-gray-100">
              <div className="text-xs text-gray-500">
                {installPoints.length} product
                {installPoints.length !== 1 ? "s" : ""} mapped
              </div>
              <div className="flex gap-3 mt-1 text-[10px] text-gray-400">
                <span>
                  {installPoints.filter((p) => p.status === "completed").length}{" "}
                  done
                </span>
                <span>
                  {
                    installPoints.filter((p) => p.status === "in_progress")
                      .length
                  }{" "}
                  active
                </span>
                <span>
                  {
                    installPoints.filter((p) => p.status === "not_started")
                      .length
                  }{" "}
                  pending
                </span>
                <span>
                  {installPoints.filter((p) => p.status === "ncr").length} NCR
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
