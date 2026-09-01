import { z } from 'zod'

const dateKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export const registerSchema = z.object({
  deviceId: z.string().min(8).max(128),
  name: z.string().trim().min(1).max(20).optional(),
})

export const gameEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('eliminate'),
    cells: z.array(z.number().int().min(0).max(24)).min(2).max(25),
  }),
  z.object({ type: z.literal('shuffle') }),
])

export const scoreSubmissionSchema = z.object({
  mode: z.literal('daily'),
  dateKey: dateKeySchema,
  events: z.array(gameEventSchema).max(500),
  score: z.number().int().min(0),
  maxCombo: z.number().int().min(0),
})

export const nameSchema = z.object({
  name: z.string().trim().min(1).max(20),
})

export const leaderboardQuerySchema = z.object({
  date: dateKeySchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
})

export const adminPlayersQuerySchema = z.object({
  ipHash: z.string().min(1).max(128),
})
