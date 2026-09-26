import { z } from 'zod'

export const durationSettingsSchema = z.strictObject({
  focusMinutes: z.number().int().min(1).max(120),
  shortBreakMinutes: z.number().int().min(1).max(30),
  longBreakMinutes: z.number().int().min(1).max(60),
})

export type DurationSettings = z.infer<typeof durationSettingsSchema>

export const defaultDurations: DurationSettings = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
}

export const settingsChangeSchema = z.strictObject({
  id: z.uuidv7(),
  settings: durationSettingsSchema,
})

export type SettingsChange = z.infer<typeof settingsChangeSchema>
