import { expect, test } from '@playwright/test'
import { buildProgress, gridPalette, navigateGrid } from '@/lib/progress'
import type { TaskRecord } from '@/lib/task-contract'
import type { CheckinRecord } from '@/lib/session-contract'

const today = '2026-09-27'
function task(id: string, day: string, completed = false): TaskRecord {
  return { id, userId: 'alice', day, title: id, completed, orderKey: id, createdAt: `${day}T12:00:00.000Z`, seq: 0 }
}
function checkin(id: string, target: string, durationMinutes: number): CheckinRecord {
  return { id, userId: 'alice', taskId: target, durationMinutes, origin: 'manual', sourceSessionId: null, createdAt: `${today}T12:00:00.000Z` }
}

test('thresholds become whole-history quartiles on the eighth active Day without changing with range', () => {
  const tasks = [1, 5, 10, 15, 20, 30, 45, 80].map((minutes, index) => task(`t${index}`, `2026-0${index < 4 ? 5 : 9}-${String(index < 4 ? index + 1 : index + 12).padStart(2, '0')}`))
  const records = tasks.map((item, index) => checkin(`c${index}`, item.id, [1, 5, 10, 15, 20, 30, 45, 80][index]))
  const fixed = buildProgress(tasks, records.slice(0, 7), today, 3)
  expect(fixed.legend).toEqual(['No focus', '1–15 min', '16–30 min', '31–60 min', '>60 min'])
  const quartiles = buildProgress(tasks, records, today, 3)
  expect(quartiles.legend).toEqual(['No focus', '1–5 min', '6–15 min', '16–30 min', '>30 min'])
  const may = buildProgress(tasks, records, today, 6)
  const september = quartiles.weeks.flat().filter(cell => cell?.day === '2026-09-16')[0]
  expect(may.weeks.flat().find(cell => cell?.day === september?.day)?.level).toBe(september?.level)
  expect(quartiles.stats.minutes).toBe(175)
  expect(may.stats.minutes).toBe(206)
})

test('streaks survive today without a Check-in but end across a completed Day gap', () => {
  const tasks = ['2026-09-20', '2026-09-21', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26'].map((day, index) => task(`t${index}`, day))
  const records = tasks.map((item, index) => checkin(`c${index}`, item.id, 10))
  expect(buildProgress(tasks, records, today, 3).streaks).toEqual({ current: 4, longest: 4 })
  expect(buildProgress(tasks, records.slice(0, -1), today, 3).streaks).toEqual({ current: 0, longest: 3 })
})

test('reassignment, correction, and cascading deletion recompute Days and totals from Task ownership', () => {
  const tasks = [task('a', '2026-09-25', true), task('b', '2026-09-26')]
  const record = checkin('c', 'a', 45)
  const before = buildProgress(tasks, [record], today, 3)
  expect(before.weeks.flat().find(cell => cell?.day === tasks[0].day)).toMatchObject({ minutes: 45, checkins: 1, completed: 1, total: 1 })
  const after = buildProgress(tasks, [{ ...record, taskId: 'b', durationMinutes: 12 }], today, 3)
  expect(after.weeks.flat().find(cell => cell?.day === tasks[0].day)).toMatchObject({ minutes: 0, checkins: 0 })
  expect(after.weeks.flat().find(cell => cell?.day === tasks[1].day)).toMatchObject({ minutes: 12, checkins: 1, level: 1 })
  expect(after.stats).toEqual({ minutes: 12, checkins: 1, activeDays: 1, completed: 1, total: 2 })
  expect(buildProgress(tasks.slice(0, 1), [{ ...record, taskId: 'b' }], today, 3).stats.minutes).toBe(0)
})

test('grid has Monday weeks, no future cells, full labels and week-relative keyboard navigation', () => {
  const tasks = [task('a', today, true), task('b', today)]
  const progress = buildProgress(tasks, [checkin('c', 'a', 45), checkin('d', 'a', 10)], today, 3)
  const cells = progress.weeks.flat().filter(cell => cell !== null)
  expect(progress.weeks[0].find(cell => cell !== null)?.day).toBe(progress.startDay)
  expect(buildProgress([], [], '2026-09-23', 3).weeks.at(-1)?.[6]).toBeNull()
  expect(buildProgress([], [], today, 3).stats).toEqual({ minutes: 0, checkins: 0, activeDays: 0, completed: 0, total: 0 })
  expect(cells.at(-1)?.day).toBe(today)
  expect(cells.at(-1)?.label).toMatch(/27 September 2026, 55 minutes, 2 Check-ins, 1 of 2 Tasks completed/)
  expect(cells[0].label).toMatch(/0 minutes, 0 Check-ins, 0 of 0 Tasks completed/)
  expect(navigateGrid(today, 'ArrowLeft', cells)).toBe('2026-09-20')
  expect(navigateGrid(today, 'Home', cells)).toBe('2026-09-21')
  expect(navigateGrid(today, 'End', cells)).toBe(today)
  expect(navigateGrid(today, 'ArrowDown', cells)).toBe(today)
})

function luminance(hex: string): number {
  const [r, g, b] = hex.match(/[\da-f]{2}/gi)!.map(part => parseInt(part, 16) / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
function contrast(a: string, b: string): number {
  const x = luminance(a), y = luminance(b)
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}

test('light and dark cells retain non-colour contrast and readable day numbers at each level', () => {
  for (const palette of Object.values(gridPalette)) {
    expect(contrast(palette.cells[0], palette.cells[1])).toBeGreaterThanOrEqual(3)
    for (let level = 0; level < 5; level++) {
      if (level) expect(luminance(palette.cells[level])).toBeGreaterThan(luminance(palette.cells[level - 1]))
      expect(contrast(palette.cells[level], palette.numbers[level])).toBeGreaterThanOrEqual(4.5)
    }
  }
})
