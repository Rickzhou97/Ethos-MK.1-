"use client"

import "leaflet/dist/leaflet.css"

import { useEffect, useMemo } from "react"
import Link from "next/link"
import L from "leaflet"
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet"
import type { InstallationMapProps, MapProject, MapCrew } from "./installation-map"
import {
  INSTALL_STAGES,
  INSTALL_STAGE_DISPLAY_NAMES,
} from "@/lib/install-utils"

// ---------------------------------------------------------------------------
// Fix Leaflet default icon path issue in bundlers
// ---------------------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
})

// ---------------------------------------------------------------------------
// UK location lookup  (fallback geocoding from siteLocation strings)
// ---------------------------------------------------------------------------
const UK_LOCATIONS: Record<string, [number, number]> = {
  london:       [51.5074, -0.1278],
  manchester:   [53.4808, -2.2426],
  birmingham:   [52.4862, -1.8904],
  leeds:        [53.8008, -1.5491],
  sheffield:    [53.3811, -1.4701],
  liverpool:    [53.4084, -2.9916],
  bristol:      [51.4545, -2.5879],
  newcastle:    [54.9783, -1.6178],
  nottingham:   [52.9548, -1.1581],
  glasgow:      [55.8642, -4.2518],
  edinburgh:    [55.9533, -3.1883],
  cardiff:      [51.4816, -3.1791],
  belfast:      [54.5973, -5.9301],
  aberdeen:     [57.1497, -2.0943],
  dundee:       [56.462,  -2.9707],
  plymouth:     [50.3755, -4.1427],
  southampton:  [50.9097, -1.4044],
  portsmouth:   [50.8198, -1.0880],
  hull:         [53.7457, -0.3367],
  stoke:        [53.0027, -2.1794],
  coventry:     [52.4068, -1.5197],
  leicester:    [52.6369, -1.1398],
  derby:        [52.9225, -1.4746],
  wolverhampton:[52.5870, -2.1288],
  sunderland:   [54.9069, -1.3838],
  wakefield:    [53.6830, -1.4990],
  york:         [53.9591, -1.0815],
  swansea:      [51.6214, -3.9436],
  oxford:       [51.7520, -1.2577],
  cambridge:    [52.2053,  0.1218],
  exeter:       [50.7236, -3.5275],
  norwich:      [52.6309,  1.2974],
  bath:         [51.3811, -2.3590],
  ipswich:      [52.0567,  1.1482],
  reading:      [51.4543, -0.9781],
  essex:        [51.7343,  0.4691],
  kent:         [51.2787,  0.5217],
  surrey:       [51.3148, -0.5600],
  cornwall:     [50.2660, -5.0527],
  devon:        [50.7156, -3.5309],
  dorset:       [50.7488, -2.3445],
  suffolk:      [52.1872,  0.9708],
  norfolk:      [52.6140,  0.8864],
  yorkshire:    [53.9591, -1.0815],
  lancashire:   [53.7632, -2.7044],
  cumbria:      [54.5772, -2.7975],
  durham:       [54.7761, -1.5733],
  inverness:    [57.4778, -4.2247],
  middlesbrough:[54.5742, -1.2350],
  barnsley:     [53.5529, -1.4793],
  doncaster:    [53.5228, -1.1289],
  rotherham:    [53.4326, -1.3635],
  chesterfield: [53.2350, -1.4210],
  worksop:      [53.3010, -1.1242],
  scunthorpe:   [53.5809, -0.6502],
  grimsby:      [53.5675, -0.0800],
  lincoln:      [53.2307, -0.5406],
  peterborough: [52.5695, -0.2405],
  northampton:  [52.2405, -0.9027],
  bedford:      [52.1356, -0.4685],
  luton:        [51.8787, -0.4200],
  watford:      [51.6565, -0.3903],
  swindon:      [51.5558, -1.7797],
  gloucester:   [51.8642, -2.2382],
  worcester:    [52.1936, -2.2216],
  hereford:     [52.0565, -2.7160],
  shrewsbury:   [52.7074, -2.7546],
  telford:      [52.6796, -2.4496],
  chester:      [53.1930, -2.8931],
  warrington:   [53.3900, -2.5970],
  wigan:        [53.5448, -2.6318],
  bolton:       [53.5785, -2.4299],
  stockport:    [53.4106, -2.1575],
  blackburn:    [53.7501, -2.4849],
  burnley:      [53.7890, -2.2403],
  preston:      [53.7632, -2.7031],
  blackpool:    [53.8142, -3.0503],
  carlisle:     [54.8925, -2.9329],
  penrith:      [54.6647, -2.7542],
  harrogate:    [53.9921, -1.5418],
  bradford:     [53.7960, -1.7594],
  huddersfield: [53.6458, -1.7850],
  halifax:      [53.7249, -1.8580],
  scarborough:  [54.2793, -0.4049],
  whitby:       [54.4858, -0.6206],
  darlington:   [54.5235, -1.5527],
  hartlepool:   [54.6863, -1.2129],
  gateshead:    [54.9527, -1.6038],
  "south shields":[54.9989, -1.4320],
  perth:        [56.3952, -3.4372],
  stirling:     [56.1165, -3.9369],
  "fort william":[56.8198, -5.1052],
  oban:         [56.4153, -5.4714],
  dumfries:     [55.0700, -3.6052],
  stranraer:    [54.9010, -5.0262],
  londonderry:  [55.0068, -7.3186],
  bangor:       [54.6600, -5.6700],
  newry:        [54.1751, -6.3397],
  armagh:       [54.3503, -6.6528],
  cork:         [51.8969, -8.4863],
  dublin:       [53.3498, -6.2603],
  galway:       [53.2707, -9.0568],
  limerick:     [52.6680, -8.6305],
}

const MME_HQ: [number, number] = [53.3811, -1.4701] // Sheffield

function geocodeSiteLocation(location: string | null): [number, number] | null {
  if (!location) return null
  const lower = location.toLowerCase().trim()
  // Direct match
  if (UK_LOCATIONS[lower]) return UK_LOCATIONS[lower]
  // Partial match – check if any key is contained in the string or vice versa
  for (const [key, coords] of Object.entries(UK_LOCATIONS)) {
    if (lower.includes(key) || key.includes(lower)) return coords
  }
  return null
}

// ---------------------------------------------------------------------------
// Marker icon helpers
// ---------------------------------------------------------------------------
type MarkerColor = "blue" | "amber" | "green" | "red" | "gray"

const COLOR_MAP: Record<MarkerColor, { bg: string; border: string; text: string }> = {
  blue:  { bg: "#3b82f6", border: "#1d4ed8", text: "#ffffff" },
  amber: { bg: "#f59e0b", border: "#b45309", text: "#ffffff" },
  green: { bg: "#22c55e", border: "#15803d", text: "#ffffff" },
  red:   { bg: "#ef4444", border: "#b91c1c", text: "#ffffff" },
  gray:  { bg: "#9ca3af", border: "#6b7280", text: "#ffffff" },
}

function makeProjectIcon(label: string, color: MarkerColor): L.DivIcon {
  const c = COLOR_MAP[color]
  return L.divIcon({
    className: "",
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -34],
    html: `<div style="
      width:32px;height:32px;border-radius:50%;
      background:${c.bg};border:2px solid ${c.border};
      display:flex;align-items:center;justify-content:center;
      color:${c.text};font-size:10px;font-weight:700;
      box-shadow:0 2px 6px rgba(0,0,0,0.35);
      line-height:1;
    ">${label}</div>`,
  })
}

function makeCrewIcon(code: string, colorIdx: number): L.DivIcon {
  const colors = ["#3b82f6", "#10b981", "#8b5cf6", "#f97316", "#f43f5e"]
  const bg = colors[colorIdx % colors.length]
  return L.divIcon({
    className: "",
    iconSize: [44, 20],
    iconAnchor: [22, 10],
    popupAnchor: [0, -12],
    html: `<div style="
      padding:2px 6px;border-radius:4px;
      background:${bg};color:#fff;
      font-size:9px;font-weight:700;
      white-space:nowrap;text-align:center;
      box-shadow:0 1px 4px rgba(0,0,0,0.3);
    ">${code}</div>`,
  })
}

function makeHqIcon(): L.DivIcon {
  return L.divIcon({
    className: "",
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -38],
    html: `<div style="
      width:36px;height:36px;border-radius:50%;
      background:#1e293b;border:3px solid #0f172a;
      display:flex;align-items:center;justify-content:center;
      color:#fff;font-size:9px;font-weight:800;
      box-shadow:0 2px 8px rgba(0,0,0,0.4);
      line-height:1;
    ">HQ</div>`,
  })
}

// ---------------------------------------------------------------------------
// Determine marker color for a project
// ---------------------------------------------------------------------------
function getProjectColor(project: MapProject): MarkerColor {
  const tasks = project.installationTasks ?? []
  // Has NCR / issues (no direct field — approximate via BLOCKED status)
  if (tasks.some((t) => t.status === "BLOCKED" || t.status === "REWORK")) return "red"
  if (tasks.some((t) => t.status === "IN_PROGRESS")) return "blue"
  if (tasks.some((t) => t.status === "PENDING")) return "amber"
  // Fallback: use departmentStatus
  if (project.departmentStatus === "DONE") return "green"
  if (project.departmentStatus === "REVIEW") return "amber"
  if (project.departmentStatus === "ONGOING") return "blue"
  return "gray"
}

// ---------------------------------------------------------------------------
// Auto-fit bounds helper
// ---------------------------------------------------------------------------
function FitBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap()
  useEffect(() => {
    if (positions.length === 0) return
    if (positions.length === 1) {
      map.setView(positions[0], 8)
      return
    }
    const bounds = L.latLngBounds(positions.map(([lat, lng]) => [lat, lng]))
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 10 })
  }, [map, positions])
  return null
}

// ---------------------------------------------------------------------------
// Progress helper
// ---------------------------------------------------------------------------
function stageStatusIcon(tasks: MapProject["installationTasks"], stage: string) {
  const stageTasks = tasks.filter((t) => t.stage === stage)
  if (stageTasks.length === 0) return "\u2b1c" // white square
  if (stageTasks.every((t) => t.status === "COMPLETED")) return "\u2705"
  if (stageTasks.some((t) => t.status === "IN_PROGRESS")) return "\ud83d\udfe2" // blue circle approx
  return "\ud83d\udfe1" // yellow circle
}

// ---------------------------------------------------------------------------
// Main map component (client-only, imported via dynamic)
// ---------------------------------------------------------------------------
export default function InstallationMapInner({ projects, crews }: InstallationMapProps) {
  // Resolve positions for projects
  const projectsWithCoords = useMemo(() => {
    // Jitter offset to separate markers at same location
    const seen = new Map<string, number>()
    return projects
      .map((p) => {
        const explicit =
          p.siteLatitude != null && p.siteLongitude != null
            ? ([p.siteLatitude, p.siteLongitude] as [number, number])
            : null
        const coords = explicit ?? geocodeSiteLocation(p.siteLocation)
        if (!coords) return null

        // Slight jitter if duplicate coords
        const key = `${coords[0].toFixed(3)},${coords[1].toFixed(3)}`
        const count = seen.get(key) ?? 0
        seen.set(key, count + 1)
        const jittered: [number, number] = [
          coords[0] + count * 0.012,
          coords[1] + count * 0.018,
        ]
        return { project: p, coords: jittered }
      })
      .filter(Boolean) as Array<{ project: MapProject; coords: [number, number] }>
  }, [projects])

  // Determine which project each crew is at
  const crewLocations = useMemo(() => {
    const result: Array<{
      crew: MapCrew
      coords: [number, number]
      atProject: MapProject | null
      colorIdx: number
    }> = []

    crews.forEach((crew, idx) => {
      // Find a project with an IN_PROGRESS task assigned to this crew
      const activeProject = projectsWithCoords.find((pc) =>
        pc.project.installationTasks?.some(
          (t) => t.crew?.id === crew.id && t.status === "IN_PROGRESS",
        ),
      )
      if (activeProject) {
        // Offset slightly from project marker
        result.push({
          crew,
          coords: [activeProject.coords[0] + 0.015, activeProject.coords[1] + 0.025],
          atProject: activeProject.project,
          colorIdx: idx,
        })
      } else {
        // Idle crews at HQ
        result.push({
          crew,
          coords: [MME_HQ[0] + 0.008 * idx, MME_HQ[1] + 0.012 * idx],
          atProject: null,
          colorIdx: idx,
        })
      }
    })
    return result
  }, [crews, projectsWithCoords])

  // All positions for fit-bounds
  const allPositions = useMemo(() => {
    const pts: [number, number][] = projectsWithCoords.map((p) => p.coords)
    crewLocations.forEach((c) => pts.push(c.coords))
    if (pts.length === 0) pts.push(MME_HQ)
    return pts
  }, [projectsWithCoords, crewLocations])

  const noProjectsOnMap = projectsWithCoords.length === 0

  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden bg-white">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-800">Installation Map</h2>
          <p className="text-[11px] text-gray-500">
            {projectsWithCoords.length} of {projects.length} project
            {projects.length !== 1 ? "s" : ""} mapped
            {crews.length > 0 && <> &middot; {crews.length} crew{crews.length !== 1 ? "s" : ""}</>}
          </p>
        </div>
        {/* Legend */}
        <div className="flex items-center gap-3 text-[10px] text-gray-500">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: COLOR_MAP.blue.bg }} />
            Active
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: COLOR_MAP.amber.bg }} />
            Pending
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: COLOR_MAP.green.bg }} />
            Complete
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: COLOR_MAP.red.bg }} />
            Issue
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full" style={{ background: "#1e293b" }} />
            HQ
          </span>
        </div>
      </div>

      {/* Map */}
      <div className="relative" style={{ height: 500 }}>
        {noProjectsOnMap && (
          <div className="absolute inset-0 z-[1000] pointer-events-none flex items-center justify-center">
            <div className="bg-white/90 rounded-lg px-5 py-3 text-sm text-gray-500 shadow">
              No projects with recognised site locations to display.
              <br />
              <span className="text-[11px] text-gray-400">
                Add a site location (UK city/town) to projects to see them on the map.
              </span>
            </div>
          </div>
        )}
        <MapContainer
          center={[54.5, -2.5]}
          zoom={6}
          scrollWheelZoom={true}
          style={{ height: "100%", width: "100%" }}
          className="z-0"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <FitBounds positions={allPositions} />

          {/* MME HQ marker */}
          <Marker position={MME_HQ} icon={makeHqIcon()}>
            <Popup>
              <div className="text-xs min-w-[160px]">
                <p className="font-bold text-sm">MME HQ</p>
                <p className="text-gray-500">Sheffield, South Yorkshire</p>
                {crewLocations.filter((c) => !c.atProject).length > 0 && (
                  <div className="mt-1.5 pt-1.5 border-t border-gray-200">
                    <p className="font-semibold text-gray-600">Idle Crews:</p>
                    {crewLocations
                      .filter((c) => !c.atProject)
                      .map((c) => (
                        <p key={c.crew.id} className="text-gray-500">
                          {c.crew.name} ({c.crew.code})
                        </p>
                      ))}
                  </div>
                )}
              </div>
            </Popup>
          </Marker>

          {/* Project markers */}
          {projectsWithCoords.map(({ project, coords }) => {
            const color = getProjectColor(project)
            const label = project.projectNumber.replace(/^P-?0*/i, "").slice(0, 4)
            const tasks = project.installationTasks ?? []
            const assignedCrews = [
              ...new Map(
                tasks
                  .filter((t) => t.crew)
                  .map((t) => [t.crew!.id, t.crew!]),
              ).values(),
            ]

            return (
              <Marker key={project.id} position={coords} icon={makeProjectIcon(label, color)}>
                <Popup maxWidth={300} minWidth={220}>
                  <div className="text-xs min-w-[200px]">
                    {/* Title row */}
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div>
                        <p className="font-bold text-sm leading-tight">
                          {project.projectNumber}
                        </p>
                        <p className="text-gray-700 leading-tight">{project.name}</p>
                      </div>
                      {project.priority && project.priority !== "NORMAL" && (
                        <span
                          className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                            project.priority === "URGENT" || project.priority === "CRITICAL"
                              ? "bg-red-100 text-red-700"
                              : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {project.priority}
                        </span>
                      )}
                    </div>

                    {/* Details */}
                    <div className="space-y-0.5 text-gray-500 mb-2">
                      {project.customer && <p>Customer: {project.customer.name}</p>}
                      {project.siteLocation && <p>Site: {project.siteLocation}</p>}
                      {project.targetCompletion && (
                        <p>
                          Target:{" "}
                          {new Date(project.targetCompletion).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </p>
                      )}
                      <p>Products: {project._count?.products ?? 0}</p>
                    </div>

                    {/* Installation stages progress */}
                    {tasks.length > 0 && (
                      <div className="mb-2 pt-1.5 border-t border-gray-200">
                        <p className="font-semibold text-gray-600 mb-1">Installation Progress</p>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                          {INSTALL_STAGES.map((stage) => (
                            <div key={stage} className="flex items-center gap-1">
                              <span className="text-[11px]">{stageStatusIcon(tasks, stage)}</span>
                              <span className="text-gray-600">
                                {INSTALL_STAGE_DISPLAY_NAMES[stage] ?? stage}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Crews */}
                    {assignedCrews.length > 0 && (
                      <div className="mb-2 pt-1.5 border-t border-gray-200">
                        <p className="font-semibold text-gray-600 mb-0.5">Crews Assigned</p>
                        {assignedCrews.map((c) => (
                          <p key={c.id} className="text-gray-500">
                            {c.name} ({c.code})
                          </p>
                        ))}
                      </div>
                    )}

                    {/* Link */}
                    <div className="pt-1.5 border-t border-gray-200">
                      <Link
                        href={`/projects/${project.id}`}
                        className="text-blue-600 hover:underline font-medium"
                      >
                        View Project →
                      </Link>
                    </div>
                  </div>
                </Popup>
              </Marker>
            )
          })}

          {/* Crew badges */}
          {crewLocations.map(({ crew, coords, atProject, colorIdx }) => (
            <Marker key={crew.id} position={coords} icon={makeCrewIcon(crew.code, colorIdx)}>
              <Popup maxWidth={240} minWidth={180}>
                <div className="text-xs min-w-[160px]">
                  <p className="font-bold text-sm">
                    {crew.name}{" "}
                    <span className="text-gray-400 font-normal">({crew.code})</span>
                  </p>

                  {/* Members */}
                  {crew.members.length > 0 && (
                    <div className="mt-1">
                      <p className="font-semibold text-gray-600">Members:</p>
                      {crew.members.map((m, i) => (
                        <p key={i} className="text-gray-500">
                          {m.worker.name}
                        </p>
                      ))}
                    </div>
                  )}

                  <p className="text-gray-500 mt-1">
                    Active tasks: {crew._count?.tasks ?? 0}
                  </p>

                  {atProject ? (
                    <p className="text-gray-500">
                      At: {atProject.projectNumber} &ndash; {atProject.name}
                    </p>
                  ) : (
                    <p className="text-gray-400 italic">At HQ (no active tasks)</p>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  )
}
