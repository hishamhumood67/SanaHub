import * as THREE from 'three'

/**
 * Draws silkscreen text, grids and markings into a canvas and returns it as a texture.
 * Everything stays procedural: no image files, no font downloads, works offline.
 * Client-only (uses document); call it from components rendered inside <Canvas>.
 */
export function makeLabelTexture(
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (ctx) draw(ctx, width, height)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  tex.needsUpdate = true
  return tex
}
