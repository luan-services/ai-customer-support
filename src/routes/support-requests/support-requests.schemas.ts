import { z } from 'zod'

export const createSupportRequestSchema = z.object({
	userId: z.uuid().toLowerCase(),
	orderId: z.uuid().toLowerCase(),
	message: z.string().refine((message) => message.trim().length > 0),
})

export const supportRequestParamsSchema = z.object({
	id: z.uuid(),
})
