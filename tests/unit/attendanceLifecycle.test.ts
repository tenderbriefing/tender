import { describe, expect, it } from 'vitest'
import {
  assertAttendanceTransition,
  canTransitionAttendance,
  normalizeWorkflowState,
} from '../../lib/domain/attendanceLifecycle'

describe('attendanceLifecycle', () => {
  it('allows agent accept from assigned', () => {
    expect(canTransitionAttendance('assigned', 'accepted', 'youth-agent').ok).toBe(true)
  })

  it('blocks SME from accepting', () => {
    const result = canTransitionAttendance('assigned', 'accepted', 'sme')
    expect(result.ok).toBe(false)
  })

  it('blocks completed → pending', () => {
    expect(canTransitionAttendance('completed', 'pending', 'admin').ok).toBe(false)
  })

  it('allows SME cancel from pending', () => {
    expect(canTransitionAttendance('pending', 'cancelled', 'sme').ok).toBe(true)
  })

  it('throws on invalid assert', () => {
    expect(() => assertAttendanceTransition('closed', 'pending', 'admin')).toThrow()
  })

  it('normalizes unknown to pending', () => {
    expect(normalizeWorkflowState('nope')).toBe('pending')
  })
})
