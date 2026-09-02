import { z } from 'zod'

const dateKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export const reasonSchema = z.object({
  reason: z.string().trim().min(1).max(500),
})

export const banSchema = z.object({
  reason: z.string().trim().min(1).max(500),
  until: z
    .string()
    .refine((value) => {
      const time = Date.parse(value)
      return !Number.isNaN(time) && time > Date.now()
    })
    .optional(),
})

export const scoreActionSchema = z.object({
  reason: z.string().trim().min(1).max(500),
  date: dateKeySchema.optional(),
})

export const searchQuerySchema = z
  .object({
    playerId: z.string().trim().min(6).max(64).optional(),
    name: z.string().trim().min(1).max(50).optional(),
    ipHash: z.string().trim().min(8).max(128).optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
  })
  .refine(
    (query) => Boolean(query.playerId || query.name || query.ipHash),
    'playerId, name, or ipHash is required',
  )

export const auditQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
})
