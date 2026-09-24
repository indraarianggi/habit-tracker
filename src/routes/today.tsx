import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { liveQuery } from 'dexie'
import { ArrowDown, ArrowUp, Check, ChevronLeft, ChevronRight, EllipsisVertical, LayoutGrid, Pause, Pencil, Play, Plus, RefreshCw, SquareCheck, Timer, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { authClient } from '@/auth-client'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { localDay, type TaskRecord } from '@/lib/task-contract'
import { chooseTimerTask, type CheckinRecord, type SessionRecord } from '@/lib/session-contract'
import { startSession, syncSession } from '@/lib/session-client'
import { elapsedFocusMs, SessionStore } from '@/lib/session-store'
import { TaskStore } from '@/lib/task-store'
import { syncTasks } from '@/lib/task-sync'

type TodayUser = { id: string; name: string; image: string | null }
const cachedUserKey = 'habit-tracker:last-user'


function shiftDay(day: string, offset: number): string {
  const [year, month, date] = day.split('-').map(Number)
  const value = new Date(year, month - 1, date + offset, 12)
  return localDay(value)
}

function dayDate(day: string): Date {
  const [year, month, date] = day.split('-').map(Number)
  return new Date(year, month - 1, date, 12)
}

function dayLabel(day: string): string {
  return new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'short' }).format(dayDate(day))
}
export const Route = createFileRoute('/today')({ component: Today })

function Today() {
  const navigate = useNavigate()
  const [user, setUser] = useState<TodayUser | null>(null)
  const [store, setStore] = useState<TaskStore | null>(null)
  const [focusStore, setFocusStore] = useState<SessionStore | null>(null)
  const [focus, setFocus] = useState<{ session: SessionRecord | null; lastTaskId: string | null; checkins: CheckinRecord[] }>({ session: null, lastTaskId: null, checkins: [] })
  const [focusLoaded, setFocusLoaded] = useState(false)
  const [connected, setConnected] = useState(true)
  const [focusError, setFocusError] = useState('')
  const [stopMinutes, setStopMinutes] = useState<number | null>(null)
  const [awaySessionId, setAwaySessionId] = useState<string | null>(null)
  const [partialRecovery, setPartialRecovery] = useState(false)
  const [recoveryMinutes, setRecoveryMinutes] = useState('')
  const [focusEndMinutes, setFocusEndMinutes] = useState<number | null>(null)
  const [resumeAfterCancel, setResumeAfterCancel] = useState(false)
  const [starting, setStarting] = useState(false)
  const [clockNow, setClockNow] = useState(Date.now)
  const syncingFocus = useRef(false)
  const rerunFocus = useRef(false)
  const focusReady = useRef(false)
  const finishingFocus = useRef(false)
  const observedRunning = useRef<string | null>(null)
  const lastTick = useRef(Date.now())
  const manuallySelected = useRef(false)
  const [tasks, setTasks] = useState<TaskRecord[]>([])
  const [ready, setReady] = useState(false)
  const [firstLoadError, setFirstLoadError] = useState(false)
  const [sessionError, setSessionError] = useState('')
  const [syncError, setSyncError] = useState('')
  const [pending, setPending] = useState(0)
  const [title, setTitle] = useState('')
  const [titleError, setTitleError] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [view, setView] = useState<'timer' | 'tasks'>('timer')
  const [selectedDay, setSelectedDay] = useState(localDay)
  const [weekDays, setWeekDays] = useState<string[]>([])
  const [copySourceId, setCopySourceId] = useState<string | null>(null)
  const [copyDay, setCopyDay] = useState('')
  const [menuTaskId, setMenuTaskId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [actionError, setActionError] = useState('')
  const inFlight = useRef(false)
  const rerunRequested = useRef(false)
  const retryTimer = useRef<number | undefined>(undefined)
  const failures = useRef(0)
  const day = localDay()
  const displayedDay = view === 'tasks' ? selectedDay : day
  const menuTask = tasks.find(task => task.id === menuTaskId)
  const editingTask = tasks.find(task => task.id === editingId)
  const copySource = tasks.find(task => task.id === copySourceId)
  const weekStart = shiftDay(selectedDay, -((dayDate(selectedDay).getDay() + 6) % 7))
  const weekEnd = shiftDay(weekStart, 6)
  const unfinishedPast = selectedDay < day && tasks.some(task => !task.completed)
  const activeFocus = focus.session
  const elapsedMs = activeFocus ? elapsedFocusMs(activeFocus, clockNow) : 0
  const remainingSeconds = Math.max(0, Math.ceil(((activeFocus?.plannedMinutes ?? 25) * 60_000 - elapsedMs) / 1000))
  const clockText = `${String(Math.floor(remainingSeconds / 60)).padStart(2, '0')}:${String(remainingSeconds % 60).padStart(2, '0')}`
  const todayCheckins = focus.checkins.filter(checkin => tasks.some(task => task.id === checkin.taskId))
  const minutesForTask = (taskId: string) => todayCheckins.reduce((sum, checkin) => sum + (checkin.taskId === taskId ? checkin.durationMinutes : 0), 0)

  useEffect(() => {
    const instance = new TaskStore()
    setStore(instance)
    return () => {
      clearTimeout(retryTimer.current)
      instance.close()
    }
  }, [])
  useEffect(() => {
    const instance = new SessionStore()
    setFocusStore(instance)
    return () => instance.close()
  }, [])

  const syncFocus = useCallback(async () => {
    if (!focusStore || !user || !navigator.onLine) return
    if (syncingFocus.current) {
      rerunFocus.current = true
      return
    }
    syncingFocus.current = true
    try {
      await syncSession(focusStore, user.id)
      if (!focusReady.current) {
        setFocus(await focusStore.snapshot(user.id))
        focusReady.current = true
      }
      setConnected(true)
      setFocusLoaded(true)
      setFocusError('')
    } catch (reason) {
      setConnected(false)
      setFocusError(reason instanceof Error ? reason.message : 'Could not sync focus.')
    } finally {
      syncingFocus.current = false
      if (rerunFocus.current) {
        rerunFocus.current = false
        void syncFocus()
      }
    }
  }, [focusStore, user])

  useEffect(() => {
    if (!focusStore || !user) return
    const subscription = liveQuery(() => focusStore.snapshot(user.id)).subscribe({
      next: setFocus,
      error: () => setFocusError('Could not read focus on this device.'),
    })
    const online = () => { setConnected(true); void syncFocus() }
    const offline = () => setConnected(false)
    const foreground = () => {
      if (document.visibilityState !== 'visible') observedRunning.current = null
      setClockNow(Date.now())
      lastTick.current = Date.now()
      if (document.visibilityState === 'visible') void syncFocus()
    }
    window.addEventListener('online', online)
    window.addEventListener('offline', offline)
    document.addEventListener('visibilitychange', foreground)
    const clock = window.setInterval(() => {
      const now = Date.now()
      if (now - lastTick.current > 5000) observedRunning.current = null
      lastTick.current = now
      setClockNow(now)
    }, 1000)
    const poll = window.setInterval(() => { if (navigator.onLine) void syncFocus() }, 5000)
    setConnected(navigator.onLine)
    void syncFocus()
    return () => {
      subscription.unsubscribe()
      window.clearInterval(clock)
      window.clearInterval(poll)
      window.removeEventListener('online', online)
      window.removeEventListener('offline', offline)
      document.removeEventListener('visibilitychange', foreground)
    }
  }, [focusStore, user, syncFocus])

  useEffect(() => {
    if (view !== 'timer') return
    if (!tasks.length) {
      setSelectedId(null)
      manuallySelected.current = false
    } else {
      setSelectedId(current => manuallySelected.current && tasks.some(task => task.id === current)
        ? current : chooseTimerTask(tasks, focus.lastTaskId)?.id ?? null)
    }
  }, [view, tasks, focus.lastTaskId])

  async function finishFocus(outcome: 'finish' | 'save' | 'discard', durationMinutes?: number, alertOnFinish = false) {
    if (!focusStore || !user || finishingFocus.current) return
    finishingFocus.current = true
    try {
      await focusStore.finish(user.id, outcome, durationMinutes)
      setStopMinutes(null)
      setAwaySessionId(null)
      setPartialRecovery(false)
      if (alertOnFinish) setFocusEndMinutes(focus.session?.plannedMinutes ?? null)
      setFocusError('')
      void syncFocus()
    } catch (reason) {
      setFocusError(reason instanceof Error ? reason.message : 'Could not finish focus on this device.')
    } finally {
      finishingFocus.current = false
    }
  }

  useEffect(() => {
    if (!activeFocus || activeFocus.status !== 'running' || !focusStore || !user || (!focusLoaded && connected)) return
    if (elapsedMs < activeFocus.plannedMinutes * 60_000) {
      if (document.visibilityState === 'visible') observedRunning.current = activeFocus.id
    } else if (!finishingFocus.current && document.visibilityState === 'visible') {
      if (observedRunning.current === activeFocus.id) {
        observedRunning.current = null
        void finishFocus('finish', undefined, true)
      } else {
        setAwaySessionId(activeFocus.id)
      }
    }
  }, [activeFocus, elapsedMs, focusStore, user, focusLoaded, connected])

  async function beginFocus() {
    const selected = tasks.find(task => task.id === selectedId)
    if (!store || !focusStore || !user || !selected || selected.day !== localDay() || !connected || starting) return
    setStarting(true)
    try {
      await syncTasks(store, user.id)
      const session = await startSession(selected.id, localDay())
      await focusStore.started(user.id, session)
      observedRunning.current = session.id
      setFocusEndMinutes(null)
      setClockNow(Date.now())
      setFocusError('')
    } catch (reason) {
      setFocusError(reason instanceof Error ? reason.message : 'Could not start a Session.')
      void syncFocus()
    } finally {
      setStarting(false)
    }
  }

  async function toggleFocus() {
    if (!focusStore || !user || !activeFocus) return
    try {
      await focusStore.control(user.id, activeFocus.status === 'running' ? 'pause' : 'resume')
      setClockNow(Date.now())
      void syncFocus()
    } catch (reason) {
      setFocusError(reason instanceof Error ? reason.message : 'Could not control focus.')
    }
  }

  async function stopFocus() {
    if (!focusStore || !user || !activeFocus) return
    try {
      if (elapsedMs >= activeFocus.plannedMinutes * 60_000) {
        await finishFocus('finish')
        return
      }
      const minutes = Math.floor(elapsedMs / 60_000)
      const wasRunning = activeFocus.status === 'running'
      if (wasRunning) {
        await focusStore.control(user.id, 'pause')
        void syncFocus()
      }
      setResumeAfterCancel(wasRunning)
      if (minutes < 1) await finishFocus('discard')
      else setStopMinutes(minutes)
    } catch (reason) {
      setFocusError(reason instanceof Error ? reason.message : 'Could not stop focus on this device.')
    }
  }

  const loadSession = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch('/api/today', { credentials: 'same-origin', signal })
      if (response.status === 401) {
        localStorage.removeItem(cachedUserKey)
        void navigate({ to: '/', replace: true })
        return
      }
      if (!response.ok) throw new Error('Could not load Today')
      const data: { user: TodayUser } = await response.json()
      localStorage.setItem(cachedUserKey, JSON.stringify(data.user))
      setUser(data.user)
      setFirstLoadError(false)
      setSessionError('')
    } catch (reason) {
      if (signal?.aborted) return
      const cached = localStorage.getItem(cachedUserKey)
      if (cached) {
        try {
          const previous = JSON.parse(cached) as TodayUser
          if (previous.id && previous.name) {
            setUser(previous)
            setSyncError('Offline')
            return
          }
        } catch { /* An invalid identity is not a usable local account. */ }
      }
      setFirstLoadError(true)
      setSessionError(reason instanceof Error ? reason.message : 'Could not load Today')
    }
  }, [navigate])

  useEffect(() => {
    const controller = new AbortController()
    void loadSession(controller.signal)
    return () => controller.abort()
  }, [loadSession])

  const refreshPending = useCallback(async () => {
    if (store && user) setPending((await store.syncState(user.id)).pending)
  }, [store, user])

  const sync = useCallback(async () => {
    if (!store || !user) return
    if (inFlight.current) {
      rerunRequested.current = true
      return
    }
    inFlight.current = true
    clearTimeout(retryTimer.current)
    try {
      await syncTasks(store, user.id)
      setReady(true)
      setFirstLoadError(false)
      setSyncError('')
      failures.current = 0
      await refreshPending()
    } catch (reason) {
      setSyncError(reason instanceof Error ? reason.message : 'Could not sync')
      const state = await store.syncState(user.id)
      if (!state.firstLoadComplete) setFirstLoadError(true)
      failures.current += 1
      if (navigator.onLine) {
        retryTimer.current = window.setTimeout(() => void sync(), Math.min(1000 * 2 ** (failures.current - 1), 300_000))
      }
    } finally {
      inFlight.current = false
      if (rerunRequested.current) {
        rerunRequested.current = false
        void sync()
      }
    }
  }, [store, user, refreshPending])

  useEffect(() => {
    if (!store || !user) return
    let active = true
    setReady(false)
    setTasks([])
    void store.syncState(user.id).then(state => {
      if (!active) return
      setReady(state.firstLoadComplete)
      setPending(state.pending)
      void sync()
    })
    const reconnect = () => void sync()
    const foreground = () => { if (document.visibilityState === 'visible') void sync() }
    window.addEventListener('online', reconnect)
    document.addEventListener('visibilitychange', foreground)
    return () => {
      active = false
      window.removeEventListener('online', reconnect)
      document.removeEventListener('visibilitychange', foreground)
      clearTimeout(retryTimer.current)
    }
  }, [store, user, sync])

  useEffect(() => {
    if (!store || !user) return
    setTasks([])
    const subscription = liveQuery(() => store.listTasks(user.id, displayedDay)).subscribe({
      next: setTasks,
      error: () => setSyncError('Could not read Tasks on this device.'),
    })
    return () => subscription.unsubscribe()
  }, [store, user, displayedDay])
  useEffect(() => {
    if (!store || !user) return
    setWeekDays([])
    const subscription = liveQuery(() => store.daysWithTasks(user.id, weekStart, weekEnd)).subscribe({
      next: setWeekDays,
      error: () => setSyncError('Could not read planned Days on this device.'),
    })
    return () => subscription.unsubscribe()
  }, [store, user, weekStart, weekEnd])

  useEffect(() => {
    if (!user && firstLoadError) {
      const reconnect = () => void loadSession()
      window.addEventListener('online', reconnect)
      return () => window.removeEventListener('online', reconnect)
    }
  }, [user, firstLoadError, loadSession])

  async function addTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!store || !user) return
    try {
      const task = await store.createTask(user.id, title, displayedDay)
      setTitle('')
      setTitleError('')
      if (displayedDay === localDay()) { manuallySelected.current = true; setSelectedId(task.id) }
      await refreshPending()
      void sync()
    } catch (reason) {
      setTitleError(reason instanceof Error ? reason.message : 'Could not save Task on this device.')
    }
  }
  function selectDay(value: string) {
    setSelectedDay(value)
    setTitle('')
    setTitleError('')
    setMenuTaskId(null)
    setCopySourceId(null)
  }

  function startCopy(task: TaskRecord) {
    setMenuTaskId(null)
    setCopySourceId(task.id)
    setCopyDay(shiftDay(task.day, 1) > localDay() ? shiftDay(task.day, 1) : localDay())
    setActionError('')
  }

  async function submitCopy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!copySource || !store || !user) return
    if (await changeTask(() => store.copyTask(user.id, copySource.id, copyDay))) {
      setCopySourceId(null)
    }
  }

  async function changeTask(action: () => Promise<unknown>): Promise<boolean> {
    if (!store || !user) return false
    try {
      await action()
      setActionError('')
      setMenuTaskId(null)
      await refreshPending()
      void sync()
      return true
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : 'Could not save Task on this device.')
      return false
    }
  }

  function startRename(task: TaskRecord) {
    setMenuTaskId(null)
    setEditingId(task.id)
    setEditTitle(task.title)
    setActionError('')
  }

  async function saveRename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!store || !user || !editingTask) return
    if (await changeTask(() => store.renameTask(user.id, editingTask.id, editTitle))) {
      setEditingId(null)
    }
  }

  useEffect(() => {
    if (!menuTaskId && !editingId && !copySourceId) return
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuTaskId(null)
        setEditingId(null)
        setCopySourceId(null)
        setActionError('')
      }
    }
    document.addEventListener('keydown', dismiss)
    return () => document.removeEventListener('keydown', dismiss)
  }, [menuTaskId, editingId, copySourceId])

  async function signOut() {
    try {
      const result = await authClient.signOut()
      if (result.error) throw result.error
      localStorage.removeItem(cachedUserKey)
      void navigate({ to: '/', replace: true })
    } catch {
      setSessionError('Could not sign out. Try again.')
    }
  }

  if (!user || !ready) {
    return (
      <main className="mx-auto grid min-h-svh w-full max-w-[414px] place-items-center px-6">
        <Card className="w-full items-center gap-5 rounded-[28px] px-6 py-9 text-center shadow-none">
          <div className="grid size-[60px] place-items-center rounded-full border-[3px] border-mint bg-mint-surface text-mint">
            <RefreshCw size={28} aria-hidden="true" />
          </div>
          <h1 className="text-xl font-extrabold">Loading your data…</h1>
          <p role="status" className="text-[13px] text-muted-foreground">Syncing your Tasks from the secure server.</p>
          {firstLoadError && (
            <div className="w-full rounded-2xl border border-amber bg-amber-surface px-3.5 py-3 text-amber">
              <p className="text-xs font-bold">Connect to the internet to load your data.</p>
              <Button className="mt-2 h-8 rounded-[10px] bg-amber px-4 text-xs font-bold text-white hover:bg-[#b45309]" onClick={() => user ? void sync() : void loadSession()}>Try again</Button>
            </div>
          )}
        </Card>
      </main>
    )
  }

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-[414px] flex-col">
      <header className="flex min-h-14 items-center justify-between px-5">
        <span className="whitespace-nowrap text-[22px] font-bold tracking-tight">Habit Tracker</span>
        <div className="flex items-center gap-2">
          <Avatar className="size-[34px] border-[1.5px] border-mint bg-mint-surface" aria-label={`${user.name}'s profile`}>
            {user.image && <AvatarImage src={user.image} alt="" referrerPolicy="no-referrer" />}
            <AvatarFallback className="bg-mint-surface font-bold text-mint-ink">{user.name.slice(0, 1).toUpperCase()}</AvatarFallback>
          </Avatar>
          <Button variant="ghost" className="h-11 px-1 text-xs text-muted-foreground hover:text-foreground" type="button" onClick={() => void signOut()}>Sign out</Button>
        </div>
      </header>
      {(pending > 0 || (syncError && (!navigator.onLine || failures.current >= 3))) && (
        <div className="flex justify-end px-5 pb-1">
          <button type="button" onClick={() => void sync()} className="rounded-full bg-amber-surface px-2 py-1 text-[11px] font-semibold text-amber">
            {!navigator.onLine ? 'Offline' : pending > 0 ? `${pending} ${pending === 1 ? 'change' : 'changes'} waiting` : 'Can’t sync'}
          </button>
        </div>
      )}
      {sessionError && <p role="alert" className="px-5 text-sm text-destructive">{sessionError}</p>}
      {focusEndMinutes !== null && <div role="alert" aria-label="Focus interval complete" className="mx-5 flex items-center justify-between gap-3 rounded-2xl border border-mint bg-mint-surface px-4 py-3 text-sm font-semibold text-mint-ink">
        <span>Focus interval complete · {focusEndMinutes} min recorded</span>
        <button type="button" aria-label="Dismiss focus alert" onClick={() => setFocusEndMinutes(null)} className="grid size-9 shrink-0 place-items-center rounded-lg focus-visible:outline-2 focus-visible:outline-mint"><X size={17} aria-hidden="true" /></button>
      </div>}
      <h1 className="sr-only">{view === 'tasks' ? 'Tasks' : 'Today'}</h1>
      {view === 'timer' ? <div className="flex flex-1 flex-col gap-4 px-5 py-5">
        <section aria-labelledby="timer-heading">
          <Card className="items-center gap-4 rounded-[26px] px-5 py-5 text-center shadow-none">
            <div className="relative grid size-[220px] shrink-0 place-items-center">
              <svg viewBox="0 0 220 220" className="absolute inset-0 size-full -rotate-90" aria-hidden="true">
                <circle cx="110" cy="110" r="95" fill="none" stroke="#e2f5eb" strokeWidth="12" />
                <circle cx="110" cy="110" r="95" fill="none" stroke="#2da46f" strokeWidth="12" strokeLinecap="round" strokeDasharray={2 * Math.PI * 95} strokeDashoffset={2 * Math.PI * 95 * (activeFocus ? elapsedMs / (activeFocus.plannedMinutes * 60_000) : 0)} />
              </svg>
              <div className="flex flex-col items-center gap-1">
                <span className="font-display text-[48px] font-extrabold leading-none tracking-[-.05em] tabular-nums" aria-live="off">{clockText}</span>
                <span className="text-xs font-semibold text-muted-foreground">{activeFocus?.status === 'paused' ? 'Paused' : 'Focus time'}</span>
              </div>
            </div>
            {activeFocus ? <>
              <h2 id="timer-heading" className="max-w-full break-words text-base font-bold">Focusing on {tasks.find(task => task.id === activeFocus.taskId)?.title ?? 'your Task'}</h2>
              <div className="flex w-full gap-2">
                <Button type="button" onClick={() => void toggleFocus()} className="min-h-12 flex-1 rounded-[18px] bg-primary font-bold text-white">
                  {activeFocus.status === 'paused' ? <Play size={16} aria-hidden="true" /> : <Pause size={16} aria-hidden="true" />}
                  {activeFocus.status === 'paused' ? 'Resume Session' : 'Pause Session'}
                </Button>
                <Button type="button" variant="outline" onClick={() => void stopFocus()} className="min-h-12 rounded-[18px] px-5 font-bold">Stop</Button>
              </div>
            </> : tasks.length === 0 ? <>
              <h2 id="timer-heading" className="text-base font-bold">What will you focus on today?</h2>
              <p className="text-xs leading-relaxed text-muted-foreground">Add a task below to start your focus session.</p>
            </> : <>
              <h2 id="timer-heading" className="sr-only">Today’s timer</h2>
              <Button type="button" onClick={() => void beginFocus()} disabled={!connected || !focusLoaded || !selectedId || starting} className="min-h-12 w-full rounded-[18px] bg-primary text-[15px] font-bold text-white">
                <Play size={16} aria-hidden="true" /> Start Session
              </Button>
              {!connected && <p role="status" className="text-xs font-semibold text-amber">Connect to the internet to start a session.</p>}
            </>}
          </Card>
        </section>
        {!activeFocus && <section aria-labelledby="task-list-heading" className="flex flex-col gap-2">
          <h2 id="task-list-heading" className="text-[13px] font-bold text-muted-foreground">Focus on</h2>
          <form onSubmit={event => void addTask(event)}>
            <div className="flex min-h-[42px] items-center gap-2 rounded-[14px] border border-border bg-card px-3 text-sm focus-within:border-mint">
              <Plus size={17} className="shrink-0 text-mint" aria-hidden="true" />
              <input aria-label="New Task" aria-describedby={titleError ? 'task-title-error' : undefined} value={title} onChange={event => { setTitle(event.target.value); if (titleError) setTitleError('') }} placeholder="New Task…" className="min-w-0 flex-1 bg-transparent py-2.5 text-[13px] text-foreground outline-none placeholder:text-ink-tertiary" />
            </div>
            {titleError && <p id="task-title-error" role="alert" className="mt-1 text-xs text-destructive">{titleError}</p>}
          </form>
          {tasks.map(task => {
            const minutes = minutesForTask(task.id)
            return <button type="button" key={task.id} onClick={() => { manuallySelected.current = true; setSelectedId(task.id) }} aria-label={`${task.title}, ${task.completed ? 'complete' : 'open'}, ${minutes} focused minutes`} aria-pressed={selectedId === task.id} className={`flex min-h-[44px] w-full items-center gap-2.5 rounded-2xl border bg-card px-3.5 py-2.5 text-left text-[13px] font-semibold ${selectedId === task.id ? 'border-mint' : 'border-border'}`}>
              <span className={`size-[18px] shrink-0 rounded-full border-2 ${selectedId === task.id ? 'grid place-items-center border-mint' : 'border-border'}`}>{selectedId === task.id && <span className="size-2 rounded-full bg-mint" />}</span>
              <span className={`min-w-0 flex-1 break-words ${task.completed ? 'text-muted-foreground line-through' : ''}`}>{task.title}</span>
              <span className="shrink-0 text-[11px] font-medium text-ink-tertiary">{minutes ? `${minutes}m` : 'No focus'}</span>
            </button>
          })}
        </section>}
        {focusError && <p role="alert" className="text-xs text-destructive">{focusError}</p>}
        <section aria-labelledby="today-focus-heading">
          <Card className="gap-2.5 rounded-[22px] p-4 shadow-none">
            <h2 id="today-focus-heading" className="text-sm font-bold">Today's focus {todayCheckins.length > 0 && <span className="ml-1 rounded-full bg-mint-surface px-2 py-0.5 text-xs text-mint-ink">{todayCheckins.reduce((sum, checkin) => sum + checkin.durationMinutes, 0)}m</span>}</h2>
            {todayCheckins.length === 0 ? <p className="text-[13px] text-ink-tertiary">No focus recorded today yet.</p> : todayCheckins.map(checkin => (
              <div key={checkin.id} className="flex items-center justify-between gap-2 rounded-xl bg-surface-subtle px-2.5 py-2 text-left text-xs">
                <div className="min-w-0"><p className="break-words font-bold">{tasks.find(task => task.id === checkin.taskId)?.title}</p><p className="text-[10px] text-muted-foreground">Pomodoro</p></div>
                <span className="shrink-0 font-bold text-mint-ink">{checkin.durationMinutes} min</span>
              </div>
            ))}
          </Card>
        </section>
      </div> : <div className="flex flex-1 flex-col gap-3 px-4 py-3">
        <section aria-label="Choose a Day" className="rounded-[22px] border border-border bg-card p-3">
          <div className="flex items-center justify-between px-1 pb-2">
            <button type="button" aria-label="Previous week" onClick={() => selectDay(shiftDay(selectedDay, -7))} className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-mint"><ChevronLeft size={18} aria-hidden="true" /></button>
            <span className="text-xs font-semibold">{new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(dayDate(weekStart))} – {new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).format(dayDate(weekEnd))}</span>
            <button type="button" aria-label="Next week" onClick={() => selectDay(shiftDay(selectedDay, 7))} className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-mint"><ChevronRight size={18} aria-hidden="true" /></button>
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 7 }, (_, index) => shiftDay(weekStart, index)).map(date => (
              <button key={date} type="button" onClick={() => selectDay(date)} aria-label={`${dayLabel(date)}${weekDays.includes(date) ? ', has Tasks' : ''}`} aria-current={date === selectedDay ? 'date' : undefined} className={`flex min-w-0 flex-col items-center rounded-[10px] py-1.5 text-[11px] ${date === selectedDay ? 'bg-mint-surface font-bold text-mint-ink' : 'bg-surface-subtle text-muted-foreground'}`}>
                <span>{new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(dayDate(date))}</span>
                <span className="text-sm font-semibold">{dayDate(date).getDate()}</span>
                <span aria-hidden="true" className={`mt-1 size-1 rounded-full ${weekDays.includes(date) ? 'bg-mint' : 'bg-transparent'}`} />
              </button>
            ))}
          </div>
        </section>
        <section aria-labelledby="day-tasks-heading" className="rounded-[24px] border border-border bg-card p-4">
          <h2 id="day-tasks-heading" className="font-display text-base font-bold">{selectedDay === day ? `Today · ${dayLabel(selectedDay)}` : dayLabel(selectedDay)}</h2>
          <p className="mb-3 text-[11px] text-muted-foreground">{todayCheckins.reduce((sum, checkin) => sum + checkin.durationMinutes, 0)}m focused • {todayCheckins.length} Check-ins • {tasks.filter(task => task.completed).length} of {tasks.length} tasks completed</p>
          {unfinishedPast && <p className="mb-3 text-[11px] text-muted-foreground">Unfinished tasks stay on this Day. Tap Copy → to bring work forward.</p>}
          {selectedDay >= day && <form onSubmit={event => void addTask(event)} className="mb-2">
            <div className="flex min-h-[42px] items-center gap-2 rounded-[14px] bg-surface-subtle px-3 focus-within:outline-2 focus-within:outline-mint">
              <Plus size={16} className="text-mint" aria-hidden="true" />
              <input aria-label="New Task" aria-describedby={titleError ? 'task-title-error' : undefined} value={title} onChange={event => { setTitle(event.target.value); setTitleError('') }} placeholder="Add a Task…" className="min-w-0 flex-1 bg-transparent py-2.5 text-[13px] outline-none placeholder:text-ink-tertiary" />
            </div>
            {titleError && <p id="task-title-error" role="alert" className="mt-1 text-xs text-destructive">{titleError}</p>}
          </form>}
          <ul aria-label="Tasks for selected Day" className="flex flex-col gap-1.5">
            {tasks.map(task => <li key={task.id} aria-label={`${task.title}, ${task.completed ? 'complete' : 'open'}, ${minutesForTask(task.id)} focused minutes`} className="flex min-h-[46px] items-center gap-2 rounded-xl border border-border bg-card px-2.5 py-1.5">
              <span aria-hidden="true" className={`grid size-[20px] shrink-0 place-items-center rounded-md border ${task.completed ? 'border-mint bg-mint text-white' : 'border-border'}`}>{task.completed && <Check size={14} />}</span>
              <span className={`min-w-0 flex-1 break-words text-[13px] font-semibold ${task.completed ? 'text-muted-foreground line-through' : ''}`}>{task.title}</span>
              <span aria-hidden="true" className="shrink-0 text-[10px] text-ink-tertiary">{minutesForTask(task.id) ? `${minutesForTask(task.id)}m` : 'No focus'}</span>
              {selectedDay < day && !task.completed && <button type="button" onClick={() => startCopy(task)} className="shrink-0 rounded-lg px-1 py-2 text-[11px] font-semibold text-mint-ink hover:bg-mint-surface focus-visible:outline-2 focus-visible:outline-mint">Copy →</button>}
              <button type="button" aria-label={`Actions for ${task.title}`} onClick={() => { setMenuTaskId(task.id); setActionError('') }} className="grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-mint"><EllipsisVertical size={17} aria-hidden="true" /></button>
            </li>)}
          </ul>
          {tasks.length === 0 && <p className="py-3 text-center text-xs text-muted-foreground">{selectedDay > day ? 'No Tasks for this Day. Add one above to plan ahead.' : 'No Tasks for this Day.'}</p>}
        </section>
      </div>}
      <nav className="sticky bottom-0 flex min-h-[72px] items-center justify-around border-t border-border bg-card px-4 py-2 pb-[max(8px,env(safe-area-inset-bottom))]" aria-label="Main sections">
        <button type="button" onClick={() => setView('timer')} aria-current={view === 'timer' ? 'page' : undefined} className={`flex h-[52px] w-20 flex-col items-center justify-center gap-1 rounded-2xl text-[11px] ${view === 'timer' ? 'bg-mint-surface font-bold text-mint' : 'text-muted-foreground'}`}><Timer size={20} aria-hidden="true" />Timer</button>
        <button type="button" onClick={() => setView('tasks')} aria-current={view === 'tasks' ? 'page' : undefined} className={`flex h-[52px] w-20 flex-col items-center justify-center gap-1 rounded-2xl text-[11px] ${view === 'tasks' ? 'bg-mint-surface font-bold text-mint' : 'text-muted-foreground'}`}><SquareCheck size={20} aria-hidden="true" />Tasks</button>
        <span className="flex h-[52px] w-20 flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-medium text-muted-foreground opacity-65" aria-disabled="true" title="Progress is coming in a later update"><LayoutGrid size={20} aria-hidden="true" />Progress</span>
      </nav>
      {(menuTask || editingTask || copySource) && <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/35" onClick={() => { setMenuTaskId(null); setEditingId(null); setCopySourceId(null); setActionError('') }}>
        <section role="dialog" aria-modal="true" aria-label={copySource ? `Copy ${copySource.title}` : editingTask ? `Rename ${editingTask.title}` : `Actions for ${menuTask?.title}`} onClick={event => event.stopPropagation()} className="w-full max-w-[414px] rounded-t-[28px] bg-card px-5 pb-[max(32px,env(safe-area-inset-bottom))] pt-4 shadow-xl">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="break-words text-base font-bold">{copySource ? 'Copy to a later Day' : editingTask ? 'Rename Task' : menuTask?.title}</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">{dayLabel((copySource ?? editingTask ?? menuTask)!.day)} · 0m focused</p>
            </div>
            <button type="button" aria-label="Close Task actions" onClick={() => { setMenuTaskId(null); setEditingId(null); setCopySourceId(null); setActionError('') }} className="grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground"><X size={19} aria-hidden="true" /></button>
          </div>
          {copySource ? <form onSubmit={event => void submitCopy(event)} className="flex flex-col gap-3">
            <p className="text-xs text-muted-foreground">The original Task stays on its Day. The copy starts incomplete with no focus history.</p>
            <label className="text-xs font-semibold" htmlFor="copy-target-day">Destination Day</label>
            <input id="copy-target-day" type="date" aria-label="Destination Day" required min={shiftDay(copySource.day, 1) > day ? shiftDay(copySource.day, 1) : day} value={copyDay} onChange={event => { setCopyDay(event.target.value); setActionError('') }} className="h-11 rounded-xl border border-border px-3 text-sm outline-none focus:border-mint" />
            {actionError && <p role="alert" className="text-xs text-destructive">{actionError}</p>}
            <Button type="submit" className="h-11 rounded-xl bg-mint text-white hover:bg-mint-ink">Copy Task</Button>
          </form> : editingTask ? <form onSubmit={event => void saveRename(event)} className="flex flex-col gap-3">
            <label className="text-xs font-semibold" htmlFor="edit-task-title">Task title</label>
            <input id="edit-task-title" aria-label="Task title" autoFocus value={editTitle} onChange={event => { setEditTitle(event.target.value); setActionError('') }} className="h-11 rounded-xl border border-border px-3 text-sm outline-none focus:border-mint" />
            {actionError && <p role="alert" className="text-xs text-destructive">{actionError}</p>}
            <Button type="submit" className="h-11 rounded-xl bg-mint text-white hover:bg-mint-ink">Save title</Button>
          </form> : menuTask && <div className="flex flex-col gap-1">
            <button type="button" autoFocus onClick={() => startRename(menuTask)} className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-left text-sm hover:bg-surface-subtle"><Pencil size={18} aria-hidden="true" />Rename Task</button>
            <button type="button" onClick={() => void changeTask(() => store!.setTaskCompleted(user.id, menuTask.id, !menuTask.completed))} className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-left text-sm hover:bg-surface-subtle"><Check size={18} aria-hidden="true" />{menuTask.completed ? 'Reopen Task' : 'Mark as complete'}</button>
            <button type="button" disabled={tasks[0]?.id === menuTask.id} onClick={() => void changeTask(() => store!.moveTask(user.id, menuTask.id, 'up'))} className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-left text-sm hover:bg-surface-subtle disabled:opacity-35"><ArrowUp size={18} aria-hidden="true" />Move up</button>
            <button type="button" disabled={tasks.at(-1)?.id === menuTask.id} onClick={() => void changeTask(() => store!.moveTask(user.id, menuTask.id, 'down'))} className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-left text-sm hover:bg-surface-subtle disabled:opacity-35"><ArrowDown size={18} aria-hidden="true" />Move down</button>
            {!menuTask.completed && <button type="button" onClick={() => startCopy(menuTask)} className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-left text-sm hover:bg-surface-subtle"><ChevronRight size={18} aria-hidden="true" />Copy to a later Day →</button>}
            {actionError && <p role="alert" className="px-3 text-xs text-destructive">{actionError}</p>}
          </div>}
        </section>
      </div>}
      {stopMinutes !== null && <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/35">
        <section role="dialog" aria-modal="true" aria-label="Stop Session" className="flex w-full max-w-[414px] flex-col gap-3 rounded-t-[28px] bg-card px-5 pb-[max(32px,env(safe-area-inset-bottom))] pt-5">
          <h2 className="font-display text-lg font-bold">Stop Session?</h2>
          <p className="text-sm text-muted-foreground">Save {stopMinutes} whole {stopMinutes === 1 ? 'minute' : 'minutes'} of focus, or discard this interval.</p>
          <Button type="button" onClick={() => void finishFocus('save', stopMinutes)} className="min-h-11 rounded-xl bg-primary text-white">Save {stopMinutes} min</Button>
          <Button type="button" variant="outline" onClick={() => void finishFocus('discard')} className="min-h-11 rounded-xl">Discard focus</Button>
          <button type="button" className="min-h-11 text-sm text-muted-foreground" onClick={() => { setStopMinutes(null); if (resumeAfterCancel) void toggleFocus() }}>Keep Session</button>
        </section>
      </div>}
      {awaySessionId === activeFocus?.id && activeFocus.status === 'running' && elapsedMs >= activeFocus.plannedMinutes * 60_000 && <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-5">
        <section role="dialog" aria-modal="true" aria-label="While you were away" className="flex w-full max-w-[374px] flex-col gap-4 rounded-[32px] border border-border bg-card p-6 shadow-xl">
          <div>
            <h2 className="font-display text-xl font-extrabold">While you were away</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Your focus interval ended while you were away. How much focused time would you like to record?</p>
          </div>
          <div className="flex flex-col gap-2">
            <Button type="button" onClick={() => void finishFocus('finish')} className="min-h-12 rounded-2xl bg-primary text-white">Fully finished · {activeFocus.plannedMinutes} min</Button>
            <Button type="button" variant="outline" onClick={() => { setPartialRecovery(true); setRecoveryMinutes('') }} className="min-h-12 rounded-2xl">Partly finished</Button>
            {partialRecovery && <form onSubmit={event => {
              event.preventDefault()
              const minutes = Number(recoveryMinutes)
              if (Number.isInteger(minutes) && minutes >= 1 && minutes < activeFocus.plannedMinutes) void finishFocus('save', minutes)
            }} className="flex flex-col gap-2 rounded-2xl bg-surface-subtle p-3">
              <label htmlFor="recovery-minutes" className="text-xs font-semibold">Whole focused minutes</label>
              <input id="recovery-minutes" aria-label="Focused minutes" type="number" required min={1} max={activeFocus.plannedMinutes - 1} step={1} value={recoveryMinutes} onChange={event => setRecoveryMinutes(event.target.value)} className="h-11 w-full rounded-xl border border-border bg-card px-3 text-base outline-none focus:border-mint" />
              <Button type="submit" disabled={!Number.isInteger(Number(recoveryMinutes)) || Number(recoveryMinutes) < 1 || Number(recoveryMinutes) >= activeFocus.plannedMinutes} className="min-h-11 rounded-xl bg-primary text-white">Save {recoveryMinutes || '0'} min</Button>
            </form>}
            <Button type="button" variant="outline" onClick={() => void finishFocus('discard')} className="min-h-12 rounded-2xl">No focus</Button>
          </div>
          {focusError && <p role="alert" className="text-xs text-destructive">{focusError}</p>}
        </section>
      </div>}
    </main>
  )
}
