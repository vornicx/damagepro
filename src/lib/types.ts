export type Language = 'es' | 'en'
export type Units = 'km' | 'mi'
export type InspectionKind = 'pickup' | 'return'
export type InspectionStatus = 'PICKUP' | 'RETURN' | 'CLAIM_READY'
export type EvidenceSlot = 'front' | 'rear' | 'left' | 'right' | 'interior' | 'dashboard' | 'wheel_fl' | 'wheel_fr' | 'wheel_rl' | 'wheel_rr'
export type DamageArea = 'front' | 'rear' | 'left' | 'right' | 'interior' | 'wheel' | 'glass' | 'other'
export type DamageType = 'scratch' | 'dent' | 'scuff' | 'crack' | 'stain' | 'other'
export type Severity = 'minor' | 'moderate' | 'severe'
export type DamageClassification = 'new' | 'pre_existing' | 'uncertain'

export interface CompanySettings {
  id: 'settings'
  companyName: string
  logo?: Blob
  language: Language
  units: Units
  defaultEmployeeName?: string
  lastBackupAt?: string
}

export interface Vehicle {
  id: string
  plate: string
  make: string
  model: string
  year: number
  color: string
  vin?: string
  odometer: number
  notes?: string
  archived: boolean
  createdAt: string
  updatedAt: string
}

export interface CustomerSnapshot {
  fullName: string
  email?: string
  phone?: string
}

export interface EvidencePhoto {
  id: string
  slot: EvidenceSlot
  blob: Blob
  fileName: string
  capturedAt: string
}

export interface DamageRecord {
  id: string
  area: DamageArea
  type: DamageType
  severity: Severity
  description: string
  photo?: Blob
  photoName?: string
  classification?: DamageClassification
}

export interface Signature {
  printedName: string
  dataUrl: string
  signedAt: string
}

export interface Inspection {
  id: string
  kind: InspectionKind
  status: InspectionStatus
  pickupId?: string
  vehicleId: string
  customer: CustomerSnapshot
  reservationRef: string
  employeeName: string
  inspectedAt: string
  odometer: number
  fuelPercent: number
  evidence: EvidencePhoto[]
  damages: DamageRecord[]
  customerSignature: Signature
  employeeSignature: Signature
  createdAt: string
  updatedAt: string
}

export interface InspectionDraft {
  id: string
  kind: InspectionKind
  pickupId?: string
  step: number
  vehicleId: string
  customer: CustomerSnapshot
  reservationRef: string
  employeeName: string
  inspectedAt: string
  odometer: number
  fuelPercent: number
  evidence: EvidencePhoto[]
  damages: DamageRecord[]
  customerSignature: Signature
  employeeSignature: Signature
  updatedAt: string
}

export interface BackupManifest {
  product: 'DAMAGEPRO'
  schemaVersion: 1
  exportedAt: string
  vehicleCount: number
  inspectionCount: number
  draftCount?: number
}
