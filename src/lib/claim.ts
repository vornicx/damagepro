import JSZip from 'jszip'
import { jsPDF } from 'jspdf'
import { inspectionPdf, translatedDamage } from './pdf'
import type { CompanySettings, Inspection, Vehicle } from './types'

interface IntegrityEntry {
  path: string
  sha256: string
  bytes: number
  source: 'pickup' | 'return' | 'new_damage' | 'signature'
  inspectionId: string
  capturedAt?: string
  slot?: string
  damageId?: string
}

function safeName(name: string) {
  return name.replace(/[^a-z0-9-_.]+/gi, '_').replace(/^_+|_+$/g, '') || 'archivo'
}

function extensionFor(blob: Blob) {
  if (blob.type === 'image/png') return 'png'
  if (blob.type === 'image/webp') return 'webp'
  return 'jpg'
}

async function sha256(blob: Blob) {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

async function dataUrlToBlob(dataUrl: string) {
  return await (await fetch(dataUrl)).blob()
}

async function blobToDataUrl(blob: Blob) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('No se pudo leer una imagen del expediente'))
    reader.readAsDataURL(blob)
  })
}

async function containedSize(blob: Blob, maxWidth: number, maxHeight: number) {
  try {
    const bitmap = await createImageBitmap(blob)
    const scale = Math.min(maxWidth / bitmap.width, maxHeight / bitmap.height)
    const size = { width:bitmap.width * scale, height:bitmap.height * scale }
    bitmap.close()
    return size
  } catch {
    return { width:maxWidth, height:maxHeight }
  }
}

export async function buildClaimZip(pickup: Inspection, ret: Inspection, vehicle: Vehicle, settings: CompanySettings) {
  const zip = new JSZip()
  const integrity: IntegrityEntry[] = []
  const generatedAt = new Date().toISOString()

  zip.file('01_pickup_report.pdf', await inspectionPdf(pickup, vehicle, settings, settings.language === 'en' ? 'Pickup inspection report' : 'Informe de entrega'))
  zip.file('02_return_report.pdf', await inspectionPdf(ret, vehicle, settings, settings.language === 'en' ? 'Return inspection report' : 'Informe de devolución'))

  async function addEvidence(folderName: string, fileName: string, blob: Blob, metadata: Omit<IntegrityEntry, 'path' | 'sha256' | 'bytes'>) {
    const path = `${folderName}/${safeName(fileName)}`
    zip.file(path, blob)
    integrity.push({ path, sha256: await sha256(blob), bytes: blob.size, ...metadata })
  }

  for (const photo of pickup.evidence) {
    await addEvidence('03_before_photos', `${photo.slot}_${photo.id}.${extensionFor(photo.blob)}`, photo.blob, { source:'pickup', inspectionId:pickup.id, capturedAt:photo.capturedAt, slot:photo.slot })
  }
  for (const photo of ret.evidence) {
    await addEvidence('04_after_photos', `${photo.slot}_${photo.id}.${extensionFor(photo.blob)}`, photo.blob, { source:'return', inspectionId:ret.id, capturedAt:photo.capturedAt, slot:photo.slot })
  }

  const newDamages = ret.damages.filter(damage => damage.classification === 'new')
  for (const damage of newDamages) {
    if (damage.photo) await addEvidence('05_new_damage_photos', `${damage.area}_${damage.type}_${damage.id}.${extensionFor(damage.photo)}`, damage.photo, { source:'new_damage', inspectionId:ret.id, damageId:damage.id })
  }

  const es = settings.language === 'es'
  const locale = es ? 'es-ES' : 'en-GB'
  const comparison = new jsPDF({ unit:'mm', format:'a4' })
  comparison.setFont('courier','normal'); comparison.setFontSize(8); comparison.setTextColor(85); comparison.text(settings.companyName || 'DAMAGEPRO',15,15)
  comparison.setFont('courier','bold'); comparison.setFontSize(17); comparison.setTextColor(24); comparison.text(es?'Comparativa de daños':'Damage comparison',15,25)
  comparison.setDrawColor(205); comparison.line(15,31,195,31)
  comparison.setFont('courier','normal'); comparison.setFontSize(8); comparison.setTextColor(70)
  comparison.text(`${es?'Vehículo':'Vehicle'}: ${vehicle.make} ${vehicle.model} · ${vehicle.plate}`,15,38)
  comparison.text(`${es?'Reserva':'Reservation'}: ${ret.reservationRef}`,15,44)
  comparison.text(`${es?'Entrega':'Pickup'}: ${new Date(pickup.inspectedAt).toLocaleString(locale)}`,108,38)
  comparison.text(`${es?'Devolución':'Return'}: ${new Date(ret.inspectedAt).toLocaleString(locale)}`,108,44)
  let comparisonY=53
  for (const [index, damage] of newDamages.entries()) {
    const blockHeight=damage.photo?48:32
    if (comparisonY+blockHeight>278) { comparison.addPage(); comparisonY=18 }
    comparison.setDrawColor(210); comparison.setFillColor(249,249,248); comparison.rect(15,comparisonY,180,blockHeight,'FD')
    comparison.setFillColor(29,90,68); comparison.rect(15,comparisonY,25,9,'F')
    comparison.setFont('courier','bold'); comparison.setFontSize(7.5); comparison.setTextColor(255); comparison.text(es?'NUEVO':'NEW',27.5,comparisonY+6,{align:'center'})
    comparison.setTextColor(25); comparison.setFontSize(9); comparison.text(`${index+1}. ${translatedDamage(damage,settings.language)}`,44,comparisonY+6)
    const description=damage.description||(es?'Sin descripción':'No description')
    comparison.setFont('courier','normal'); comparison.setFontSize(8); comparison.setTextColor(70)
    comparison.text(comparison.splitTextToSize(description,damage.photo?112:168),21,comparisonY+17)
    comparison.setFontSize(6.5); comparison.setTextColor(115); comparison.text(`ID: ${damage.id}`,21,comparisonY+blockHeight-5)
    if(damage.photo){
      try{const data=await blobToDataUrl(damage.photo);const size=await containedSize(damage.photo,47,35);comparison.setDrawColor(215);comparison.rect(142,comparisonY+10,47,35);comparison.addImage(data,damage.photo.type==='image/png'?'PNG':'JPEG',142+(47-size.width)/2,comparisonY+10+(35-size.height)/2,size.width,size.height)}catch{/* The textual damage record remains usable. */}
    }
    comparisonY+=blockHeight+6
  }
  const comparisonPages=comparison.getNumberOfPages()
  for(let page=1;page<=comparisonPages;page++){
    comparison.setPage(page);comparison.setDrawColor(220);comparison.line(15,287,195,287);comparison.setFont('courier','normal');comparison.setFontSize(6.5);comparison.setTextColor(120);comparison.text(`DAMAGEPRO · ${ret.reservationRef}`,15,291);comparison.text(`${page}/${comparisonPages}`,195,291,{align:'right'})
  }
  zip.file('06_damage_comparison.pdf', comparison.output('blob'))

  const signatures: Array<[string,string,string]> = [
    ['pickup_customer.png', pickup.customerSignature.dataUrl, pickup.id],
    ['pickup_employee.png', pickup.employeeSignature.dataUrl, pickup.id],
    ['return_customer.png', ret.customerSignature.dataUrl, ret.id],
    ['return_employee.png', ret.employeeSignature.dataUrl, ret.id]
  ]
  for (const [name,dataUrl,inspectionId] of signatures) {
    if (!dataUrl) continue
    const blob = await dataUrlToBlob(dataUrl)
    await addEvidence('07_signatures',name,blob,{source:'signature',inspectionId})
  }

  const summary = new jsPDF({ unit: 'mm', format: 'a4' })
  summary.setFont('courier','bold'); summary.setFontSize(18); summary.text(settings.companyName || 'DAMAGEPRO',15,18)
  summary.setFontSize(14); summary.text(settings.language === 'en' ? 'Claim file summary' : 'Resumen de expediente',15,28)
  summary.setFillColor(29,90,68);summary.rect(15,35,180,13,'F');summary.setTextColor(255);summary.setFontSize(9);summary.text(es?`EXPEDIENTE PREPARADO · ${newDamages.length} ${newDamages.length===1?'DAÑO NUEVO':'DAÑOS NUEVOS'}`:`CLAIM FILE READY · ${newDamages.length} NEW ${newDamages.length===1?'DAMAGE':'DAMAGES'}`,20,43)
  summary.setTextColor(24);summary.setDrawColor(215);summary.rect(15,54,180,45)
  summary.setFont('courier','normal'); summary.setFontSize(9)
  const labels = settings.language === 'en'
    ? [['Vehicle',`${vehicle.make} ${vehicle.model} · ${vehicle.plate}`],['Customer',ret.customer.fullName],['Reservation',ret.reservationRef],['New damages',String(newDamages.length)],['Generated',new Date(generatedAt).toLocaleString('en-GB')]]
    : [['Vehículo',`${vehicle.make} ${vehicle.model} · ${vehicle.plate}`],['Cliente',ret.customer.fullName],['Reserva',ret.reservationRef],['Daños nuevos',String(newDamages.length)],['Generado',new Date(generatedAt).toLocaleString('es-ES')]]
  let summaryY=64
  for (const [label,value] of labels) { summary.setFont('courier','bold'); summary.text(`${label}:`,21,summaryY); summary.setFont('courier','normal'); summary.text(value,61,summaryY); summaryY+=7 }
  summary.setFont('courier','bold');summary.setFontSize(10);summary.text(es?'Contenido del expediente':'Claim file contents',15,112)
  summary.setFont('courier','normal');summary.setFontSize(8);summary.setTextColor(55)
  const contents=es?['[OK] Informe firmado de entrega','[OK] Informe firmado de devolución','[OK] Fotografías originales antes y después','[OK] Fotografías de daños nuevos','[OK] Comparativa y firmas separadas','[OK] Manifiesto de integridad SHA-256']:['[OK] Signed pickup report','[OK] Signed return report','[OK] Original before and after photographs','[OK] New damage photographs','[OK] Comparison and separate signatures','[OK] SHA-256 integrity manifest']
  contents.forEach((line,index)=>summary.text(line,18,122+index*7))
  summary.setFillColor(247,249,248);summary.setDrawColor(202,218,209);summary.rect(15,168,180,35,'FD')
  summary.setFont('courier','bold');summary.setFontSize(9);summary.setTextColor(29,90,68);summary.text(es?'Integridad verificable':'Verifiable integrity',21,178)
  summary.setFont('courier','normal');summary.setFontSize(7.5);summary.setTextColor(70)
  const integrityCopy=es?`00_integrity_manifest.json contiene la huella SHA-256 y el tamaño de los ${integrity.length} archivos originales incluidos. Cualquier cambio posterior en una imagen o firma produce una huella diferente.`:`00_integrity_manifest.json contains the SHA-256 fingerprint and size of all ${integrity.length} included original files. Any later change to an image or signature produces a different fingerprint.`
  summary.text(summary.splitTextToSize(integrityCopy,166),21,187)
  summary.setDrawColor(220);summary.line(15,287,195,287);summary.setFontSize(6.5);summary.setTextColor(120);summary.text(`DAMAGEPRO · ${ret.reservationRef}`,15,291);summary.text(new Date(generatedAt).toLocaleString(locale),195,291,{align:'right'})
  zip.file('08_claim_summary.pdf', summary.output('blob'))

  zip.file('00_integrity_manifest.json', JSON.stringify({
    product:'DAMAGEPRO',
    formatVersion:1,
    generatedAt,
    vehicle:{id:vehicle.id,plate:vehicle.plate,vin:vehicle.vin},
    reservationRef:ret.reservationRef,
    inspections:{pickupId:pickup.id,returnId:ret.id,pickupAt:pickup.inspectedAt,returnAt:ret.inspectedAt},
    algorithm:'SHA-256',
    entries:integrity
  },null,2))

  const blob = await zip.generateAsync({ type: 'blob', compression:'DEFLATE', compressionOptions:{level:6} })
  return { blob, fileName:`DAMAGEPRO_${safeName(vehicle.plate)}_${safeName(ret.reservationRef)}.zip` }
}
