import { z } from 'zod'

export const deleteAccountRequestSchema = z.strictObject({ confirmation: z.literal('DELETE') })
export type DeleteAccountRequest = z.infer<typeof deleteAccountRequestSchema>
