import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { authClient } from '@/auth-client'
import { LayoutGrid, Timer, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

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
    <main className="mx-auto min-h-svh max-w-[30rem] px-6 pt-[clamp(4rem,15vh,10rem)] pb-12 font-display max-[480px]:px-5 max-[480px]:pt-8 max-[480px]:pb-10">
      <div className="mb-8 grid size-[52px] place-items-center rounded-2xl bg-mint-ink text-[28px] font-extrabold text-white max-[480px]:mb-4" aria-hidden="true">✓</div>
      <p className="text-[.72rem] font-extrabold tracking-[.13em] text-mint-ink uppercase">Habit Tracker</p>
      <h1 className="mt-3 mb-4 text-[clamp(2.4rem,9vw,3.5rem)] leading-[1.15] font-bold tracking-[-.045em] max-[480px]:mb-3 max-[480px]:text-[clamp(2rem,8vw,2.4rem)]">Make room for the work that matters.</h1>
      <p className="mb-10 leading-[1.7] text-foreground/80 max-[480px]:mb-5">Choose what you’ll work on today. Focus in one stretch at a time. See your days add up.</p>
      <Card className="mb-[1.6rem] gap-0 rounded-3xl p-5 font-sans shadow-none max-[480px]:mb-5 max-[480px]:p-4">
        <ul className="grid gap-3.5 max-[480px]:gap-3" aria-label="What Habit Tracker offers">
          {features.map(({ Icon, title, description }) => (
            <li className="grid grid-cols-[36px_minmax(0,1fr)] items-start gap-3" key={title}>
              <span className="grid size-9 place-items-center rounded-xl bg-mint-surface text-mint" aria-hidden="true">
                <Icon size={18} strokeWidth={2} />
              </span>
              <div>
                <h2 className="mb-0.5 text-sm leading-tight font-bold">{title}</h2>
                <p className="text-xs leading-[1.45] text-muted-foreground">{description}</p>
              </div>
            </li>
          ))}
        </ul>
      </Card>
      <Button
        className="h-[52px] w-full rounded-[.9rem] bg-mint-ink font-display font-bold text-white hover:bg-[#18543a] disabled:cursor-wait disabled:opacity-60"
        type="button"
        onClick={() => void signIn()}
        disabled={isPending}
      >
        Sign in with Google
      </Button>
      {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
      <p className="mt-6 text-[.85rem] leading-[1.6] text-[#655f6b] max-[480px]:mt-4">
        Before signing in, read our <Link to="/privacy" className="text-mint-ink underline underline-offset-[.18em] focus-visible:rounded-sm focus-visible:outline-[3px] focus-visible:outline-offset-4 focus-visible:outline-ring">Privacy Policy</Link> to see what we store and how to request deletion.
      </p>
    </main>
  )
}
