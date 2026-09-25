import { z } from 'zod'

const daySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month && date.getUTCDate() === day
}, 'Enter a valid calendar day.')

const taskBodySchema = z.strictObject({
  id: z.uuidv7(),
  day: daySchema,
  title: z.string().trim().min(1).max(120),
  completed: z.boolean(),
  orderKey: z.string().regex(/^[0-9a-f]{32}$/),
  createdAt: z.iso.datetime(),
})

export const taskRecordSchema = taskBodySchema.extend({
  userId: z.string().min(1),
  seq: z.number().int().nonnegative(),
})
export const taskChangeSchema = z.union([
  z.strictObject({ id: z.uuidv7(), task: taskBodySchema }),
  z.strictObject({ id: z.uuidv7(), deleteTaskId: z.uuidv7() }),
])
export const pushRequestSchema = z.strictObject({ changes: z.array(taskChangeSchema).max(100) })
export const pushResponseSchema = z.strictObject({ results: z.array(z.strictObject({
  id: z.uuidv7(),
  status: z.enum(['accepted', 'rejected']),
  seq: z.number().int().positive().optional(),
  reason: z.string().optional(),
})) })
export const pullResponseSchema = z.strictObject({
  changes: z.array(z.union([
    z.strictObject({ seq: z.number().int().positive(), task: taskRecordSchema }),
    z.strictObject({ seq: z.number().int().positive(), deletedTaskId: z.uuidv7() }),
  ])),
  nextSeq: z.number().int().nonnegative(),
  hasMore: z.boolean(),
})

export type TaskRecord = z.infer<typeof taskRecordSchema>
export type TaskChange = z.infer<typeof taskChangeSchema>

export function normalizeTaskTitle(input: string): string {
  const title = input.trim()
  if (!title) throw new Error('Enter a Task title.')
  if (title.length > 120) throw new Error('Task titles must be 120 characters or fewer.')
  return title
}

export function localDay(date: Date = new Date()): string {
  const year = String(date.getFullYear()).padStart(4, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const ORDER_STEP = 1n << 64n
const ORDER_MAX = (1n << 128n) - 1n

export function nextOrderKey(keys: string[]): string {
  let maximum = 0n
  for (const key of keys) {
    if (!/^[0-9a-f]{32}$/.test(key)) throw new Error('Invalid Task order key.')
    const value = BigInt(`0x${key}`)
    if (value > maximum) maximum = value
  }

  if (maximum > ORDER_MAX - ORDER_STEP) throw new Error('Task order keys exhausted.')
  return (maximum + ORDER_STEP).toString(16).padStart(32, '0')
}

export function orderKeyBetween(lower?: string, upper?: string): string {
  const low = lower ? BigInt(`0x${lower}`) : 0n
  const high = upper ? BigInt(`0x${upper}`) : ORDER_MAX
  if (high - low < 2n) throw new Error('No room to move this Task in the current order.')
  return (low + (high - low) / 2n).toString(16).padStart(32, '0')
}
