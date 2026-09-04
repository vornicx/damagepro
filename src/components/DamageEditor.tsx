import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { compressImage } from '../lib/image'
import type { DamageArea, DamageClassification, DamageRecord, DamageType, Severity } from '../lib/types'
import { VehicleDiagram } from './VehicleDiagram'
import { BlobImage } from './BlobImage'

export function DamageEditor({ value, onChange, allowClassification=false }: { value:DamageRecord[]; onChange:(v:DamageRecord[])=>void; allowClassification?:boolean }) {
  const [area,setArea]=useState<DamageArea>('front')
  const [photoError,setPhotoError]=useState('')
  function add(){ onChange([...value,{id:crypto.randomUUID(), area, type:'scratch', severity:'minor', description:'', classification:allowClassification?'uncertain':undefined}]) }
  function update(id:string, patch:Partial<DamageRecord>){onChange(value.map(d=>d.id===id?{...d,...patch}:d))}
  async function photo(id:string,file?:File){
    if(!file)return
    setPhotoError('')
    try { const blob=await compressImage(file); update(id,{photo:blob,photoName:file.name}) }
    catch (cause) { setPhotoError(cause instanceof Error ? cause.message : 'No se pudo procesar la imagen') }
  }
  return <div>
    <div className="diagram-wrap"><VehicleDiagram selected={area} onSelect={setArea}/><div className="diagram-actions"><span>Zona seleccionada: <strong>{areaLabels[area]}</strong></span><button type="button" onClick={add}><Plus size={16}/> Añadir daño</button></div></div>
    <div className="damage-list">
      {value.length===0 && <div className="empty-inline">No hay daños registrados.</div>}
      {value.map((d,i)=><div className="damage-row" key={d.id}>
        <div className="damage-number">{i+1}</div>
        <div className="grid-4">
          <label>Zona<select value={d.area} onChange={e=>update(d.id,{area:e.target.value as DamageArea})}>{Object.entries(areaLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
          <label>Tipo<select value={d.type} onChange={e=>update(d.id,{type:e.target.value as DamageType})}><option value="scratch">Arañazo</option><option value="dent">Abolladura</option><option value="scuff">Rozadura</option><option value="crack">Grieta</option><option value="stain">Mancha</option><option value="other">Otro</option></select></label>
          <label>Gravedad<select value={d.severity} onChange={e=>update(d.id,{severity:e.target.value as Severity})}><option value="minor">Leve</option><option value="moderate">Moderada</option><option value="severe">Grave</option></select></label>
          {allowClassification && <label>Comparación<select value={d.classification} onChange={e=>update(d.id,{classification:e.target.value as DamageClassification})}><option value="uncertain">Por revisar</option><option value="new">Nuevo</option><option value="pre_existing">Preexistente</option></select></label>}
        </div>
        <textarea placeholder="Descripción del daño" value={d.description} onChange={e=>update(d.id,{description:e.target.value})}/>
        <div className="damage-footer">
          <label className="file-link">{d.photo?'Cambiar foto':'Añadir foto'}<input hidden type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={e=>photo(d.id,e.target.files?.[0])}/></label>
          {d.photo && <BlobImage blob={d.photo} alt={`Daño ${i+1}`}/>} 
          <button type="button" className="icon-danger" aria-label={`Eliminar daño ${i+1}`} onClick={()=>onChange(value.filter(x=>x.id!==d.id))}><Trash2 size={16}/></button>
        </div>
      </div>)}
      {photoError && <p className="field-error" role="alert">{photoError}</p>}
    </div>
  </div>
}

const areaLabels: Record<DamageArea,string> = {
  front:'Frontal', rear:'Trasera', left:'Lateral izquierdo', right:'Lateral derecho',
  interior:'Interior', wheel:'Llanta / rueda', glass:'Cristales', other:'Otra zona'
}
