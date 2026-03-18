"use client"

import dynamic from "next/dynamic"

// ---------------------------------------------------------------------------
// Types shared between wrapper & inner map
// ---------------------------------------------------------------------------
export interface MapProject {
  id: string
  projectNumber: string
  name: string
  projectStatus: string
  departmentStatus: string
  siteLocation: string | null
  siteLatitude: number | null
  siteLongitude: number | null
  priority: string | null
  targetCompletion: string | null
  customer: { name: string } | null
  _count: { products: number }
  installationTasks: Array<{
    id: string
    stage: string
    status: string
    crew: { id: string; name: string; code: string } | null
  }>
}

export interface MapCrew {
  id: string
  name: string
  code: string
  members: Array<{ worker: { name: string } }>
  _count: { tasks: number }
}

export interface InstallationMapProps {
  projects: MapProject[]
  crews: MapCrew[]
}

// ---------------------------------------------------------------------------
// Dynamic import – Leaflet must never be SSR'd
// ---------------------------------------------------------------------------
const InstallationMapInner = dynamic(
  () => import("./installation-map-inner"),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[500px] rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center text-sm text-gray-400">
        Loading map…
      </div>
    ),
  },
)

export default function InstallationMap(props: InstallationMapProps) {
  return <InstallationMapInner {...props} />
}
