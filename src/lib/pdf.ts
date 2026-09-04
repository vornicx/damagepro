import { jsPDF } from 'jspdf'
import type { CompanySettings, DamageClassification, DamageRecord, Inspection, Vehicle } from './types'

const slotLabels = {
  es: { front:'Frontal',rear:'Trasera',left:'Lateral izquierdo',right:'Lateral derecho',interior:'Interior',dashboard:'Cuadro / odómetro',wheel_fl:'Llanta delantera izq.',wheel_fr:'Llanta delantera der.',wheel_rl:'Llanta trasera izq.',wheel_rr:'Llanta trasera der.' },
  en: { front:'Front',rear:'Rear',left:'Left side',right:'Right side',interior:'Interior',dashboard:'Dashboard / odometer',wheel_fl:'Front left wheel',wheel_fr:'Front right wheel',wheel_rl:'Rear left wheel',wheel_rr:'Rear right wheel' }
} as const

const damageLabels = {
  es: { front:'Frontal',rear:'Trasera',left:'Lateral izquierdo',right:'Lateral derecho',interior:'Interior',wheel:'Llanta / rueda',glass:'Cristales',other:'Otro',scratch:'Arañazo',dent:'Abolladura',scuff:'Rozadura',crack:'Grieta',stain:'Mancha',minor:'Leve',moderate:'Moderada',severe:'Grave',new:'Nuevo',pre_existing:'Preexistente',uncertain:'Por revisar' },
  en: { front:'Front',rear:'Rear',left:'Left side',right:'Right side',interior:'Interior',wheel:'Wheel',glass:'Glass',other:'Other',scratch:'Scratch',dent:'Dent',scuff:'Scuff',crack:'Crack',stain:'Stain',minor:'Minor',moderate:'Moderate',severe:'Severe',new:'New',pre_existing:'Pre-existing',uncertain:'Uncertain' }
} as const

async function blobToDataUrl(blob: Blob) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('No se pudo leer una imagen para el PDF'))
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

export function translatedDamage(damage: DamageRecord, language: CompanySettings['language']) {
  const labels = damageLabels[language]
  const classification = damage.classification ? labels[damage.classification as DamageClassification] : ''
  return `${labels[damage.area]} · ${labels[damage.type]} · ${labels[damage.severity]}${classification ? ` · ${classification}` : ''}`
}

export async function inspectionPdf(inspection: Inspection, vehicle: Vehicle, settings: CompanySettings, title?: string): Promise<Blob> {
  const language = settings.language
  const es = language === 'es'
  const locale = es ? 'es-ES' : 'en-GB'
  const doc = new jsPDF({ unit:'mm', format:'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 15
  let y = 16

  if (settings.logo) {
    try {
      const logo = await blobToDataUrl(settings.logo)
      const size = await containedSize(settings.logo,24,13)
      doc.addImage(logo,settings.logo.type === 'image/png'?'PNG':'JPEG',pageWidth-margin-size.width,y-2,size.width,size.height)
    } catch { /* A report must still generate if the optional logo is unreadable. */ }
  }
  doc.setTextColor(24,24,24); doc.setFont('courier','bold'); doc.setFontSize(18); doc.text(settings.companyName || 'DAMAGEPRO',margin,y)
  y += 9; doc.setFontSize(13); doc.text(title || (inspection.kind === 'pickup' ? (es?'Informe de entrega':'Pickup inspection report') : (es?'Informe de devolución':'Return inspection report')),margin,y)
  y += 5; doc.setDrawColor(205); doc.line(margin,y,pageWidth-margin,y); y += 7

  doc.setFontSize(8.5)
  const rows = es ? [
    ['Vehículo',`${vehicle.make} ${vehicle.model} · ${vehicle.plate}`],
    ['VIN',vehicle.vin || '-'],['Cliente',inspection.customer.fullName],
    ['Email / teléfono',[inspection.customer.email,inspection.customer.phone].filter(Boolean).join(' · ') || '-'],
    ['Reserva / contrato',inspection.reservationRef],['Empleado',inspection.employeeName],
    ['Fecha',new Date(inspection.inspectedAt).toLocaleString(locale)],
    ['Odómetro',`${inspection.odometer.toLocaleString()} ${settings.units}`],['Combustible',`${inspection.fuelPercent}%`]
  ] : [
    ['Vehicle',`${vehicle.make} ${vehicle.model} · ${vehicle.plate}`],
    ['VIN',vehicle.vin || '-'],['Customer',inspection.customer.fullName],
    ['Email / phone',[inspection.customer.email,inspection.customer.phone].filter(Boolean).join(' · ') || '-'],
    ['Reservation / agreement',inspection.reservationRef],['Employee',inspection.employeeName],
    ['Date',new Date(inspection.inspectedAt).toLocaleString(locale)],
    ['Odometer',`${inspection.odometer.toLocaleString()} ${settings.units}`],['Fuel',`${inspection.fuelPercent}%`]
  ]
  for (const [label,value] of rows) {
    doc.setFont('courier','bold'); doc.setTextColor(75); doc.text(`${label}:`,margin,y)
    doc.setFont('courier','normal'); doc.setTextColor(25); doc.text(doc.splitTextToSize(value,138),57,y)
    y += 5.5
  }

  function newPage() { doc.addPage(); y = 17 }
  function ensureSpace(height:number) { if (y + height > 280) newPage() }
  function sectionTitle(text:string) { ensureSpace(14); y += 4; doc.setDrawColor(205); doc.line(margin,y,pageWidth-margin,y); y += 7; doc.setFont('courier','bold'); doc.setFontSize(11); doc.setTextColor(25); doc.text(text,margin,y); y += 7 }

  sectionTitle(es?'Daños registrados':'Recorded damage')
  if (!inspection.damages.length) {
    doc.setFont('courier','normal'); doc.setFontSize(9); doc.setTextColor(85); doc.text(es?'Sin daños registrados.':'No damage recorded.',margin,y); y += 7
  }
  for (const [index,damage] of inspection.damages.entries()) {
    const description = damage.description || (es?'Sin descripción':'No description')
    const lines = doc.splitTextToSize(`${index+1}. ${translatedDamage(damage,language)} - ${description}`,damage.photo?112:180)
    const blockHeight = Math.max(lines.length*4.6+5,damage.photo?35:0)
    ensureSpace(blockHeight)
    doc.setFont('courier','normal'); doc.setFontSize(8.5); doc.setTextColor(35); doc.text(lines,margin,y)
    if (damage.photo) {
      try {
        const data = await blobToDataUrl(damage.photo); const size = await containedSize(damage.photo,55,31)
        const x = pageWidth-margin-55+(55-size.width)/2
        doc.setDrawColor(215); doc.rect(pageWidth-margin-55,y-3,55,33)
        doc.addImage(data,damage.photo.type === 'image/png'?'PNG':'JPEG',x,y-2+(31-size.height)/2,size.width,size.height)
      } catch { /* Keep the textual record if a photo cannot be embedded. */ }
    }
    y += blockHeight
  }

  sectionTitle(es?'Evidencia fotográfica':'Photographic evidence')
  for (let index=0; index<inspection.evidence.length; index+=2) {
    ensureSpace(65)
    const pair = inspection.evidence.slice(index,index+2)
    for (const [column,photo] of pair.entries()) {
      const frameWidth=86; const frameHeight=55; const x=margin+column*94
      doc.setFillColor(247,247,247); doc.setDrawColor(215,215,215); doc.rect(x,y,frameWidth,frameHeight,'FD')
      try {
        const data=await blobToDataUrl(photo.blob); const size=await containedSize(photo.blob,frameWidth,frameHeight)
        doc.addImage(data,photo.blob.type === 'image/png'?'PNG':'JPEG',x+(frameWidth-size.width)/2,y+(frameHeight-size.height)/2,size.width,size.height)
      } catch { /* Caption still identifies missing evidence. */ }
      doc.setFont('courier','bold'); doc.setFontSize(7); doc.setTextColor(45); doc.text(slotLabels[language][photo.slot],x,y+59)
      doc.setFont('courier','normal'); doc.setFontSize(6.5); doc.setTextColor(110); doc.text(new Date(photo.capturedAt).toLocaleString(locale),x+frameWidth,y+59,{align:'right'})
    }
    y += 65
  }

  sectionTitle(es?'Firmas':'Signatures')
  const signatures = es
    ? [['Cliente',inspection.customerSignature],['Empleado',inspection.employeeSignature]] as const
    : [['Customer',inspection.customerSignature],['Employee',inspection.employeeSignature]] as const
  ensureSpace(42)
  for (const [column,[label,signature]] of signatures.entries()) {
    const x=margin+column*94
    doc.setFont('courier','bold'); doc.setFontSize(8); doc.setTextColor(55); doc.text(label,x,y)
    doc.setDrawColor(215); doc.rect(x,y+3,82,25)
    if (signature.dataUrl) {
      try { doc.addImage(signature.dataUrl,'PNG',x+2,y+4,78,22) } catch { /* Printed name remains available. */ }
    }
    doc.setFont('courier','normal'); doc.setFontSize(7); doc.text(signature.printedName || '-',x,y+33)
    doc.setTextColor(110); doc.setFontSize(6.5); doc.text(new Date(signature.signedAt).toLocaleString(locale),x+82,y+33,{align:'right'})
  }

  const totalPages = doc.getNumberOfPages()
  for (let page=1; page<=totalPages; page++) {
    doc.setPage(page); doc.setDrawColor(220); doc.line(margin,287,pageWidth-margin,287)
    doc.setFont('courier','normal'); doc.setFontSize(6.5); doc.setTextColor(120)
    doc.text(`DAMAGEPRO · ${inspection.id}`,margin,291)
    doc.text(`${page}/${totalPages}`,pageWidth-margin,291,{align:'right'})
  }
  return doc.output('blob')
}
