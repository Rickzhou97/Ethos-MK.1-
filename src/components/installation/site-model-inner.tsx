"use client"

import { Canvas, useFrame } from "@react-three/fiber"
import { OrbitControls, Html, Grid } from "@react-three/drei"
import { useRef, useState, useMemo } from "react"
import * as THREE from "three"
import type { SiteModelProps, InstallPoint } from "./site-model-viewer"

// ── Status colors ──────────────────────────────────────────────
const STATUS_COLORS: Record<InstallPoint["status"], string> = {
  not_started: "#f97316", // orange
  in_progress: "#3b82f6", // blue
  completed: "#22c55e",   // green
  ncr: "#ef4444",         // red
}

const STATUS_LABELS: Record<InstallPoint["status"], string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  completed: "Completed",
  ncr: "NCR",
}

// ── Substation Building ────────────────────────────────────────
function SubstationBuilding() {
  return (
    <group>
      {/* Main building body */}
      <mesh position={[0, 3, 0]} castShadow receiveShadow>
        <boxGeometry args={[20, 6, 8]} />
        <meshStandardMaterial color="#d4d4d8" roughness={0.8} />
      </mesh>

      {/* Roof – slightly wider overhang */}
      <mesh position={[0, 6.15, 0]} castShadow receiveShadow>
        <boxGeometry args={[21, 0.3, 9]} />
        <meshStandardMaterial color="#a1a1aa" roughness={0.7} />
      </mesh>

      {/* Control room – attached to the right side */}
      <mesh position={[13, 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[6, 4, 5]} />
        <meshStandardMaterial color="#d4d4d8" roughness={0.8} />
      </mesh>
      <mesh position={[13, 4.15, 0]} castShadow receiveShadow>
        <boxGeometry args={[6.5, 0.25, 5.5]} />
        <meshStandardMaterial color="#a1a1aa" roughness={0.7} />
      </mesh>

      {/* Control room door */}
      <mesh position={[13, 1.2, 2.51]} castShadow>
        <boxGeometry args={[1.2, 2.2, 0.08]} />
        <meshStandardMaterial color="#71717a" roughness={0.6} />
      </mesh>

      {/* Ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial color="#e5e7eb" roughness={0.9} />
      </mesh>
    </group>
  )
}

// ── Transformer units ──────────────────────────────────────────
function TransformerUnit({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Main body */}
      <mesh position={[0, 1.5, 0]} castShadow>
        <boxGeometry args={[3, 3, 2.5]} />
        <meshStandardMaterial color="#3f3f46" roughness={0.6} metalness={0.3} />
      </mesh>
      {/* Cooling fins – left side */}
      {[-0.8, -0.3, 0.2, 0.7].map((z, i) => (
        <mesh key={`fin-l-${i}`} position={[-1.6, 1.5, z]} castShadow>
          <boxGeometry args={[0.1, 2.4, 0.35]} />
          <meshStandardMaterial color="#52525b" roughness={0.5} metalness={0.4} />
        </mesh>
      ))}
      {/* Cooling fins – right side */}
      {[-0.8, -0.3, 0.2, 0.7].map((z, i) => (
        <mesh key={`fin-r-${i}`} position={[1.6, 1.5, z]} castShadow>
          <boxGeometry args={[0.1, 2.4, 0.35]} />
          <meshStandardMaterial color="#52525b" roughness={0.5} metalness={0.4} />
        </mesh>
      ))}
      {/* Bushings on top */}
      {[-0.6, 0, 0.6].map((x, i) => (
        <mesh key={`bush-${i}`} position={[x, 3.5, 0]} castShadow>
          <cylinderGeometry args={[0.1, 0.15, 1, 8]} />
          <meshStandardMaterial color="#78716c" roughness={0.4} metalness={0.5} />
        </mesh>
      ))}
      {/* Base pad */}
      <mesh position={[0, 0.05, 0]} receiveShadow>
        <boxGeometry args={[3.6, 0.1, 3]} />
        <meshStandardMaterial color="#a1a1aa" roughness={0.9} />
      </mesh>
    </group>
  )
}

function Transformers() {
  return (
    <group>
      <TransformerUnit position={[-5, 0, -8]} />
      <TransformerUnit position={[0, 0, -8]} />
      <TransformerUnit position={[5, 0, -8]} />
    </group>
  )
}

// ── Cable trays ────────────────────────────────────────────────
function CableTrays() {
  const trays = [
    { from: [-5, 3.2, -6.5], to: [-5, 3.2, -4] },
    { from: [0, 3.2, -6.5], to: [0, 3.2, -4] },
    { from: [5, 3.2, -6.5], to: [5, 3.2, -4] },
    // Horizontal tray along building back
    { from: [-6, 3.2, -4], to: [6, 3.2, -4] },
  ]

  return (
    <group>
      {trays.map((tray, i) => {
        const start = new THREE.Vector3(...tray.from)
        const end = new THREE.Vector3(...tray.to)
        const mid = start.clone().add(end).multiplyScalar(0.5)
        const length = start.distanceTo(end)
        const dir = end.clone().sub(start).normalize()
        const quat = new THREE.Quaternion()
        quat.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir)

        return (
          <mesh key={i} position={[mid.x, mid.y, mid.z]} quaternion={quat} castShadow>
            <cylinderGeometry args={[0.12, 0.12, length, 8]} />
            <meshStandardMaterial color="#71717a" roughness={0.5} metalness={0.3} />
          </mesh>
        )
      })}
      {/* Tray supports */}
      {[-5, 0, 5].map((x, i) => (
        <mesh key={`sup-${i}`} position={[x, 1.6, -5.5]} castShadow>
          <cylinderGeometry args={[0.06, 0.06, 3.2, 6]} />
          <meshStandardMaterial color="#71717a" roughness={0.6} />
        </mesh>
      ))}
    </group>
  )
}

// ── Perimeter fence ────────────────────────────────────────────
function PerimeterFence() {
  const fencePoints: [number, number, number][] = [
    [-18, 0, 14],
    [20, 0, 14],
    [20, 0, -14],
    [-18, 0, -14],
  ]

  const segments: { from: [number, number, number]; to: [number, number, number] }[] = []
  for (let i = 0; i < fencePoints.length; i++) {
    segments.push({ from: fencePoints[i], to: fencePoints[(i + 1) % fencePoints.length] })
  }

  return (
    <group>
      {/* Low concrete wall */}
      {segments.map((seg, i) => {
        const start = new THREE.Vector3(...seg.from)
        const end = new THREE.Vector3(...seg.to)
        const mid = start.clone().add(end).multiplyScalar(0.5)
        const length = start.distanceTo(end)
        const angle = Math.atan2(end.x - start.x, end.z - start.z)

        return (
          <group key={`fence-${i}`}>
            {/* Concrete base wall */}
            <mesh position={[mid.x, 0.3, mid.z]} rotation={[0, angle, 0]} castShadow receiveShadow>
              <boxGeometry args={[0.2, 0.6, length]} />
              <meshStandardMaterial color="#a8a29e" roughness={0.9} />
            </mesh>
            {/* Wireframe fence panels */}
            <mesh position={[mid.x, 1.5, mid.z]} rotation={[0, angle, 0]}>
              <boxGeometry args={[0.05, 1.8, length]} />
              <meshStandardMaterial color="#78716c" wireframe transparent opacity={0.4} />
            </mesh>
          </group>
        )
      })}

      {/* Fence posts */}
      {fencePoints.map((p, i) => (
        <mesh key={`post-${i}`} position={[p[0], 1.2, p[2]]} castShadow>
          <cylinderGeometry args={[0.08, 0.08, 2.4, 6]} />
          <meshStandardMaterial color="#71717a" roughness={0.6} />
        </mesh>
      ))}

      {/* Gate opening marker on front */}
      <mesh position={[1, 0.05, 14]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[4, 0.3]} />
        <meshStandardMaterial color="#fbbf24" roughness={0.5} />
      </mesh>
    </group>
  )
}

// ── North arrow ────────────────────────────────────────────────
function NorthArrow() {
  return (
    <group position={[-16, 0.1, -12]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.5, 1.5, 3]} />
        <meshStandardMaterial color="#ef4444" roughness={0.5} />
      </mesh>
      <Html position={[0, 0.5, -1.2]} center>
        <span className="text-xs font-bold text-red-600 select-none">N</span>
      </Html>
    </group>
  )
}

// ── Glowing frame around an opening ────────────────────────────
function GlowingFrame({
  width,
  height,
  color,
  status,
}: {
  width: number
  height: number
  color: string
  status: InstallPoint["status"]
}) {
  const matRef = useRef<THREE.MeshStandardMaterial>(null)

  useFrame(({ clock }) => {
    if (!matRef.current) return
    const t = clock.getElapsedTime()

    if (status === "in_progress") {
      // Pulsing opacity
      matRef.current.emissiveIntensity = 0.6 + 0.4 * Math.sin(t * 3)
    } else if (status === "ncr") {
      // Flashing
      matRef.current.emissiveIntensity = Math.sin(t * 6) > 0 ? 1.2 : 0.2
    } else {
      matRef.current.emissiveIntensity = 0.5
    }
  })

  const thickness = 0.08
  const threeColor = new THREE.Color(color)

  // Build frame from 4 thin boxes
  const bars: { pos: [number, number, number]; size: [number, number, number] }[] = [
    // top
    { pos: [0, height / 2, 0], size: [width + thickness * 2, thickness, thickness] },
    // bottom
    { pos: [0, -height / 2, 0], size: [width + thickness * 2, thickness, thickness] },
    // left
    { pos: [-width / 2, 0, 0], size: [thickness, height, thickness] },
    // right
    { pos: [width / 2, 0, 0], size: [thickness, height, thickness] },
  ]

  return (
    <group>
      {bars.map((bar, i) => (
        <mesh key={i} position={bar.pos}>
          <boxGeometry args={bar.size} />
          <meshStandardMaterial
            ref={i === 0 ? matRef : undefined}
            color={color}
            emissive={threeColor}
            emissiveIntensity={0.5}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  )
}

// ── Installation Opening ───────────────────────────────────────
function InstallationOpening({
  point,
  onClick,
}: {
  point: InstallPoint
  onClick: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const color = STATUS_COLORS[point.status]
  const statusLabel = STATUS_LABELS[point.status]

  const rotation = point.rotation
    ? new THREE.Euler(point.rotation[0], point.rotation[1], point.rotation[2])
    : new THREE.Euler(0, 0, 0)

  return (
    <group position={point.position} rotation={rotation}>
      {/* Dark opening cutout */}
      <mesh
        onClick={(e) => {
          e.stopPropagation()
          onClick()
        }}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHovered(true)
          document.body.style.cursor = "pointer"
        }}
        onPointerOut={() => {
          setHovered(false)
          document.body.style.cursor = "auto"
        }}
      >
        <planeGeometry args={[point.size[0], point.size[1]]} />
        <meshStandardMaterial
          color={hovered ? "#27272a" : "#18181b"}
          roughness={0.95}
        />
      </mesh>

      {/* Glowing frame */}
      <group position={[0, 0, 0.02]}>
        <GlowingFrame
          width={point.size[0]}
          height={point.size[1]}
          color={color}
          status={point.status}
        />
      </group>

      {/* Floating label */}
      <Html
        position={[0, point.size[1] / 2 + 0.6, 0.1]}
        center
        distanceFactor={15}
        style={{ pointerEvents: "none" }}
      >
        <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200 px-3 py-2 min-w-[140px] text-center select-none">
          <div className="text-xs font-semibold text-gray-900 truncate max-w-[160px]">
            {point.productDescription}
          </div>
          <div className="flex items-center justify-center gap-1.5 mt-1">
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ backgroundColor: color }}
            />
            <span className="text-[10px] font-medium text-gray-600">
              {statusLabel}
            </span>
          </div>
          {point.crewName && (
            <div className="text-[10px] text-gray-500 mt-0.5">
              {point.crewName}
            </div>
          )}
        </div>
      </Html>
    </group>
  )
}

// ── Main Scene ─────────────────────────────────────────────────
export default function SiteModelInner({ installPoints, onPointClick }: SiteModelProps) {
  return (
    <div className="w-full h-[600px] rounded-xl overflow-hidden border border-gray-200 bg-gradient-to-b from-sky-100 to-sky-50">
      <Canvas
        shadows
        camera={{ position: [25, 15, 25], fov: 50 }}
        gl={{ antialias: true }}
      >
        {/* Sky background */}
        <color attach="background" args={["#dbeafe"]} />
        <fog attach="fog" args={["#dbeafe", 50, 120]} />

        {/* Lighting */}
        <ambientLight intensity={0.5} />
        <directionalLight
          position={[10, 20, 10]}
          intensity={1}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-far={60}
          shadow-camera-left={-30}
          shadow-camera-right={30}
          shadow-camera-top={30}
          shadow-camera-bottom={-30}
        />
        <directionalLight position={[-8, 10, -8]} intensity={0.3} />

        {/* Scene objects */}
        <SubstationBuilding />
        <Transformers />
        <CableTrays />
        <PerimeterFence />
        <NorthArrow />

        {/* Installation openings */}
        {installPoints.map((point) => (
          <InstallationOpening
            key={point.id}
            point={point}
            onClick={() => onPointClick?.(point)}
          />
        ))}

        {/* Ground grid */}
        <Grid
          args={[100, 100]}
          cellSize={1}
          cellThickness={0.5}
          cellColor="#d4d4d8"
          sectionSize={5}
          sectionThickness={1}
          sectionColor="#a1a1aa"
          fadeDistance={50}
          position={[0, 0, 0]}
        />

        {/* Camera controls */}
        <OrbitControls
          makeDefault
          maxPolarAngle={Math.PI / 2.1}
          minDistance={10}
          maxDistance={60}
          target={[0, 3, 0]}
        />
      </Canvas>
    </div>
  )
}
