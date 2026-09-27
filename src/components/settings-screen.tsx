import { Link } from '@tanstack/react-router'
import { ArrowLeft, Bell, ChevronRight, Eye, Minus, Moon, Plus, RotateCcw, Sun, Timer, Volume2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import type { DevicePreferences } from '@/lib/device-preferences'
import type { DurationSettings } from '@/lib/settings-contract'

type DurationKey = keyof DurationSettings
const fields: Array<{ key: DurationKey; label: string; max: number; description: string }> = [
  { key: 'focusMinutes', label: 'Focus', max: 120, description: 'Length of a focus interval' },
  { key: 'shortBreakMinutes', label: 'Short Break', max: 30, description: 'A quick pause between sessions' },
  { key: 'longBreakMinutes', label: 'Long Break', max: 60, description: 'A longer chance to rest' },
]

function DurationControl({ label, description, max, value, onSave }: {
  label: string; description: string; max: number; value: number; onSave: (value: number) => Promise<void>
}) {
  const [draft, setDraft] = useState(String(value))
  const [error, setError] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const inputId = `duration-${label.toLowerCase().replaceAll(' ', '-')}`
  useEffect(() => {
    if (document.activeElement !== input.current) setDraft(String(value))
  }, [value])

  async function save(raw: string) {
    const minutes = Number(raw)
    if (!/^\d+$/.test(raw) || !Number.isInteger(minutes) || minutes < 1 || minutes > max) {
      setDraft(String(value))
      setError(`Enter 1–${max} whole minutes.`)
      return
    }
    setDraft(String(minutes))
    setError('')
    if (minutes === value) return
    try {
      await onSave(minutes)
    } catch {
      setDraft(String(value))
      setError('Could not save on this device. Try again.')
    }
  }

  return <div className="border-b border-border last:border-0">
    <div className="flex min-h-[76px] items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <label htmlFor={inputId} className="block text-[13px] font-bold">{label}</label>
        <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{description}</p>
      </div>
      <div className="flex shrink-0 items-center gap-0.5 rounded-xl border border-border bg-surface-subtle p-1">
        <button type="button" aria-label={`Decrease ${label}`} disabled={Number(draft) <= 1} onClick={() => void save(String(Number(draft) - 1))} className="grid size-9 place-items-center rounded-lg text-foreground active:bg-mint-surface disabled:opacity-35 focus-visible:outline-2 focus-visible:outline-mint"><Minus size={16} aria-hidden="true" /></button>
        <input ref={input} id={inputId} aria-label={`${label} minutes`} aria-invalid={!!error} aria-describedby={error ? `error-${inputId}` : undefined} type="number" inputMode="numeric" min={1} max={max} step={1} value={draft} onChange={event => { setDraft(event.target.value); setError('') }} onBlur={() => void save(draft)} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur() }} className="w-11 bg-transparent text-center text-base font-bold tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
        <button type="button" aria-label={`Increase ${label}`} disabled={Number(draft) >= max} onClick={() => void save(String(Number(draft) + 1))} className="grid size-9 place-items-center rounded-lg text-foreground active:bg-mint-surface disabled:opacity-35 focus-visible:outline-2 focus-visible:outline-mint"><Plus size={16} aria-hidden="true" /></button>
      </div>
    </div>
    {error && <p id={`error-${inputId}`} role="alert" className="pb-2 text-xs text-destructive">{error}</p>}
  </div>
}

function DeviceSwitch({ label, description, checked, disabled, onChange }: {
  label: string; description?: string; checked: boolean; disabled?: boolean; onChange: () => void
}) {
  return <div className="flex min-h-[62px] items-center justify-between gap-3 border-b border-border py-3 last:border-0">
    <div className="min-w-0"><p className="text-[13px] font-bold">{label}</p>{description && <p className="mt-0.5 text-[11px] text-muted-foreground">{description}</p>}</div>
    <button type="button" role="switch" aria-label={label} aria-checked={checked} disabled={disabled} onClick={onChange} className={`relative h-8 w-[52px] shrink-0 rounded-full p-1 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mint disabled:opacity-45 ${checked && !disabled ? 'bg-mint' : 'bg-border'}`}>
      <span className={`block size-6 rounded-full bg-white shadow-sm transition-transform duration-150 ${checked && !disabled ? 'translate-x-5' : ''}`} />
    </button>
  </div>
}

export function SettingsScreen({ user, durations, preferences, wakeSupported, onDuration, onReset, onPreferences, onBack, onSignOut, onOpenDangerZone }: {
  user: { name: string; email: string; image: string | null }
  durations: DurationSettings
  preferences: DevicePreferences
  wakeSupported: boolean
  onDuration: (key: DurationKey, minutes: number) => Promise<void>
  onReset: () => Promise<void>
  onPreferences: (preferences: DevicePreferences) => void
  onBack: () => void
  onSignOut: () => void
  onOpenDangerZone: () => void
}) {
  return <>
    <header className="flex min-h-16 items-center gap-2 px-4 pt-[env(safe-area-inset-top)]">
      <button type="button" aria-label="Back" onClick={onBack} className="grid size-11 shrink-0 place-items-center rounded-xl text-foreground active:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-mint"><ArrowLeft size={20} aria-hidden="true" /></button>
      <h1 className="font-display text-xl font-extrabold tracking-tight">Settings</h1>
    </header>
    <div className="flex flex-1 flex-col gap-5 px-5 pb-[max(32px,env(safe-area-inset-bottom))] pt-3">
      <section aria-labelledby="account-heading">
        <h2 id="account-heading" className="mb-2 flex items-center gap-2 px-1 text-[11px] font-extrabold tracking-[.12em] text-muted-foreground uppercase"><Eye size={14} aria-hidden="true" />Account</h2>
        <div className="rounded-[22px] border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <Avatar className="size-12 shrink-0 border border-mint bg-mint-surface">
              {user.image && <AvatarImage src={user.image} alt="" referrerPolicy="no-referrer" />}
              <AvatarFallback className="bg-mint-surface text-base font-bold text-mint-ink">{user.name.slice(0, 1).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="min-w-0"><p className="truncate text-sm font-bold">{user.name}</p><p className="break-all text-xs text-muted-foreground">{user.email}</p></div>
          </div>
          <button type="button" onClick={onSignOut} className="mt-4 min-h-11 w-full rounded-xl border border-border bg-surface-subtle text-[13px] font-semibold active:scale-[.96] focus-visible:outline-2 focus-visible:outline-mint">Sign out</button>
        </div>
      </section>
      <section aria-labelledby="timer-settings-heading">
        <h2 id="timer-settings-heading" className="mb-2 flex items-center gap-2 px-1 text-[11px] font-extrabold tracking-[.12em] text-muted-foreground uppercase"><Timer size={14} aria-hidden="true" />Timer</h2>
        <div className="rounded-[22px] border border-border bg-card px-4">
          {fields.map(field => <DurationControl key={field.key} label={field.label} description={field.description} max={field.max} value={durations[field.key]} onSave={minutes => onDuration(field.key, minutes)} />)}
          <button type="button" onClick={() => void onReset()} className="flex min-h-11 w-full items-center justify-center gap-2 text-xs font-bold text-mint-ink focus-visible:outline-2 focus-visible:outline-mint"><RotateCcw size={14} aria-hidden="true" />Reset to defaults</button>
        </div>
        <div className="mt-3 rounded-[22px] border border-border bg-card px-4">
          <DeviceSwitch label="Focus-end sound" description="Play a tone when focus ends" checked={preferences.focusSound} onChange={() => onPreferences({ ...preferences, focusSound: !preferences.focusSound })} />
          <DeviceSwitch label="Break-end sound" description="Play a different tone when a Break ends" checked={preferences.breakSound} onChange={() => onPreferences({ ...preferences, breakSound: !preferences.breakSound })} />
          <DeviceSwitch label="Keep screen awake" description={wakeSupported ? 'While a focus interval is running' : 'Not supported on this device'} checked={wakeSupported && preferences.wakeLock} disabled={!wakeSupported} onChange={() => onPreferences({ ...preferences, wakeLock: !preferences.wakeLock })} />
          <p className="flex items-center gap-1.5 border-t border-border py-2 text-[11px] font-semibold text-muted-foreground"><Volume2 size={13} aria-hidden="true" />Only on this device</p>
        </div>
      </section>
      <section aria-labelledby="appearance-heading">
        <h2 id="appearance-heading" className="mb-2 flex items-center gap-2 px-1 text-[11px] font-extrabold tracking-[.12em] text-muted-foreground uppercase"><Sun size={14} aria-hidden="true" />Appearance</h2>
        <div className="rounded-[22px] border border-border bg-card p-4">
          <fieldset><legend className="mb-2 text-[13px] font-bold">Theme</legend><div className="grid grid-cols-3 gap-2">
            {(['system', 'light', 'dark'] as const).map(theme => <label key={theme} className={`flex min-h-11 cursor-pointer items-center justify-center rounded-xl border text-xs font-bold transition-colors duration-150 ${preferences.theme === theme ? 'border-mint bg-mint-surface text-mint-ink' : 'border-border bg-surface-subtle text-muted-foreground'}`}>
              <input type="radio" name="theme" value={theme} checked={preferences.theme === theme} onChange={() => onPreferences({ ...preferences, theme })} className="sr-only" />
              {theme === 'dark' && <Moon size={13} className="mr-1" aria-hidden="true" />}{theme[0].toUpperCase() + theme.slice(1)}
            </label>)}
          </div></fieldset>
          <p className="mt-3 text-[11px] font-semibold text-muted-foreground">Only on this device</p>
        </div>
      </section>
      <section aria-labelledby="app-heading">
        <h2 id="app-heading" className="mb-2 px-1 text-[11px] font-extrabold tracking-[.12em] text-muted-foreground uppercase">App</h2>
        <div className="rounded-[22px] border border-border bg-card px-4"><Link to="/privacy" className="flex min-h-14 items-center justify-between text-[13px] font-bold focus-visible:outline-2 focus-visible:outline-mint">Privacy policy<ChevronRight size={17} className="text-muted-foreground" aria-hidden="true" /></Link></div>
      </section>
      <section aria-labelledby="danger-zone-heading">
        <div className="flex flex-col gap-2.5 rounded-[22px] border border-destructive bg-destructive-surface p-4">
          <h2 id="danger-zone-heading" className="text-[13px] font-extrabold text-destructive">Danger Zone</h2>
          <button type="button" onClick={onOpenDangerZone} className="flex min-h-8 w-full items-center justify-between rounded-lg text-[13px] font-bold text-destructive focus-visible:outline-2 focus-visible:outline-destructive">
            Delete account and data
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </div>
      </section>
    </div>
  </>
}
