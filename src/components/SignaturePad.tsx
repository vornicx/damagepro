import { useEffect, useRef, useState } from 'react'
import type { Signature } from '../lib/types'

export function SignaturePad({ label, value, onChange }: { label: string; value?: Signature; onChange: (s: Signature) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [name, setName] = useState(value?.printedName || '')
  const [drawing, setDrawing] = useState(false)

  useEffect(() => {
    const c = canvasRef.current; if (!c) return
    const ctx = c.getContext('2d')!; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.strokeStyle = '#111'
    if (value?.dataUrl) { const img = new Image(); img.onload = () => ctx.drawImage(img, 0, 0, c.width, c.height); img.src = value.dataUrl }
  }, [])

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = canvasRef.current!; const r = c.getBoundingClientRect(); return { x:(e.clientX-r.left)*(c.width/r.width), y:(e.clientY-r.top)*(c.height/r.height) }
  }
  function start(e: React.PointerEvent<HTMLCanvasElement>) { setDrawing(true); const p=pos(e); const ctx=canvasRef.current!.getContext('2d')!; ctx.beginPath(); ctx.moveTo(p.x,p.y); e.currentTarget.setPointerCapture(e.pointerId) }
  function move(e: React.PointerEvent<HTMLCanvasElement>) { if(!drawing)return; const p=pos(e); const ctx=canvasRef.current!.getContext('2d')!; ctx.lineTo(p.x,p.y); ctx.stroke() }
  function end() { if(!drawing)return; setDrawing(false); emit() }
  function emit() { const c=canvasRef.current!; onChange({ printedName:name, dataUrl:c.toDataURL('image/png'), signedAt:new Date().toISOString() }) }
  function clear() { const c=canvasRef.current!; c.getContext('2d')!.clearRect(0,0,c.width,c.height); onChange({ printedName:name, dataUrl:'', signedAt:new Date().toISOString() }) }
  return <div className="signature-card">
    <div className="field-label">{label}</div>
    <input value={name} onChange={e=>{setName(e.target.value)}} onBlur={emit} placeholder="Nombre y apellidos" />
    <canvas ref={canvasRef} width={700} height={220} onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end} />
    <button type="button" className="link-btn" onClick={clear}>Borrar firma</button>
  </div>
}
