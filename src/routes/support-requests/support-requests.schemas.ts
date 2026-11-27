import { z } from 'zod'
import { SupportReplyStatus } from '../../../generated/prisma/enums'

export const createSupportMessageSchema = z.object({
	message: z.string().refine((message) => message.trim().length > 0),
})

export const createSupportRequestSchema = z.object({
	userId: z.uuid().toLowerCase(),
	orderId: z.uuid().toLowerCase(),
	...createSupportMessageSchema.shape,
})

export const supportRequestParamsSchema = z.object({
	id: z.uuid(),
})

export const listSupportRequestsQuerySchema = z.object({
	replyStatus: z.enum(SupportReplyStatus).optional(),
})
