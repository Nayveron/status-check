import type { Commitment, Status } from './types'

/**
 * Derived display status: a commitment awaiting check (to_check) whose deadline
 * has passed (relative to the given "today", which may be the demo/mock date)
 * is shown as expired immediately — before the DB sweep persists it.
 */
export function effectiveStatus(c: Commitment, today: Date): Status {
  if (c.status === 'to_check') {
    const deadline = new Date(c.deadline + 'T00:00:00')
    const midnight = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    if (deadline < midnight) return 'expired'
  }
  return c.status
}
