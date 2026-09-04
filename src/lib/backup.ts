import JSZip from 'jszip'
import { db } from './db'
import type { BackupManifest, CompanySettings, DamageRecord, EvidencePhoto, Inspection, InspectionDraft, Vehicle } from './types'

const MAX_BACKUP_BYTES = 1024 * 1024 * 1024
const MAX_DATA_BYTES = 2 * 1024 * 1024 * 1024

type LocalRecord = Inspection | InspectionDraft
type SerializedRecord<T extends LocalRecord> = Omit<T, 'evidence' | 'damages'> & {
  evidence: Array<Omit<EvidencePhoto, 'blob'> & { blob: string }>
  damages: Array<Omit<DamageRecord, 'photo'> & { photo?: string }>
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function assertString(value: unknown, label: string) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Backup no válido: falta ${label}`)
}

function validateRecord(record: unknown, label: string) {
  if (!isObject(record)) throw new Error(`Backup no válido: ${label}`)
  assertString(record.id, `${label}.id`)
  assertString(record.kind, `${label}.kind`)
  assertString(record.vehicleId, `${label}.vehicleId`)
  if (!Array.isArray(record.evidence) || !Array.isArray(record.damages)) throw new Error(`Backup no válido: evidencia de ${label}`)
  for (const [index, photo] of record.evidence.entries()) {
    if (!isObject(photo) || typeof photo.blob !== 'string' || !photo.blob.startsWith('data:image/')) throw new Error(`Backup no válido: foto ${index + 1} de ${label}`)
  }
  for (const [index, damage] of record.damages.entries()) {
    if (!isObject(damage)) throw new Error(`Backup no válido: daño ${index + 1} de ${label}`)
    if (damage.photo !== undefined && (typeof damage.photo !== 'string' || !damage.photo.startsWith('data:image/'))) throw new Error(`Backup no válido: foto del daño ${index + 1} de ${label}`)
  }
}

function validatePayload(value: unknown, manifest: BackupManifest) {
  if (!isObject(value) || !Array.isArray(value.vehicles) || !Array.isArray(value.inspections) || !isObject(value.settings)) throw new Error('Backup no válido: estructura de datos incorrecta')
  const drafts = value.drafts === undefined ? [] : value.drafts
  if (!Array.isArray(drafts)) throw new Error('Backup no válido: borradores incorrectos')
  if (value.vehicles.length !== manifest.vehicleCount || value.inspections.length !== manifest.inspectionCount) throw new Error('Backup incompleto: el recuento de registros no coincide')
  if (manifest.draftCount !== undefined && drafts.length !== manifest.draftCount) throw new Error('Backup incompleto: el recuento de borradores no coincide')

  const vehicleIds = new Set<string>()
  for (const [index, vehicle] of value.vehicles.entries()) {
    if (!isObject(vehicle)) throw new Error(`Backup no válido: vehículo ${index + 1}`)
    assertString(vehicle.id, `vehículo ${index + 1}.id`)
    assertString(vehicle.plate, `vehículo ${index + 1}.matrícula`)
    if (vehicleIds.has(vehicle.id as string)) throw new Error('Backup no válido: hay vehículos duplicados')
    vehicleIds.add(vehicle.id as string)
  }

  const inspectionIds = new Set<string>()
  for (const [index, inspection] of value.inspections.entries()) {
    validateRecord(inspection, `inspección ${index + 1}`)
    const typed = inspection as Record<string, unknown>
    if (!vehicleIds.has(typed.vehicleId as string)) throw new Error(`Backup no válido: la inspección ${index + 1} referencia un vehículo inexistente`)
    if (inspectionIds.has(typed.id as string)) throw new Error('Backup no válido: hay inspecciones duplicadas')
    inspectionIds.add(typed.id as string)
  }
  for (const inspection of value.inspections as Array<Record<string, unknown>>) {
    if (inspection.kind === 'return' && (typeof inspection.pickupId !== 'string' || !inspectionIds.has(inspection.pickupId))) throw new Error('Backup no válido: una devolución no tiene su entrega original')
  }
  for (const [index, draft] of drafts.entries()) validateRecord(draft, `borrador ${index + 1}`)

  if (value.settings.id !== 'settings') throw new Error('Backup no válido: configuración incorrecta')
  if (!['es', 'en'].includes(String(value.settings.language)) || !['km', 'mi'].includes(String(value.settings.units))) throw new Error('Backup no válido: preferencias incompatibles')
  return { vehicles: value.vehicles as Vehicle[], inspections: value.inspections as SerializedRecord<Inspection>[], drafts: drafts as SerializedRecord<InspectionDraft>[], settings: value.settings as unknown as Omit<CompanySettings, 'logo'> & { logo?: string } }
}

async function blobToBase64(blob: Blob) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('No se pudo leer una imagen del backup'))
    reader.readAsDataURL(blob)
  })
}

async function dataUrlToBlob(dataUrl: string) {
  const response = await fetch(dataUrl)
  if (!response.ok) throw new Error('No se pudo reconstruir una imagen del backup')
  return await response.blob()
}

async function serializeRecord<T extends LocalRecord>(record: T): Promise<SerializedRecord<T>> {
  return {
    ...record,
    evidence: await Promise.all(record.evidence.map(async photo => ({ ...photo, blob: await blobToBase64(photo.blob) }))),
    damages: await Promise.all(record.damages.map(async damage => ({ ...damage, photo: damage.photo ? await blobToBase64(damage.photo) : undefined })))
  }
}

async function hydrateRecord<T extends LocalRecord>(record: SerializedRecord<T>): Promise<T> {
  return {
    ...record,
    evidence: await Promise.all(record.evidence.map(async photo => ({ ...photo, blob: await dataUrlToBlob(photo.blob) }))),
    damages: await Promise.all(record.damages.map(async damage => ({ ...damage, photo: damage.photo ? await dataUrlToBlob(damage.photo) : undefined })))
  } as T
}

export async function exportBackup() {
  const [vehicles, inspections, drafts, settings] = await Promise.all([
    db.vehicles.toArray(),
    db.inspections.toArray(),
    db.drafts.toArray(),
    db.settings.get('settings')
  ])
  if (!settings) throw new Error('No se encontró la configuración local')
  const manifest: BackupManifest = { product:'DAMAGEPRO', schemaVersion:1, exportedAt:new Date().toISOString(), vehicleCount:vehicles.length, inspectionCount:inspections.length, draftCount:drafts.length }
  const serialInspections = await Promise.all(inspections.map(serializeRecord))
  const serialDrafts = await Promise.all(drafts.map(serializeRecord))
  const serialSettings = { ...settings, logo: settings.logo ? await blobToBase64(settings.logo) : undefined }
  const zip = new JSZip()
  zip.file('manifest.json', JSON.stringify(manifest,null,2))
  zip.file('data.json', JSON.stringify({ vehicles, inspections: serialInspections, drafts: serialDrafts, settings: serialSettings },null,2))
  return await zip.generateAsync({ type:'blob', compression:'DEFLATE', compressionOptions:{level:6} })
}

export async function restoreBackup(file: File) {
  if (file.size > MAX_BACKUP_BYTES) throw new Error('El backup supera el límite de 1 GB')
  const zip = await JSZip.loadAsync(file)
  const manifestFile = zip.file('manifest.json')
  const dataFile = zip.file('data.json')
  if (!manifestFile || !dataFile) throw new Error('Backup incompleto')
  const reportedSize = (dataFile as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize
  if (reportedSize && reportedSize > MAX_DATA_BYTES) throw new Error('El contenido del backup es demasiado grande')

  const [manifestText, dataText] = await Promise.all([manifestFile.async('string'), dataFile.async('string')])
  if (dataText.length > MAX_DATA_BYTES) throw new Error('El contenido del backup es demasiado grande')
  const manifest = JSON.parse(manifestText) as BackupManifest
  if (manifest.product !== 'DAMAGEPRO' || manifest.schemaVersion !== 1) throw new Error('Formato o versión de backup no compatible')
  const payload = validatePayload(JSON.parse(dataText) as unknown, manifest)
  const [inspections, drafts] = await Promise.all([
    Promise.all(payload.inspections.map(record => hydrateRecord<Inspection>(record))),
    Promise.all(payload.drafts.map(record => hydrateRecord<InspectionDraft>(record)))
  ])
  const settings: CompanySettings = { ...payload.settings, logo: payload.settings.logo ? await dataUrlToBlob(payload.settings.logo) : undefined }

  await db.transaction('rw', db.vehicles, db.inspections, db.drafts, db.settings, async () => {
    await db.vehicles.clear()
    await db.inspections.clear()
    await db.drafts.clear()
    await db.settings.clear()
    await db.vehicles.bulkPut(payload.vehicles)
    await db.inspections.bulkPut(inspections)
    await db.drafts.bulkPut(drafts)
    await db.settings.put(settings)
  })
  return manifest
}
