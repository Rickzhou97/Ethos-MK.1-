"use client"

import dynamic from "next/dynamic"

const FactoryTwinInner = dynamic(
  () => import("@/components/production/factory-twin-inner"),
  { ssr: false, loading: () => (
    <div className="flex items-center justify-center h-screen bg-[#101020]">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-white/60 text-sm">Loading Factory Digital Twin…</p>
      </div>
    </div>
  )}
)

export interface DigitalTwinTask {
  id: string
  stage: string
  status: string
  assignedTo: string | null
  startedAt: string | null
  completedAt: string | null
  inspectionStatus: string | null
  product: {
    partCode: string
    description: string
    quantity: number
    productionTargetDate: string | null
    project: {
      projectNumber: string
      name: string
      priority: string
      customer: { name: string } | null
    }
  }
}

export interface DigitalTwinWorker {
  id: string
  name: string
  role: string
}

interface Props {
  tasksByStage: Record<string, DigitalTwinTask[]>
  workers: DigitalTwinWorker[]
}

export default function FactoryDigitalTwin({ tasksByStage, workers }: Props) {
  return <FactoryTwinInner tasksByStage={tasksByStage} workers={workers} />
}
