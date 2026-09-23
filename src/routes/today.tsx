import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { liveQuery } from 'dexie'
import { LayoutGrid, Plus, RefreshCw, SquareCheck, Timer } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { authClient } from '@/auth-client'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { localDay, type TaskRecord } from '@/lib/task-contract'
import { TaskStore } from '@/lib/task-store'
import { syncTasks } from '@/lib/task-sync'

type TodayUser = { id: string; name: string; image: string | null }
const cachedUserKey = 'habit-tracker:last-user'

export const Route = createFileRoute('/today')({ component: Today })

function Today() {
  const navigate = useNavigate()
  const [user, setUser] = useState<TodayUser | null>(null)
  const [store, setStore] = useState<TaskStore | null>(null)
  const [tasks, setTasks] = useState<TaskRecord[]>([])
  const [ready, setReady] = useState(false)
  const [firstLoadError, setFirstLoadError] = useState(false)
  const [sessionError, setSessionError] = useState('')
  const [syncError, setSyncError] = useState('')
  const [pending, setPending] = useState(0)
  const [title, setTitle] = useState('')
  const [titleError, setTitleError] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const inFlight = useRef(false)
  const rerunRequested = useRef(false)
  const retryTimer = useRef<number | undefined>(undefined)
  const failures = useRef(0)
  const day = localDay()

  useEffect(() => {
    const instance = new TaskStore()
    setStore(instance)
    return () => {
      clearTimeout(retryTimer.current)
      instance.close()
    }
  }, [])

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
    const subscription = liveQuery(() => store.listTasks(user.id, day)).subscribe({
      next: records => { if (active) setTasks(records) },
      error: () => { if (active) setSyncError('Could not read Tasks on this device.') },
    })
    const reconnect = () => void sync()
    const foreground = () => { if (document.visibilityState === 'visible') void sync() }
    window.addEventListener('online', reconnect)
    document.addEventListener('visibilitychange', foreground)
    return () => {
      active = false
      subscription.unsubscribe()
      window.removeEventListener('online', reconnect)
      document.removeEventListener('visibilitychange', foreground)
      clearTimeout(retryTimer.current)
    }
  }, [store, user, day, sync])

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
      const task = await store.createTask(user.id, title, localDay())
      setTitle('')
      setTitleError('')
      setSelectedId(task.id)
      await refreshPending()
      void sync()
    } catch (reason) {
      setTitleError(reason instanceof Error ? reason.message : 'Could not save Task on this device.')
    }
  }

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
      <h1 className="sr-only">Today</h1>
      <div className="flex flex-1 flex-col justify-center gap-4 px-5 py-6">
        <section aria-labelledby="timer-heading">
          <Card className="items-center gap-3 rounded-[26px] px-5 py-6 text-center shadow-none">
            <span className="font-sans text-[56px] leading-none font-bold tracking-[-.035em] text-foreground tabular-nums" aria-label="Default focus interval: 25 minutes">25:00</span>
            {tasks.length === 0 ? <>
              <h2 id="timer-heading" className="text-base font-bold">What will you focus on today?</h2>
              <p className="text-xs leading-relaxed text-muted-foreground">Focus sessions start with a Task.</p>
            </> : <>
              <h2 id="timer-heading" className="sr-only">Today’s timer</h2>
              <Button type="button" disabled className="w-full rounded-[18px]">Start Session</Button>
            </>}
          </Card>
        </section>
        <section aria-labelledby="task-list-heading" className="flex flex-col gap-2">
          <h2 id="task-list-heading" className="text-[13px] font-bold text-muted-foreground">Focus on</h2>
          <form onSubmit={event => void addTask(event)}>
            <div className="flex min-h-[42px] items-center gap-2 rounded-[14px] border border-border bg-card px-3 text-sm focus-within:border-mint">
              <Plus size={17} className="shrink-0 text-mint" aria-hidden="true" />
              <input aria-label="New Task" aria-describedby={titleError ? 'task-title-error' : undefined} value={title} onChange={event => { setTitle(event.target.value); if (titleError) setTitleError('') }} placeholder="New Task…" className="min-w-0 flex-1 bg-transparent py-2.5 text-[13px] text-foreground outline-none placeholder:text-ink-tertiary" />
            </div>
            {titleError && <p id="task-title-error" role="alert" className="mt-1 text-xs text-destructive">{titleError}</p>}
          </form>
          {tasks.map(task => <button type="button" key={task.id} onClick={() => setSelectedId(task.id)} aria-label={`${task.title}, incomplete`} aria-pressed={selectedId === task.id} className={`flex min-h-[44px] w-full items-center gap-2.5 rounded-2xl border bg-card px-3.5 py-2.5 text-left text-[13px] font-semibold ${selectedId === task.id ? 'border-mint' : 'border-border'}`}>
            <span className={`size-[18px] shrink-0 rounded-full border-2 ${selectedId === task.id ? 'grid place-items-center border-mint' : 'border-border'}`}>{selectedId === task.id && <span className="size-2 rounded-full bg-mint" />}</span>
            <span className="min-w-0 flex-1 break-words">{task.title}</span>
            <span className="shrink-0 text-[11px] font-medium text-ink-tertiary">No focus</span>
          </button>)}
        </section>
        <section aria-labelledby="today-focus-heading">
          <Card className="gap-2.5 rounded-[22px] p-4 shadow-none">
            <h2 id="today-focus-heading" className="text-sm font-bold">Today's focus</h2>
            <p className="text-[13px] text-ink-tertiary">No focus recorded today yet.</p>
          </Card>
        </section>
      </div>
      <nav className="sticky bottom-0 flex min-h-[72px] items-center justify-around border-t border-border bg-card px-4 py-2 pb-[max(8px,env(safe-area-inset-bottom))]" aria-label="Main sections">
        <span className="flex h-[52px] w-20 flex-col items-center justify-center gap-1 rounded-2xl bg-mint-surface text-[11px] font-bold text-mint" aria-current="page"><Timer size={20} aria-hidden="true" />Timer</span>
        <span className="flex h-[52px] w-20 flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-medium text-muted-foreground opacity-65" aria-disabled="true" title="Tasks are coming in a later update"><SquareCheck size={20} aria-hidden="true" />Tasks</span>
        <span className="flex h-[52px] w-20 flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-medium text-muted-foreground opacity-65" aria-disabled="true" title="Progress is coming in a later update"><LayoutGrid size={20} aria-hidden="true" />Progress</span>
      </nav>
    </main>
  )
}
