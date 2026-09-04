import { useEffect, useState } from 'react'

export function BlobImage({ blob, alt, className }: { blob?: Blob; alt: string; className?: string }) {
  const [src, setSrc] = useState('')

  useEffect(() => {
    if (!blob) {
      setSrc('')
      return
    }

    const objectUrl = URL.createObjectURL(blob)
    setSrc(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [blob])

  if (!src) return null
  return <img className={className} src={src} alt={alt} />
}
