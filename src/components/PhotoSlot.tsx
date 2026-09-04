import { useState } from 'react'
import { Camera, Check, Trash2 } from 'lucide-react'
import { compressImage } from '../lib/image'
import type { EvidencePhoto, EvidenceSlot } from '../lib/types'
import { BlobImage } from './BlobImage'

export function PhotoSlot({ slot, label, required=false, value, onChange }: { slot:EvidenceSlot; label:string; required?:boolean; value?:EvidencePhoto; onChange:(v?:EvidencePhoto)=>void }) {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function pick(file?:File) {
    if(!file)return
    setError('')
    setBusy(true)
    try {
      const blob=await compressImage(file)
      onChange({ id:crypto.randomUUID(), slot, blob, fileName:file.name || `${slot}.jpg`, capturedAt:new Date().toISOString() })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo procesar la imagen')
    } finally {
      setBusy(false)
    }
  }
  return <div className={value?'photo-slot complete':'photo-slot'}>
    <div className="photo-head"><div><strong>{label}</strong>{required && <span> · obligatorio</span>}</div>{value && <Check size={17}/>}</div>
    {value ? <div className="photo-preview"><BlobImage blob={value.blob} alt={label}/><button type="button" aria-label={`Eliminar foto: ${label}`} onClick={()=>onChange(undefined)}><Trash2 size={16}/></button></div> : <label className={busy?'photo-upload busy':'photo-upload'}><Camera size={20}/><span>{busy?'Procesando…':'Hacer foto o subir'}</span><input hidden disabled={busy} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={e=>pick(e.target.files?.[0])}/></label>}
    {error && <p className="field-error" role="alert">{error}</p>}
  </div>
}
