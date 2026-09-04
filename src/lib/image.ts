export async function compressImage(file: File, maxDimension = 1800, quality = 0.82): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('El archivo seleccionado no es una imagen')
  if (file.size > 35 * 1024 * 1024) throw new Error('La imagen supera el límite de 35 MB')

  const bitmap = await decodeImage(file)
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap, 0, 0, width, height)
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(b => b ? resolve(b) : reject(new Error('No se pudo comprimir la imagen')), 'image/jpeg', quality)
  })
  bitmap.close()
  return blob
}

async function decodeImage(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new Error('No se pudo leer la imagen. Usa una foto JPG, PNG o WebP.')
  }
}
