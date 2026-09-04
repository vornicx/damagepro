import Dexie, { type Table } from 'dexie'
import type { CompanySettings, Inspection, InspectionDraft, Vehicle } from './types'

class DamageProDB extends Dexie {
  vehicles!: Table<Vehicle, string>
  inspections!: Table<Inspection, string>
  drafts!: Table<InspectionDraft, string>
  settings!: Table<CompanySettings, string>

  constructor() {
    super('damagepro')
    this.version(1).stores({
      vehicles: 'id, plate, archived, updatedAt',
      inspections: 'id, kind, status, vehicleId, pickupId, inspectedAt, updatedAt',
      settings: 'id'
    })
    this.version(2).stores({
      vehicles: 'id, plate, archived, updatedAt',
      inspections: 'id, kind, status, vehicleId, pickupId, inspectedAt, updatedAt',
      drafts: 'id, kind, pickupId, updatedAt',
      settings: 'id'
    })
  }
}

export const db = new DamageProDB()

export async function ensureSettings() {
  const existing = await db.settings.get('settings')
  if (!existing) {
    await db.settings.put({ id: 'settings', companyName: '', language: 'es', units: 'km' })
  }
}
