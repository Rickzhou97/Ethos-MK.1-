// @ts-nocheck — Three.js direct canvas mount (no R3F due to React 19 incompatibility)
"use client"

import { useRef, useEffect, useCallback, useState } from "react"
import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"
import type { DigitalTwinTask, DigitalTwinWorker } from "./factory-digital-twin"

// ═══════ ZONE → STAGE MAPPING ═══════
const ZONE_STAGE_MAP: Record<string, string> = {
  cut: "CUTTING",
  w1: "FABRICATION", w2: "FABRICATION", w3: "FABRICATION",
  w4: "FABRICATION", w5: "FABRICATION", w6: "FABRICATION", w7: "FABRICATION",
  weldC: "FABRICATION",
  fit1: "FITTING", fit2: "FITTING", fit3: "FITTING",
  sb1: "SHOTBLASTING", sb2: "SHOTBLASTING",
  sp1: "PAINTING", sp2: "PAINTING", sp3: "PAINTING",
  paint: "PAINTING",
  dry: "PAINTING",
  complete: "PACKING",
}

const STAGE_DISPLAY: Record<string, string> = {
  CUTTING: "Cutting",
  FABRICATION: "Fabrication (Welding)",
  FITTING: "Pre-Fit / Fitting",
  SHOTBLASTING: "Shot Blasting",
  PAINTING: "Painting",
  PACKING: "Packing / Completion",
}

const STAGE_HEX_COLORS: Record<string, number> = {
  CUTTING: 0x64748b,
  FABRICATION: 0x06b6d4,
  FITTING: 0xf97316,
  SHOTBLASTING: 0xef4444,
  PAINTING: 0xf59e0b,
  PACKING: 0x22c55e,
}

const STAGE_CSS_COLORS: Record<string, string> = {
  CUTTING: "#64748b",
  FABRICATION: "#06b6d4",
  FITTING: "#f97316",
  SHOTBLASTING: "#ef4444",
  PAINTING: "#f59e0b",
  PACKING: "#22c55e",
}

// ═══════ ZONE DEFINITIONS (matching factory-3d-v2.html) ═══════
const W = 25, L = 60

interface ZoneDef {
  id: string; lb: string; c: number; x: number; z: number
  w: number; d: number; h: number; ty: string; ds: string
}

const ZONES: ZoneDef[] = [
  { id: "office",  lb: "Office",          c: 0x22c55e, x: 6,   z: 28, w: 16, d: 6,  h: 3,  ty: "Office & Admin",      ds: "Management, design office, meeting rooms" },
  { id: "gate",    lb: "Gate",            c: 0x06b6d4, x: -8,  z: 28, w: 8,  d: 4,  h: 4,  ty: "Main Gate",           ds: "Vehicle entrance, security checkpoint" },
  { id: "fit1",    lb: "Fitting Bay 1",   c: 0xf97316, x: 9,   z: 20, w: 6,  d: 5,  h: 6,  ty: "Fitting Bay",         ds: "Product assembly station 1" },
  { id: "fit2",    lb: "Fitting Bay 2",   c: 0xf97316, x: 9,   z: 14, w: 6,  d: 5,  h: 6,  ty: "Fitting Bay",         ds: "Product assembly station 2" },
  { id: "fit3",    lb: "Fitting Bay 3",   c: 0xf97316, x: 9,   z: 8,  w: 6,  d: 5,  h: 6,  ty: "Fitting Bay",         ds: "Product assembly station 3" },
  { id: "inv2",    lb: "Inventory 2",     c: 0x8b5cf6, x: 0,   z: 21, w: 8,  d: 8,  h: 6,  ty: "Inventory Storage",   ds: "Raw materials, hardware, consumables" },
  { id: "matl",    lb: "Materials",       c: 0x8b5cf6, x: 1,   z: 13, w: 6,  d: 5,  h: 4,  ty: "Materials Store",     ds: "Steel stock, plates, sections" },
  { id: "weldC",   lb: "Welding (Main)",  c: 0x06b6d4, x: -2,  z: 15, w: 5,  d: 4,  h: 6,  ty: "Welding Bay",         ds: "Main welding / fabrication area" },
  { id: "w1",      lb: "Weld 1",         c: 0x06b6d4, x: -10, z: 26, w: 4,  d: 4,  h: 6,  ty: "Welding Bay",         ds: "MIG/TIG welding station 1" },
  { id: "w2",      lb: "Weld 2",         c: 0x06b6d4, x: -10, z: 21, w: 4,  d: 4,  h: 6,  ty: "Welding Bay",         ds: "MIG/TIG welding station 2" },
  { id: "w3",      lb: "Weld 3",         c: 0x06b6d4, x: -10, z: 16, w: 4,  d: 4,  h: 6,  ty: "Welding Bay",         ds: "MIG/TIG welding station 3" },
  { id: "w4",      lb: "Weld 4",         c: 0x06b6d4, x: -10, z: 11, w: 4,  d: 4,  h: 6,  ty: "Welding Bay",         ds: "MIG/TIG welding station 4" },
  { id: "w5",      lb: "Weld 5",         c: 0x06b6d4, x: -10, z: 6,  w: 4,  d: 4,  h: 6,  ty: "Welding Bay",         ds: "MIG/TIG welding station 5" },
  { id: "w6",      lb: "Weld 6",         c: 0x06b6d4, x: -10, z: 1,  w: 4,  d: 4,  h: 6,  ty: "Welding Bay",         ds: "MIG/TIG welding station 6" },
  { id: "w7",      lb: "Weld 7",         c: 0x06b6d4, x: -10, z: -4, w: 4,  d: 4,  h: 6,  ty: "Welding Bay",         ds: "MIG/TIG welding station 7" },
  { id: "sb1",     lb: "Shot Blasting",   c: 0xef4444, x: 4,   z: -1, w: 12, d: 8,  h: 6,  ty: "Shot Blast Booth",    ds: "Surface preparation — SA 2.5 blast finish" },
  { id: "sp1",     lb: "Surface Prep 1",  c: 0xf59e0b, x: 9,   z: -11,w: 5,  d: 3,  h: 4,  ty: "Surface Preparation", ds: "Pre-paint surface treatment" },
  { id: "sp2",     lb: "Surface Prep 2",  c: 0xf59e0b, x: 9,   z: -15,w: 5,  d: 3,  h: 4,  ty: "Surface Preparation", ds: "Pre-paint surface treatment" },
  { id: "sp3",     lb: "Surface Prep 3",  c: 0xf59e0b, x: 9,   z: -19,w: 5,  d: 3,  h: 4,  ty: "Surface Preparation", ds: "Pre-paint surface treatment" },
  { id: "dry",     lb: "Drying Area",     c: 0xf59e0b, x: 0,   z: -14,w: 8,  d: 10, h: 5,  ty: "Drying Area",         ds: "Heated drying zone for painted products" },
  { id: "cut",     lb: "Cutting",         c: 0x64748b, x: -9,  z: -12,w: 5,  d: 8,  h: 6,  ty: "Cutting Bay",         ds: "Plasma CNC table and band saw" },
  { id: "mat1",    lb: "Materials 1",     c: 0x64748b, x: -10, z: -20,w: 4,  d: 4,  h: 4,  ty: "Materials Storage",   ds: "Steel stock and offcuts" },
  { id: "mat2",    lb: "Materials 2",     c: 0x64748b, x: -10, z: -25,w: 4,  d: 4,  h: 4,  ty: "Materials Storage",   ds: "Consumables and hardware" },
  { id: "paint",   lb: "Painting",        c: 0xec4899, x: 2,   z: -26,w: 18, d: 6,  h: 6,  ty: "Painting Bay",        ds: "Primer + topcoat spray booth, heated drying" },
  { id: "sb2",     lb: "Shot Blasting 2", c: 0xef4444, x: 2,   z: -34,w: 16, d: 4,  h: 5,  ty: "Shot Blast (External)",ds: "Outdoor shot blasting for oversized items" },
  { id: "yard",    lb: "Yard",            c: 0x166534, x: 0,   z: -39,w: 20, d: 4,  h: 0.3,ty: "External Yard",       ds: "Loading, dispatch, outdoor storage" },
  { id: "complete",lb: "Completion",      c: 0x22c55e, x: 0,   z: 8,  w: 6,  d: 4,  h: 3,  ty: "Packing / Completion",ds: "Final QC, packing and dispatch" },
]

// Production flow path
const FLOW_POINTS = [
  { s: 1, p: [-9, -12] },  // Cutting
  { s: 2, p: [-10, 6] },   // Welding
  { s: 3, p: [-10, 16] },  // Welding main
  { s: 4, p: [9, 20] },    // Fitting 1
  { s: 5, p: [9, 14] },    // Fitting 2
  { s: 6, p: [9, 8] },     // Fitting 3
  { s: 7, p: [4, -1] },    // Shot blasting
  { s: 8, p: [0, -14] },   // Drying
  { s: 9, p: [2, -26] },   // Painting
  { s: 10, p: [0, 8] },    // Complete
]

interface Props {
  tasksByStage: Record<string, DigitalTwinTask[]>
  workers: DigitalTwinWorker[]
}

function isToday(dateStr: string | null): boolean {
  if (!dateStr) return false
  const d = new Date(dateStr)
  const now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
}

export default function FactoryTwinInner({ tasksByStage, workers }: Props) {
  const mountRef = useRef<HTMLDivElement>(null)
  const hoverRef = useRef<HTMLDivElement>(null)
  const [hoverData, setHoverData] = useState<{
    stage: string; zoneName: string; x: number; y: number
    active: number; pending: number; completedToday: number
    tasks: DigitalTwinTask[]
  } | null>(null)

  // Calculate global stats
  const allTasks = Object.values(tasksByStage).flat()
  const totalActive = allTasks.filter(t => t.status === "IN_PROGRESS").length
  const totalPending = allTasks.filter(t => t.status === "PENDING").length
  const totalCompletedToday = allTasks.filter(t => t.status === "COMPLETED" && isToday(t.completedAt)).length

  useEffect(() => {
    if (!mountRef.current) return

    const container = mountRef.current
    const width = container.clientWidth
    const height = container.clientHeight

    // ═══════ THREE SETUP ═══════
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x101020)
    scene.fog = new THREE.Fog(0x101020, 90, 160)

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 500)
    camera.position.set(40, 40, 50)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.1
    container.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.target.set(0, 2, 0)
    controls.maxPolarAngle = Math.PI / 2.05

    // Lighting
    scene.add(new THREE.AmbientLight(0x8899bb, 0.5))
    const sun = new THREE.DirectionalLight(0xfff5e0, 0.9)
    sun.position.set(25, 45, 20)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    sun.shadow.camera.left = -45
    sun.shadow.camera.right = 45
    sun.shadow.camera.top = 50
    sun.shadow.camera.bottom = -50
    scene.add(sun)
    const fill = new THREE.DirectionalLight(0x4466aa, 0.25)
    fill.position.set(-20, 15, 0)
    scene.add(fill)

    // Ground
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(150, 150),
      new THREE.MeshStandardMaterial({ color: 0x181828 })
    )
    ground.rotation.x = -Math.PI / 2
    ground.receiveShadow = true
    scene.add(ground)

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(W + 2, L + 2),
      new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.9 })
    )
    floor.rotation.x = -Math.PI / 2
    floor.position.set(0, 0.03, 0)
    floor.receiveShadow = true
    scene.add(floor)

    scene.add(new THREE.GridHelper(150, 75, 0x1e1e30, 0x16162a))

    // Building shell
    const shell = new THREE.Mesh(
      new THREE.BoxGeometry(W, 7, L),
      new THREE.MeshStandardMaterial({ color: 0x556677, transparent: true, opacity: 0.06, side: THREE.DoubleSide })
    )
    shell.position.y = 3.5
    scene.add(shell)

    const shellEdges = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(W, 7, L)),
      new THREE.LineBasicMaterial({ color: 0x445566, transparent: true, opacity: 0.25 })
    )
    shellEdges.position.y = 3.5
    scene.add(shellEdges)

    const roof = new THREE.Mesh(
      new THREE.PlaneGeometry(W + 2, L + 2),
      new THREE.MeshStandardMaterial({ color: 0x445566, transparent: true, opacity: 0.03, side: THREE.DoubleSide })
    )
    roof.rotation.x = -Math.PI / 2
    roof.position.y = 7.5
    scene.add(roof)

    // ═══════ BUILD ZONES ═══════
    const clickables: THREE.Object3D[] = []
    const zoneFloors: THREE.Mesh[] = []
    const zonePadMap: Record<string, THREE.Mesh> = {}
    const labels: THREE.Sprite[] = []
    let hoveredZoneId: string | null = null

    for (const z of ZONES) {
      const col = new THREE.Color(z.c)
      const stage = ZONE_STAGE_MAP[z.id]
      const stageTasks = stage ? (tasksByStage[stage] || []) : []
      const hasActive = stageTasks.some(t => t.status === "IN_PROGRESS")
      const hasPending = stageTasks.some(t => t.status === "PENDING")

      // Determine floor pad opacity based on activity
      let padOpacity = 0.15 // empty
      if (hasActive) padOpacity = 0.55
      else if (hasPending) padOpacity = 0.35

      // Floor pad
      const pad = new THREE.Mesh(
        new THREE.PlaneGeometry(z.w, z.d),
        new THREE.MeshStandardMaterial({ color: z.c, transparent: true, opacity: padOpacity, side: THREE.DoubleSide })
      )
      pad.rotation.x = -Math.PI / 2
      pad.position.set(z.x, 0.08, z.z)
      pad.userData = { zone: z }
      scene.add(pad)
      clickables.push(pad)
      zoneFloors.push(pad)
      zonePadMap[z.id] = pad

      // Box
      if (z.h > 1) {
        const box = new THREE.Mesh(
          new THREE.BoxGeometry(z.w, z.h, z.d),
          new THREE.MeshStandardMaterial({ color: z.c, transparent: true, opacity: 0.1 })
        )
        box.position.set(z.x, z.h / 2, z.z)
        box.userData = { zone: z }
        scene.add(box)
        clickables.push(box)

        const wireframe = new THREE.LineSegments(
          new THREE.EdgesGeometry(new THREE.BoxGeometry(z.w, z.h, z.d)),
          new THREE.LineBasicMaterial({ color: z.c, transparent: true, opacity: 0.35 })
        )
        wireframe.position.copy(box.position)
        scene.add(wireframe)
      }

      // Label sprite
      const labelCanvas = document.createElement("canvas")
      labelCanvas.width = 512
      labelCanvas.height = 80
      const ctx = labelCanvas.getContext("2d")!
      ctx.fillStyle = `rgba(${col.r * 255 | 0},${col.g * 255 | 0},${col.b * 255 | 0},.85)`
      ctx.beginPath()
      ctx.roundRect(0, 0, 512, 80, 12)
      ctx.fill()
      ctx.fillStyle = "#fff"
      ctx.font = "bold 34px sans-serif"
      ctx.textAlign = "center"
      const txt = z.lb.length > 18 ? z.lb.slice(0, 18) + "\u2026" : z.lb
      ctx.fillText(txt, 256, 52)

      const labelTexture = new THREE.CanvasTexture(labelCanvas)
      const labelSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture, transparent: true, depthTest: false }))
      labelSprite.position.set(z.x, Math.max(z.h, 1) + 1.5, z.z)
      labelSprite.scale.set(Math.min(z.w * 0.9, 7), Math.min(z.w * 0.9, 7) * 0.16, 1)
      scene.add(labelSprite)
      labels.push(labelSprite)

      // Count badge (active task count) above zone
      if (stage && stageTasks.length > 0) {
        const activeCount = stageTasks.filter(t => t.status === "IN_PROGRESS").length
        const pendingCount = stageTasks.filter(t => t.status === "PENDING").length
        // Only show badge for zones that are the "primary" for their stage to avoid duplicates
        const primaryZones: Record<string, string> = {
          CUTTING: "cut", FABRICATION: "weldC", FITTING: "fit1",
          SHOTBLASTING: "sb1", PAINTING: "paint", PACKING: "complete"
        }
        if (primaryZones[stage] === z.id && (activeCount > 0 || pendingCount > 0)) {
          const badgeCanvas = document.createElement("canvas")
          badgeCanvas.width = 128
          badgeCanvas.height = 64
          const bctx = badgeCanvas.getContext("2d")!
          bctx.fillStyle = activeCount > 0 ? "#3b82f6" : "#f59e0b"
          bctx.beginPath()
          bctx.roundRect(4, 4, 120, 56, 12)
          bctx.fill()
          bctx.fillStyle = "#fff"
          bctx.font = "bold 36px sans-serif"
          bctx.textAlign = "center"
          bctx.fillText(`${activeCount}/${pendingCount}`, 64, 44)

          const badgeTexture = new THREE.CanvasTexture(badgeCanvas)
          const badgeSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: badgeTexture, transparent: true, depthTest: false }))
          badgeSprite.position.set(z.x, Math.max(z.h, 1) + 3, z.z)
          badgeSprite.scale.set(2.5, 1.25, 1)
          scene.add(badgeSprite)
        }
      }

      // Equipment
      if (z.ty === "Welding Bay") {
        const table = new THREE.Mesh(
          new THREE.BoxGeometry(1.5, 0.6, 1.5),
          new THREE.MeshStandardMaterial({ color: 0x8b6914, metalness: 0.3 })
        )
        table.position.set(z.x, 0.3, z.z)
        table.castShadow = true
        scene.add(table)
      }
      if (z.ty === "Fitting Bay") {
        const bench = new THREE.Mesh(
          new THREE.BoxGeometry(4, 0.6, 2),
          new THREE.MeshStandardMaterial({ color: 0xcc6600, metalness: 0.2 })
        )
        bench.position.set(z.x, 0.3, z.z)
        bench.castShadow = true
        scene.add(bench)
      }
      if (z.ty === "Cutting Bay") {
        const cutter = new THREE.Mesh(
          new THREE.BoxGeometry(3.5, 0.8, 2.5),
          new THREE.MeshStandardMaterial({ color: 0x883333, metalness: 0.4 })
        )
        cutter.position.set(z.x, 0.4, z.z)
        cutter.castShadow = true
        scene.add(cutter)
      }
      if (z.ty === "Painting Bay") {
        const booth = new THREE.Mesh(
          new THREE.BoxGeometry(5, 3.5, 4),
          new THREE.MeshStandardMaterial({ color: 0xec4899, transparent: true, opacity: 0.12 })
        )
        booth.position.set(z.x - 4, 1.75, z.z)
        scene.add(booth)
        const boothWire = new THREE.LineSegments(
          new THREE.EdgesGeometry(new THREE.BoxGeometry(5, 3.5, 4)),
          new THREE.LineBasicMaterial({ color: 0xec4899, transparent: true, opacity: 0.3 })
        )
        boothWire.position.copy(booth.position)
        scene.add(boothWire)
      }
    }

    // Steel frame products in bays
    const prodPositions = [
      { x: 9, z: 20 }, { x: 9, z: 14 }, { x: -10, z: 21 }, { x: -10, z: 11 }, { x: -9, z: -12 }
    ]
    for (const p of prodPositions) {
      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(2, 2.5, 0.1),
        new THREE.MeshStandardMaterial({ color: 0xbbbbcc, metalness: 0.7, roughness: 0.25 })
      )
      frame.position.set(p.x + 1, 1.25, p.z + 1)
      frame.castShadow = true
      scene.add(frame)
    }

    // ═══════ PRODUCTION FLOW PATH ═══════
    const flowGroup = new THREE.Group()
    flowGroup.visible = true
    scene.add(flowGroup)

    const flowPts = FLOW_POINTS.map(f => new THREE.Vector3(f.p[0], 1.5, f.p[1]))
    const flowCurve = new THREE.CatmullRomCurve3(flowPts)
    flowGroup.add(new THREE.Mesh(
      new THREE.TubeGeometry(flowCurve, 100, 0.15, 8, false),
      new THREE.MeshBasicMaterial({ color: 0xff3333, transparent: true, opacity: 0.5 })
    ))

    // Flow step markers
    for (const s of FLOW_POINTS) {
      const mc = document.createElement("canvas")
      mc.width = mc.height = 128
      const mx = mc.getContext("2d")!
      mx.fillStyle = "#ef4444"
      mx.beginPath()
      mx.arc(64, 64, 50, 0, Math.PI * 2)
      mx.fill()
      mx.strokeStyle = "#fff"
      mx.lineWidth = 4
      mx.stroke()
      mx.fillStyle = "#fff"
      mx.font = "bold 52px sans-serif"
      mx.textAlign = "center"
      mx.fillText(s.s + "", 64, 80)
      const ms = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(mc), depthTest: false }))
      ms.position.set(s.p[0], 4, s.p[1])
      ms.scale.set(2, 2, 1)
      flowGroup.add(ms)
    }

    // Animated flow ball
    const flowBall = new THREE.Mesh(
      new THREE.SphereGeometry(0.45, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xff6600 })
    )
    flowBall.userData = { crv: flowCurve, t: 0 }
    flowGroup.add(flowBall)

    // North arrow
    const northArrow = new THREE.Mesh(
      new THREE.ConeGeometry(0.5, 2, 4),
      new THREE.MeshBasicMaterial({ color: 0xef4444 })
    )
    northArrow.position.set(-W / 2 - 3, 1, L / 2 + 2)
    scene.add(northArrow)

    const nc = document.createElement("canvas")
    nc.width = nc.height = 64
    const nx = nc.getContext("2d")!
    nx.fillStyle = "#ef4444"
    nx.font = "bold 48px sans-serif"
    nx.textAlign = "center"
    nx.fillText("N", 32, 48)
    const nSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(nc) }))
    nSprite.position.set(-W / 2 - 3, 3.5, L / 2 + 2)
    nSprite.scale.set(1.8, 1.8, 1)
    scene.add(nSprite)

    // ═══════ PULSING GLOW FOR ACTIVE ZONES ═══════
    const activeZonePads: THREE.Mesh[] = []
    for (const z of ZONES) {
      const stage = ZONE_STAGE_MAP[z.id]
      if (!stage) continue
      const stageTasks = tasksByStage[stage] || []
      if (stageTasks.some(t => t.status === "IN_PROGRESS")) {
        const pad = zonePadMap[z.id]
        if (pad) activeZonePads.push(pad)
      }
    }

    // ═══════ RAYCASTER / HOVER ═══════
    const raycaster = new THREE.Raycaster()
    const mouse = new THREE.Vector2()

    function getHits(e: MouseEvent) {
      const rect = renderer.domElement.getBoundingClientRect()
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(mouse, camera)
      return raycaster.intersectObjects(clickables)
    }

    function handleMouseMove(e: MouseEvent) {
      const hits = getHits(e)
      if (hits.length > 0 && hits[0].object.userData.zone) {
        const z = hits[0].object.userData.zone as ZoneDef
        const stage = ZONE_STAGE_MAP[z.id]

        renderer.domElement.style.cursor = "pointer"

        // Highlight zone
        if (hoveredZoneId !== z.id) {
          zoneFloors.forEach(f => {
            const fz = f.userData.zone as ZoneDef
            const fStage = ZONE_STAGE_MAP[fz.id]
            const fTasks = fStage ? (tasksByStage[fStage] || []) : []
            const fHasActive = fTasks.some(t => t.status === "IN_PROGRESS")
            const fHasPending = fTasks.some(t => t.status === "PENDING")
            if (fz.id === z.id) {
              f.material.opacity = 0.7
            } else {
              f.material.opacity = fHasActive ? 0.55 : fHasPending ? 0.35 : 0.15
            }
          })
          hoveredZoneId = z.id
        }

        if (stage) {
          const stageTasks = tasksByStage[stage] || []
          const active = stageTasks.filter(t => t.status === "IN_PROGRESS").length
          const pending = stageTasks.filter(t => t.status === "PENDING").length
          const completedToday = stageTasks.filter(t => t.status === "COMPLETED" && isToday(t.completedAt)).length

          setHoverData({
            stage,
            zoneName: z.lb,
            x: e.clientX,
            y: e.clientY,
            active,
            pending,
            completedToday,
            tasks: stageTasks.slice(0, 6),
          })
        } else {
          // Non-production zone (office, gate, etc.) — show simple tooltip
          setHoverData({
            stage: "",
            zoneName: z.lb,
            x: e.clientX,
            y: e.clientY,
            active: 0,
            pending: 0,
            completedToday: 0,
            tasks: [],
          })
        }
      } else {
        renderer.domElement.style.cursor = "default"
        if (hoveredZoneId) {
          zoneFloors.forEach(f => {
            const fz = f.userData.zone as ZoneDef
            const fStage = ZONE_STAGE_MAP[fz.id]
            const fTasks = fStage ? (tasksByStage[fStage] || []) : []
            const fHasActive = fTasks.some(t => t.status === "IN_PROGRESS")
            const fHasPending = fTasks.some(t => t.status === "PENDING")
            f.material.opacity = fHasActive ? 0.55 : fHasPending ? 0.35 : 0.15
          })
          hoveredZoneId = null
        }
        setHoverData(null)
      }
    }

    function handleMouseLeave() {
      setHoverData(null)
      hoveredZoneId = null
      zoneFloors.forEach(f => {
        const fz = f.userData.zone as ZoneDef
        const fStage = ZONE_STAGE_MAP[fz.id]
        const fTasks = fStage ? (tasksByStage[fStage] || []) : []
        const fHasActive = fTasks.some(t => t.status === "IN_PROGRESS")
        const fHasPending = fTasks.some(t => t.status === "PENDING")
        f.material.opacity = fHasActive ? 0.55 : fHasPending ? 0.35 : 0.15
      })
    }

    renderer.domElement.addEventListener("mousemove", handleMouseMove)
    renderer.domElement.addEventListener("mouseleave", handleMouseLeave)

    // ═══════ ANIMATION LOOP ═══════
    let animId: number
    const clock = new THREE.Clock()

    function animate() {
      animId = requestAnimationFrame(animate)
      controls.update()
      const elapsed = clock.getElapsedTime()

      // Pulse active zone pads
      for (const pad of activeZonePads) {
        const base = 0.45
        const pulse = base + Math.sin(elapsed * 3) * 0.12
        if (hoveredZoneId !== (pad.userData.zone as ZoneDef).id) {
          pad.material.opacity = pulse
        }
      }

      // Animate flow ball
      flowBall.userData.t = (flowBall.userData.t + 0.0015) % 1
      flowBall.position.copy(flowCurve.getPoint(flowBall.userData.t))
      flowBall.position.y = 1.5

      renderer.render(scene, camera)
    }
    animate()

    // Resize handler
    function handleResize() {
      const w = container.clientWidth
      const h = container.clientHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    window.addEventListener("resize", handleResize)

    // Cleanup
    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener("resize", handleResize)
      renderer.domElement.removeEventListener("mousemove", handleMouseMove)
      renderer.domElement.removeEventListener("mouseleave", handleMouseLeave)
      renderer.dispose()
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement)
      }
    }
  }, [tasksByStage])

  // Position hover panel
  const panelStyle: React.CSSProperties = hoverData
    ? {
        display: "block",
        left: Math.min(hoverData.x + 16, (typeof window !== "undefined" ? window.innerWidth - 420 : 800)),
        top: Math.min(hoverData.y - 10, (typeof window !== "undefined" ? window.innerHeight - 400 : 500)),
      }
    : { display: "none" }

  const stageColor = hoverData?.stage ? (STAGE_CSS_COLORS[hoverData.stage] || "#64748b") : "#64748b"
  const remainingCount = hoverData?.stage ? Math.max(0, (tasksByStage[hoverData.stage] || []).length - 6) : 0

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#101020]">
      {/* Title bar */}
      <div className="fixed top-0 left-0 right-0 z-50 flex items-center gap-3 px-5 py-2.5 border-b border-white/10"
           style={{ background: "rgba(10,10,26,0.92)", backdropFilter: "blur(12px)" }}>
        <h1 className="text-white text-[15px] font-bold">Factory Digital Twin</h1>
        <span className="bg-blue-500 text-white text-[10px] px-2 py-0.5 rounded">LIVE</span>
        <span className="text-white/40 text-xs">Live Production Status</span>
        <div className="flex-1" />
        <span className="text-white/30 text-[10px]">Data refreshed on page load</span>
      </div>

      {/* Legend */}
      <div className="fixed bottom-14 left-3.5 z-50 rounded-xl p-3 px-4 text-white border border-white/[0.08]"
           style={{ background: "rgba(10,10,26,0.9)" }}>
        <h3 className="text-[9px] text-slate-500 uppercase tracking-wider mb-1.5 font-semibold">Production Stages</h3>
        {Object.entries(STAGE_DISPLAY).map(([key, label]) => (
          <div key={key} className="flex items-center gap-2 my-0.5 text-[10px] text-slate-300">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ background: STAGE_CSS_COLORS[key] }} />
            {label}
          </div>
        ))}
        <div className="mt-2 pt-2 border-t border-white/10">
          <h3 className="text-[9px] text-slate-500 uppercase tracking-wider mb-1 font-semibold">Other</h3>
          <div className="flex items-center gap-2 my-0.5 text-[10px] text-slate-300">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ background: "#22c55e" }} />Office / Gate
          </div>
          <div className="flex items-center gap-2 my-0.5 text-[10px] text-slate-300">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ background: "#8b5cf6" }} />Inventory / Materials
          </div>
          <div className="flex items-center gap-2 my-0.5 text-[10px] text-slate-300">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ background: "#166534" }} />Yard
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 flex items-center gap-6 px-5 py-2 border-t border-white/10 text-[11px]"
           style={{ background: "rgba(10,10,26,0.92)", backdropFilter: "blur(12px)" }}>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
          <span className="text-white/60">Active:</span>
          <span className="text-white font-bold">{totalActive}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
          <span className="text-white/60">Pending:</span>
          <span className="text-white font-bold">{totalPending}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
          <span className="text-white/60">Completed Today:</span>
          <span className="text-white font-bold">{totalCompletedToday}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-purple-400 inline-block" />
          <span className="text-white/60">Workers On Shift:</span>
          <span className="text-white font-bold">{workers.length}</span>
        </div>
        <div className="flex-1" />
        <div className="text-white/25 text-[9px]">
          <b className="text-white/40">Drag</b> orbit &middot; <b className="text-white/40">Right-drag</b> pan &middot; <b className="text-white/40">Scroll</b> zoom
        </div>
      </div>

      {/* Three.js mount */}
      <div ref={mountRef} className="w-full h-full pt-10 pb-8" />

      {/* Hover panel */}
      <div
        ref={hoverRef}
        className="fixed z-[200] pointer-events-none"
        style={panelStyle}
      >
        {hoverData && (
          <div className="rounded-xl border border-white/[0.12] text-white min-w-[380px] max-w-[420px] overflow-hidden"
               style={{ background: "rgba(10,10,26,0.96)", backdropFilter: "blur(14px)", boxShadow: "0 8px 32px rgba(0,0,0,0.6)" }}>
            {/* Header */}
            <div className="px-4 py-2.5 border-b border-white/10 flex items-center gap-2" style={{ borderTopColor: stageColor, borderTopWidth: "3px", borderTopStyle: "solid" }}>
              <div className="w-2.5 h-2.5 rounded-sm" style={{ background: stageColor }} />
              <span className="font-bold text-[13px]">
                {hoverData.stage ? STAGE_DISPLAY[hoverData.stage] || hoverData.stage : hoverData.zoneName}
              </span>
              <span className="text-white/40 text-[11px] ml-1">({hoverData.zoneName})</span>
            </div>

            {hoverData.stage ? (
              <>
                {/* Stats row */}
                <div className="px-4 py-2 flex items-center gap-4 text-[11px] border-b border-white/[0.06] bg-white/[0.02]">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                    <span className="text-white/60">{hoverData.active} Active</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                    <span className="text-white/60">{hoverData.pending} Pending</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                    <span className="text-white/60">{hoverData.completedToday} Done Today</span>
                  </span>
                </div>

                {/* Task table */}
                {hoverData.tasks.length > 0 ? (
                  <div className="px-3 py-2">
                    <table className="w-full text-[10px]">
                      <thead>
                        <tr className="text-white/40 uppercase tracking-wider">
                          <th className="text-left py-1 px-1 font-semibold">Product</th>
                          <th className="text-left py-1 px-1 font-semibold">Project</th>
                          <th className="text-left py-1 px-1 font-semibold">Status</th>
                          <th className="text-left py-1 px-1 font-semibold">Worker</th>
                        </tr>
                      </thead>
                      <tbody>
                        {hoverData.tasks.map((task, i) => (
                          <tr key={task.id} className={i % 2 === 0 ? "bg-white/[0.02]" : ""}>
                            <td className="py-1 px-1 text-white/80 truncate max-w-[120px]" title={task.product.description}>
                              {task.product.partCode || task.product.description.slice(0, 20)}
                            </td>
                            <td className="py-1 px-1 text-white/60">
                              {task.product.project.projectNumber}
                            </td>
                            <td className="py-1 px-1">
                              {task.status === "IN_PROGRESS" ? (
                                <span className="inline-flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />
                                  <span className="text-blue-400">Live</span>
                                </span>
                              ) : task.status === "PENDING" ? (
                                <span className="inline-flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                                  <span className="text-amber-400">Ready</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                                  <span className="text-green-400">Done</span>
                                </span>
                              )}
                            </td>
                            <td className="py-1 px-1 text-white/50">
                              {task.assignedTo || "\u2014"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {remainingCount > 0 && (
                      <div className="text-white/30 text-[10px] mt-1 px-1">+{remainingCount} more in queue</div>
                    )}
                  </div>
                ) : (
                  <div className="px-4 py-3 text-white/30 text-[11px]">No tasks at this stage</div>
                )}
              </>
            ) : (
              <div className="px-4 py-3 text-white/40 text-[11px]">Non-production zone</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
