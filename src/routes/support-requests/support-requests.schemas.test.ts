import { describe, expect, test } from 'bun:test'
import { createSupportRequestSchema, supportRequestParamsSchema } from './support-requests.schemas'

describe('createSupportRequestSchema', () => {
	test('preserves the original message', () => {
		const message = '  When will my order arrive?\n'

		expect(createSupportRequestSchema.parse({ message })).toEqual({ message })
	})

	test('rejects a missing message', () => {
		expect(createSupportRequestSchema.safeParse({}).success).toBe(false)
	})

	test('rejects an empty message', () => {
		expect(createSupportRequestSchema.safeParse({ message: '' }).success).toBe(false)
	})

	test('rejects a whitespace-only message', () => {
		expect(createSupportRequestSchema.safeParse({ message: ' \t\n' }).success).toBe(false)
	})
})

describe('supportRequestParamsSchema', () => {
	test('accepts a valid UUID', () => {
		const id = '550e8400-e29b-41d4-a716-446655440000'

		expect(supportRequestParamsSchema.parse({ id })).toEqual({ id })
	})

	test('rejects a malformed ID', () => {
		expect(supportRequestParamsSchema.safeParse({ id: 'not-a-uuid' }).success).toBe(false)
	})
})
