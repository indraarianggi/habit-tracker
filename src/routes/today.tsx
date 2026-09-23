import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { LayoutGrid, Plus, SquareCheck, Timer } from 'lucide-react'
import { useEffect, useState } from 'react'
import { authClient } from '@/auth-client'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

type TodayUser = { id: string; name: string; image: string | null }

export const Route = createFileRoute('/today')({ component: Today })

function Today() {
  const navigate = useNavigate()
  const [user, setUser] = useState<TodayUser | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/today', { credentials: 'same-origin', signal: controller.signal })
      .then(async (response) => {
        if (response.status === 401) {
          void navigate({ to: '/', replace: true })
          return
        }
        if (!response.ok) throw new Error('Could not load Today')
        const data: { user: TodayUser } = await response.json()
        setUser(data.user)
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Could not load Today')
      })
    return () => controller.abort()
  }, [navigate])

  async function signOut() {
    const result = await authClient.signOut()
    if (result.error) {
      setError('Could not sign out. Try again.')
      return
    }
    void navigate({ to: '/', replace: true })
  }

  if (error) return <main className="mx-auto min-h-svh max-w-[414px] p-5"><p role="alert" className="text-sm text-destructive">{error}</p></main>
  if (!user) return <main className="mx-auto grid min-h-svh max-w-[414px] place-items-center p-5"><p role="status" className="text-sm text-muted-foreground">Loading your data…</p></main>

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-[414px] flex-col">
      <header className="flex min-h-14 items-center justify-between px-5">
        <span className="text-[22px] font-bold tracking-tight">Habit Tracker</span>
        <div className="flex items-center gap-2">
          <Avatar className="size-[34px] border-[1.5px] border-mint bg-mint-surface" aria-label={`${user.name}'s profile`}>
            {user.image && <AvatarImage src={user.image} alt="" referrerPolicy="no-referrer" />}
            <AvatarFallback className="bg-mint-surface font-bold text-mint-ink">{user.name.slice(0, 1).toUpperCase()}</AvatarFallback>
          </Avatar>
          <Button variant="ghost" className="h-11 px-1 text-xs text-muted-foreground hover:text-foreground" type="button" onClick={() => void signOut()}>Sign out</Button>
        </div>
      </header>
      <h1 className="sr-only">Today</h1>
      <div className="flex flex-1 flex-col justify-center gap-6 px-5 py-6">
        <section aria-labelledby="timer-empty-heading">
          <Card className="items-center gap-3 rounded-[28px] px-5 py-6 text-center shadow-none">
            <span className="font-sans text-[56px] leading-none font-bold tracking-[-.035em] text-muted-foreground tabular-nums" aria-label="Default focus interval: 25 minutes">25:00</span>
            <h2 id="timer-empty-heading" className="text-base font-bold">What will you focus on today?</h2>
            <p className="text-xs leading-relaxed text-muted-foreground">Focus sessions start with a Task.</p>
          </Card>
        </section>
        <div>
          <div className="flex min-h-[42px] items-center gap-2.5 rounded-[18px] border border-border bg-card px-3.5 py-2.5 text-sm text-ink-tertiary" aria-disabled="true">
            <Plus size={18} strokeWidth={2} className="text-mint" aria-hidden="true" />
            <span>New Task…</span>
          </div>
          <p className="mt-1.5 text-center text-[11px] text-muted-foreground">Task entry is coming in the next update.</p>
        </div>
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
