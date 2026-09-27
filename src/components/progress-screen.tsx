import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type MouseEvent } from 'react'
import { Flame, LayoutGrid, Plus, X } from 'lucide-react'
import type { TaskRecord } from '@/lib/task-contract'
import type { CheckinRecord } from '@/lib/session-contract'
import { buildProgress, navigateGrid, type GridCell } from '@/lib/progress'

const selectedDayFormat = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })
const monthFormat = new Intl.DateTimeFormat('en-GB', { month: 'short' })

type Props = {
  tasks: TaskRecord[]
  allTasks: TaskRecord[]
  checkins: CheckinRecord[]
  today: string
  selectedDay: string
  onSelectDay: (day: string) => void
  title: string
  titleError: string
  onTitle: (value: string) => void
  onAddTask: (event: FormEvent<HTMLFormElement>) => void
  onAddCheckin: () => void
  onEditCheckin: (checkin: CheckinRecord) => void
}
function dateLabel(day: string): string {
  const [year, month, date] = day.split('-').map(Number)
  return selectedDayFormat.format(new Date(year, month - 1, date, 12))
}
function monthLabel(day: string): string {
  const [year, month] = day.split('-').map(Number)
  return monthFormat.format(new Date(year, month - 1, 1, 12))
}

export function ProgressScreen({ tasks, allTasks, checkins, today, selectedDay, onSelectDay, title, titleError, onTitle, onAddTask, onAddCheckin, onEditCheckin }: Props) {
  const [range, setRange] = useState<3 | 6>(3)
  const [activeDay, setActiveDay] = useState(today)
  const [previewDay, setPreviewDay] = useState<string | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const closeButton = useRef<HTMLButtonElement>(null)
  const focusFrame = useRef<number | null>(null)
  const progress = useMemo(() => buildProgress(allTasks, checkins, today, range), [allTasks, checkins, today, range])
  const cells = useMemo(() => progress.weeks.flat().filter((cell): cell is GridCell => cell !== null), [progress])
  const preview = cells.find(cell => cell.day === previewDay)
  const selected = cells.find(cell => cell.day === selectedDay)
  const visibleTasks = tasks.filter(task => task.day === selectedDay)
  const checkinsByTask = useMemo(() => {
    const grouped = new Map<string, CheckinRecord[]>()
    for (const checkin of checkins) {
      const records = grouped.get(checkin.taskId)
      if (records) records.push(checkin)
      else grouped.set(checkin.taskId, [checkin])
    }
    return grouped
  }, [checkins])
  const selectedCheckins = visibleTasks.flatMap(task => checkinsByTask.get(task.id) ?? [])
  const totalMinutes = selectedCheckins.reduce((total, checkin) => total + checkin.durationMinutes, 0)
  const completed = visibleTasks.filter(task => task.completed).length
  const rangeLabel = `Last ${range} months`

  useEffect(() => {
    if (cells.some(cell => cell.day === activeDay)) return
    setActiveDay(today)
    setPreviewDay(null)
  }, [activeDay, cells, today])
  useEffect(() => {
    if (!cells.some(cell => cell.day === selectedDay)) onSelectDay(today)
  }, [cells, selectedDay, today, onSelectDay])
  useEffect(() => { if (detailsOpen) closeButton.current?.focus() }, [detailsOpen])
  useEffect(() => () => { if (focusFrame.current !== null) cancelAnimationFrame(focusFrame.current) }, [])

  function closeDetails() {
    setDetailsOpen(false)
    focusFrame.current = requestAnimationFrame(() => document.querySelector<HTMLElement>(`[role="gridcell"][data-day="${activeDay}"]`)?.focus())
  }
  function dialogKey(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape') { event.preventDefault(); closeDetails(); return }
    if (event.key !== 'Tab') return
    const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')]
    const first = buttons[0], last = buttons.at(-1)
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
  }

  function openDay(day: string) {
    if (focusFrame.current !== null) cancelAnimationFrame(focusFrame.current)
    onSelectDay(day)
    setActiveDay(day)
    setPreviewDay(day)
    setDetailsOpen(true)
  }
  function onKey(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openDay(activeDay)
      return
    }
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const next = navigateGrid(activeDay, event.key, cells)
    setActiveDay(next)
    setPreviewDay(next)
    if (focusFrame.current !== null) cancelAnimationFrame(focusFrame.current)
    focusFrame.current = requestAnimationFrame(() => document.querySelector<HTMLElement>(`[role="gridcell"][data-day="${next}"]`)?.focus())
  }
  function openNearest(event: MouseEvent<HTMLDivElement>) {
    const elements = [...event.currentTarget.querySelectorAll<HTMLElement>('[role="gridcell"][data-day]')]
    const closest = elements.reduce<{ day: string; distance: number } | null>((best, element) => {
      const rect = element.getBoundingClientRect()
      const distance = (event.clientX - (rect.left + rect.width / 2)) ** 2 + (event.clientY - (rect.top + rect.height / 2)) ** 2
      return !best || distance < best.distance ? { day: element.dataset.day!, distance } : best
    }, null)
    if (closest) openDay(closest.day)
  }

  const checkinRows = (task: TaskRecord) => checkinsByTask.get(task.id) ?? []
  return <div className="flex flex-1 flex-col gap-4 px-4 pb-6 pt-4">
    <section aria-labelledby="activity-heading" className="min-w-0 rounded-[26px] border border-border bg-card p-4 shadow-none">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="mb-1 inline-flex size-9 items-center justify-center rounded-xl bg-mint-surface text-mint-ink"><LayoutGrid size={18} aria-hidden="true" /></span>
          <h2 id="activity-heading" className="font-display text-lg font-extrabold">Activity Grid</h2>
          <p className="text-xs text-muted-foreground">Every minute of focus, day by day.</p>
        </div>
        <div className="inline-flex shrink-0 gap-1 rounded-xl bg-surface-subtle p-1" aria-label="Activity Grid range">
          {([3, 6] as const).map(months => <button type="button" key={months} aria-label={`${months} mo`} aria-pressed={range === months} onClick={() => setRange(months)} className={`min-h-9 rounded-lg px-2.5 text-xs font-bold ${range === months ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>{months} mo</button>)}
        </div>
      </div>
      <p className="mb-3 text-[11px] font-semibold text-muted-foreground">{rangeLabel} · through Today</p>
      <div className="flex min-w-0 gap-1.5">
        <div aria-hidden="true" className="flex w-6 shrink-0 flex-col pt-[20px] text-[9px] font-semibold text-muted-foreground">
          {['Mon', '', 'Wed', '', 'Fri', '', ''].map((label, index) => <div key={index} className="flex flex-1 items-center">{label}</div>)}
        </div>
        <div role="grid" aria-label="Activity Grid" aria-describedby="grid-help" className="flex min-w-0 flex-1 gap-[2px]" onKeyDown={onKey} onClick={openNearest} onMouseLeave={event => { if (!event.currentTarget.contains(document.activeElement)) setPreviewDay(null) }}>
          {progress.weeks.map((week, index) => {
            const first = week.find((cell): cell is GridCell => cell !== null)
            const hasNewMonth = first && (index === 0 || week.some(cell => cell?.day.endsWith('-01')))
            return <div key={index} role="row" className="flex min-w-0 flex-1 flex-col gap-[2px]">
              <span aria-hidden="true" className="h-[18px] overflow-visible whitespace-nowrap text-[9px] font-bold text-muted-foreground">{hasNewMonth && first ? monthLabel(week.find(cell => cell?.day.endsWith('-01'))?.day ?? first.day) : ''}</span>
              {week.map((cell, weekday) => cell ? <div key={cell.day} role="gridcell" data-day={cell.day} aria-label={cell.label} aria-current={cell.today ? 'date' : undefined} tabIndex={activeDay === cell.day ? 0 : -1} onFocus={() => { setActiveDay(cell.day); setPreviewDay(cell.day) }} onMouseEnter={() => setPreviewDay(cell.day)} className="relative aspect-square min-w-0 cursor-pointer rounded-[3px] text-center text-[9px] font-bold leading-none tabular-nums outline-offset-1 focus-visible:outline-2 focus-visible:outline-mint" style={{ backgroundColor: `var(--color-grid-${cell.level})`, color: `var(--color-grid-text-${cell.level})` }}>
                {range === 3 && <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center">{Number(cell.day.slice(-2))}</span>}
                {cell.today && <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[3px] border-2 border-mint" />}
              </div> : <div key={weekday} aria-hidden="true" className="aspect-square min-w-0" />)}
            </div>
          })}
        </div>
      </div>
      <p id="grid-help" className="sr-only">Use left and right arrows for weeks, up and down for weekdays, Home and End for the week. Press Enter or Space to open a Day.</p>
      {preview && <div role="status" aria-label="Day preview" className="mt-3 rounded-xl bg-surface-subtle px-3 py-2 text-[11px] font-semibold text-foreground">{preview.label}</div>}
      {!allTasks.some(task => checkinsByTask.has(task.id)) && <p className="mt-3 text-xs text-muted-foreground">{allTasks.length ? 'Your first Check-in will light up today.' : 'Create your first Task for Today.'}</p>}
      <div aria-label="Activity Grid legend" className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-muted-foreground">
        {progress.legend.map((label, level) => <span key={level} className="inline-flex items-center gap-1"><span aria-hidden="true" className="size-2.5 rounded-[2px]" style={{ backgroundColor: `var(--color-grid-${level})` }} />{label}</span>)}
      </div>
    </section>

    <section aria-label="Focus statistics" className="grid grid-cols-2 gap-2.5">
      {[
        { label: 'Current Focus Streak', value: `${progress.streaks.current} days`, scope: 'All-time', icon: true },
        { label: 'Longest Focus Streak', value: `${progress.streaks.longest} days`, scope: 'All-time', icon: true },
        { label: 'Focused time', value: `${progress.stats.minutes} min`, scope: rangeLabel },
        { label: 'Check-ins', value: String(progress.stats.checkins), scope: rangeLabel },
        { label: 'Active Days', value: `${progress.stats.activeDays} days`, scope: rangeLabel },
        { label: 'Tasks completed', value: `${progress.stats.completed} / ${progress.stats.total}`, scope: rangeLabel },
      ].map(tile => <div key={tile.label} className="min-w-0 rounded-[20px] border border-border bg-card px-3.5 py-3.5">
        <p className="text-[10px] font-semibold text-muted-foreground">{tile.label}</p>
        <p className="mt-1 font-display text-xl font-extrabold tabular-nums text-foreground">{tile.icon && <Flame size={16} aria-hidden="true" className="mr-1 inline-block text-mint" />}{tile.value}</p>
        <p className="mt-1 text-[10px] font-medium text-muted-foreground">{tile.scope}</p>
      </div>)}
    </section>

    <section aria-labelledby="progress-day-heading" className="rounded-[24px] border border-border bg-card p-4">
      <h2 id="progress-day-heading" className="font-display text-base font-bold">{selectedDay === today ? `Today · ${dateLabel(today)}` : dateLabel(selectedDay)}</h2>
      <p className="mb-3 text-[11px] text-muted-foreground">{totalMinutes}m focused • {selectedCheckins.length} Check-ins • {completed} of {visibleTasks.length} tasks completed</p>
      {selectedDay === today && <form onSubmit={onAddTask} className="mb-3">
        <div className="flex min-h-[44px] items-center gap-2 rounded-[14px] bg-surface-subtle px-3 focus-within:outline-2 focus-within:outline-mint"><Plus size={16} aria-hidden="true" className="text-mint" />
          <input aria-label="New Task" value={title} onChange={event => onTitle(event.target.value)} placeholder="Add a Task to Today…" className="min-w-0 flex-1 bg-transparent py-2.5 text-[13px] outline-none placeholder:text-ink-tertiary" />
        </div>{titleError && <p role="alert" className="mt-1 text-xs text-destructive">{titleError}</p>}
      </form>}
      <ul aria-label="Tasks on selected Day" className="flex flex-col gap-2">
        {visibleTasks.map(task => {
          const records = checkinRows(task)
          const minutes = records.reduce((sum, checkin) => sum + checkin.durationMinutes, 0)
          return <li key={task.id} aria-label={`${task.title}, ${task.completed ? 'complete' : 'open'}, ${minutes} focused minutes`} className="rounded-xl bg-surface-subtle px-3 py-2.5 text-xs">
            <div className="flex items-start justify-between gap-2"><span className={`min-w-0 break-words font-bold ${task.completed ? 'line-through' : ''}`}>{task.title}</span><span className="shrink-0 rounded-full bg-card px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">{task.completed ? 'Done' : 'Open'}</span></div>
            <p className="mt-1 text-[11px] text-muted-foreground">{records.length ? `${minutes}m (${records.length} Check-ins)` : 'No focus recorded.'}</p>
            {records.map(checkin => <div key={checkin.id} className="mt-2 flex items-center justify-between gap-2 border-t border-border pt-2"><span>{checkin.origin === 'session' ? 'Pomodoro' : 'Added by hand'} · {checkin.durationMinutes} min</span><button type="button" aria-label={`Edit Check-in for ${task.title}`} onClick={() => onEditCheckin(checkin)} className="min-h-9 rounded-lg px-2 font-semibold text-mint-ink">Edit</button></div>)}
          </li>
        })}
      </ul>
      {!visibleTasks.length && <p className="py-2 text-xs text-muted-foreground">No Tasks for this Day.</p>}
      <button type="button" aria-label="Add Check-in" onClick={onAddCheckin} className="mt-3 min-h-11 w-full rounded-xl bg-mint-surface text-xs font-bold text-mint-ink"><Plus size={14} aria-hidden="true" className="mr-1 inline-block" />Add Check-in for {dateLabel(selectedDay)}</button>
    </section>
    {detailsOpen && <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/35" onClick={closeDetails}>
      <section role="dialog" aria-modal="true" aria-label="Day details" onClick={event => event.stopPropagation()} onKeyDown={dialogKey} className="max-h-[85svh] w-full max-w-[414px] overflow-y-auto rounded-t-[28px] bg-card px-5 pb-[max(32px,env(safe-area-inset-bottom))] pt-4 shadow-xl">
        <div className="mb-4 flex items-center justify-between"><h2 className="font-display text-lg font-bold">{selectedDay === today ? 'Today' : dateLabel(selectedDay)}</h2><button ref={closeButton} type="button" aria-label="Close Day details" onClick={closeDetails} className="grid size-11 place-items-center rounded-xl"><X size={18} aria-hidden="true" /></button></div>
        <p className="mb-3 text-xs text-muted-foreground">{selected?.label}</p>
        {visibleTasks.map(task => <div key={task.id} className="mb-2 rounded-xl bg-surface-subtle p-3 text-xs"><p className="font-bold">{task.title} · {task.completed ? 'Done' : 'Open'}</p><p className="mt-1 text-muted-foreground">{checkinRows(task).length ? `${checkinRows(task).reduce((sum, record) => sum + record.durationMinutes, 0)}m focused` : 'No focus recorded.'}</p>{checkinRows(task).map(checkin => <div key={checkin.id} className="mt-2 flex items-center justify-between gap-2"><span>{checkin.origin === 'session' ? 'Pomodoro' : 'Added by hand'} · {checkin.durationMinutes} min</span><button type="button" aria-label={`Edit Check-in for ${task.title}`} onClick={() => { setDetailsOpen(false); onEditCheckin(checkin) }} className="min-h-9 px-2 font-bold text-mint-ink">Edit</button></div>)}</div>)}
        {!visibleTasks.length && <p className="text-xs text-muted-foreground">No Tasks for this Day.</p>}
        <button type="button" aria-label="Add Check-in" onClick={() => { setDetailsOpen(false); onAddCheckin() }} className="mt-3 min-h-11 w-full rounded-xl bg-mint-surface text-xs font-bold text-mint-ink">Add Check-in for {dateLabel(selectedDay)}</button>
      </section>
    </div>}
  </div>
}
