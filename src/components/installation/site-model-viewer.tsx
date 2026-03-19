"use client"
import dynamic from "next/dynamic"

// Types for installation points
export interface InstallPoint {
  id: string
  label: string
  productDescription: string
  position: [number, number, number]
  rotation?: [number, number, number]
  size: [number, number] // width, height of the opening
  status: "not_started" | "in_progress" | "completed" | "ncr"
  stage?: string
  crewName?: string
}

export interface SiteModelProps {
  installPoints: InstallPoint[]
  onPointClick?: (point: InstallPoint) => void
}

const SiteModelInner = dynamic(() => import("./site-model-inner"), { ssr: false })

export default function SiteModelViewer(props: SiteModelProps) {
  return <SiteModelInner {...props} />
}
