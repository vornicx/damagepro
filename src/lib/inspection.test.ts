import { describe, expect, it, vi } from 'vitest'
import { deriveInspectionStatus, inspectionDraftId, isValidReturnOdometer, localDateTimeInputValue } from './inspection'
import type { DamageRecord } from './types'

function damage(classification?: DamageRecord['classification']): DamageRecord {
  return { id:crypto.randomUUID(), area:'front', type:'scratch', severity:'minor', description:'', classification }
}

describe('inspection state rules', () => {
  it('keeps pickup inspections in PICKUP state', () => {
    expect(deriveInspectionStatus('pickup',[damage('new')])).toBe('PICKUP')
  })

  it('marks a return as claim-ready only while it has new damage', () => {
    expect(deriveInspectionStatus('return',[damage('uncertain'),damage('pre_existing')])).toBe('RETURN')
    expect(deriveInspectionStatus('return',[damage('new')])).toBe('CLAIM_READY')
    expect(deriveInspectionStatus('return',[])).toBe('RETURN')
  })

  it('uses one pickup draft and one draft per return inspection', () => {
    expect(inspectionDraftId('pickup')).toBe('pickup')
    expect(inspectionDraftId('return','pickup-123')).toBe('return:pickup-123')
  })

  it('does not allow the return odometer to move backwards', () => {
    expect(isValidReturnOdometer(42_001,42_000)).toBe(true)
    expect(isValidReturnOdometer(41_999,42_000)).toBe(false)
  })

  it('formats the current local time instead of displaying UTC in the form', () => {
    const date = new Date('2026-01-02T03:04:00.000Z')
    vi.spyOn(date,'getTimezoneOffset').mockReturnValue(-120)
    expect(localDateTimeInputValue(date)).toBe('2026-01-02T05:04')
  })
})
