import { Link, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/privacy')({
  head: () => ({ meta: [{ title: 'Privacy Policy · Habit Tracker' }] }),
  component: PrivacyPolicy,
})

function PrivacyPolicy() {
  const contact = import.meta.env.VITE_PRIVACY_CONTACT_EMAIL

  return (
    <main className="privacy-page">
      <nav className="privacy-nav" aria-label="Page navigation">
        <Link to="/" className="back-link"><span aria-hidden="true">←</span> Back</Link>
      </nav>
      <div className="privacy-content">
        <header className="privacy-intro">
          <p className="eyebrow">Habit Tracker / Your data</p>
          <h1>Privacy Policy</h1>
          <p className="effective-date">Effective September 23, 2026</p>
          <p>Focus should belong to you. This policy explains what the app keeps and how to remove it.</p>
        </header>

        <section className="policy-section" aria-labelledby="identity-heading">
          <span className="section-number" aria-hidden="true">01</span>
          <div>
            <h2 id="identity-heading">Google identity</h2>
            <p>When you sign in with Google, we keep your Google name, email address, and profile photo URL to identify your User and display your account. Google is used for sign-in, not to read your Google Tasks or other Google data. There is no password stored by this app.</p>
          </div>
        </section>

        <section className="policy-section" aria-labelledby="work-heading">
          <span className="section-number" aria-hidden="true">02</span>
          <div>
            <h2 id="work-heading">What you create</h2>
            <p>We keep your Tasks (titles, Days, order and completion state), Check-ins (the Task, focused minutes and whether they came from a Pomodoro Session or manual entry), Pomodoro Sessions and timer settings. Check-ins take their Day from their Task. Sound, wake-screen and appearance preferences stay on your device.</p>
          </div>
        </section>

        <section className="policy-section" aria-labelledby="storage-heading">
          <span className="section-number" aria-hidden="true">03</span>
          <div>
            <h2 id="storage-heading">Storage and access</h2>
            <p>When signed-in features are available, your work will be saved on your device and synced to the operator’s own homelab server so you can use multiple devices. Each User’s Tasks, Check-ins, Pomodoro Sessions and settings will be isolated from other Users; another User cannot read your records. We do not use analytics, advertising, tracking pixels or third-party trackers.</p>
          </div>
        </section>

        <section className="policy-section" aria-labelledby="backup-heading">
          <span className="section-number" aria-hidden="true">04</span>
          <div>
            <h2 id="backup-heading">Backups and deletion</h2>
            <p>When signed-in storage is available, off-site backups will be kept for disaster recovery with retention of up to 30 days. When account deletion is available, you can delete your account and its Tasks, Check-ins, Pomodoro Sessions and settings from Settings. Active server records are removed on deletion; copies in backups can remain for up to 30 days before they expire. Until account controls are available, contact us using the address below with a deletion request.</p>
          </div>
        </section>

        <section className="policy-section policy-contact" aria-labelledby="contact-heading">
          <span className="section-number" aria-hidden="true">05</span>
          <div>
            <h2 id="contact-heading">Questions or requests?</h2>
            <p>For privacy questions or account deletion, email <a href={`mailto:${contact}`} aria-label={`Contact us about privacy at ${contact}`}>{contact}</a>.</p>
          </div>
        </section>
      </div>
    </main>
  )
}
