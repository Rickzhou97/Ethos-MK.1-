"use client"
import dynamic from "next/dynamic"
import React from "react"

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

const SiteModelInner = dynamic(() => import("./site-model-inner"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[600px] rounded-xl border bg-gradient-to-b from-sky-100 to-sky-50 flex items-center justify-center text-sm text-gray-400">
      Loading 3D model...
    </div>
  ),
})

// Error boundary to catch Three.js crashes
class ModelErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: "" }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-[600px] rounded-xl border border-red-200 bg-red-50 flex flex-col items-center justify-center text-sm gap-3 p-6">
          <div className="text-red-500 font-medium">3D Model failed to load</div>
          <div className="text-red-400 text-xs text-center max-w-md">{this.state.error}</div>
          <button
            onClick={() => this.setState({ hasError: false, error: "" })}
            className="mt-2 px-4 py-2 rounded-lg bg-red-500 text-white text-sm hover:bg-red-600"
          >
            Try Again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

export default function SiteModelViewer(props: SiteModelProps) {
  return (
    <ModelErrorBoundary>
      <SiteModelInner {...props} />
    </ModelErrorBoundary>
  )
}
