import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { liveQuery } from 'dexie'
import { ArrowDown, ArrowUp, Check, ChevronLeft, ChevronRight, Download, EllipsisVertical, Flame, LayoutGrid, Pause, Pencil, Play, Plus, RefreshCw, Share, SquareCheck, Timer, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { authClient } from '@/auth-client'
import { SignIn } from '@/components/sign-in'
import { SettingsScreen } from '@/components/settings-screen'
import { ProgressScreen } from '@/components/progress-screen'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DEVICE_PREFERENCES_KEY, readDevicePreferences, saveDevicePreferences, type DevicePreferences } from '@/lib/device-preferences'
import { buildProgress } from '@/lib/progress'
import { localDay, type TaskRecord } from '@/lib/task-contract'
import { chooseTimerTask, type CheckinRecord, type SessionRecord } from '@/lib/session-contract'
import { startSession, syncSession } from '@/lib/session-client'
import { elapsedFocusMs, remainingBreakSeconds, SessionStore, type BreakState } from '@/lib/session-store'
import { defaultDurations, type DurationSettings } from '@/lib/settings-contract'
import { SettingsStore, syncSettings } from '@/lib/settings-store'
import { TaskStore } from '@/lib/task-store'
import { SyncAuthError, syncTasks } from '@/lib/task-sync'
import { applyUpdate, dismissInstallCard, getPwaSnapshot, promptInstall, requestPersistentStorage, subscribePwa, type PwaSnapshot } from '@/lib/pwa'

type TodayUser = { id: string; name: string; email: string; image: string | null }
const cachedUserKey = 'habit-tracker:last-user'
const signedOutKey = 'habit-tracker:signed-out'
const accountDeletedKey = 'habit-tracker:account-deleted'


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
function CheckinRow({ checkin, task, onEdit }: { checkin: CheckinRecord; task: TaskRecord; onEdit: () => void }) {
  return <div className="flex min-w-0 items-center justify-between gap-2 rounded-xl bg-surface-subtle px-2.5 py-2 text-left text-xs">
    <div className="min-w-0">
      <p className="break-words font-bold">{task.title}</p>
      <p className="text-[10px] text-muted-foreground">{checkin.origin === 'session' ? 'Pomodoro' : 'Added by hand'}</p>
    </div>
    <div className="flex shrink-0 items-center gap-2">
      <span className="font-bold text-mint-ink">{checkin.durationMinutes} min</span>
      <button type="button" aria-label={`Edit Check-in for ${task.title}`} onClick={onEdit} className="min-h-9 rounded-lg px-1 text-[11px] font-bold text-muted-foreground focus-visible:outline-2 focus-visible:outline-mint">Edit</button>
    </div>
  </div>
}

export const Route = createFileRoute('/today')({ component: Today })

function Today() {
  const navigate = useNavigate()
  const [user, setUser] = useState<TodayUser | null>(null)
  const [store, setStore] = useState<TaskStore | null>(null)
  const [focusStore, setFocusStore] = useState<SessionStore | null>(null)
  const [settingsStore, setSettingsStore] = useState<SettingsStore | null>(null)
  const [durations, setDurations] = useState<DurationSettings>(defaultDurations)
  const [preferences, setPreferences] = useState<DevicePreferences>(readDevicePreferences)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [focus, setFocus] = useState<{ session: SessionRecord | null; lastTaskId: string | null; break: BreakState | null; checkins: CheckinRecord[] }>({ session: null, lastTaskId: null, break: null, checkins: [] })
  const [focusLoaded, setFocusLoaded] = useState(false)
  const [connected, setConnected] = useState(true)
  const [authRequired, setAuthRequired] = useState(false)
  const [focusError, setFocusError] = useState('')
  const [stopMinutes, setStopMinutes] = useState<number | null>(null)
  const [awaySessionId, setAwaySessionId] = useState<string | null>(null)
  const [partialRecovery, setPartialRecovery] = useState(false)
  const [recoveryMinutes, setRecoveryMinutes] = useState('')
  const [focusEndMinutes, setFocusEndMinutes] = useState<number | null>(null)
  const [wakeSupported, setWakeSupported] = useState(false)
  const wakeEnabled = preferences.wakeLock
  const [visible, setVisible] = useState(true)
  const [resumeAfterCancel, setResumeAfterCancel] = useState(false)
  const [starting, setStarting] = useState(false)
  const [clockNow, setClockNow] = useState(Date.now)
  const syncingFocus = useRef(false)
  const rerunFocus = useRef(false)
  const focusReady = useRef(false)
  const finishingFocus = useRef(false)
  const observedRunning = useRef<string | null>(null)
  const observedBreak = useRef<string | null>(null)
  const audio = useRef<AudioContext | null>(null)
  const lastTick = useRef(Date.now())
  const manuallySelected = useRef(false)
  const [tasks, setTasks] = useState<TaskRecord[]>([])
  const [eligibleTasks, setEligibleTasks] = useState<TaskRecord[]>([])
  const [checkinEditor, setCheckinEditor] = useState<{ mode: 'add' } | { mode: 'edit'; id: string } | null>(null)
  const [checkinTaskId, setCheckinTaskId] = useState('')
  const [checkinMinutes, setCheckinMinutes] = useState(String(defaultDurations.focusMinutes))
  const [checkinError, setCheckinError] = useState('')
  const [confirmCheckinDelete, setConfirmCheckinDelete] = useState(false)
  const [ready, setReady] = useState(false)
  const [firstLoadError, setFirstLoadError] = useState(false)
  const [sessionError, setSessionError] = useState('')
  const [syncError, setSyncError] = useState('')
  const [syncNotices, setSyncNotices] = useState<Array<{ id: string; message: string }>>([])
  const [pending, setPending] = useState(0)
  const [signOutPending, setSignOutPending] = useState<number | null>(null)
  const [signedOut, setSignedOut] = useState(false)
  const [dangerZoneOpen, setDangerZoneOpen] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [accountDeleting, setAccountDeleting] = useState(false)
  const [accountDeleteError, setAccountDeleteError] = useState('')
  const [accountCounts, setAccountCounts] = useState<{ tasks: number; checkins: number } | null>(null)
  const [statusOpen, setStatusOpen] = useState(false)
  const [pwa, setPwa] = useState<PwaSnapshot>(getPwaSnapshot)
  const [iosInstallOpen, setIosInstallOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [titleError, setTitleError] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [view, setView] = useState<'timer' | 'tasks' | 'progress'>('timer')
  const [selectedDay, setSelectedDay] = useState(localDay)
  const [weekDays, setWeekDays] = useState<string[]>([])
  const [copySourceId, setCopySourceId] = useState<string | null>(null)
  const [copyDay, setCopyDay] = useState('')
  const [menuTaskId, setMenuTaskId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [actionError, setActionError] = useState('')
  const inFlight = useRef(false)
  const rerunRequested = useRef(false)
  const retryTimer = useRef<number | undefined>(undefined)
  const failures = useRef(0)
  const userIdRef = useRef<string | null>(null)
  const accountWiped = useRef(false)
  const storeActive = useRef(true)
  const activeScope = useRef<string | null>(null)
  const currentSync = useRef<(() => Promise<void>) | null>(null)
  const identityRefresh = useRef<((signal?: AbortSignal) => Promise<void>) | null>(null)
  const currentFocusSync = useRef<(() => Promise<void>) | null>(null)
  const syncPromise = useRef<Promise<void> | null>(null)
  const day = localDay()
  const status = authRequired ? 'Sign in to sync' : !connected ? 'Offline'
    : failures.current >= 3 ? "Can't sync"
      : pending > 0 ? `${pending} ${pending === 1 ? 'change' : 'changes'} waiting` : null
  const displayedDay = view === 'timer' ? day : selectedDay
  const menuTask = tasks.find(task => task.id === menuTaskId)
  const editingTask = tasks.find(task => task.id === editingId)
  const copySource = tasks.find(task => task.id === copySourceId)
  const deletingTask = tasks.find(task => task.id === deletingId)
  const deletingCheckins = deletingTask ? focus.checkins.filter(checkin => checkin.taskId === deletingTask.id) : []
  const deletingMinutes = deletingCheckins.reduce((sum, checkin) => sum + checkin.durationMinutes, 0)
  const weekStart = shiftDay(selectedDay, -((dayDate(selectedDay).getDay() + 6) % 7))
  const weekEnd = shiftDay(weekStart, 6)
  const unfinishedPast = selectedDay < day && tasks.some(task => !task.completed)
  const activeFocus = focus.session
  const activeBreak = focus.break
  const elapsedMs = activeFocus ? elapsedFocusMs(activeFocus, clockNow) : 0
  const remainingSeconds = activeFocus
    ? Math.max(0, Math.ceil((activeFocus.plannedMinutes * 60_000 - elapsedMs) / 1000))
    : activeBreak?.phase === 'running' ? remainingBreakSeconds(activeBreak, clockNow) : activeBreak ? 0 : durations.focusMinutes * 60
  const clockText = `${String(Math.floor(remainingSeconds / 60)).padStart(2, '0')}:${String(remainingSeconds % 60).padStart(2, '0')}`
  const todayCheckins = focus.checkins.filter(checkin => tasks.some(task => task.id === checkin.taskId))
  const minutesForTask = (taskId: string) => todayCheckins.reduce((sum, checkin) => sum + (checkin.taskId === taskId ? checkin.durationMinutes : 0), 0)
  const editingCheckin = checkinEditor?.mode === 'edit' ? focus.checkins.find(checkin => checkin.id === checkinEditor.id) : null
  const selectedCheckinTask = eligibleTasks.find(task => task.id === checkinTaskId)
  const allTimeProgress = useMemo(() => buildProgress(eligibleTasks, focus.checkins, day, 3), [eligibleTasks, focus.checkins, day])
  const hasCheckin = focus.checkins.length > 0
  const installEligible = !pwa.installed && pwa.installPlatform !== null
  const showInstallCard = hasCheckin && installEligible && !pwa.installCardDismissed

  useEffect(() => {
    const instance = new TaskStore()
    storeActive.current = true
    setStore(instance)
    return () => {
      storeActive.current = false
      clearTimeout(retryTimer.current)
      instance.close()
    }
  }, [])
  useEffect(() => {
    const instance = new SessionStore()
    setFocusStore(instance)
    return () => instance.close()
  }, [])
  useEffect(() => {
    const instance = new SettingsStore()
    setSettingsStore(instance)
    return () => instance.close()
  }, [])
  useEffect(() => {
    if (!settingsStore || !user) return
    setDurations(defaultDurations)
    const subscription = liveQuery(() => settingsStore.snapshot(user.id)).subscribe({
      next: setDurations,
      error: () => setSyncError('Could not read timer settings on this device.'),
    })
    return () => subscription.unsubscribe()
  }, [settingsStore, user])
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === DEVICE_PREFERENCES_KEY) setPreferences(readDevicePreferences())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  useEffect(() => subscribePwa(() => setPwa(getPwaSnapshot())), [])
  useEffect(() => { if (hasCheckin) void requestPersistentStorage() }, [hasCheckin])

  useEffect(() => {
    setWakeSupported(typeof navigator.wakeLock?.request === 'function')
    return () => { void audio.current?.close() }
  }, [])

  useEffect(() => {
    if (!wakeSupported || !wakeEnabled || activeFocus?.status !== 'running' || !visible) return
    let cancelled = false
    let lock: WakeLockSentinel | null = null
    void navigator.wakeLock.request('screen').then(sentinel => {
      if (cancelled) void sentinel.release()
      else lock = sentinel
    }).catch(() => { /* Browser can deny Wake Lock; the timer remains accurate. */ })
    return () => { cancelled = true; if (lock) void lock.release() }
  }, [wakeSupported, wakeEnabled, activeFocus?.id, activeFocus?.status, visible])

  function unlockAudio() {
    if (!window.AudioContext) return
    try {
      audio.current ??= new AudioContext()
      void audio.current.resume().catch(() => {})
    } catch { /* Audio is optional when the platform refuses it. */ }
  }

  function playAlert(kind: 'focus' | 'break') {
    const context = audio.current
    if (!context || document.visibilityState !== 'visible' || !(kind === 'focus' ? preferences.focusSound : preferences.breakSound)) return
    const start = context.currentTime
    for (const [index, frequency] of (kind === 'focus' ? [660, 880] : [520, 390]).entries()) {
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = 'sine'
      oscillator.frequency.value = frequency
      gain.gain.setValueAtTime(0.0001, start + index * 0.24)
      gain.gain.exponentialRampToValueAtTime(0.12, start + index * 0.24 + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + index * 0.24 + 0.2)
      oscillator.connect(gain).connect(context.destination)
      oscillator.start(start + index * 0.24)
      oscillator.stop(start + index * 0.24 + 0.21)
    }
  }

  const reportSyncNotice = useCallback((message: string) => {
    setSyncNotices(current => [...current, { id: crypto.randomUUID(), message }])
  }, [])

  const wipeAndRedirect = useCallback(async (reason: 'here' | 'elsewhere') => {
    if (accountWiped.current) return
    accountWiped.current = true
    const uid = userIdRef.current
    try {
      if (uid) await Promise.all([store?.wipeUser(uid), focusStore?.wipeUser(uid), settingsStore?.wipeUser(uid)])
    } finally {
      try { await authClient.signOut() } catch { /* The session is already gone server-side; only the local cache needs clearing. */ }
      localStorage.removeItem(cachedUserKey)
      localStorage.removeItem(signedOutKey)
      localStorage.setItem(accountDeletedKey, reason)
      userIdRef.current = null
      void navigate({ to: '/', replace: true })
    }
  }, [store, focusStore, settingsStore, navigate])

  const syncFocus = useCallback(async () => {
    if (!focusStore || !user || !navigator.onLine || authRequired) return
    if (syncingFocus.current) {
      rerunFocus.current = true
      return
    }
    syncingFocus.current = true
    try {
      if (store && (await store.syncState(user.id)).pending) await syncTasks(store, user.id, fetch, () => syncSession(focusStore, user.id, fetch, reportSyncNotice))
      await syncSession(focusStore, user.id, fetch, reportSyncNotice)
      if (userIdRef.current !== user.id) return
      if (!focusReady.current) setFocus(await focusStore.snapshot(user.id))
      focusReady.current = true
      setConnected(true)
      setFocusLoaded(true)
      setFocusError('')
    } catch (reason) {
      if (reason instanceof SyncAuthError && reason.status === 410) { void wipeAndRedirect('elsewhere'); return }
      if (userIdRef.current !== user.id) return
      if (reason instanceof SyncAuthError) {
        setAuthRequired(true)
        if (reason.status === 403) void identityRefresh.current?.()
      }
      setConnected(navigator.onLine)
      setFocusError(reason instanceof Error ? reason.message : 'Could not sync focus.')
    } finally {
      syncingFocus.current = false
      if (rerunFocus.current) {
        rerunFocus.current = false
        void currentFocusSync.current?.()
      }
    }
  }, [focusStore, store, user, authRequired, reportSyncNotice, wipeAndRedirect])
  useEffect(() => { currentFocusSync.current = syncFocus }, [syncFocus])

  useEffect(() => {
    if (!focusStore || !user) return
    const subscription = liveQuery(() => focusStore.snapshot(user.id)).subscribe({
      next: setFocus,
      error: () => setFocusError('Could not read focus on this device.'),
    })
    const online = () => { setConnected(true); void syncFocus() }
    const offline = () => setConnected(false)
    const foreground = () => {
      if (document.visibilityState !== 'visible') { observedRunning.current = null; observedBreak.current = null }
      setVisible(document.visibilityState === 'visible')
      setClockNow(Date.now())
      lastTick.current = Date.now()
      if (document.visibilityState === 'visible') void syncFocus()
    }
    window.addEventListener('online', online)
    window.addEventListener('offline', offline)
    document.addEventListener('visibilitychange', foreground)
    const clock = window.setInterval(() => {
      const now = Date.now()
      if (now - lastTick.current > 5000) { observedRunning.current = null; observedBreak.current = null }
      lastTick.current = now
      setClockNow(now)
    }, 1000)
    const poll = window.setInterval(() => { if (navigator.onLine && !authRequired) void syncFocus() }, 5000)
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
  }, [focusStore, user, authRequired, syncFocus])

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
      const source = activeFocus && (tasks.find(task => task.id === activeFocus.taskId)
        ?? (await store?.listTasks(user.id, activeFocus.day).catch(() => []))?.find(task => task.id === activeFocus.taskId))
      await focusStore.finish(user.id, outcome, durationMinutes, new Date(), source?.title ?? '')
      setStopMinutes(null)
      setAwaySessionId(null)
      setPartialRecovery(false)
      if (alertOnFinish) { setFocusEndMinutes(focus.session?.plannedMinutes ?? null); playAlert('focus') }
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

  useEffect(() => {
    if (activeBreak?.phase !== 'running' || !focusStore || !user) return
    if (remainingBreakSeconds(activeBreak, clockNow) > 0) {
      if (document.visibilityState === 'visible') observedBreak.current = activeBreak.sourceSessionId
    } else {
      if (observedBreak.current === activeBreak.sourceSessionId) playAlert('break')
      observedBreak.current = null
      void focusStore.endBreak(user.id).catch(() => setFocusError('Could not end Break on this device.'))
    }
  }, [activeBreak, clockNow, focusStore, user])

  async function chooseBreak(kind: 'short' | 'long') {
    if (!focusStore || !user) return
    unlockAudio()
    try {
      await focusStore.startBreak(user.id, kind)
      setClockNow(Date.now())
      setFocusEndMinutes(null)
      setFocusError('')
    } catch (reason) {
      setFocusError(reason instanceof Error ? reason.message : 'Could not start Break.')
    }
  }

  async function skipBreak() {
    if (!focusStore || !user) return
    try {
      await focusStore.clearBreak(user.id)
      setFocusEndMinutes(null)
      setFocusError('')
    } catch (reason) {
      setFocusError(reason instanceof Error ? reason.message : 'Could not skip Break.')
    }
  }

  async function beginFocus(preferredTaskId?: string) {
    const eligible = tasks.filter(task => task.day === localDay())
    const selected = eligible.find(task => task.id === (preferredTaskId ?? selectedId))
      ?? (preferredTaskId ? chooseTimerTask(eligible, null) : null)
    if (!store || !focusStore || !user || !selected || !connected || authRequired || starting) return
    unlockAudio()
    setStarting(true)
    try {
      await syncTasks(store, user.id)
      if (!settingsStore) throw new Error('Timer settings are still loading.')
      await syncSettings(settingsStore, user.id)
      const current = await settingsStore.snapshot(user.id)
      const session = await startSession(selected.id, localDay(), fetch, current.focusMinutes)
      await focusStore.started(user.id, session, selected.title)
      observedRunning.current = session.id
      setSelectedId(selected.id)
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
    unlockAudio()
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
    if (localStorage.getItem(signedOutKey)) {
      void navigate({ to: '/', replace: true })
      return
    }
    const useCached = (expired: boolean) => {
      const cached = localStorage.getItem(cachedUserKey)
      if (!cached) return false
      try {
        const previous = JSON.parse(cached) as TodayUser
        if (!previous.id || !previous.name) return false
        userIdRef.current = previous.id
        setUser(current => current?.id === previous.id && current.name === previous.name && current.email === previous.email && current.image === previous.image ? current : previous)
        setAuthRequired(expired)
        return true
      } catch { return false }
    }
    try {
      const response = await fetch('/api/today', { credentials: 'same-origin', cache: 'no-store', signal })
      if (signal?.aborted) return
      if (response.status === 401) {
        if (!useCached(true)) void navigate({ to: '/', replace: true })
        return
      }
      if (!response.ok) throw new Error('Could not load Today')
      const data: { user: TodayUser } = await response.json()
      if (signal?.aborted) return
      if (userIdRef.current && userIdRef.current !== data.user.id) {
        setReady(false)
        setTasks([])
        setEligibleTasks([])
        setFocus({ session: null, lastTaskId: null, break: null, checkins: [] })
        setFocusLoaded(false)
        focusReady.current = false
        failures.current = 0
        setPending(0)
      }
      userIdRef.current = data.user.id
      localStorage.setItem(cachedUserKey, JSON.stringify(data.user))
      setUser(current => current?.id === data.user.id && current.name === data.user.name && current.email === data.user.email && current.image === data.user.image ? current : data.user)
      setAuthRequired(false)
      setFirstLoadError(false)
      setSessionError('')
    } catch (reason) {
      if (signal?.aborted) return
      if (useCached(false)) return
      setFirstLoadError(true)
      setSessionError(reason instanceof Error ? reason.message : 'Could not load Today')
    }
  }, [navigate])

  useEffect(() => {
    const controller = new AbortController()
    void loadSession(controller.signal)
    return () => controller.abort()
  }, [loadSession])
  useEffect(() => { identityRefresh.current = loadSession }, [loadSession])

  const refreshPending = useCallback(async () => {
    if (!store || !user || !storeActive.current) return
    try {
      const [taskState, focusChanges, settingsChanges] = await Promise.all([
        store.syncState(user.id), focusStore?.pendingChanges(user.id), settingsStore?.pendingCount(user.id),
      ])
      if (storeActive.current && userIdRef.current === user.id) setPending(taskState.pending + (focusChanges?.length ?? 0) + (settingsChanges ?? 0))
    } catch {
      if (storeActive.current) setSyncError('Could not read changes on this device.')
    }
  }, [store, focusStore, settingsStore, user])

  const sync = useCallback(async () => {
    if (!store || !settingsStore || !user || !storeActive.current || !navigator.onLine || authRequired) return
    if (inFlight.current) {
      rerunRequested.current = true
      // The owner reports this failure and schedules the retry.
      await syncPromise.current?.catch(() => {})
      return
    }
    inFlight.current = true
    clearTimeout(retryTimer.current)
    try {
      const operation = (async () => {
        const syncCheckins = focusStore ? () => syncSession(focusStore, user.id, fetch, reportSyncNotice) : undefined
        await syncTasks(store, user.id, fetch, syncCheckins)
        if (focusStore) await syncSession(focusStore, user.id, fetch, reportSyncNotice)
        await syncSettings(settingsStore, user.id)
      })()
      syncPromise.current = operation
      await operation
      if (!storeActive.current || userIdRef.current !== user.id) return
      setReady(true)
      setFirstLoadError(false)
      setSyncError('')
      failures.current = 0
      await refreshPending()
    } catch (reason) {
      if (reason instanceof SyncAuthError && reason.status === 410) { void wipeAndRedirect('elsewhere'); return }
      if (!storeActive.current || userIdRef.current !== user.id) return
      const state = await store.syncState(user.id)
      if (!state.firstLoadComplete) setFirstLoadError(true)
      await refreshPending()
      if (reason instanceof SyncAuthError) {
        setAuthRequired(true)
        setSyncError('')
        if (reason.status === 403) void loadSession()
      } else {
        setSyncError(reason instanceof Error ? reason.message : 'Could not sync')
        if (navigator.onLine) {
          failures.current += 1
          retryTimer.current = window.setTimeout(() => void sync(), Math.min(1000 * 2 ** (failures.current - 1), 300_000))
        }
      }
    } finally {
      syncPromise.current = null
      inFlight.current = false
      if (storeActive.current && rerunRequested.current) {
        rerunRequested.current = false
        void currentSync.current?.()
      }
    }
  }, [store, focusStore, settingsStore, user, authRequired, refreshPending, reportSyncNotice, loadSession, wipeAndRedirect])

  useEffect(() => { currentSync.current = sync }, [sync])

  useEffect(() => {
    if (!store || !user) return
    let active = true
    if (activeScope.current !== user.id) {
      activeScope.current = user.id
      setReady(false)
      setTasks([])
    }
    void store.syncState(user.id).then(state => {
      if (!active || !storeActive.current) return
      setReady(state.firstLoadComplete)
      // On an authenticated load, wait for the authoritative Session before treating an elapsed timer as visible completion.
      if (!navigator.onLine || authRequired) setFocusLoaded(state.firstLoadComplete)
      void refreshPending()
      void sync()
    }).catch(() => { if (active && storeActive.current) setFirstLoadError(true) })
    const reconnect = () => { setConnected(true); void loadSession(); void sync() }
    const offline = () => setConnected(false)
    const foreground = () => { if (document.visibilityState === 'visible') { void loadSession(); void sync() } }
    window.addEventListener('online', reconnect)
    window.addEventListener('offline', offline)
    document.addEventListener('visibilitychange', foreground)
    return () => {
      active = false
      window.removeEventListener('online', reconnect)
      window.removeEventListener('offline', offline)
      document.removeEventListener('visibilitychange', foreground)
      clearTimeout(retryTimer.current)
    }
  }, [store, user, sync, refreshPending, loadSession])

  useEffect(() => {
    if (!focusStore || !user) return
    const subscription = liveQuery(() => focusStore.pendingChanges(user.id)).subscribe({
      next: () => { void refreshPending() },
    })
    return () => subscription.unsubscribe()
  }, [focusStore, user, refreshPending])
  useEffect(() => {
    if (!settingsStore || !user) return
    const subscription = liveQuery(() => settingsStore.pendingCount(user.id)).subscribe({
      next: () => { void refreshPending() },
    })
    return () => subscription.unsubscribe()
  }, [settingsStore, user, refreshPending])
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
    const subscription = liveQuery(() => store.eligibleCheckinTasks(user.id, day)).subscribe({
      next: setEligibleTasks,
      error: () => setSyncError('Could not read eligible Tasks on this device.'),
    })
    return () => subscription.unsubscribe()
  }, [store, user, day])

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
  function openCheckin(checkin?: CheckinRecord) {
    setCheckinEditor(checkin ? { mode: 'edit', id: checkin.id } : { mode: 'add' })
    setCheckinTaskId(checkin?.taskId ?? (view === 'timer' ? selectedId : tasks[0]?.id) ?? eligibleTasks[0]?.id ?? '')
    setCheckinMinutes(String(checkin?.durationMinutes ?? durations.focusMinutes))
    setCheckinError('')
    setConfirmCheckinDelete(false)
  }

  async function submitCheckin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!focusStore || !user || !checkinEditor) return
    const minutes = Number(checkinMinutes)
    if (!selectedCheckinTask || selectedCheckinTask.day > localDay()) {
      setCheckinError('Choose an existing Task from Today or a past Day.')
      return
    }
    if (!/^\d+$/.test(checkinMinutes) || !Number.isInteger(minutes) || minutes < 1 || minutes > 480) {
      setCheckinError('Enter 1–480 whole focused minutes.')
      return
    }
    try {
      if (checkinEditor.mode === 'edit') await focusStore.editCheckin(user.id, checkinEditor.id, selectedCheckinTask, minutes,
        eligibleTasks.find(task => task.id === editingCheckin?.taskId))
      else await focusStore.createCheckin(user.id, selectedCheckinTask, minutes)
      setCheckinEditor(null)
      setFocusError('')
      void syncFocus()
    } catch (reason) {
      setCheckinError(reason instanceof Error ? reason.message : 'Could not save Check-in on this device.')
    }
  }

  async function removeCheckin() {
    if (!focusStore || !user || checkinEditor?.mode !== 'edit') return
    try {
      await focusStore.deleteCheckin(user.id, checkinEditor.id)
      setCheckinEditor(null)
      setFocusError('')
      void syncFocus()
    } catch (reason) {
      setCheckinError(reason instanceof Error ? reason.message : 'Could not delete Check-in on this device.')
    }
  }

  function selectDay(value: string) {
    setSelectedDay(value)
    setTitle('')
    setTitleError('')
    setMenuTaskId(null)
    setCopySourceId(null)
    setDeletingId(null)
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
  async function confirmTaskDeletion() {
    if (!deletingTask || !store || !focusStore || !user) return
    const taskId = deletingTask.id
    const current = (await focusStore.snapshot(user.id)).session
    if (current?.taskId === taskId) {
      setActionError('Stop or finish the session first')
      return
    }
    if (await changeTask(async () => {
      await focusStore.removeTaskCheckins(user.id, taskId)
      await store.deleteTask(user.id, taskId)
    })) {
      setDeletingId(null)
      if (selectedId === taskId) setSelectedId(null)
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

  async function completeSignOut() {
    try {
      if (navigator.onLine) {
        const result = await authClient.signOut()
        if (result.error) throw result.error
        localStorage.removeItem(signedOutKey)
      } else {
        // The session cookie is HttpOnly. Revoke it on reconnect before allowing another sign-in.
        localStorage.setItem(signedOutKey, 'pending')
      }
      localStorage.removeItem(cachedUserKey)
      setSignOutPending(null)
      if (navigator.onLine) void navigate({ to: '/', replace: true })
      else setSignedOut(true)
    } catch {
      setSignOutPending(null)
      setSessionError('Could not sign out. Try again.')
    }
  }

  async function signOut() {
    if (!store || !user) return
    if (navigator.onLine && !authRequired) {
      let timeout: number | undefined
      try {
        await Promise.race([
          sync(),
          new Promise<void>(resolve => { timeout = window.setTimeout(resolve, 2000) }),
        ])
      } finally {
        clearTimeout(timeout)
      }
    }
    const [taskState, focusChanges, settingsChanges] = await Promise.all([
      store.syncState(user.id), focusStore?.pendingChanges(user.id), settingsStore?.pendingCount(user.id),
    ])
    const unsent = taskState.pending + (focusChanges?.length ?? 0) + (settingsChanges ?? 0)
    if (unsent) setSignOutPending(unsent)
    else await completeSignOut()
  }

  async function openDangerZone() {
    if (!store || !user) return
    setDangerZoneOpen(true)
    setDeleteConfirmText('')
    setAccountDeleteError('')
    setAccountCounts(null)
    try {
      const tasks = await store.countAll(user.id)
      setAccountCounts({ tasks, checkins: focus.checkins.length })
    } catch {
      setAccountDeleteError('Could not count your data on this device.')
    }
  }

  async function deleteAccountNow() {
    if (!user || deleteConfirmText !== 'DELETE' || accountDeleting) return
    setAccountDeleteError('')
    setAccountDeleting(true)
    try {
      const response = await fetch('/api/account', {
        method: 'POST', credentials: 'same-origin', cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation: 'DELETE' }),
      })
      if (!response.ok) throw new Error('Could not delete your account. Try again.')
      setDangerZoneOpen(false)
      await wipeAndRedirect('here')
    } catch (reason) {
      setAccountDeleteError(reason instanceof Error ? reason.message : 'Could not delete your account. Try again.')
      setAccountDeleting(false)
    }
  }

  async function openStatus() {
    if (authRequired) {
      const result = await authClient.signIn.social({ provider: 'google', callbackURL: '/today' })
      if (result.error) setSessionError('Could not start Google sign-in. Try again.')
    } else setStatusOpen(true)
  }

  async function updateDurations(next: DurationSettings | ((current: DurationSettings) => DurationSettings)) {
    if (!settingsStore || !user) throw new Error('Timer settings are still loading.')
    await settingsStore.update(user.id, next)
    await refreshPending()
    void sync()
  }

  function updatePreferences(next: DevicePreferences) {
    saveDevicePreferences(next)
    setPreferences(next)
    window.dispatchEvent(new Event('habit-tracker:device-preferences'))
  }

  const signOutPrompt = signOutPending !== null && <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/35">
    <section role="dialog" aria-modal="true" aria-label="Unsent changes" className="w-full max-w-[414px] rounded-t-[28px] bg-card px-5 pb-[max(32px,env(safe-area-inset-bottom))] pt-5 shadow-xl">
      <h2 className="font-display text-lg font-bold">Changes waiting to sync</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{signOutPending} {signOutPending === 1 ? 'change is' : 'changes are'} saved on this device but not on the server. Signing out keeps them here for this Google account. Sign in with the same account to sync them.</p>
      <Button type="button" onClick={() => void completeSignOut()} className="mt-5 min-h-12 w-full rounded-2xl bg-primary font-bold text-white">Sign out anyway</Button>
      <button type="button" onClick={() => setSignOutPending(null)} className="mt-2 min-h-11 w-full rounded-xl text-sm font-semibold text-muted-foreground">Keep working</button>
    </section>
  </div>

  const header = user && <header className="flex min-h-14 items-center justify-between gap-2 px-5">
    <span className="min-w-0 truncate whitespace-nowrap font-display text-[22px] font-bold tracking-tight">Habit Tracker</span>
    <div className="flex shrink-0 items-center gap-2">
      {status && <button type="button" onClick={() => void openStatus()} className="flex min-h-9 items-center gap-1 rounded-full bg-amber-surface px-2.5 text-[11px] font-semibold text-amber focus-visible:outline-2 focus-visible:outline-amber">
        <span aria-hidden="true" className="size-1.5 rounded-full bg-amber" />{status}
      </button>}
      <span aria-label={`Current Focus Streak: ${allTimeProgress.streaks.current} days, all-time`} className="inline-flex min-h-8 items-center gap-1 rounded-full bg-mint-surface px-2 text-xs font-bold text-mint-ink"><Flame size={14} aria-hidden="true" />{allTimeProgress.streaks.current}</span>
      <button type="button" aria-label={`${user.name}'s profile`} onClick={() => setSettingsOpen(true)} className="grid size-11 shrink-0 place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mint">
        <Avatar className="size-[34px] border-[1.5px] border-mint bg-mint-surface">
          {user.image && <AvatarImage src={user.image} alt="" referrerPolicy="no-referrer" />}
          <AvatarFallback className="bg-mint-surface font-bold text-mint-ink">{user.name.slice(0, 1).toUpperCase()}</AvatarFallback>
        </Avatar>
      </button>
    </div>
  </header>

  if (signedOut) return <SignIn />
  if (settingsOpen && user) return <main className="mx-auto flex min-h-svh w-full max-w-[414px] flex-col">
    <SettingsScreen user={user} durations={durations} preferences={preferences} wakeSupported={wakeSupported}
      installEligible={installEligible}
      onInstall={() => { if (pwa.installPlatform === 'ios') setIosInstallOpen(true); else void promptInstall() }}
      onDuration={(key, minutes) => updateDurations(current => ({ ...current, [key]: minutes }))} onReset={async () => {
        try { await updateDurations(defaultDurations); setSessionError('') }
        catch { setSessionError('Could not reset timer settings on this device.') }
      }} onPreferences={updatePreferences} onBack={() => setSettingsOpen(false)} onSignOut={() => void signOut()} onOpenDangerZone={() => void openDangerZone()} />
    {sessionError && <p role="alert" className="px-5 text-xs text-destructive">{sessionError}</p>}
    {signOutPrompt}
    {iosInstallOpen && <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/35" onClick={() => setIosInstallOpen(false)}>
      <section role="dialog" aria-modal="true" aria-label="Install Habit Tracker" onClick={event => event.stopPropagation()} className="w-full max-w-[414px] rounded-t-[28px] bg-card px-5 pb-[max(32px,env(safe-area-inset-bottom))] pt-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">Install Habit Tracker</h2>
          <button type="button" aria-label="Close install instructions" onClick={() => setIosInstallOpen(false)} className="grid size-10 place-items-center rounded-xl text-muted-foreground"><X size={18} aria-hidden="true" /></button>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Tap <Share size={14} className="inline" aria-hidden="true" /> Share, then "Add to Home Screen". Installing keeps your focus history from being cleared and lets you open Habit Tracker offline.</p>
      </section>
    </div>}
    {dangerZoneOpen && <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/35" onClick={() => setDangerZoneOpen(false)}>
      <section role="dialog" aria-modal="true" aria-label="Delete account and data" onClick={event => event.stopPropagation()} className="flex max-h-[90svh] w-full max-w-[414px] flex-col gap-4 overflow-y-auto rounded-t-[28px] bg-card px-5 pb-[max(32px,env(safe-area-inset-bottom))] pt-4 shadow-xl">
        <div className="mx-auto h-1 w-9 rounded-full bg-border" />
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-extrabold text-destructive">Delete account and data</h2>
          <button type="button" aria-label="Close delete account" onClick={() => setDangerZoneOpen(false)} className="grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground"><X size={19} aria-hidden="true" /></button>
        </div>
        <div className="flex flex-col gap-2 rounded-2xl border border-destructive bg-destructive-surface p-3.5">
          <p className="text-sm font-bold text-destructive">This cannot be undone.</p>
          <p className="text-xs leading-relaxed text-destructive">
            {accountCounts === null ? 'Counting your Tasks and Check-ins…'
              : `Permanently deletes your account, ${accountCounts.tasks} ${accountCounts.tasks === 1 ? 'Task' : 'Tasks'}, and ${accountCounts.checkins} ${accountCounts.checkins === 1 ? 'Check-in' : 'Check-ins'} across all devices. A secure copy stays in backups for up to 30 days before full erasure.`}
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="delete-confirm" className="text-[13px] font-bold">To confirm, type DELETE in all caps:</label>
          <input id="delete-confirm" aria-label="Type DELETE to confirm" autoComplete="off" value={deleteConfirmText} onChange={event => { setDeleteConfirmText(event.target.value); setAccountDeleteError('') }} className="h-11 rounded-xl border border-destructive bg-surface-subtle px-3 text-sm tracking-wider outline-none focus:ring-2 focus:ring-destructive/30" />
        </div>
        {!connected && <p role="status" className="text-xs font-semibold text-amber">Connect to the internet to delete your account.</p>}
        {accountDeleteError && <p role="alert" className="text-xs text-destructive">{accountDeleteError}</p>}
        <div className="flex flex-col gap-2.5">
          <Button type="button" variant="destructive" disabled={deleteConfirmText !== 'DELETE' || !connected || accountDeleting} onClick={() => void deleteAccountNow()} className="min-h-11 rounded-2xl font-bold"><Trash2 size={16} aria-hidden="true" />Delete my account and data</Button>
          <button type="button" onClick={() => setDangerZoneOpen(false)} className="min-h-11 rounded-xl text-sm font-semibold text-muted-foreground">Keep my account</button>
        </div>
      </section>
    </div>}
  </main>
  if (!user || !ready) {
    return (
      <main className="mx-auto flex min-h-svh w-full max-w-[414px] flex-col">
        {header}
        {sessionError && <p role="alert" className="px-5 text-sm text-destructive">{sessionError}</p>}
        <div className="grid flex-1 place-items-center px-6">
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
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-[414px] flex-col">
      {header}
      {statusOpen && <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/35" onClick={() => setStatusOpen(false)}>
        <section role="dialog" aria-modal="true" aria-label="Sync status" onClick={event => event.stopPropagation()} className="w-full max-w-[414px] rounded-t-[28px] bg-card px-5 pb-[max(32px,env(safe-area-inset-bottom))] pt-5 shadow-xl">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold">Sync status</h2>
            <button type="button" aria-label="Close sync status" onClick={() => setStatusOpen(false)} className="grid size-10 place-items-center rounded-xl text-muted-foreground"><X size={18} aria-hidden="true" /></button>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {!navigator.onLine ? 'This device is offline. Your changes are saved here and will sync when you reconnect.'
              : failures.current >= 3 ? 'Your changes are saved on this device, but the server cannot be reached right now. We will keep trying.'
                : `${pending} ${pending === 1 ? 'change is' : 'changes are'} saved on this device and waiting to sync.`}
          </p>
          <Button type="button" disabled={!navigator.onLine} onClick={() => { setStatusOpen(false); void sync() }} className="mt-5 min-h-12 w-full rounded-2xl bg-primary font-bold text-white"><RefreshCw size={16} aria-hidden="true" />Sync now</Button>
        </section>
      </div>}
      {signOutPrompt}
      {sessionError && <p role="alert" className="px-5 text-sm text-destructive">{sessionError}</p>}
      {pwa.updateAvailable && <div role="alert" aria-label="New version available" className="mx-5 mb-2 flex items-center justify-between gap-3 rounded-2xl border border-sky bg-sky-surface px-4 py-3 text-sm font-semibold text-sky">
        <span>New version available</span>
        <Button type="button" disabled={!!activeFocus} onClick={() => applyUpdate()} className="min-h-9 shrink-0 rounded-xl bg-sky px-3 text-xs font-bold text-white disabled:opacity-60">{activeFocus ? 'Update after your session' : 'Reload'}</Button>
      </div>}
      {syncNotices.map(notice => <div key={notice.id} role="alert" aria-label="Sync conflict" className="sticky top-0 z-10 mx-5 mb-2 flex items-start justify-between gap-3 rounded-2xl border border-amber bg-amber-surface px-4 py-3 text-sm leading-relaxed text-foreground">
        <p className="min-w-0 break-words">{notice.message}</p>
        <button type="button" aria-label="Dismiss sync notice" onClick={() => setSyncNotices(current => current.filter(item => item.id !== notice.id))} className="grid size-11 shrink-0 place-items-center rounded-xl text-amber focus-visible:outline-2 focus-visible:outline-amber"><X size={18} aria-hidden="true" /></button>
      </div>)}
      {focusEndMinutes !== null && <div role="alert" aria-label="Focus interval complete" className="mx-5 flex items-center justify-between gap-3 rounded-2xl border border-mint bg-mint-surface px-4 py-3 text-sm font-semibold text-mint-ink">
        <span>Focus interval complete · {focusEndMinutes} min recorded</span>
        <button type="button" aria-label="Dismiss focus alert" onClick={() => setFocusEndMinutes(null)} className="grid size-9 shrink-0 place-items-center rounded-lg focus-visible:outline-2 focus-visible:outline-mint"><X size={17} aria-hidden="true" /></button>
      </div>}
      {activeBreak?.phase === 'ended' && <div role="alert" aria-label="Break is over!" className="mx-5 rounded-2xl border border-sky bg-sky-surface px-4 py-3 text-sm font-semibold text-sky">
        Break is over! Choose when to start your next Session.
      </div>}
      <h1 className="sr-only">{view === 'tasks' ? 'Tasks' : view === 'progress' ? 'Progress' : 'Today'}</h1>
      {view === 'timer' ? <div className="flex flex-1 flex-col gap-4 px-5 py-5">
        <section aria-labelledby="timer-heading">
          <Card className="items-center gap-4 rounded-[26px] px-5 py-5 text-center shadow-none">
            <div className="relative grid size-[220px] shrink-0 place-items-center">
              <svg viewBox="0 0 220 220" className="absolute inset-0 size-full -rotate-90" aria-hidden="true">
                <circle cx="110" cy="110" r="95" fill="none" stroke={activeBreak ? 'var(--color-sky-surface)' : 'var(--color-mint-surface)'} strokeWidth="12" />
                <circle cx="110" cy="110" r="95" fill="none" stroke={activeBreak ? 'var(--color-sky)' : 'var(--color-mint)'} strokeWidth="12" strokeLinecap="round" strokeDasharray={2 * Math.PI * 95} strokeDashoffset={2 * Math.PI * 95 * (activeFocus ? elapsedMs / (activeFocus.plannedMinutes * 60_000) : activeBreak?.phase === 'running' ? 1 - remainingSeconds / (activeBreak.durationMinutes * 60) : 0)} />
              </svg>
              <div className="flex flex-col items-center gap-1">
                <span className="font-display text-[48px] font-extrabold leading-none tracking-[-.05em] tabular-nums" aria-live="off">{clockText}</span>
                <span className="text-xs font-semibold text-muted-foreground">{activeFocus?.status === 'paused' ? 'Paused' : activeBreak ? 'Break time' : 'Focus time'}</span>
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
            </> : activeBreak ? <>
              <h2 id="timer-heading" className="max-w-full break-words text-base font-bold">
                {activeBreak.phase === 'choice' ? `Take a break after ${activeBreak.taskTitle || tasks.find(task => task.id === activeBreak.taskId)?.title || 'your Task'}`
                  : activeBreak.phase === 'ended' ? 'Break is over!'
                    : `On a ${activeBreak.kind} Break from ${activeBreak.taskTitle || tasks.find(task => task.id === activeBreak.taskId)?.title || 'your Task'}`}
              </h2>
              {activeBreak.phase === 'choice' ? <div className="flex w-full flex-col gap-2">
                <Button type="button" onClick={() => void chooseBreak('short')} className="min-h-12 rounded-[18px] bg-primary font-bold text-white">Short Break · {activeBreak.shortBreakMinutes} min</Button>
                <Button type="button" variant="outline" onClick={() => void chooseBreak('long')} className="min-h-12 rounded-[18px] font-bold">Long Break · {activeBreak.longBreakMinutes} min</Button>
                <button type="button" onClick={() => void skipBreak()} className="min-h-11 text-sm font-semibold text-muted-foreground">No Break</button>
              </div> : activeBreak.phase === 'running' ? <Button type="button" variant="outline" onClick={() => void skipBreak()} className="min-h-12 w-full rounded-[18px] font-bold">Skip Break</Button>
                : <div className="flex w-full flex-col gap-2">
                  <Button type="button" disabled={!connected || !focusLoaded || starting || !tasks.some(task => task.day === localDay())} onClick={() => void beginFocus(activeBreak.taskId)} className="min-h-12 rounded-[18px] bg-primary font-bold text-white"><Play size={16} aria-hidden="true" />Start Next Session</Button>
                  {!connected && <p role="status" className="text-xs text-amber">Connect to the internet to start a session.</p>}
                  <button type="button" onClick={() => void skipBreak()} className="min-h-11 text-sm font-semibold text-muted-foreground">Dismiss Break</button>
                </div>}
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
        {!activeFocus && !activeBreak && <section aria-labelledby="task-list-heading" className="flex flex-col gap-2">
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
        {showInstallCard && <div role="region" aria-label="Install Habit Tracker" className="flex items-start gap-3 rounded-2xl border border-mint bg-mint-surface px-4 py-3 text-mint-ink">
          <Download size={20} className="mt-0.5 shrink-0" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">Install Habit Tracker</p>
            {pwa.installPlatform === 'ios'
              ? <p className="mt-1 text-xs leading-relaxed">Tap <Share size={12} className="inline" aria-hidden="true" /> Share, then "Add to Home Screen" — it keeps your focus history from being cleared and works offline.</p>
              : <p className="mt-1 text-xs leading-relaxed">Add it to your home screen for quick, offline access.</p>}
            {pwa.installPlatform === 'chrome' && <Button type="button" onClick={() => void promptInstall()} className="mt-2 min-h-9 rounded-xl bg-mint px-3 text-xs font-bold text-white">Install app</Button>}
          </div>
          <button type="button" aria-label="Dismiss install prompt" onClick={dismissInstallCard} className="grid size-9 shrink-0 place-items-center rounded-lg text-mint-ink focus-visible:outline-2 focus-visible:outline-mint"><X size={16} aria-hidden="true" /></button>
        </div>}
        {focusError && <p role="alert" className="text-xs text-destructive">{focusError}</p>}
        <section aria-labelledby="today-focus-heading">
          <Card className="gap-2.5 rounded-[22px] p-4 shadow-none">
            <div className="flex items-center justify-between gap-2">
              <h2 id="today-focus-heading" className="text-sm font-bold">Today's focus {todayCheckins.length > 0 && <span className="ml-1 rounded-full bg-mint-surface px-2 py-0.5 text-xs text-mint-ink">{todayCheckins.reduce((sum, checkin) => sum + checkin.durationMinutes, 0)}m</span>}</h2>
              <button type="button" aria-label="Add Check-in" onClick={() => openCheckin()} className="grid size-9 shrink-0 place-items-center rounded-full border border-border bg-surface-subtle focus-visible:outline-2 focus-visible:outline-mint"><Plus size={16} aria-hidden="true" /></button>
            </div>
            {todayCheckins.length === 0 ? <p className="text-[13px] text-ink-tertiary">No focus recorded today yet.</p> : todayCheckins.map(checkin => (
              <CheckinRow key={checkin.id} checkin={checkin} task={tasks.find(task => task.id === checkin.taskId)!} onEdit={() => openCheckin(checkin)} />
            ))}
          </Card>
        </section>
      </div> : view === 'progress' ? <ProgressScreen tasks={tasks} allTasks={eligibleTasks} checkins={focus.checkins} today={day} selectedDay={selectedDay} onSelectDay={selectDay} title={title} titleError={titleError} onTitle={value => { setTitle(value); setTitleError('') }} onAddTask={event => void addTask(event)} onAddCheckin={() => openCheckin()} onEditCheckin={openCheckin} /> : <div className="flex flex-1 flex-col gap-3 px-4 py-3">
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
        {selectedDay <= day && (tasks.length > 0 || todayCheckins.length > 0) && <section aria-label={`Check-ins for ${dayLabel(selectedDay)}`} className="flex flex-col gap-2 rounded-[22px] border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold">Check-ins</h2>
            <button type="button" aria-label="Add Check-in" onClick={() => openCheckin()} className="grid size-9 place-items-center rounded-full border border-border bg-surface-subtle focus-visible:outline-2 focus-visible:outline-mint"><Plus size={16} aria-hidden="true" /></button>
          </div>
          {todayCheckins.length === 0 ? <p className="text-xs text-ink-tertiary">No focus recorded on this Day.</p> : todayCheckins.map(checkin => (
            <CheckinRow key={checkin.id} checkin={checkin} task={tasks.find(task => task.id === checkin.taskId)!} onEdit={() => openCheckin(checkin)} />
          ))}
        </section>}
      </div>}
      <nav className="sticky bottom-0 flex min-h-[72px] items-center justify-around border-t border-border bg-card px-4 py-2 pb-[max(8px,env(safe-area-inset-bottom))]" aria-label="Main sections">
        <button type="button" onClick={() => setView('timer')} aria-current={view === 'timer' ? 'page' : undefined} className={`flex h-[52px] w-20 flex-col items-center justify-center gap-1 rounded-2xl text-[11px] ${view === 'timer' ? 'bg-mint-surface font-bold text-mint' : 'text-muted-foreground'}`}><Timer size={20} aria-hidden="true" />Timer</button>
        <button type="button" onClick={() => setView('tasks')} aria-current={view === 'tasks' ? 'page' : undefined} className={`flex h-[52px] w-20 flex-col items-center justify-center gap-1 rounded-2xl text-[11px] ${view === 'tasks' ? 'bg-mint-surface font-bold text-mint' : 'text-muted-foreground'}`}><SquareCheck size={20} aria-hidden="true" />Tasks</button>
        <button type="button" onClick={() => setView('progress')} aria-current={view === 'progress' ? 'page' : undefined} className={`flex h-[52px] w-20 flex-col items-center justify-center gap-1 rounded-2xl text-[11px] ${view === 'progress' ? 'bg-mint-surface font-bold text-mint' : 'text-muted-foreground'}`}><LayoutGrid size={20} aria-hidden="true" />Progress</button>
      </nav>
      {(menuTask || editingTask || copySource || deletingTask) && <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/35" onClick={() => { setMenuTaskId(null); setEditingId(null); setCopySourceId(null); setDeletingId(null); setActionError('') }}>
        <section role="dialog" aria-modal="true" aria-label={deletingTask ? `Delete ${deletingTask.title}` : copySource ? `Copy ${copySource.title}` : editingTask ? `Rename ${editingTask.title}` : `Actions for ${menuTask?.title}`} onClick={event => event.stopPropagation()} className="max-h-[90svh] w-full max-w-[414px] overflow-y-auto rounded-t-[28px] bg-card px-5 pb-[max(32px,env(safe-area-inset-bottom))] pt-4 shadow-xl">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="break-words font-display text-lg font-bold">{deletingTask ? `Delete ${deletingTask.title}?` : copySource ? 'Copy to a later Day' : editingTask ? 'Rename Task' : menuTask?.title}</h2>
              {!deletingTask && <p className="mt-0.5 text-xs text-muted-foreground">{dayLabel((copySource ?? editingTask ?? menuTask)!.day)} · {minutesForTask((copySource ?? editingTask ?? menuTask)!.id)}m focused</p>}
            </div>
            <button type="button" aria-label="Close Task actions" onClick={() => { setMenuTaskId(null); setEditingId(null); setCopySourceId(null); setDeletingId(null); setActionError('') }} className="grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground"><X size={19} aria-hidden="true" /></button>
          </div>
          {deletingTask ? <div className="flex flex-col gap-3">
            <p className="text-sm leading-relaxed text-muted-foreground">“{deletingTask.title}” will be permanently removed from every device. This cannot be undone.</p>
            {deletingCheckins.length > 0 && <p className="rounded-2xl bg-surface-subtle p-3 text-sm text-foreground">This also deletes {deletingCheckins.length} {deletingCheckins.length === 1 ? 'Check-in' : 'Check-ins'} and {deletingMinutes} focused {deletingMinutes === 1 ? 'minute' : 'minutes'}.</p>}
            {actionError && <p role="alert" className="text-xs text-destructive">{actionError}</p>}
            <Button type="button" variant="outline" onClick={() => void confirmTaskDeletion()} className="min-h-11 rounded-xl border-destructive font-semibold text-destructive hover:bg-destructive/5 hover:text-destructive focus-visible:border-destructive focus-visible:ring-destructive/20"><Trash2 size={16} aria-hidden="true" />Delete Task permanently</Button>
            <button type="button" autoFocus onClick={() => { setDeletingId(null); setActionError('') }} className="min-h-11 rounded-xl text-sm font-semibold text-muted-foreground">Keep Task</button>
          </div> : copySource ? <form onSubmit={event => void submitCopy(event)} className="flex flex-col gap-3">
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
            <button type="button" disabled={activeFocus?.taskId === menuTask.id} onClick={() => { setDeletingId(menuTask.id); setMenuTaskId(null); setActionError('') }} className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold text-destructive hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-50"><Trash2 size={18} aria-hidden="true" />{activeFocus?.taskId === menuTask.id ? 'Delete Task' : `Delete Task${minutesForTask(menuTask.id) ? ` (removes ${minutesForTask(menuTask.id)}m focus)` : ''}`}</button>
            {activeFocus?.taskId === menuTask.id && <p className="px-3 text-xs font-semibold text-amber">Stop or finish the session first</p>}
            {actionError && <p role="alert" className="px-3 text-xs text-destructive">{actionError}</p>}
          </div>}
        </section>
      </div>}
      {checkinEditor && <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/35" onClick={() => setCheckinEditor(null)}>
        <section role="dialog" aria-modal="true" aria-label={checkinEditor.mode === 'add' ? 'Add Check-in' : 'Edit Check-in'} onClick={event => event.stopPropagation()} className="max-h-[90svh] w-full max-w-[414px] overflow-y-auto rounded-t-[28px] bg-card px-5 pb-[max(32px,env(safe-area-inset-bottom))] pt-4 shadow-xl">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-bold">{checkinEditor.mode === 'add' ? 'Add Check-in' : 'Edit Check-in'}</h2>
              <p className="mt-1 text-xs text-muted-foreground">Focused time belongs to the selected Task's Day.</p>
            </div>
            <button type="button" aria-label="Close Check-in" onClick={() => setCheckinEditor(null)} className="grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground"><X size={19} aria-hidden="true" /></button>
          </div>
          <form onSubmit={event => void submitCheckin(event)} className="flex flex-col gap-3">
            <label htmlFor="checkin-task" className="text-xs font-semibold">Task</label>
            <select id="checkin-task" aria-label="Task" required value={checkinTaskId} onChange={event => { setCheckinTaskId(event.target.value); setCheckinError('') }} className="min-h-11 w-full rounded-xl border border-border bg-card px-3 text-base outline-none focus:border-mint">
              {!checkinTaskId && <option value="">Choose a Task</option>}
              {eligibleTasks.map(task => <option key={task.id} value={task.id}>{task.title}{task.day !== day ? ` · ${dayLabel(task.day)}` : ''}</option>)}
            </select>
            {selectedCheckinTask && <p className="text-xs text-muted-foreground">Day: {dayLabel(selectedCheckinTask.day)} · {selectedCheckinTask.completed ? 'complete' : 'incomplete'} Task</p>}
            {eligibleTasks.length === 0 && <p className="text-xs text-muted-foreground">Add a Task on Today first. Past Days only allow existing Tasks.</p>}
            <label htmlFor="checkin-minutes" className="text-xs font-semibold">Focused minutes</label>
            <input id="checkin-minutes" aria-label="Focused minutes" type="number" required min={1} max={480} step={1} value={checkinMinutes} onChange={event => { setCheckinMinutes(event.target.value); setCheckinError('') }} className="min-h-11 w-full rounded-xl border border-border bg-card px-3 text-base outline-none focus:border-mint" />
            {checkinError && <p role="alert" className="text-xs text-destructive">{checkinError}</p>}
            <Button type="submit" disabled={!selectedCheckinTask} className="min-h-11 rounded-xl bg-primary font-bold text-white">{checkinEditor.mode === 'add' ? 'Save Check-in' : 'Save changes'}</Button>
          </form>
          {editingCheckin && <div className="mt-3">
            {!confirmCheckinDelete ? <Button type="button" variant="outline" onClick={() => setConfirmCheckinDelete(true)} className="min-h-11 w-full rounded-xl border-destructive font-semibold text-destructive hover:bg-destructive/5 hover:text-destructive focus-visible:border-destructive focus-visible:ring-destructive/20"><Trash2 size={16} aria-hidden="true" />Delete Check-in</Button>
              : <div className="flex flex-col gap-2">
                <p className="text-xs text-muted-foreground">Remove this focused time? Task completion and its Session will not change.</p>
                <Button type="button" onClick={() => void removeCheckin()} variant="outline" className="min-h-11 w-full rounded-xl border-destructive text-destructive hover:bg-destructive/5 hover:text-destructive focus-visible:border-destructive focus-visible:ring-destructive/20">Confirm deletion</Button>
                <button type="button" onClick={() => setConfirmCheckinDelete(false)} className="min-h-11 text-xs text-muted-foreground">Keep Check-in</button>
              </div>}
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
