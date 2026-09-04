import type { DamageRecord, InspectionKind, InspectionStatus } from './types'

export function deriveInspectionStatus(kind: InspectionKind, damages: DamageRecord[]): InspectionStatus {
  if (kind === 'pickup') return 'PICKUP'
  return damages.some(damage => damage.classification === 'new') ? 'CLAIM_READY' : 'RETURN'
}

export function inspectionDraftId(kind: InspectionKind, pickupId?: string) {
  return kind === 'pickup' ? 'pickup' : `return:${pickupId ?? 'unknown'}`
}

export function isValidReturnOdometer(odometer: number, pickupOdometer?: number) {
  return pickupOdometer === undefined || odometer >= pickupOdometer
}

export function localDateTimeInputValue(date = new Date()) {
  const offsetMilliseconds = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offsetMilliseconds).toISOString().slice(0, 16)
}
