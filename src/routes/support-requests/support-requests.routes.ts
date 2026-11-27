import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import {
	createSupportMessageSchema,
	createSupportRequestSchema,
	listSupportRequestsQuerySchema,
	supportRequestParamsSchema,
} from './support-requests.schemas'
import {
	createSupportMessage,
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
	const query = listSupportRequestsQuerySchema.safeParse(c.req.query())

	if (!query.success) {
		throw new HTTPException(400, {
			message: 'Invalid query parameters',
			cause: query.error,
		})
	}

	const supportRequests = await listSupportRequests(query.data.replyStatus)

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

supportRequestsRouter.post('/:id/messages', async (c) => {
	const params = supportRequestParamsSchema.safeParse(c.req.param())

	if (!params.success) {
		throw new HTTPException(400, {
			message: 'ID must be a valid UUID',
			cause: params.error,
		})
	}

	const body: unknown = await c.req.json().catch(() => {
		throw new HTTPException(400, { message: 'Invalid JSON' })
	})
	const result = createSupportMessageSchema.safeParse(body)

	if (!result.success) {
		throw new HTTPException(400, {
			message: 'Message must be a non-empty string',
			cause: result.error,
		})
	}

	const conversationTurn = await createSupportMessage(params.data.id.toLowerCase(), result.data.message)

	if (!conversationTurn) {
		throw new HTTPException(404, { message: 'Support request not found' })
	}

	return c.json(conversationTurn, 201)
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

	if (result.kind === 'generationFailed') {
		throw result.error
	}

	if (result.kind === 'replyUnavailable') {
		return c.json({
			success: false,
			code: 'REPLY_UNAVAILABLE',
			message: 'A resposta automática está temporariamente indisponível. Tente novamente em instantes.',
		}, 503)
	}

	if (result.reviewReason !== null) {
		return c.json({
			status: result.replyStatus,
			reason: result.reviewReason,
			reply: result.reply,
		}, 200)
	}

	return c.json({ status: result.replyStatus, reply: result.reply }, 200)
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
