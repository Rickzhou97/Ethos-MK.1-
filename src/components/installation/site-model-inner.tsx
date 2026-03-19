// @ts-nocheck — Three.js direct canvas mount (no R3F due to React 19 incompatibility)
"use client"

import { useRef, useEffect, useCallback } from "react"
import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"
import type { SiteModelProps, InstallPoint } from "./site-model-viewer"

const STATUS_COLORS: Record<string, number> = {
  not_started: 0xf97316,
  in_progress: 0x3b82f6,
  completed: 0x22c55e,
  ncr: 0xef4444,
}

function createSubstation(scene: THREE.Scene) {
  // Ground plane
  const groundGeo = new THREE.PlaneGeometry(60, 60)
  const groundMat = new THREE.MeshStandardMaterial({ color: 0xe5e7eb })
  const ground = new THREE.Mesh(groundGeo, groundMat)
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true
  scene.add(ground)

  // Main building
  const buildingGeo = new THREE.BoxGeometry(20, 6, 8)
  const buildingMat = new THREE.MeshStandardMaterial({ color: 0xd4d4d8 })
  const building = new THREE.Mesh(buildingGeo, buildingMat)
  building.position.set(0, 3, 0)
  building.castShadow = true
  building.receiveShadow = true
  scene.add(building)

  // Roof
  const roofGeo = new THREE.BoxGeometry(21, 0.3, 9)
  const roofMat = new THREE.MeshStandardMaterial({ color: 0xa1a1aa })
  const roof = new THREE.Mesh(roofGeo, roofMat)
  roof.position.set(0, 6.15, 0)
  roof.castShadow = true
  scene.add(roof)

  // Control room (smaller box attached)
  const ctrlGeo = new THREE.BoxGeometry(6, 4, 5)
  const ctrlMat = new THREE.MeshStandardMaterial({ color: 0xbfbfbf })
  const ctrl = new THREE.Mesh(ctrlGeo, ctrlMat)
  ctrl.position.set(-13, 2, 0)
  ctrl.castShadow = true
  scene.add(ctrl)

  const ctrlRoof = new THREE.BoxGeometry(7, 0.2, 6)
  const ctrlRoofMesh = new THREE.Mesh(ctrlRoof, roofMat)
  ctrlRoofMesh.position.set(-13, 4.1, 0)
  scene.add(ctrlRoofMesh)

  // Transformers (3 units)
  for (let i = 0; i < 3; i++) {
    const txGeo = new THREE.BoxGeometry(2.5, 3, 2)
    const txMat = new THREE.MeshStandardMaterial({ color: 0x3f3f46 })
    const tx = new THREE.Mesh(txGeo, txMat)
    tx.position.set(4 + i * 4, 1.5, -8)
    tx.castShadow = true
    scene.add(tx)

    // Cooling fins
    for (let f = 0; f < 3; f++) {
      const finGeo = new THREE.BoxGeometry(0.05, 2.5, 1.8)
      const finMat = new THREE.MeshStandardMaterial({ color: 0x52525b })
      const fin = new THREE.Mesh(finGeo, finMat)
      fin.position.set(4 + i * 4 - 0.8 + f * 0.8, 1.5, -8)
      scene.add(fin)
    }

    // Cable tray to building
    const pipeGeo = new THREE.CylinderGeometry(0.1, 0.1, 4, 8)
    const pipeMat = new THREE.MeshStandardMaterial({ color: 0x71717a })
    const pipe = new THREE.Mesh(pipeGeo, pipeMat)
    pipe.position.set(4 + i * 4, 4, -6)
    pipe.rotation.x = Math.PI / 2
    scene.add(pipe)
  }

  // Perimeter fence posts
  const postPositions = [
    [-18, 0, -15], [-18, 0, -8], [-18, 0, 0], [-18, 0, 8], [-18, 0, 15],
    [18, 0, -15], [18, 0, -8], [18, 0, 0], [18, 0, 8], [18, 0, 15],
    [-12, 0, -15], [-6, 0, -15], [0, 0, -15], [6, 0, -15], [12, 0, -15],
    [-12, 0, 15], [-6, 0, 15], [0, 0, 15], [6, 0, 15], [12, 0, 15],
  ]
  for (const [x, , z] of postPositions) {
    const postGeo = new THREE.CylinderGeometry(0.08, 0.08, 2.5, 6)
    const postMat = new THREE.MeshStandardMaterial({ color: 0x71717a })
    const post = new THREE.Mesh(postGeo, postMat)
    post.position.set(x, 1.25, z)
    scene.add(post)
  }

  // Fence wireframe
  const fenceLines = [
    [[-18, 2, -15], [18, 2, -15]],
    [[-18, 2, 15], [18, 2, 15]],
    [[-18, 2, -15], [-18, 2, 15]],
    [[18, 2, -15], [18, 2, 15]],
    [[-18, 1, -15], [18, 1, -15]],
    [[-18, 1, 15], [18, 1, 15]],
    [[-18, 1, -15], [-18, 1, 15]],
    [[18, 1, -15], [18, 1, 15]],
  ]
  const lineMat = new THREE.LineBasicMaterial({ color: 0xa1a1aa })
  for (const [start, end] of fenceLines) {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(...(start as [number, number, number])),
      new THREE.Vector3(...(end as [number, number, number])),
    ])
    scene.add(new THREE.Line(geo, lineMat))
  }

  // Grid helper
  const grid = new THREE.GridHelper(60, 30, 0xd4d4d8, 0xe5e7eb)
  grid.position.y = 0.02
  scene.add(grid)
}

function createInstallPoints(
  scene: THREE.Scene,
  points: InstallPoint[],
  clickTargets: THREE.Mesh[]
) {
  for (const point of points) {
    const [x, y, z] = point.position
    const [w, h] = point.size
    const color = STATUS_COLORS[point.status] ?? 0xf97316

    // Dark opening (hole in wall)
    const openingGeo = new THREE.PlaneGeometry(w, h)
    const openingMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a1e,
      side: THREE.DoubleSide,
    })
    const opening = new THREE.Mesh(openingGeo, openingMat)
    opening.position.set(x, y, z)
    if (point.rotation) {
      opening.rotation.set(...point.rotation)
    }
    scene.add(opening)

    // Glowing frame around opening
    const frameGeo = new THREE.EdgesGeometry(new THREE.PlaneGeometry(w + 0.2, h + 0.2))
    const frameMat = new THREE.LineBasicMaterial({ color, linewidth: 2 })
    const frame = new THREE.LineSegments(frameGeo, frameMat)
    frame.position.set(x, y, z + (point.rotation?.[1] === Math.PI ? -0.02 : 0.02))
    if (point.rotation) {
      frame.rotation.set(...point.rotation)
    }
    scene.add(frame)

    // Glowing fill plane (semi-transparent)
    const glowGeo = new THREE.PlaneGeometry(w, h)
    const glowMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: point.status === "in_progress" ? 0.3 : point.status === "completed" ? 0.15 : 0.25,
      side: THREE.DoubleSide,
    })
    const glow = new THREE.Mesh(glowGeo, glowMat)
    glow.position.set(x, y, z + (point.rotation?.[1] === Math.PI ? -0.03 : 0.03))
    if (point.rotation) {
      glow.rotation.set(...point.rotation)
    }
    // Store reference for raycasting
    glow.userData = { pointId: point.id }
    scene.add(glow)
    clickTargets.push(glow)

    // Label sprite
    const canvas = document.createElement("canvas")
    canvas.width = 256
    canvas.height = 80
    const ctx = canvas.getContext("2d")!
    ctx.fillStyle = "rgba(0,0,0,0.7)"
    ctx.roundRect(0, 0, 256, 80, 8)
    ctx.fill()
    ctx.fillStyle = "#ffffff"
    ctx.font = "bold 16px sans-serif"
    const label = point.productDescription.length > 20
      ? point.productDescription.substring(0, 20) + "..."
      : point.productDescription
    ctx.fillText(label, 10, 24)
    ctx.font = "12px sans-serif"
    ctx.fillStyle = "#aaaaaa"
    ctx.fillText(point.label, 10, 44)

    // Status dot
    const dotColor = `#${color.toString(16).padStart(6, "0")}`
    ctx.fillStyle = dotColor
    ctx.beginPath()
    ctx.arc(10, 64, 5, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = "#cccccc"
    ctx.font = "11px sans-serif"
    const statusText = point.status.replace("_", " ")
    ctx.fillText(statusText.charAt(0).toUpperCase() + statusText.slice(1), 22, 68)

    if (point.crewName) {
      ctx.fillText("| " + point.crewName, 110, 68)
    }

    const tex = new THREE.CanvasTexture(canvas)
    const spriteMat = new THREE.SpriteMaterial({ map: tex, transparent: true })
    const sprite = new THREE.Sprite(spriteMat)
    sprite.position.set(x, y + h / 2 + 1, z)
    sprite.scale.set(4, 1.25, 1)
    scene.add(sprite)
  }
}

export default function SiteModelInner({ installPoints, onPointClick }: SiteModelProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const animFrameRef = useRef<number>(0)

  const handleClick = useCallback(
    (event: MouseEvent, camera: THREE.Camera, scene: THREE.Scene, clickTargets: THREE.Mesh[]) => {
      if (!containerRef.current || !onPointClick) return
      const rect = containerRef.current.getBoundingClientRect()
      const mouse = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      )
      const raycaster = new THREE.Raycaster()
      raycaster.setFromCamera(mouse, camera)
      const hits = raycaster.intersectObjects(clickTargets)
      if (hits.length > 0) {
        const pointId = hits[0].object.userData.pointId
        const point = installPoints.find((p) => p.id === pointId)
        if (point) onPointClick(point)
      }
    },
    [installPoints, onPointClick]
  )

  useEffect(() => {
    if (!containerRef.current) return

    const container = containerRef.current
    const width = container.clientWidth
    const height = container.clientHeight

    // Scene
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0xf0f9ff) // sky-50
    scene.fog = new THREE.Fog(0xf0f9ff, 40, 80)

    // Camera
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 200)
    camera.position.set(25, 18, 25)
    camera.lookAt(0, 2, 0)

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    container.appendChild(renderer.domElement)
    rendererRef.current = renderer

    // Lights
    const ambient = new THREE.AmbientLight(0xffffff, 0.6)
    scene.add(ambient)

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0)
    dirLight.position.set(15, 25, 15)
    dirLight.castShadow = true
    dirLight.shadow.mapSize.width = 2048
    dirLight.shadow.mapSize.height = 2048
    dirLight.shadow.camera.near = 0.5
    dirLight.shadow.camera.far = 80
    dirLight.shadow.camera.left = -30
    dirLight.shadow.camera.right = 30
    dirLight.shadow.camera.top = 30
    dirLight.shadow.camera.bottom = -30
    scene.add(dirLight)

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controls.maxPolarAngle = Math.PI / 2.1
    controls.minDistance = 10
    controls.maxDistance = 60
    controls.target.set(0, 2, 0)

    // Build scene
    createSubstation(scene)

    const clickTargets: THREE.Mesh[] = []
    createInstallPoints(scene, installPoints, clickTargets)

    // North arrow
    const arrowGeo = new THREE.ConeGeometry(0.5, 2, 4)
    const arrowMat = new THREE.MeshBasicMaterial({ color: 0xef4444 })
    const arrow = new THREE.Mesh(arrowGeo, arrowMat)
    arrow.position.set(-20, 1, -20)
    arrow.rotation.x = 0
    scene.add(arrow)

    // "N" label
    const nCanvas = document.createElement("canvas")
    nCanvas.width = 64
    nCanvas.height = 64
    const nCtx = nCanvas.getContext("2d")!
    nCtx.fillStyle = "#ef4444"
    nCtx.font = "bold 48px sans-serif"
    nCtx.textAlign = "center"
    nCtx.fillText("N", 32, 48)
    const nTex = new THREE.CanvasTexture(nCanvas)
    const nSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: nTex }))
    nSprite.position.set(-20, 3.5, -20)
    nSprite.scale.set(2, 2, 1)
    scene.add(nSprite)

    // Click handler
    const onClick = (e: MouseEvent) => handleClick(e, camera, scene, clickTargets)
    renderer.domElement.addEventListener("click", onClick)

    // Animation loop
    let pulseTime = 0
    function animate() {
      animFrameRef.current = requestAnimationFrame(animate)
      controls.update()
      pulseTime += 0.02

      // Pulse in_progress openings
      clickTargets.forEach((mesh) => {
        const point = installPoints.find((p) => p.id === mesh.userData.pointId)
        if (point?.status === "in_progress") {
          (mesh.material as THREE.MeshBasicMaterial).opacity = 0.2 + 0.15 * Math.sin(pulseTime * 3)
        } else if (point?.status === "ncr") {
          (mesh.material as THREE.MeshBasicMaterial).opacity = Math.sin(pulseTime * 6) > 0 ? 0.4 : 0.1
        }
      })

      renderer.render(scene, camera)
    }
    animate()

    // Resize handler
    const onResize = () => {
      const w = container.clientWidth
      const h = container.clientHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    window.addEventListener("resize", onResize)

    // Cleanup
    return () => {
      cancelAnimationFrame(animFrameRef.current)
      window.removeEventListener("resize", onResize)
      renderer.domElement.removeEventListener("click", onClick)
      controls.dispose()
      renderer.dispose()
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement)
      }
    }
  }, [installPoints, handleClick])

  return (
    <div
      ref={containerRef}
      className="w-full h-[600px] rounded-xl overflow-hidden border border-gray-200 cursor-grab active:cursor-grabbing"
    />
  )
}
