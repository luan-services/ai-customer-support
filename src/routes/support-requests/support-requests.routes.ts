import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { createSupportRequestSchema, supportRequestParamsSchema } from './support-requests.schemas'
import {
	createSupportRequest,
	getSupportRequestById,
	listSupportRequests,
} from './support-requests.services'

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

supportRequestsRouter.get('/', async (c) => {
	const supportRequests = await listSupportRequests()

	return c.json(supportRequests, 200)
})

supportRequestsRouter.get('/:id', async (c) => {
	const result = supportRequestParamsSchema.safeParse(c.req.param())

	if (!result.success) {
		throw new HTTPException(400, {
			message: 'ID must be a valid UUID',
			cause: result.error,
		})
	}

	const supportRequest = await getSupportRequestById(result.data.id.toLowerCase())

	if (!supportRequest) {
		throw new HTTPException(404, { message: 'Support request not found' })
	}

	return c.json(supportRequest, 200)
})
