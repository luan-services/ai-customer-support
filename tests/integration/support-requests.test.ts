import { afterAll, beforeAll, expect, spyOn, test } from 'bun:test'
import { z } from 'zod'
import { app } from '../../src/index'
import { prisma } from '../../src/lib/prisma'
import fixture from '../fixtures/triage-cases.json'

const originalApiKey = process.env.GEMINI_API_KEY
const createdRequestSchema = z.object({ id: z.uuid() })
const userId = crypto.randomUUID()
const otherUserId = crypto.randomUUID()
const orderId = crypto.randomUUID()

beforeAll(async () => {
	await prisma.$transaction([
		prisma.user.create({
			data: {
				id: userId,
				name: 'Integration test customer',
				orders: { create: { id: orderId, number: `TEST-${orderId}` } },
			},
		}),
		prisma.user.create({ data: { id: otherUserId, name: 'Other integration test customer' } }),
	])
	process.env.GEMINI_API_KEY = 'integration-test-key'
})

afterAll(async () => {
	if (originalApiKey === undefined) {
		delete process.env.GEMINI_API_KEY
	} else {
		process.env.GEMINI_API_KEY = originalApiKey
	}

	try {
		await prisma.$transaction([
			prisma.supportRequest.deleteMany({ where: { orderId } }),
			prisma.order.deleteMany({ where: { id: orderId, userId } }),
			prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } }),
		])
	} finally {
		await prisma.$disconnect()
	}
})

test('rejects an order belonging to another user before saving or analyzing the message', async () => {
	const geminiFetch = spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Unexpected Gemini request'))
	const message = 'Quero saber onde está meu pedido.'

	try {
		const response = await app.request('/support-requests', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ userId: otherUserId, orderId, message }),
		})

		expect(response.status).toBe(404)
		expect(geminiFetch).toHaveBeenCalledTimes(0)
		expect(await prisma.supportRequest.count({ where: { orderId, message } })).toBe(0)
	} finally {
		geminiFetch.mockRestore()
	}
})

test('queues delivery for human review after four automatic replies', async () => {
	const message = 'Onde está meu pedido?'
	const reply = 'Seu pedido está em preparação.'
	const supportRequest = await prisma.supportRequest.create({
		data: {
			orderId,
			message,
			status: 'ANALYZED',
			category: 'DELIVERY',
			reply,
			replyStatus: 'DRAFTED',
			messages: { create: [
				{ role: 'CUSTOMER', message },
				...Array.from({ length: 3 }, () => ({ role: 'ASSISTANT' as const, message: reply })),
			] },
		},
	})
	const geminiFetch = spyOn(globalThis, 'fetch')
		.mockRejectedValue(new Error('Unexpected Gemini request'))
		.mockResolvedValueOnce(Response.json({
			candidates: [{
				finishReason: 'STOP',
				content: { parts: [{ text: JSON.stringify({ action: 'REPLY', reason: 'NONE', reply }) }] },
			}],
		}))
	const sendMessage = (message: string) => app.request(`/support-requests/${supportRequest.id}/messages`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ message }),
	})

	try {
		const fourthReply = await sendMessage('Tem alguma atualização?')
		expect(fourthReply.status).toBe(201)
		expect(await fourthReply.json()).toMatchObject({ replyStatus: 'DRAFTED', reply: { message: reply } })

		const nextMessage = 'Ainda preciso de ajuda com a entrega.'
		const handoff = await sendMessage(nextMessage)
		expect(handoff.status).toBe(201)
		expect(await handoff.json()).toMatchObject({
			message: { message: nextMessage },
			replyStatus: 'NEEDS_REVIEW',
			reply: { role: 'ASSISTANT', message: expect.stringContaining('revisão humana') },
		})
		expect(await prisma.supportRequest.findUnique({ where: { id: supportRequest.id } })).toMatchObject({
			replyStatus: 'NEEDS_REVIEW',
			reviewReason: 'TURN_LIMIT_REACHED',
		})
		expect(geminiFetch).toHaveBeenCalledTimes(1)
	} finally {
		geminiFetch.mockRestore()
	}
})

const cases = fixture.groups.flatMap(({ expectedCategory, expectedDepartment, cases }) =>
	cases.map((entry) => ({ ...entry, expectedCategory, expectedDepartment })),
)

for (const entry of cases) {
	test(entry.id, async () => {
		const analysis = { category: entry.expectedCategory, summary: entry.expectedSummary }
		const geminiResponse = Response.json({
			candidates: [{
				finishReason: 'STOP',
				content: { parts: [{ text: JSON.stringify(analysis) }] },
			}],
		})
		const geminiFetch = spyOn(globalThis, 'fetch')
			.mockRejectedValue(new Error('Unexpected fetch during integration test'))
		const shouldRetry = entry.id === 'damaged-product-1'
		const isDelivery = entry.expectedCategory === 'DELIVERY'
		const replyUnavailable = entry.id === 'delivery-1'
		const reply = 'Seu pedido está em preparação.'
		if (shouldRetry) {
			geminiFetch.mockResolvedValueOnce(new Response(null, { status: 503 }))
		}
		geminiFetch.mockResolvedValueOnce(geminiResponse)
		if (isDelivery) {
			geminiFetch.mockResolvedValueOnce(replyUnavailable
				? new Response(null, { status: 503 })
				: Response.json({
					candidates: [{
						finishReason: 'STOP',
						content: { parts: [{ text: JSON.stringify({ action: 'REPLY', reason: 'NONE', reply }) }] },
					}],
				}))
		}

		try {
			const created = await app.request('/support-requests', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ userId, orderId, message: entry.message }),
			})
			expect(created.status).toBe(201)
			const createdBody: unknown = await created.json()
			const requestId = createdRequestSchema.parse(createdBody).id

			let result: unknown = createdBody
			if (shouldRetry) {
				expect(await prisma.supportRequest.findUnique({ where: { id: requestId } })).toMatchObject({
					message: entry.message,
					status: 'FAILED',
				})
				const retried = await app.request(`/support-requests/${requestId}/retry`, { method: 'POST' })
				expect(retried.status).toBe(200)
				result = await retried.json()
			}

			const expected = {
				id: requestId,
				orderId,
				message: entry.message,
				status: 'ANALYZED',
				department: entry.expectedDepartment,
				reply: isDelivery && !replyUnavailable ? reply : null,
				replyStatus: isDelivery && !replyUnavailable ? 'DRAFTED' : null,
				...analysis,
			}
			expect(result).toMatchObject(expected)
			expect(await prisma.supportRequest.findUnique({ where: { id: requestId } })).toMatchObject(expected)
			if (replyUnavailable) {
				expect(createdBody).toMatchObject({ replyError: 'REPLY_UNAVAILABLE' })
			}
			if (isDelivery && !replyUnavailable) {
				const messages = await prisma.supportMessage.findMany({ where: { supportRequestId: requestId } })
				expect(messages).toHaveLength(2)
				expect(messages.map(({ role, message }) => ({ role, message })))
					.toContainEqual({ role: 'ASSISTANT', message: reply })
			}
			expect(geminiFetch).toHaveBeenCalledTimes(shouldRetry || isDelivery ? 2 : 1)
		} finally {
			geminiFetch.mockRestore()
		}
	})
}
