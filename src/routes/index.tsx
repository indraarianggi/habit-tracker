import { Link, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  return (
    <main className="landing">
      <h1>Habit Tracker</h1>
      <p>Plan the work. Focus on it. See the days add up.</p>
      <Link to="/privacy">Read our Privacy Policy</Link>
    </main>
  )
}
