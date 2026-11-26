import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { userOrdersParamsSchema } from './users.schemas'
import { listUserOrders } from './users.services'

export const usersRouter = new Hono()

usersRouter.get('/:userId/orders', async (c) => {
	const params = userOrdersParamsSchema.safeParse(c.req.param())

	if (!params.success) {
		throw new HTTPException(400, {
			message: 'User ID must be a valid UUID',
			cause: params.error,
		})
	}

	const orders = await listUserOrders(params.data.userId.toLowerCase())

	if (orders === null) {
		throw new HTTPException(404, { message: 'User not found' })
	}

	return c.json(orders, 200)
})
