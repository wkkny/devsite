import { describe, expect, it } from 'vitest'

import { buildCalendar, levelFromCount, moveFocus, rangeTotal } from '../src/components/github-calendar/model'

const utc = (iso: string) => new Date(`${iso}T00:00:00Z`)

// 2026 starts on a Thursday and ends on a Thursday; "today" is Thu Oct 1.
const year2026 = (days: { date: string; count: number; level?: number }[] = []) =>
  buildCalendar({
    start: utc('2026-01-01'),
    end: utc('2026-12-31'),
    activeUntil: utc('2026-10-01'),
    today: new Date('2026-10-01T15:00:00Z'),
    days,
  })

const indexOf = (model: ReturnType<typeof year2026>, iso: string) =>
  model.cells.findIndex((cell) => cell.iso === iso)

describe('buildCalendar', () => {
  it('lays out whole Monday-first weeks around the range', () => {
    const model = year2026()
    expect(model.weeks).toBe(53)
    expect(model.cells).toHaveLength(53 * 7)
    expect(model.cells[0].iso).toBe('2025-12-29')
    expect(model.cells[0].weekday).toBe(0)
  })

  it('marks days before the start and after the end as outside, and days after activeUntil as disabled', () => {
    const model = year2026()
    expect(model.cells.slice(0, 3).map((cell) => cell.state)).toEqual(['outside', 'outside', 'outside'])
    expect(model.cells[indexOf(model, '2026-01-01')].state).toBe('active')
    expect(model.cells[indexOf(model, '2026-10-01')].state).toBe('active')
    expect(model.cells[indexOf(model, '2026-10-02')].state).toBe('disabled')
    expect(model.cells[indexOf(model, '2026-12-31')].state).toBe('disabled')
    expect(model.cells[indexOf(model, '2027-01-01')].state).toBe('outside')
  })

  it('enters on today and reports the active span', () => {
    const model = year2026()
    expect(model.firstActive).toBe(indexOf(model, '2026-01-01'))
    expect(model.lastActive).toBe(indexOf(model, '2026-10-01'))
    expect(model.entry).toBe(model.lastActive)
    expect(model.lastActiveDate.toISOString().slice(0, 10)).toBe('2026-10-01')
  })

  it('enters on the last active day when today is outside the range', () => {
    const model = buildCalendar({ start: utc('2025-01-01'), end: utc('2025-12-31'), today: utc('2026-10-01'), days: [] })
    expect(model.cells[model.entry].iso).toBe('2025-12-31')
  })

  it('takes counts and GitHub levels by date, and ignores data on disabled days', () => {
    const model = year2026([
      { date: '2026-09-23', count: 22, level: 4 },
      { date: '2026-11-02', count: 5, level: 2 },
    ])
    expect(model.cells[indexOf(model, '2026-09-23')]).toMatchObject({ count: 22, level: 4 })
    expect(model.cells[indexOf(model, '2026-09-24')]).toMatchObject({ count: 0, level: 0 })
    expect(model.cells[indexOf(model, '2026-11-02')]).toMatchObject({ count: 0, level: 0 })
  })

  it('labels each month once and drops labels that would collide', () => {
    const model = year2026()
    expect(model.months.map((month) => month.label)).toEqual([
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ])
    const weeks = model.months.map((month) => month.week)
    for (let i = 1; i < weeks.length; i++) expect(weeks[i] - weeks[i - 1]).toBeGreaterThanOrEqual(3)
  })
})

describe('levelFromCount', () => {
  it('maps counts to quarters of the busiest day', () => {
    expect([0, 1, 5, 6, 10, 20].map((count) => levelFromCount(count, 20))).toEqual([0, 1, 1, 2, 2, 4])
    expect(levelFromCount(3, 0)).toBe(1)
  })
})

describe('moveFocus', () => {
  const model = year2026()
  const at = (iso: string) => indexOf(model, iso)
  const move = (iso: string, key: string, ctrl = false) => model.cells[moveFocus(model, at(iso), key, ctrl)!].iso

  it('moves by day and week', () => {
    expect(move('2026-01-08', 'ArrowUp')).toBe('2026-01-07')
    expect(move('2026-01-08', 'ArrowDown')).toBe('2026-01-09')
    expect(move('2026-01-08', 'ArrowLeft')).toBe('2026-01-01')
    expect(move('2026-01-08', 'ArrowRight')).toBe('2026-01-15')
  })

  it('stays put instead of moving onto a blank or disabled day', () => {
    expect(move('2026-01-01', 'ArrowUp')).toBe('2026-01-01')
    expect(move('2026-01-01', 'ArrowLeft')).toBe('2026-01-01')
    // the regression the old grid had: Monday Jan 5 must not jump to Thursday Jan 1
    expect(move('2026-01-05', 'ArrowLeft')).toBe('2026-01-05')
    expect(move('2026-10-01', 'ArrowRight')).toBe('2026-10-01')
    expect(move('2026-10-01', 'ArrowDown')).toBe('2026-10-01')
    expect(move('2026-01-04', 'ArrowDown')).toBe('2026-01-04')
  })

  it('jumps along the row with Home and End, and to the ends with Control', () => {
    expect(move('2026-05-07', 'Home')).toBe('2026-01-01')
    expect(move('2026-05-07', 'End')).toBe('2026-10-01')
    expect(move('2026-05-04', 'Home')).toBe('2026-01-05')
    expect(move('2026-05-04', 'End')).toBe('2026-09-28')
    expect(move('2026-05-04', 'Home', true)).toBe('2026-01-01')
    expect(move('2026-05-04', 'End', true)).toBe('2026-10-01')
  })

  it('ignores keys it does not handle', () => {
    expect(moveFocus(model, at('2026-05-04'), 'a')).toBeNull()
  })
})

describe('rangeTotal', () => {
  it('sums active days in either order and skips disabled ones', () => {
    const model = year2026([
      { date: '2026-09-23', count: 22 },
      { date: '2026-09-25', count: 8 },
      { date: '2026-10-01', count: 3 },
    ])
    const at = (iso: string) => indexOf(model, iso)
    expect(rangeTotal(model, at('2026-09-23'), at('2026-09-27'))).toEqual({ total: 30, days: 5 })
    expect(rangeTotal(model, at('2026-09-27'), at('2026-09-23'))).toEqual({ total: 30, days: 5 })
    expect(rangeTotal(model, at('2026-09-30'), at('2026-10-05'))).toEqual({ total: 3, days: 2 })
  })
})
