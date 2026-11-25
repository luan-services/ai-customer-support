import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { createSupportRequestSchema } from './support-requests.schemas'
import { createSupportRequest } from './support-requests.services'

export const supportRequestsRouter = new Hono()

supportRequestsRouter.post('/', async (c) => {
	let body;

	try {
		body = await c.req.json();
	} catch (error) {
		throw new HTTPException(400, { message: 'Invalid JSON' });
	}

	const result = createSupportRequestSchema.safeParse(body);

	if (!result.success) {
		throw new HTTPException(400, {
			message: 'Message must be a non-empty string',
			cause: result.error,
		})
	}

	const supportRequest = await createSupportRequest(result.data.message)

	return c.json(supportRequest, 201)
})
