'use client'

import { Component, Suspense, useMemo, type ReactNode } from 'react'
import { useGLTF } from '@react-three/drei'
import type { PartId } from '@/simulators/pinCatalog'

/**
 * Optional photoreal GLTF/GLB models. Leave a part undefined to use the built-in procedural model.
 * Put licensed files in /public/models, e.g. esp32: '/models/esp32-devkit.glb'.
 * Do not commit models whose licence you have not checked.
 */
export const MODEL_URLS: Partial<Record<PartId, string>> = {}

class ModelBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

function Gltf({ url, scale }: { url: string; scale: number }) {
  const { scene } = useGLTF(url)
  const clone = useMemo(() => scene.clone(true), [scene])
  return <primitive object={clone} scale={scale} />
}

/** Renders the GLB when a URL is configured and loads; otherwise (or on any load error) the procedural children. */
export function PartModel({ url, scale = 1, children }: { url?: string; scale?: number; children: ReactNode }) {
  if (!url) return <>{children}</>
  return (
    <ModelBoundary fallback={children}>
      <Suspense fallback={children}>
        <Gltf url={url} scale={scale} />
      </Suspense>
    </ModelBoundary>
  )
}
