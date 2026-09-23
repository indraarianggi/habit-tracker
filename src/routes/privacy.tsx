import { Link, createFileRoute } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
const policyCardClass = 'my-3 grid grid-cols-[2.5rem_minmax(0,1fr)] gap-3 rounded-[20px] p-[22px] shadow-none max-[480px]:grid-cols-[1.85rem_minmax(0,1fr)] max-[480px]:gap-1.5 max-[480px]:rounded-[18px] max-[480px]:p-4'


export const Route = createFileRoute('/privacy')({
  head: () => ({ meta: [{ title: 'Privacy Policy · Habit Tracker' }] }),
  component: PrivacyPolicy,
})

function PrivacyPolicy() {
  const contact = import.meta.env.VITE_PRIVACY_CONTACT_EMAIL

  return (
    <main className="min-h-svh">
      <nav className="mx-auto flex h-16 max-w-3xl items-center px-6 max-[480px]:h-14 max-[480px]:px-5" aria-label="Page navigation">
        <Button variant="ghost" asChild className="-ml-3 font-bold">
          <Link to="/"><span aria-hidden="true">←</span> Back</Link>
        </Button>
      </nav>
      <div className="mx-auto max-w-3xl px-6 pt-[22px] pb-20 max-[480px]:px-5 max-[480px]:pt-3 max-[480px]:pb-12">
        <header className="px-0.5 pt-3 pb-[30px] max-[480px]:pb-[17px]">
          <p className="text-xs font-extrabold tracking-[.13em] text-mint-ink uppercase">Habit Tracker / Your data</p>
          <h1 className="my-3 text-[clamp(2rem,6vw,3rem)] leading-[1.15] font-bold tracking-[-.045em]">Privacy Policy</h1>
          <p className="mb-5 text-[13px] text-muted-foreground">Effective September 23, 2026</p>
          <p className="max-w-[37rem] leading-relaxed text-foreground/80">Focus should belong to you. This policy explains what the app keeps and how to remove it.</p>
        </header>
        <Card role="region" className={policyCardClass} aria-labelledby="identity-heading">
          <span className="pt-1 text-xs font-extrabold text-mint-ink" aria-hidden="true">01</span>
          <div>
            <h2 id="identity-heading" className="mb-2.5 text-[1.08rem] font-bold tracking-tight">Google identity</h2>
            <p className="wrap-anywhere text-[15px] leading-[1.72] text-foreground/80 max-[480px]:text-sm">When you sign in with Google, we keep your Google name, email address, and profile photo URL, as well as your Google account identifier and the authentication tokens Google provides to identify your User and keep you signed in. We do not request access to your Google Tasks. There is no password stored by this app.</p>
          </div>
        </Card>

        <Card role="region" className={policyCardClass} aria-labelledby="work-heading">
          <span className="pt-1 text-xs font-extrabold text-mint-ink" aria-hidden="true">02</span>
          <div>
            <h2 id="work-heading" className="mb-2.5 text-[1.08rem] font-bold tracking-tight">What you create</h2>
            <p className="wrap-anywhere text-[15px] leading-[1.72] text-foreground/80 max-[480px]:text-sm">We keep your Tasks (titles, Days, order and completion state), Check-ins (the Task, focused minutes and whether they came from a Pomodoro Session or manual entry), Pomodoro Sessions and timer settings. Check-ins take their Day from their Task. Sound, wake-screen and appearance preferences stay on your device.</p>
          </div>
        </Card>

        <Card role="region" className={policyCardClass} aria-labelledby="storage-heading">
          <span className="pt-1 text-xs font-extrabold text-mint-ink" aria-hidden="true">03</span>
          <div>
            <h2 id="storage-heading" className="mb-2.5 text-[1.08rem] font-bold tracking-tight">Storage and access</h2>
            <p className="wrap-anywhere text-[15px] leading-[1.72] text-foreground/80 max-[480px]:text-sm">We store your User identity and session on the operator’s own homelab server in SQLite. When work features are available, your Tasks, Check-ins, Pomodoro Sessions and settings will be saved on your device and synced to that server for use across devices. Each User’s data is isolated from other Users; another User cannot read your records. We do not use analytics, advertising, tracking pixels or third-party trackers.</p>
          </div>
        </Card>

        <Card role="region" className={policyCardClass} aria-labelledby="backup-heading">
          <span className="pt-1 text-xs font-extrabold text-mint-ink" aria-hidden="true">04</span>
          <div>
            <h2 id="backup-heading" className="mb-2.5 text-[1.08rem] font-bold tracking-tight">Backups and deletion</h2>
            <p className="wrap-anywhere text-[15px] leading-[1.72] text-foreground/80 max-[480px]:text-sm">When signed-in storage is available, off-site backups will be kept for disaster recovery with retention of up to 30 days. When account deletion is available, you can delete your account and its Tasks, Check-ins, Pomodoro Sessions and settings from Settings. Active server records are removed on deletion; copies in backups can remain for up to 30 days before they expire. Until account controls are available, contact us using the address below with a deletion request.</p>
          </div>
        </Card>

        <Card role="region" className={`${policyCardClass} border-mint/25 bg-mint-surface`} aria-labelledby="contact-heading">
          <span className="pt-1 text-xs font-extrabold text-mint-ink" aria-hidden="true">05</span>
          <div>
            <h2 id="contact-heading" className="mb-2.5 text-[1.08rem] font-bold tracking-tight">Questions or requests?</h2>
            <p className="wrap-anywhere text-[15px] leading-[1.72] text-foreground/80 max-[480px]:text-sm">For privacy questions or account deletion, email <a className="font-bold text-mint-ink underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" href={`mailto:${contact}`} aria-label={`Contact us about privacy at ${contact}`}>{contact}</a>.</p>
          </div>
        </Card>
      </div>
    </main>
  )
}
