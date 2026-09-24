import { z } from 'zod'
import { taskRecordSchema, type TaskRecord } from '@/lib/task-contract'

export const sessionRecordSchema = z.strictObject({
  id: z.uuidv7(),
  userId: z.string().min(1),
  taskId: z.uuidv7(),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  plannedMinutes: z.number().int().positive(),
  status: z.enum(['running', 'paused']),
  startedAt: z.iso.datetime(),
  elapsedMs: z.number().int().nonnegative(),
  segmentStartedAt: z.iso.datetime().nullable(),
})

export const checkinRecordSchema = z.strictObject({
  id: z.uuidv7(),
  userId: z.string().min(1),
  taskId: z.uuidv7(),
  durationMinutes: z.number().int().min(1).max(480),
  origin: z.enum(['session', 'manual']),
  sourceSessionId: z.uuidv7().nullable(),
  createdAt: z.iso.datetime(),
})

const checkinChangeBase = { id: z.uuidv7(), checkinId: z.uuidv7(), today: taskRecordSchema.shape.day }
const checkinTarget = { taskId: z.uuidv7(), durationMinutes: z.number().int().min(1).max(480) }
export const checkinChangeSchema = z.discriminatedUnion('action', [
  z.strictObject({ ...checkinChangeBase, ...checkinTarget, action: z.literal('create'), createdAt: z.iso.datetime() }),
  z.strictObject({ ...checkinChangeBase, ...checkinTarget, action: z.literal('edit') }),
  z.strictObject({ ...checkinChangeBase, action: z.literal('delete') }),
])

export const startSessionSchema = z.strictObject({
  id: z.uuidv7(),
  taskId: z.uuidv7(),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  plannedMinutes: z.literal(25),
})
export const controlSessionSchema = z.strictObject({
  id: z.uuidv7(),
  action: z.enum(['pause', 'resume']),
  at: z.iso.datetime().optional(),
})
export const finishSessionSchema = z.strictObject({
  id: z.uuidv7(),
  outcome: z.enum(['finish', 'save', 'discard']),
  durationMinutes: z.number().int().optional(),
})
export type StartSessionRequest = z.infer<typeof startSessionSchema>
export type FinishSessionRequest = z.infer<typeof finishSessionSchema>

export type SessionRecord = z.infer<typeof sessionRecordSchema>
export type CheckinRecord = z.infer<typeof checkinRecordSchema>
export type CheckinChangeRequest = z.infer<typeof checkinChangeSchema>

export function chooseTimerTask(tasks: TaskRecord[], lastTaskId: string | null): TaskRecord | null {
  return tasks.find(task => task.id === lastTaskId)
    ?? tasks.find(task => !task.completed)
    ?? tasks[0]
    ?? null
}
