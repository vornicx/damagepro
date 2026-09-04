import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Archive, ArrowLeft, Car, ClipboardCheck, Download, FileArchive, Home, Menu, Plus, RotateCcw, Save, Search, Settings as SettingsIcon, ShieldCheck, Trash2, Upload, X } from 'lucide-react'
import { db, ensureSettings } from './lib/db'
import type { CompanySettings, CustomerSnapshot, DamageClassification, DamageRecord, EvidencePhoto, EvidenceSlot, Inspection, InspectionDraft, Signature, Vehicle } from './lib/types'
import { PhotoSlot } from './components/PhotoSlot'
import { DamageEditor } from './components/DamageEditor'
import { SignaturePad } from './components/SignaturePad'
import { compressImage } from './lib/image'
import { BlobImage } from './components/BlobImage'
import { deriveInspectionStatus, inspectionDraftId, isValidReturnOdometer, localDateTimeInputValue } from './lib/inspection'

type View = 'dashboard'|'vehicles'|'inspections'|'settings'|'pickup'|'return'|'detail'|'compare'
const requiredSlots: EvidenceSlot[] = ['front','rear','left','right','interior','dashboard']
const slotLabels: Record<EvidenceSlot,string> = {front:'Frontal',rear:'Trasera',left:'Lateral izquierdo',right:'Lateral derecho',interior:'Interior',dashboard:'Cuadro / odómetro',wheel_fl:'Llanta delantera izq.',wheel_fr:'Llanta delantera der.',wheel_rl:'Llanta trasera izq.',wheel_rr:'Llanta trasera der.'}
const emptySignature=():Signature=>({printedName:'',dataUrl:'',signedAt:new Date().toISOString()})

function downloadBlob(blob:Blob,name:string){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),5000)}

export default function App(){
  const [view,setView]=useState<View>('dashboard')
  const [menu,setMenu]=useState(false)
  const [vehicles,setVehicles]=useState<Vehicle[]>([])
  const [inspections,setInspections]=useState<Inspection[]>([])
  const [settings,setSettings]=useState<CompanySettings>({id:'settings',companyName:'',language:'es',units:'km'})
  const [selectedInspection,setSelectedInspection]=useState<string>()
  const [returnPickupId,setReturnPickupId]=useState<string>()
  const [vehicleModal,setVehicleModal]=useState(false)
  const [editingVehicle,setEditingVehicle]=useState<Vehicle>()
  const [returnPicker,setReturnPicker]=useState(false)
  const [toast,setToast]=useState('')
  const [ready,setReady]=useState(false)
  const [startupError,setStartupError]=useState('')

  async function refresh(){await ensureSettings();const [nextVehicles,nextInspections,nextSettings]=await Promise.all([db.vehicles.toArray(),db.inspections.toArray(),db.settings.get('settings')]);setVehicles(nextVehicles);setInspections(nextInspections.sort((a,b)=>b.inspectedAt.localeCompare(a.inspectedAt)));setSettings(nextSettings!);setReady(true)}
  useEffect(()=>{void refresh().catch(cause=>setStartupError(cause instanceof Error?cause.message:'No se pudo abrir el almacenamiento local'))},[])
  function notice(msg:string){setToast(msg);setTimeout(()=>setToast(''),2600)}

  const selected=inspections.find(i=>i.id===selectedInspection)
  const selectedVehicle=selected?vehicles.find(v=>v.id===selected.vehicleId):undefined
  const activePickups=useMemo(()=>{const returnedIds=new Set(inspections.filter(item=>item.kind==='return').map(item=>item.pickupId));return inspections.filter(item=>item.kind==='pickup'&&!returnedIds.has(item.id))},[inspections])
  function nav(v:View){setView(v);setMenu(false)}
  function beginReturn(id:string){setReturnPicker(false);setReturnPickupId(id);setView('return')}

  if(startupError)return <div className="fatal-state"><AlertTriangle/><h1>No se pudo abrir DAMAGEPRO</h1><p>{startupError}</p><button className="primary" onClick={()=>window.location.reload()}>Reintentar</button></div>
  if(!ready)return <div className="app-loading"><div className="brand-mark">D</div><span>Abriendo DAMAGEPRO…</span></div>

  return <div className="app-shell">
    <aside className={menu?'sidebar open':'sidebar'}>
      <div className="brand"><div className="brand-mark">D</div><div><strong>DAMAGEPRO</strong><span>Vehicle evidence</span></div><button className="mobile-close" aria-label="Cerrar menú" onClick={()=>setMenu(false)}><X size={20}/></button></div>
      <nav>
        <Nav icon={<Home/>} label="Inicio" active={view==='dashboard'} onClick={()=>nav('dashboard')}/>
        <Nav icon={<Car/>} label="Vehículos" active={view==='vehicles'} onClick={()=>nav('vehicles')}/>
        <Nav icon={<ClipboardCheck/>} label="Inspecciones" active={['inspections','detail','compare'].includes(view)} onClick={()=>nav('inspections')}/>
        <Nav icon={<SettingsIcon/>} label="Configuración" active={view==='settings'} onClick={()=>nav('settings')}/>
      </nav>
      <div className="sidebar-foot"><ShieldCheck size={18}/><span>Datos locales<br/><small>Sin servidor externo</small></span></div>
    </aside>
    {menu&&<div className="scrim" onClick={()=>setMenu(false)}/>} 
    <main className="main">
      <header className="topbar"><button className="menu-btn" aria-label="Abrir menú" onClick={()=>setMenu(true)}><Menu size={21}/></button><div>{settings.companyName||'DAMAGEPRO'}</div><div className="local-pill">LOCAL</div></header>
      {view==='dashboard'&&<Dashboard vehicles={vehicles} inspections={inspections} activePickups={activePickups} settings={settings} onPickup={()=>{setReturnPickupId(undefined);setView('pickup')}} onReturn={beginReturn} onReturnRequest={()=>activePickups.length===1?beginReturn(activePickups[0].id):setReturnPicker(true)} onOpen={(id)=>{setSelectedInspection(id);setView('detail')}}/>}
      {view==='vehicles'&&<Vehicles vehicles={vehicles} units={settings.units} onAdd={()=>{setEditingVehicle(undefined);setVehicleModal(true)}} onEdit={v=>{setEditingVehicle(v);setVehicleModal(true)}} onRefresh={refresh} notice={notice}/>} 
      {view==='inspections'&&<Inspections inspections={inspections} vehicles={vehicles} onOpen={id=>{setSelectedInspection(id);setView('detail')}}/>}
      {view==='settings'&&<SettingsPage settings={settings} setSettings={setSettings} refresh={refresh} notice={notice}/>} 
      {view==='pickup'&&<InspectionWizard kind="pickup" vehicles={vehicles} settings={settings} onCancel={()=>setView('dashboard')} onSaved={async(id)=>{await refresh();setSelectedInspection(id);setView('detail')}}/>}
      {view==='return'&&returnPickupId&&<InspectionWizard kind="return" vehicles={vehicles} settings={settings} pickup={inspections.find(i=>i.id===returnPickupId)} onCancel={()=>setView('dashboard')} onSaved={async(id)=>{await refresh();setSelectedInspection(id);setView('compare')}}/>}
      {view==='detail'&&selected&&selectedVehicle&&<InspectionDetail inspection={selected} vehicle={selectedVehicle} settings={settings} relatedReturn={selected.kind==='pickup'?inspections.find(r=>r.pickupId===selected.id):undefined} onBack={()=>setView('inspections')} onReturn={()=>beginReturn(selected.id)} onCompare={()=>setView('compare')} notice={notice}/>} 
      {view==='compare'&&selected&&selectedVehicle&&<CompareView pickup={selected.kind==='return'?inspections.find(i=>i.id===selected.pickupId):selected} ret={selected.kind==='return'?selected:inspections.find(i=>i.pickupId===selected.id)} vehicle={selectedVehicle} settings={settings} onBack={()=>setView('detail')} onUpdated={async()=>{await refresh();notice('Clasificación guardada')}} notice={notice}/>} 
    </main>
    {vehicleModal&&<VehicleModal vehicle={editingVehicle} onClose={()=>setVehicleModal(false)} onSaved={async()=>{setVehicleModal(false);await refresh();notice('Vehículo guardado')}}/>}
    {returnPicker&&<ReturnPickerModal pickups={activePickups} vehicles={vehicles} onClose={()=>setReturnPicker(false)} onSelect={beginReturn}/>} 
    {toast&&<div className="toast">{toast}</div>}
  </div>
}

function Nav({icon,label,active,onClick}:{icon:React.ReactNode,label:string,active:boolean,onClick:()=>void}){return <button className={active?'nav-item active':'nav-item'} onClick={onClick}>{icon}<span>{label}</span></button>}

function PageHead({title,subtitle,action}:{title:string,subtitle?:string,action?:React.ReactNode}){return <div className="page-head"><div><h1>{title}</h1>{subtitle&&<p>{subtitle}</p>}</div>{action}</div>}

function Dashboard({vehicles,inspections,activePickups,settings,onPickup,onReturn,onReturnRequest,onOpen}:{vehicles:Vehicle[],inspections:Inspection[],activePickups:Inspection[],settings:CompanySettings,onPickup:()=>void,onReturn:(id:string)=>void,onReturnRequest:()=>void,onOpen:(id:string)=>void}){
  return <section className="page"><PageHead title="Operaciones" subtitle="Documenta cada entrega y devolución con evidencia estructurada."/>
    <div className="primary-actions"><button className="primary big" onClick={onPickup}><Plus size={19}/>Nueva entrega</button><button className="secondary big" onClick={onReturnRequest} disabled={!activePickups.length}><RotateCcw size={19}/>Registrar devolución</button></div>
    <div className="stats-line"><div><span>Vehículos activos</span><strong>{vehicles.filter(v=>!v.archived).length}</strong></div><div><span>Entregas abiertas</span><strong>{activePickups.length}</strong></div><div><span>Inspecciones</span><strong>{inspections.length}</strong></div><div><span>Último backup</span><strong className="small-stat">{settings.lastBackupAt?new Date(settings.lastBackupAt).toLocaleDateString():'Pendiente'}</strong></div></div>
    <section className="section-block"><div className="section-title"><h2>Entregas abiertas</h2><span>{activePickups.length}</span></div>{activePickups.length===0?<Empty text="No hay vehículos pendientes de devolución."/>:<div className="rows">{activePickups.map(i=><InspectionRow key={i.id} i={i} vehicles={vehicles} onClick={()=>onOpen(i.id)} extra={<button className="secondary small" onClick={e=>{e.stopPropagation();onReturn(i.id)}}>Devolver</button>}/>)}</div>}</section>
    <section className="section-block"><div className="section-title"><h2>Actividad reciente</h2></div>{inspections.length===0?<Empty text="Tu primera inspección aparecerá aquí."/>:<div className="rows">{inspections.slice(0,6).map(i=><InspectionRow key={i.id} i={i} vehicles={vehicles} onClick={()=>onOpen(i.id)}/>)}</div>}</section>
  </section>
}

function Vehicles({vehicles,units,onAdd,onEdit,onRefresh,notice}:{vehicles:Vehicle[],units:CompanySettings['units'],onAdd:()=>void,onEdit:(v:Vehicle)=>void,onRefresh:()=>Promise<void>,notice:(s:string)=>void}){
  const [q,setQ]=useState('');const filtered=vehicles.filter(v=>`${v.plate} ${v.make} ${v.model}`.toLowerCase().includes(q.toLowerCase()))
  async function archive(v:Vehicle){await db.vehicles.update(v.id,{archived:!v.archived,updatedAt:new Date().toISOString()});await onRefresh();notice(v.archived?'Vehículo reactivado':'Vehículo archivado')}
  return <section className="page"><PageHead title="Vehículos" subtitle="Flota disponible en este dispositivo." action={<button className="primary" onClick={onAdd}><Plus size={17}/>Añadir vehículo</button>}/><div className="search"><Search size={18}/><input placeholder="Buscar matrícula, marca o modelo" value={q} onChange={e=>setQ(e.target.value)}/></div>
    {filtered.length===0?<Empty text={q?'No hay vehículos que coincidan con la búsqueda.':'No hay vehículos que mostrar.'}/>:<div className="table-wrap"><table><thead><tr><th>Matrícula</th><th>Vehículo</th><th>Año</th><th>{units==='km'?'Km':'Millas'}</th><th>Estado</th><th></th></tr></thead><tbody>{filtered.map(v=><tr key={v.id}><td><strong>{v.plate}</strong></td><td>{v.make} {v.model}<small>{v.color}</small></td><td>{v.year}</td><td>{v.odometer.toLocaleString()}</td><td>{v.archived?'Archivado':'Activo'}</td><td className="actions"><button onClick={()=>onEdit(v)}>Editar</button><button aria-label={v.archived?'Reactivar vehículo':'Archivar vehículo'} onClick={()=>archive(v)}><Archive size={15}/></button></td></tr>)}</tbody></table></div>}
  </section>
}

function VehicleModal({vehicle,onClose,onSaved}:{vehicle?:Vehicle,onClose:()=>void,onSaved:()=>void}){
  const [form,setForm]=useState({plate:vehicle?.plate||'',make:vehicle?.make||'',model:vehicle?.model||'',year:vehicle?.year||new Date().getFullYear(),color:vehicle?.color||'',vin:vehicle?.vin||'',odometer:vehicle?.odometer||0,notes:vehicle?.notes||''})
  const [error,setError]=useState('')
  async function save(e:React.FormEvent){e.preventDefault();setError('');const plate=form.plate.trim().toUpperCase();const duplicate=await db.vehicles.where('plate').equalsIgnoreCase(plate).first();if(duplicate&&duplicate.id!==vehicle?.id){setError('Ya existe un vehículo con esta matrícula.');return}const now=new Date().toISOString();await db.vehicles.put({id:vehicle?.id||crypto.randomUUID(),...form,plate,make:form.make.trim(),model:form.model.trim(),color:form.color.trim(),vin:form.vin.trim(),year:Number(form.year),odometer:Number(form.odometer),archived:vehicle?.archived||false,createdAt:vehicle?.createdAt||now,updatedAt:now});onSaved()}
  return <div className="modal" role="dialog" aria-modal="true" aria-labelledby="vehicle-modal-title"><div className="modal-card"><div className="modal-head"><h2 id="vehicle-modal-title">{vehicle?'Editar vehículo':'Nuevo vehículo'}</h2><button aria-label="Cerrar" onClick={onClose}><X/></button></div><form onSubmit={save} className="form-grid"><label>Matrícula<input required autoFocus value={form.plate} onChange={e=>setForm({...form,plate:e.target.value})}/></label><label>Marca<input required value={form.make} onChange={e=>setForm({...form,make:e.target.value})}/></label><label>Modelo<input required value={form.model} onChange={e=>setForm({...form,model:e.target.value})}/></label><label>Año<input required type="number" min="1900" max={new Date().getFullYear()+1} value={form.year} onChange={e=>setForm({...form,year:Number(e.target.value)})}/></label><label>Color<input required value={form.color} onChange={e=>setForm({...form,color:e.target.value})}/></label><label>VIN (opcional)<input value={form.vin} onChange={e=>setForm({...form,vin:e.target.value})}/></label><label>Odómetro<input required type="number" min="0" value={form.odometer} onChange={e=>setForm({...form,odometer:Number(e.target.value)})}/></label><label className="full">Notas<textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></label>{error&&<p className="field-error full" role="alert">{error}</p>}<div className="modal-actions full"><button type="button" className="secondary" onClick={onClose}>Cancelar</button><button className="primary">Guardar vehículo</button></div></form></div></div>
}

function ReturnPickerModal({pickups,vehicles,onClose,onSelect}:{pickups:Inspection[],vehicles:Vehicle[],onClose:()=>void,onSelect:(id:string)=>void}){
  return <div className="modal" role="dialog" aria-modal="true" aria-labelledby="return-picker-title"><div className="modal-card return-picker"><div className="modal-head"><div><h2 id="return-picker-title">Seleccionar entrega</h2><p>Elige el vehículo que está regresando.</p></div><button aria-label="Cerrar" onClick={onClose}><X/></button></div><div className="return-options">{pickups.map(pickup=>{const vehicle=vehicles.find(item=>item.id===pickup.vehicleId);return <button key={pickup.id} onClick={()=>onSelect(pickup.id)}><div><strong>{vehicle?`${vehicle.make} ${vehicle.model}`:'Vehículo no disponible'}</strong><span>{vehicle?.plate} · {pickup.customer.fullName}</span></div><div><span>{pickup.reservationRef}</span><small>{new Date(pickup.inspectedAt).toLocaleDateString()}</small></div></button>})}</div></div></div>
}

function Inspections({inspections,vehicles,onOpen}:{inspections:Inspection[],vehicles:Vehicle[],onOpen:(id:string)=>void}){
  const [q,setQ]=useState('');const filtered=inspections.filter(i=>{const v=vehicles.find(v=>v.id===i.vehicleId);return `${i.reservationRef} ${i.customer.fullName} ${v?.plate||''}`.toLowerCase().includes(q.toLowerCase())})
  return <section className="page"><PageHead title="Inspecciones" subtitle="Historial local de entregas, devoluciones y expedientes."/><div className="search"><Search size={18}/><input placeholder="Buscar cliente, matrícula o reserva" value={q} onChange={e=>setQ(e.target.value)}/></div>{filtered.length===0?<Empty text={q?'No hay inspecciones que coincidan con la búsqueda.':'Todavía no hay inspecciones.'}/>:<div className="rows">{filtered.map(i=><InspectionRow key={i.id} i={i} vehicles={vehicles} onClick={()=>onOpen(i.id)}/>)}</div>}</section>
}

function InspectionRow({i,vehicles,onClick,extra}:{i:Inspection,vehicles:Vehicle[],onClick:()=>void,extra?:React.ReactNode}){const v=vehicles.find(v=>v.id===i.vehicleId);return <div className="inspection-row" role="button" tabIndex={0} onClick={onClick} onKeyDown={event=>{if(event.target===event.currentTarget&&(event.key==='Enter'||event.key===' ')){event.preventDefault();onClick()}}}><div className="row-status">{i.kind==='pickup'?'OUT':'IN'}</div><div className="row-main"><strong>{v?`${v.make} ${v.model}`:'Vehículo'} <span>· {v?.plate}</span></strong><p>{i.customer.fullName} · {i.reservationRef}</p></div><div className="row-date">{new Date(i.inspectedAt).toLocaleDateString()}<small>{new Date(i.inspectedAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</small></div>{extra}</div>}

function Empty({text}:{text:string}){return <div className="empty"><ClipboardCheck size={24}/><p>{text}</p></div>}

function SettingsPage({settings,setSettings,refresh,notice}:{settings:CompanySettings,setSettings:(s:CompanySettings)=>void,refresh:()=>void,notice:(s:string)=>void}){
  const [busy,setBusy]=useState(false)
  const [settingsError,setSettingsError]=useState('')
  async function save(){setSettingsError('');try{await db.settings.put(settings);notice('Configuración guardada')}catch(cause){setSettingsError(cause instanceof Error?cause.message:'No se pudo guardar la configuración')}}
  async function logo(file?:File){if(!file)return;setSettingsError('');try{const b=await compressImage(file,800,.9);setSettings({...settings,logo:b})}catch(cause){setSettingsError(cause instanceof Error?cause.message:'No se pudo procesar el logo')}}
  async function backup(){setBusy(true);try{const {exportBackup}=await import('./lib/backup');const blob=await exportBackup();downloadBlob(blob,`DAMAGEPRO_backup_${new Date().toISOString().slice(0,10)}.zip`);const updated={...settings,lastBackupAt:new Date().toISOString()};await db.settings.put(updated);setSettings(updated);notice('Backup exportado')}catch(cause){alert(cause instanceof Error?cause.message:'No se pudo crear el backup')}finally{setBusy(false)}}
  async function restore(file?:File){if(!file)return;if(!confirm('Esto reemplazará los datos locales actuales. ¿Continuar?'))return;setBusy(true);try{const {restoreBackup}=await import('./lib/backup');const manifest=await restoreBackup(file);await refresh();notice(`Backup restaurado: ${manifest.inspectionCount} inspecciones`)}catch(cause){alert(cause instanceof Error?cause.message:'No se pudo restaurar')}finally{setBusy(false)}}
  return <section className="page narrow"><PageHead title="Configuración" subtitle="Identidad, idioma y control de tus datos."/>
    <div className="settings-section"><h2>Empresa</h2><label>Nombre de empresa<input value={settings.companyName} onChange={e=>setSettings({...settings,companyName:e.target.value})} placeholder="Ej. Costa Rent Cars"/></label><label>Empleado habitual<input value={settings.defaultEmployeeName||''} onChange={e=>setSettings({...settings,defaultEmployeeName:e.target.value})} placeholder="Se rellenará en nuevas inspecciones"/></label><div className="logo-line">{settings.logo?<BlobImage blob={settings.logo} alt="Logo de empresa"/>:<div className="logo-placeholder">Logo</div>}<label className="secondary file-btn"><Upload size={16}/>Subir logo<input hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>logo(e.target.files?.[0])}/></label></div><div className="grid-2"><label>Idioma de documentos<select value={settings.language} onChange={e=>setSettings({...settings,language:e.target.value as CompanySettings['language']})}><option value="es">Español</option><option value="en">English</option></select></label><label>Unidad de registro<select value={settings.units} onChange={e=>setSettings({...settings,units:e.target.value as CompanySettings['units']})}><option value="km">Kilómetros</option><option value="mi">Millas</option></select></label></div>{settingsError&&<p className="field-error" role="alert">{settingsError}</p>}<button className="primary" onClick={save}>Guardar configuración</button></div>
    <div className="settings-section"><h2>Backup y restauración</h2><p>Guarda una copia completa de vehículos, inspecciones, fotos y firmas.</p><div className="settings-actions"><button className="secondary" onClick={backup} disabled={busy}><Download size={17}/>Exportar backup</button><label className="secondary file-btn"><Upload size={17}/>Restaurar backup<input hidden type="file" accept=".zip,application/zip" onChange={e=>restore(e.target.files?.[0])}/></label></div></div>
    <div className="privacy-box"><ShieldCheck/><div><strong>Privacidad local</strong><p>Tus datos permanecen en este dispositivo. DAMAGEPRO no requiere cuenta ni envía tus inspecciones a nuestros servidores.</p></div></div>
  </section>
}

function InspectionWizard({kind,vehicles,settings,pickup,onCancel,onSaved}:{kind:'pickup'|'return',vehicles:Vehicle[],settings:CompanySettings,pickup?:Inspection,onCancel:()=>void,onSaved:(id:string)=>void}){
  const initialVehicleId=pickup?.vehicleId||vehicles.find(v=>!v.archived)?.id||''
  const initialVehicle=vehicles.find(v=>v.id===initialVehicleId)
  const draftKey=inspectionDraftId(kind,pickup?.id)
  const [step,setStep]=useState(1)
  const [dirty,setDirty]=useState(false)
  const [draftReady,setDraftReady]=useState(false)
  const [draftState,setDraftState]=useState<'idle'|'saving'|'saved'|'error'>('idle')
  const [restoredAt,setRestoredAt]=useState('')
  const [saving,setSaving]=useState(false)
  const [formError,setFormError]=useState('')
  const [vehicleId,setVehicleId]=useState(initialVehicleId)
  const [customer,setCustomer]=useState<CustomerSnapshot>(pickup?{...pickup.customer}:{fullName:'',email:'',phone:''})
  const [reservationRef,setReservationRef]=useState(pickup?.reservationRef||'')
  const [employeeName,setEmployeeName]=useState(settings.defaultEmployeeName||'')
  const [inspectedAt,setInspectedAt]=useState(localDateTimeInputValue())
  const [odometer,setOdometer]=useState(pickup?.odometer??initialVehicle?.odometer??0)
  const [fuelPercent,setFuelPercent]=useState(pickup?.fuelPercent??100)
  const [evidence,setEvidence]=useState<EvidencePhoto[]>([])
  const [damages,setDamages]=useState<DamageRecord[]>([])
  const [customerSignature,setCustomerSignature]=useState<Signature>(emptySignature())
  const [employeeSignature,setEmployeeSignature]=useState<Signature>(emptySignature())
  const vehicle=vehicles.find(v=>v.id===vehicleId)
  const missing=requiredSlots.filter(slot=>!evidence.some(photo=>photo.slot===slot))
  const odometerInvalid=kind==='return'&&!isValidReturnOdometer(odometer,pickup?.odometer)

  function currentDraft():InspectionDraft{return {id:draftKey,kind,pickupId:pickup?.id,step,vehicleId,customer,reservationRef,employeeName,inspectedAt,odometer,fuelPercent,evidence,damages,customerSignature,employeeSignature,updatedAt:new Date().toISOString()}}
  async function persistDraft(){if(!draftReady||!dirty)return true;setDraftState('saving');try{await db.drafts.put(currentDraft());setDraftState('saved');return true}catch{setDraftState('error');return false}}

  useEffect(()=>{let active=true;void db.drafts.get(draftKey).then(draft=>{if(!active)return;if(draft){setStep(Math.min(5,Math.max(1,draft.step)));setVehicleId(draft.vehicleId);setCustomer(draft.customer);setReservationRef(draft.reservationRef);setEmployeeName(draft.employeeName);setInspectedAt(draft.inspectedAt);setOdometer(draft.odometer);setFuelPercent(draft.fuelPercent);setEvidence(draft.evidence);setDamages(draft.damages);setCustomerSignature(draft.customerSignature);setEmployeeSignature(draft.employeeSignature);setRestoredAt(draft.updatedAt)}setDraftReady(true)}).catch(()=>{setDraftState('error');setDraftReady(true)});return()=>{active=false}},[draftKey])
  useEffect(()=>{if(!draftReady||!dirty)return;setDraftState('saving');const timer=window.setTimeout(()=>{void persistDraft()},450);return()=>window.clearTimeout(timer)},[draftReady,dirty,step,vehicleId,customer,reservationRef,employeeName,inspectedAt,odometer,fuelPercent,evidence,damages,customerSignature,employeeSignature])
  useEffect(()=>{const fn=(event:BeforeUnloadEvent)=>{if(dirty&&draftState!=='saved'){event.preventDefault();event.returnValue=''}};window.addEventListener('beforeunload',fn);return()=>window.removeEventListener('beforeunload',fn)},[dirty,draftState])

  function changed(){setDirty(true);setDraftState('saving');setFormError('')}
  function mark<T>(setter:(value:T)=>void,value:T){setter(value);changed()}
  function changeVehicle(id:string){setVehicleId(id);setOdometer(vehicles.find(item=>item.id===id)?.odometer||0);changed()}
  function updatePhoto(photo?:EvidencePhoto,slot?:EvidenceSlot){changed();setEvidence(previous=>{const remaining=previous.filter(item=>item.slot!==slot);return photo?[...remaining,photo]:remaining})}
  function changeStep(next:number){setStep(next);changed()}
  function validStep(){if(step===1)return !!vehicleId&&!!customer.fullName.trim()&&!!reservationRef.trim()&&!!employeeName.trim()&&!!inspectedAt&&!odometerInvalid;if(step===2)return missing.length===0;if(step===4)return !!customerSignature.printedName.trim()&&!!customerSignature.dataUrl&&!!employeeSignature.printedName.trim()&&!!employeeSignature.dataUrl;return true}
  async function save(){
    if(!vehicle||saving)return
    if(kind==='return'&&!pickup){setFormError('No se encontró la entrega original.');return}
    setSaving(true);setFormError('')
    try{
      const now=new Date().toISOString();const id=crypto.randomUUID()
      const inspection:Inspection={id,kind,status:deriveInspectionStatus(kind,damages),pickupId:kind==='return'?pickup?.id:undefined,vehicleId,customer:{fullName:customer.fullName.trim(),email:customer.email?.trim(),phone:customer.phone?.trim()},reservationRef:reservationRef.trim(),employeeName:employeeName.trim(),inspectedAt:new Date(inspectedAt).toISOString(),odometer:Number(odometer),fuelPercent:Number(fuelPercent),evidence,damages,customerSignature,employeeSignature,createdAt:now,updatedAt:now}
      await db.transaction('rw',db.inspections,db.vehicles,db.drafts,async()=>{await db.inspections.put(inspection);await db.vehicles.update(vehicleId,{odometer:Math.max(vehicle.odometer,Number(odometer)),updatedAt:now});await db.drafts.delete(draftKey)})
      setDirty(false);onSaved(id)
    }catch(cause){setFormError(cause instanceof Error?`No se pudo guardar: ${cause.message}`:'No se pudo guardar la inspección. El borrador se conserva.');setDraftState('error')}
    finally{setSaving(false)}
  }
  async function cancel(){const saved=await persistDraft();if(!saved&&!confirm('El borrador no se pudo guardar. ¿Salir y perder los cambios?'))return;onCancel()}
  async function discard(){if(!confirm('Se eliminará este borrador y sus fotos. ¿Continuar?'))return;await db.drafts.delete(draftKey);setDirty(false);onCancel()}

  return <section className="page wizard-page"><div className="wizard-top"><button className="back" onClick={()=>void cancel()}><ArrowLeft size={18}/>Salir</button><div><strong>{kind==='pickup'?'Nueva entrega':'Registrar devolución'}</strong><span>{vehicle?`${vehicle.make} ${vehicle.model} · ${vehicle.plate}`:''}</span></div><div className="step-count">{step}/5</div></div>
    <div className={`draft-bar ${draftState}`}>{draftState==='error'?<AlertTriangle size={15}/>:<Save size={15}/>}<span>{draftState==='saving'?'Guardando borrador…':draftState==='error'?'No se pudo guardar el borrador':restoredAt&&!dirty?`Borrador recuperado · ${new Date(restoredAt).toLocaleString()}`:draftState==='saved'?'Borrador guardado':'Los cambios se guardan automáticamente'}</span>{(restoredAt||dirty)&&<button type="button" onClick={()=>void discard()}><Trash2 size={14}/>Descartar</button>}</div>
    <div className="stepper">{[1,2,3,4,5].map(n=><div key={n} className={n<=step?'step done':'step'}><span>{n}</span><small>{['Contexto','Evidencia','Daños','Firmas','Revisar'][n-1]}</small></div>)}</div>
    <div className="wizard-card">
      {step===1&&<><ContextStep vehicles={vehicles} vehicleId={vehicleId} setVehicleId={changeVehicle} customer={customer} setCustomer={v=>mark(setCustomer,v)} reservationRef={reservationRef} setReservationRef={v=>mark(setReservationRef,v)} employeeName={employeeName} setEmployeeName={v=>mark(setEmployeeName,v)} inspectedAt={inspectedAt} setInspectedAt={v=>mark(setInspectedAt,v)} odometer={odometer} setOdometer={v=>mark(setOdometer,v)} fuelPercent={fuelPercent} setFuelPercent={v=>mark(setFuelPercent,v)} kind={kind} units={settings.units}/>{odometerInvalid&&<p className="field-error" role="alert">El odómetro no puede ser inferior al registrado en la entrega ({pickup?.odometer.toLocaleString()} {settings.units}).</p>}</>} 
      {step===2&&<EvidenceStep evidence={evidence} updatePhoto={updatePhoto}/>} 
      {step===3&&<><div className="step-intro"><h2>{kind==='pickup'?'Daños existentes':'Estado a la devolución'}</h2><p>{kind==='pickup'?'Registra cualquier desperfecto que ya exista antes de entregar el vehículo.':'Registra desperfectos y clasifica si son nuevos, preexistentes o dudosos.'}</p></div><DamageEditor value={damages} onChange={value=>mark(setDamages,value)} allowClassification={kind==='return'}/></>}
      {step===4&&<><div className="step-intro"><h2>Firmas</h2><p>Las firmas confirman la revisión y la exactitud de los datos registrados en el momento de la inspección.</p></div><div className="signatures"><SignaturePad label="Cliente" value={customerSignature} onChange={signature=>mark(setCustomerSignature,signature)}/><SignaturePad label="Empleado" value={employeeSignature} onChange={signature=>mark(setEmployeeSignature,signature)}/></div></>}
      {step===5&&<Review vehicle={vehicle} customer={customer} reservationRef={reservationRef} employeeName={employeeName} inspectedAt={inspectedAt} odometer={odometer} fuelPercent={fuelPercent} evidence={evidence} damages={damages} units={settings.units}/>} 
      {formError&&<p className="save-error" role="alert"><AlertTriangle size={16}/>{formError}</p>}
    </div>
    <div className="wizard-footer"><button className="secondary" disabled={step===1||saving} onClick={()=>changeStep(step-1)}>Anterior</button>{step<5?<button className="primary" disabled={!validStep()||saving} onClick={()=>changeStep(step+1)}>Continuar</button>:<button className="primary" disabled={saving} onClick={()=>void save()}>{saving?'Guardando…':'Guardar inspección'}</button>}</div>
  </section>
}

function ContextStep({vehicles,vehicleId,setVehicleId,customer,setCustomer,reservationRef,setReservationRef,employeeName,setEmployeeName,inspectedAt,setInspectedAt,odometer,setOdometer,fuelPercent,setFuelPercent,kind,units}:{vehicles:Vehicle[],vehicleId:string,setVehicleId:(v:string)=>void,customer:CustomerSnapshot,setCustomer:(v:CustomerSnapshot)=>void,reservationRef:string,setReservationRef:(v:string)=>void,employeeName:string,setEmployeeName:(v:string)=>void,inspectedAt:string,setInspectedAt:(v:string)=>void,odometer:number,setOdometer:(v:number)=>void,fuelPercent:number,setFuelPercent:(v:number)=>void,kind:'pickup'|'return',units:CompanySettings['units']}){return <><div className="step-intro"><h2>{kind==='pickup'?'Datos de la entrega':'Datos de la devolución'}</h2><p>Identifica vehículo, cliente y contrato antes de capturar la evidencia.</p></div><div className="form-grid"><label className="full">Vehículo<select required value={vehicleId} onChange={e=>setVehicleId(e.target.value)} disabled={kind==='return'}><option value="">Selecciona vehículo</option>{vehicles.filter(v=>!v.archived||v.id===vehicleId).map(v=><option key={v.id} value={v.id}>{v.plate} · {v.make} {v.model}</option>)}</select></label><label>Cliente<input required value={customer.fullName} onChange={e=>setCustomer({...customer,fullName:e.target.value})}/></label><label>Reserva / contrato<input required value={reservationRef} onChange={e=>setReservationRef(e.target.value)}/></label><label>Email (opcional)<input type="email" value={customer.email||''} onChange={e=>setCustomer({...customer,email:e.target.value})}/></label><label>Teléfono (opcional)<input value={customer.phone||''} onChange={e=>setCustomer({...customer,phone:e.target.value})}/></label><label>Empleado<input required value={employeeName} onChange={e=>setEmployeeName(e.target.value)}/></label><label>Fecha y hora<input required type="datetime-local" value={inspectedAt} onChange={e=>setInspectedAt(e.target.value)}/></label><label>Odómetro ({units})<input required type="number" min="0" value={odometer} onChange={e=>setOdometer(Number(e.target.value))}/></label><label>Combustible: {fuelPercent}%<input type="range" min="0" max="100" step="5" value={fuelPercent} onChange={e=>setFuelPercent(Number(e.target.value))}/></label></div></>}

function EvidenceStep({evidence,updatePhoto}:{evidence:EvidencePhoto[],updatePhoto:(p?:EvidencePhoto,s?:EvidenceSlot)=>void}){const wheels:EvidenceSlot[]=['wheel_fl','wheel_fr','wheel_rl','wheel_rr'];return <><div className="step-intro"><h2>Evidencia guiada</h2><p>Completa las seis vistas obligatorias. En móvil puedes abrir directamente la cámara.</p></div><div className="photo-grid">{requiredSlots.map(s=><PhotoSlot key={s} slot={s} label={slotLabels[s]} required value={evidence.find(p=>p.slot===s)} onChange={p=>updatePhoto(p,s)}/>)}{wheels.map(s=><PhotoSlot key={s} slot={s} label={slotLabels[s]} value={evidence.find(p=>p.slot===s)} onChange={p=>updatePhoto(p,s)}/>)}</div></>}

function Review({vehicle,customer,reservationRef,employeeName,inspectedAt,odometer,fuelPercent,evidence,damages,units}:{vehicle?:Vehicle,customer:CustomerSnapshot,reservationRef:string,employeeName:string,inspectedAt:string,odometer:number,fuelPercent:number,evidence:EvidencePhoto[],damages:DamageRecord[],units:CompanySettings['units']}){return <><div className="step-intro"><h2>Revisar y guardar</h2><p>Comprueba los datos antes de cerrar la inspección.</p></div><div className="review-grid"><div><span>Vehículo</span><strong>{vehicle?`${vehicle.make} ${vehicle.model} · ${vehicle.plate}`:'—'}</strong></div><div><span>Cliente</span><strong>{customer.fullName}</strong></div><div><span>Reserva</span><strong>{reservationRef}</strong></div><div><span>Empleado</span><strong>{employeeName}</strong></div><div><span>Fecha</span><strong>{new Date(inspectedAt).toLocaleString()}</strong></div><div><span>Odómetro</span><strong>{odometer.toLocaleString()} {units}</strong></div><div><span>Combustible</span><strong>{fuelPercent}%</strong></div><div><span>Evidencias</span><strong>{evidence.length}</strong></div><div><span>Daños</span><strong>{damages.length}</strong></div></div><div className="review-note"><ShieldCheck/><p>Al guardar, la inspección quedará almacenada únicamente en este dispositivo hasta que la exportes o hagas un backup.</p></div></>}

function InspectionDetail({inspection,vehicle,settings,relatedReturn,onBack,onReturn,onCompare,notice}:{inspection:Inspection,vehicle:Vehicle,settings:CompanySettings,relatedReturn?:Inspection,onBack:()=>void,onReturn:()=>void,onCompare:()=>void,notice:(s:string)=>void}){
  async function pdf(){const {inspectionPdf}=await import('./lib/pdf');downloadBlob(await inspectionPdf(inspection,vehicle,settings),`${inspection.kind}_${vehicle.plate}_${inspection.reservationRef}.pdf`);notice('PDF generado')}
  return <section className="page"><button className="back" onClick={onBack}><ArrowLeft size={18}/>Inspecciones</button><PageHead title={inspection.kind==='pickup'?'Entrega':'Devolución'} subtitle={`${vehicle.make} ${vehicle.model} · ${vehicle.plate}`} action={<div className="head-actions"><button className="secondary" onClick={pdf}><Download size={16}/>PDF</button>{inspection.kind==='pickup'&&!relatedReturn&&<button className="primary" onClick={onReturn}><RotateCcw size={16}/>Registrar devolución</button>}{(inspection.kind==='return'||relatedReturn)&&<button className="primary" onClick={onCompare}>Comparar</button>}</div>}/><div className="detail-meta"><div><span>Cliente</span><strong>{inspection.customer.fullName}</strong></div><div><span>Reserva</span><strong>{inspection.reservationRef}</strong></div><div><span>Fecha</span><strong>{new Date(inspection.inspectedAt).toLocaleString()}</strong></div><div><span>Odómetro</span><strong>{inspection.odometer.toLocaleString()} {settings.units}</strong></div><div><span>Combustible</span><strong>{inspection.fuelPercent}%</strong></div><div><span>Empleado</span><strong>{inspection.employeeName}</strong></div></div><section className="section-block"><div className="section-title"><h2>Evidencia</h2><span>{inspection.evidence.length}</span></div><div className="evidence-gallery">{inspection.evidence.map(photo=><figure key={photo.id}><BlobImage blob={photo.blob} alt={slotLabels[photo.slot]}/><figcaption>{slotLabels[photo.slot]}</figcaption></figure>)}</div></section><section className="section-block"><div className="section-title"><h2>Daños</h2><span>{inspection.damages.length}</span></div>{inspection.damages.length===0?<Empty text="No se registraron daños."/>:<div className="damage-summary">{inspection.damages.map((damage,index)=><div key={damage.id}>{damage.photo&&<BlobImage blob={damage.photo} alt={`Foto del daño ${index+1}`}/>}<strong>{damage.area} · {damage.type}</strong><span>{damage.severity}{damage.classification?` · ${damage.classification}`:''}</span><p>{damage.description||'Sin descripción'}</p></div>)}</div>}</section></section>
}

function CompareView({pickup,ret,vehicle,settings,onBack,onUpdated,notice}:{pickup?:Inspection,ret?:Inspection,vehicle:Vehicle,settings:CompanySettings,onBack:()=>void,onUpdated:()=>void,notice:(s:string)=>void}){
  if(!pickup||!ret)return <section className="page"><button className="back" onClick={onBack}><ArrowLeft size={18}/>Volver</button><Empty text="Todavía no hay una pareja entrega/devolución para comparar."/></section>
  const pickupInspection=pickup
  const returnInspection=ret
  async function classify(id:string,value:DamageClassification){const nextDamages=returnInspection.damages.map(damage=>damage.id===id?{...damage,classification:value}:damage);await db.inspections.update(returnInspection.id,{damages:nextDamages,status:deriveInspectionStatus('return',nextDamages),updatedAt:new Date().toISOString()});onUpdated()}
  async function claim(){const latest=await db.inspections.get(returnInspection.id);if(!latest?.damages.some(damage=>damage.classification==='new')){alert('Marca al menos un daño como nuevo antes de generar el expediente.');return}const {buildClaimZip}=await import('./lib/claim');const {blob,fileName}=await buildClaimZip(pickupInspection,latest,vehicle,settings);downloadBlob(blob,fileName);notice('Expediente ZIP generado')}
  return <section className="page"><button className="back" onClick={onBack}><ArrowLeft size={18}/>Volver</button><PageHead title="Comparativa antes / después" subtitle={`${vehicle.make} ${vehicle.model} · ${vehicle.plate}`} action={<button className="primary" onClick={claim}><FileArchive size={17}/>Generar expediente</button>}/><div className="compare-grid">{requiredSlots.map(slot=>{const before=pickupInspection.evidence.find(photo=>photo.slot===slot),after=returnInspection.evidence.find(photo=>photo.slot===slot);return <div className="compare-pair" key={slot}><h3>{slotLabels[slot]}</h3><div><figure>{before?<BlobImage blob={before.blob} alt={`${slotLabels[slot]} antes`}/>:<div className="missing-img">Sin foto</div>}<figcaption>ANTES</figcaption></figure><figure>{after?<BlobImage blob={after.blob} alt={`${slotLabels[slot]} después`}/>:<div className="missing-img">Sin foto</div>}<figcaption>DESPUÉS</figcaption></figure></div></div>})}</div><section className="section-block"><div className="section-title"><h2>Clasificación de daños</h2></div>{returnInspection.damages.length===0?<Empty text="No se registraron daños en la devolución."/>:<div className="claim-damages">{returnInspection.damages.map(damage=><div key={damage.id}><div><strong>{damage.area} · {damage.type}</strong><p>{damage.description||'Sin descripción'} · {damage.severity}</p></div><select aria-label={`Clasificación de ${damage.type} en ${damage.area}`} value={damage.classification||'uncertain'} onChange={event=>void classify(damage.id,event.target.value as DamageClassification)}><option value="uncertain">Por revisar</option><option value="new">Nuevo</option><option value="pre_existing">Preexistente</option></select></div>)}</div>}</section></section>
}
