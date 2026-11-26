import { z } from 'zod'

export const userOrdersParamsSchema = z.object({
	userId: z.uuid(),
})
