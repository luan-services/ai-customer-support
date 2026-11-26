import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { createSupportRequestSchema, supportRequestParamsSchema } from './support-requests.schemas'
import {
	createSupportRequest,
	draftSupportRequestReply,
	getSupportRequestById,
	listSupportRequests,
	retrySupportRequest,
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
			message: 'Invalid request body',
			cause: result.error,
		})
	}

	const supportRequest = await createSupportRequest(result.data)

	if (!supportRequest) {
		throw new HTTPException(404, { message: 'Order not found for this user' })
	}

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

supportRequestsRouter.post('/:id/draft-reply', async (c) => {
	const params = supportRequestParamsSchema.safeParse(c.req.param())

	if (!params.success) {
		throw new HTTPException(400, {
			message: 'ID must be a valid UUID',
			cause: params.error,
		})
	}

	const result = await draftSupportRequestReply(params.data.id.toLowerCase())

	if (result.kind === 'notFound') {
		throw new HTTPException(404, { message: 'Support request not found' })
	}

	if (result.kind === 'ineligible') {
		throw new HTTPException(409, { message: 'A draft requires an analyzed delivery request with a linked order' })
	}

	if (result.kind === 'needsReview') {
		return c.json({ status: 'NEEDS_REVIEW', reason: 'ORDER_MARKED_DELIVERED' }, 200)
	}

	return c.json({ status: 'DRAFTED', reply: result.reply }, 200)
})

supportRequestsRouter.post('/:id/retry', async (c) => {
	const params = supportRequestParamsSchema.safeParse(c.req.param())

	if (!params.success) {
		throw new HTTPException(400, {
			message: 'ID must be a valid UUID',
			cause: params.error,
		})
	}

	const result = await retrySupportRequest(params.data.id.toLowerCase())

	if (result.kind === 'updated') {
		return c.json(result.supportRequest, 200)
	}

	if (result.kind === 'notFound') {
		throw new HTTPException(404, { message: 'Support request not found' })
	}

	throw new HTTPException(409, { message: 'Only failed support requests can be retried' })
})
