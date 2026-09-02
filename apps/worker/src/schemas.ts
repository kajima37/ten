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
  z.object({ type: z.literal('miss') }),
])

export const scoreSubmissionSchema = z.object({
  mode: z.literal('daily'),
  dateKey: dateKeySchema,
  startToken: z.string().min(20).max(2048),
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

export const weeklyLeaderboardQuerySchema = z.object({
  week: dateKeySchema.optional(),
  scope: z.enum(['global', 'friends']).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
})

export const friendCodeSchema = z.object({
  friendCode: z
    .string()
    .trim()
    .regex(/^[A-Z0-9]{8}$/i),
})
