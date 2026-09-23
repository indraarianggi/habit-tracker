import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { LayoutGrid, Plus, SquareCheck, Timer } from 'lucide-react'
import { useEffect, useState } from 'react'
import { authClient } from '../auth-client'

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

  if (error) return <main className="today-page"><p role="alert">{error}</p></main>
  if (!user) return <main className="today-page"><p role="status">Loading your data…</p></main>

  return (
    <main className="today-page">
      <header className="today-header">
        <span className="today-brand">Habit Tracker</span>
        <div className="today-header-actions">
          <span className="today-avatar" aria-label={`${user.name}'s profile`}>
            {user.image
              ? <img src={user.image} alt="" referrerPolicy="no-referrer" />
              : user.name.slice(0, 1).toUpperCase()}
          </span>
          <button className="sign-out" type="button" onClick={() => void signOut()}>Sign out</button>
        </div>
      </header>
      <h1 className="visually-hidden">Today</h1>
      <div className="today-content">
        <section className="timer-empty-card" aria-labelledby="timer-empty-heading">
          <span className="timer-display" aria-label="Default focus interval: 25 minutes">25:00</span>
          <h2 id="timer-empty-heading">What will you focus on today?</h2>
          <p>Focus sessions start with a Task.</p>
        </section>
        <div>
          <div className="task-preview" aria-disabled="true">
            <Plus size={18} strokeWidth={2} aria-hidden="true" />
            <span>New Task…</span>
          </div>
          <p className="task-unavailable">Task entry is coming in the next update.</p>
        </div>
        <section className="today-focus-card" aria-labelledby="today-focus-heading">
          <h2 id="today-focus-heading">Today's focus</h2>
          <p>No focus recorded today yet.</p>
        </section>
      </div>
      <nav className="bottom-nav" aria-label="Main sections">
        <span className="bottom-nav-item bottom-nav-active" aria-current="page"><Timer size={20} aria-hidden="true" />Timer</span>
        <span className="bottom-nav-item" aria-disabled="true" title="Tasks are coming in a later update"><SquareCheck size={20} aria-hidden="true" />Tasks</span>
        <span className="bottom-nav-item" aria-disabled="true" title="Progress is coming in a later update"><LayoutGrid size={20} aria-hidden="true" />Progress</span>
      </nav>
    </main>
  )
}
