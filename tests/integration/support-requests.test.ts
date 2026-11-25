import { afterAll, beforeAll, expect, spyOn, test } from 'bun:test'
import { z } from 'zod'
import app from '../../src/index'
import { prisma } from '../../src/lib/prisma'
import fixture from '../fixtures/triage-cases.json'

const originalApiKey = process.env.GEMINI_API_KEY
const createdRequestSchema = z.object({ id: z.uuid() })

beforeAll(() => {
	process.env.GEMINI_API_KEY = 'integration-test-key'
})

afterAll(async () => {
	if (originalApiKey === undefined) {
		delete process.env.GEMINI_API_KEY
	} else {
		process.env.GEMINI_API_KEY = originalApiKey
	}

	await prisma.$disconnect()
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
		if (shouldRetry) {
			geminiFetch.mockResolvedValueOnce(new Response(null, { status: 503 }))
		}
		geminiFetch.mockResolvedValueOnce(geminiResponse)

		let requestId: string | undefined
		try {
			const created = await app.request('/support-requests', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ message: entry.message }),
			})
			expect(created.status).toBe(201)
			const createdBody: unknown = await created.json()
			requestId = createdRequestSchema.parse(createdBody).id

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
				message: entry.message,
				status: 'ANALYZED',
				department: entry.expectedDepartment,
				...analysis,
			}
			expect(result).toMatchObject(expected)
			expect(await prisma.supportRequest.findUnique({ where: { id: requestId } })).toMatchObject(expected)
			expect(geminiFetch).toHaveBeenCalledTimes(shouldRetry ? 2 : 1)
		} finally {
			geminiFetch.mockRestore()
			if (requestId) {
				await prisma.supportRequest.deleteMany({ where: { id: requestId } })
			}
		}
	})
}
