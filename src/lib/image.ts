/** Límite por foto guardada en Firestore (un documento admite ~1 MB). */
export const MAX_IMAGE_CHARS = 900_000

/**
 * Reduce una foto del móvil (varios MB) a un JPEG de ~100-300 KB para guardarla
 * directamente en Firestore. Respeta la orientación de la cámara.
 */
export async function compressImage(file: Blob, maxSide = 1400): Promise<{ dataUrl: string; width: number; height: number }> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  let side = maxSide
  let quality = 0.72
  for (let attempt = 0; attempt < 6; attempt++) {
    const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height))
    const width = Math.round(bitmap.width * scale)
    const height = Math.round(bitmap.height * scale)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, width, height)
    ctx.drawImage(bitmap, 0, 0, width, height)
    const dataUrl = canvas.toDataURL('image/jpeg', quality)
    if (dataUrl.length <= MAX_IMAGE_CHARS) {
      bitmap.close()
      return { dataUrl, width, height }
    }
    side = Math.round(side * 0.8)
    quality = Math.max(0.5, quality - 0.06)
  }
  bitmap.close()
  throw new Error('La foto es demasiado grande')
}
