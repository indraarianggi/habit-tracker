import type { CheckinRecord } from '@/lib/session-contract'
import type { TaskRecord } from '@/lib/task-contract'

const fullDayFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })

export type GridCell = {
  day: string
  label: string
  minutes: number
  checkins: number
  completed: number
  total: number
  level: number
  today: boolean
}

// Level zero is neutral; active levels grow lighter in both themes. The
// inverted zero makes the minimum recorded effort distinguishable at 3:1.
export const gridPalette = {
  light: {
    cells: ['#35443d', '#a3d1b3', '#b9dec5', '#d1ead7', '#e5f4e8'],
    numbers: ['#ffffff', '#10281e', '#10281e', '#10281e', '#10281e'],
  },
  dark: {
    cells: ['#162c24', '#73b18b', '#91c6a2', '#b4dec0', '#d5f0db'],
    numbers: ['#ffffff', '#10281e', '#10281e', '#10281e', '#10281e'],
  },
} as const

function dateOf(day: string): Date {
  const [year, month, date] = day.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, date, 12))
}
function formatDay(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}
function moveDay(day: string, amount: number): string {
  const date = dateOf(day)
  date.setUTCDate(date.getUTCDate() + amount)
  return formatDay(date)
}
function firstDay(today: string, months: 3 | 6): string {
  const date = dateOf(today)
  const targetMonth = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - months, 1, 12))
  const lastInMonth = new Date(Date.UTC(targetMonth.getUTCFullYear(), targetMonth.getUTCMonth() + 1, 0, 12)).getUTCDate()
  targetMonth.setUTCDate(Math.min(date.getUTCDate(), lastInMonth))
  return formatDay(targetMonth)
}

export function buildProgress(tasks: TaskRecord[], checkins: CheckinRecord[], today: string, months: 3 | 6) {
  const perDay = new Map<string, { minutes: number; checkins: number; completed: number; total: number }>()
  const taskDays = new Map<string, string>()
  for (const task of tasks) {
    taskDays.set(task.id, task.day)
    if (task.day > today) continue
    const entry = perDay.get(task.day) ?? { minutes: 0, checkins: 0, completed: 0, total: 0 }
    entry.total++
    if (task.completed) entry.completed++
    perDay.set(task.day, entry)
  }
  for (const checkin of checkins) {
    const day = taskDays.get(checkin.taskId)
    if (!day || day > today) continue
    const entry = perDay.get(day)!
    entry.minutes += checkin.durationMinutes
    entry.checkins++
  }

  const active = [...perDay].filter(([, value]) => value.checkins > 0).map(([day]) => day).sort()
  const amounts = active.map(day => perDay.get(day)!.minutes).sort((a, b) => a - b)
  const thresholds = amounts.length < 8 ? [15, 30, 60] : [0.25, 0.5, 0.75].map(q => amounts[Math.ceil(amounts.length * q) - 1])
  const legend = ['No focus', ...thresholds.map((max, index) => {
    const min = index ? thresholds[index - 1] + 1 : 1
    return min > max ? 'No values' : `${min}–${max} min`
  }), `>${thresholds[2]} min`]
  const startDay = firstDay(today, months)
  const stats = { minutes: 0, checkins: 0, activeDays: 0, completed: 0, total: 0 }
  for (const [day, value] of perDay) {
    if (day < startDay) continue
    stats.minutes += value.minutes
    stats.checkins += value.checkins
    stats.completed += value.completed
    stats.total += value.total
    if (value.checkins) stats.activeDays++
  }

  let longest = 0
  let run = 0
  let previous = ''
  for (const day of active) {
    run = previous && moveDay(previous, 1) === day ? run + 1 : 1
    longest = Math.max(longest, run)
    previous = day
  }
  const last = active.at(-1)
  const current = last === today || last === moveDay(today, -1) ? run : 0

  const firstMonday = moveDay(startDay, -((dateOf(startDay).getUTCDay() + 6) % 7))
  const weeks: Array<Array<GridCell | null>> = []
  for (let monday = firstMonday; monday <= today; monday = moveDay(monday, 7)) {
    const week: Array<GridCell | null> = []
    for (let offset = 0; offset < 7; offset++) {
      const day = moveDay(monday, offset)
      if (day < startDay || day > today) { week.push(null); continue }
      const value = perDay.get(day) ?? { minutes: 0, checkins: 0, completed: 0, total: 0 }
      const level = value.checkins ? thresholds.findIndex(threshold => value.minutes <= threshold) + 1 || 4 : 0
      const date = dateOf(day)
      const dateLabel = fullDayFormat.format(date)
      week.push({ day, ...value, level, today: day === today,
        label: `${dateLabel}, ${value.minutes} ${value.minutes === 1 ? 'minute' : 'minutes'}, ${value.checkins} ${value.checkins === 1 ? 'Check-in' : 'Check-ins'}, ${value.completed} of ${value.total} Tasks completed`,
      })
    }
    weeks.push(week)
  }
  return { weeks, startDay, endDay: today, legend, stats, streaks: { current, longest } }
}

export function navigateGrid(day: string, key: string, cells: GridCell[]): string {
  const available = new Set(cells.map(cell => cell.day))
  const weekday = (dateOf(day).getUTCDay() + 6) % 7
  const target = key === 'ArrowLeft' ? moveDay(day, -7) : key === 'ArrowRight' ? moveDay(day, 7)
    : key === 'ArrowUp' ? moveDay(day, -1) : key === 'ArrowDown' ? moveDay(day, 1)
      : key === 'Home' ? moveDay(day, -weekday) : key === 'End' ? moveDay(day, 6 - weekday) : day
  if (available.has(target)) return target
  if (key === 'Home' || key === 'End') {
    const week = cells.filter(cell => cell.day >= moveDay(day, -weekday) && cell.day <= moveDay(day, 6 - weekday))
    return (key === 'Home' ? week[0] : week.at(-1))?.day ?? day
  }
  return day
}
