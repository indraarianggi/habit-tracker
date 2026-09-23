import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { authClient } from '../auth-client'
import { LayoutGrid, Timer, WifiOff } from 'lucide-react'

const features = [
  { Icon: Timer, title: 'Pomodoro Focus', description: 'Classic 25-minute intervals automatically recorded against your daily tasks.' },
  { Icon: LayoutGrid, title: 'Activity Grid', description: 'GitHub-style heatmap shaded by effort and minutes across all tasks.' },
  { Icon: WifiOff, title: 'Local-First & Offline', description: 'Instant on your device, syncing seamlessly in the background.' },
]

export const Route = createFileRoute('/')({
  component: SignIn,
})

function SignIn() {
  const navigate = useNavigate()
  const { data: session, isPending } = authClient.useSession()
  const [error, setError] = useState('')

  useEffect(() => {
    if (session) void navigate({ to: '/today', replace: true })
  }, [session, navigate])

  async function signIn() {
    setError('')
    const result = await authClient.signIn.social({
      provider: 'google',
      callbackURL: '/today',
    })
    if (result.error) setError('Could not start Google sign-in. Try again.')
  }

  return (
    <main className="sign-in">
      <div className="sign-in-mark" aria-hidden="true">✓</div>
      <p className="eyebrow">Habit Tracker</p>
      <h1>Make room for the work that matters.</h1>
      <p className="sign-in-description">Choose what you’ll work on today. Focus in one stretch at a time. See your days add up.</p>
      <ul className="sign-in-features" aria-label="What Habit Tracker offers">
        {features.map(({ Icon, title, description }) => (
          <li className="sign-in-feature" key={title}>
            <span className="feature-icon" aria-hidden="true"><Icon size={18} strokeWidth={2} /></span>
            <div>
              <h2>{title}</h2>
              <p>{description}</p>
            </div>
          </li>
        ))}
      </ul>
      <button className="google-button" type="button" onClick={() => void signIn()} disabled={isPending}>
        Sign in with Google
      </button>
      {error && <p role="alert">{error}</p>}
      <p className="sign-in-privacy">Before signing in, read our <Link to="/privacy">Privacy Policy</Link> to see what we store and how to request deletion.</p>
    </main>
  )
}
