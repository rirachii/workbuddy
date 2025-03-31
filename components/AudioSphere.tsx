"use client"

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { noise } from '@/lib/utils/perlin'

interface AudioSphereProps {
  isRecording: boolean
  audioData?: Float32Array
}

const AudioSphere = ({ isRecording, audioData }: AudioSphereProps) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene>()
  const cameraRef = useRef<THREE.PerspectiveCamera>()
  const rendererRef = useRef<THREE.WebGLRenderer>()
  const sphereRef = useRef<THREE.Mesh>()
  const frameIdRef = useRef<number>()
  const timeRef = useRef<number>(0)

  useEffect(() => {
    if (!containerRef.current) return

    // Scene setup
    const scene = new THREE.Scene()
    sceneRef.current = scene

    // Camera setup
    const camera = new THREE.PerspectiveCamera(
      75,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    )
    camera.position.z = 5
    cameraRef.current = camera

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight)
    renderer.setClearColor(0x000000, 0)
    containerRef.current.appendChild(renderer.domElement)
    rendererRef.current = renderer

    // Sphere geometry
    const geometry = new THREE.IcosahedronGeometry(1, 4)
    const material = new THREE.MeshPhongMaterial({
      color: 0x4a9eff,
      shininess: 100,
      specular: 0x4a9eff,
      wireframe: true,
    })
    const sphere = new THREE.Mesh(geometry, material)
    scene.add(sphere)
    sphereRef.current = sphere

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
    scene.add(ambientLight)

    const pointLight = new THREE.PointLight(0xffffff, 1)
    pointLight.position.set(5, 5, 5)
    scene.add(pointLight)

    // Animation function
    const animate = () => {
      timeRef.current += 0.01

      if (sphereRef.current) {
        // Idle animation
        if (!isRecording) {
          const position = sphereRef.current.geometry.getAttribute('position')
          const originalPosition = sphereRef.current.geometry.getAttribute('position').clone()
          
          for (let i = 0; i < position.count; i++) {
            const x = originalPosition.getX(i)
            const y = originalPosition.getY(i)
            const z = originalPosition.getZ(i)
            const length = Math.sqrt(x * x + y * y + z * z)
            
            const noise_val = noise.perlin3(
              x * 1.5 + timeRef.current,
              y * 1.5 + timeRef.current,
              z * 1.5
            ) * 0.3
            
            position.setXYZ(
              i,
              x * (1 + noise_val) / length,
              y * (1 + noise_val) / length,
              z * (1 + noise_val) / length
            )
          }
          position.needsUpdate = true
        }
        
        // Audio reactive animation
        if (isRecording && audioData) {
          const position = sphereRef.current.geometry.getAttribute('position')
          const originalPosition = sphereRef.current.geometry.getAttribute('position').clone()
          
          for (let i = 0; i < position.count; i++) {
            const x = originalPosition.getX(i)
            const y = originalPosition.getY(i)
            const z = originalPosition.getZ(i)
            const length = Math.sqrt(x * x + y * y + z * z)
            
            const strength = audioData[i % audioData.length] * 2
            
            position.setXYZ(
              i,
              x * (1 + strength) / length,
              y * (1 + strength) / length,
              z * (1 + strength) / length
            )
          }
          position.needsUpdate = true
          
          // Color based on audio intensity
          const averageIntensity = audioData.reduce((a, b) => a + Math.abs(b), 0) / audioData.length
          const hue = THREE.MathUtils.lerp(0.6, 0.15, averageIntensity) // Blue to red
          const color = new THREE.Color().setHSL(hue, 1, 0.5)
          ;(sphereRef.current.material as THREE.MeshPhongMaterial).color = color
          ;(sphereRef.current.material as THREE.MeshPhongMaterial).specular = color
        }

        sphereRef.current.rotation.x += 0.001
        sphereRef.current.rotation.y += 0.002
      }

      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current)
      }

      frameIdRef.current = requestAnimationFrame(animate)
    }

    // Start animation
    animate()

    // Handle resize
    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return

      const width = containerRef.current.clientWidth
      const height = containerRef.current.clientHeight

      rendererRef.current.setSize(width, height)
      cameraRef.current.aspect = width / height
      cameraRef.current.updateProjectionMatrix()
    }

    window.addEventListener('resize', handleResize)

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize)
      if (frameIdRef.current) {
        cancelAnimationFrame(frameIdRef.current)
      }
      if (rendererRef.current && containerRef.current) {
        containerRef.current.removeChild(rendererRef.current.domElement)
      }
    }
  }, [isRecording, audioData])

  return (
    <div 
      ref={containerRef} 
      className="w-full h-[300px] flex items-center justify-center"
    />
  )
}

export default AudioSphere 