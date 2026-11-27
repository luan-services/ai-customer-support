import type { z } from 'zod'
import {
	SupportMessageRole,
	SupportReplyStatus,
	SupportRequestStatus,
	TriageCategory,
} from '../../../generated/prisma/enums'
import { analyzeSupportMessage, decideDeliveryReply, GeminiHttpError } from '../../lib/gemini'
import { prisma } from '../../lib/prisma'
import type { createSupportRequestSchema } from './support-requests.schemas'
import { departmentByCategory } from './support-requests.triage'

const analyzeAndUpdateSupportRequest = async (id: string, message: string) => {
	const where = { id }
	let analysis: Awaited<ReturnType<typeof analyzeSupportMessage>>

	try {
		analysis = await analyzeSupportMessage(message)
	} catch {
		console.error('Support request analysis failed', id)

		return prisma.supportRequest.update({
			where,
			data: { status: SupportRequestStatus.FAILED },
		})
	}

	return prisma.supportRequest.update({
		where,
		data: {
			status: SupportRequestStatus.ANALYZED,
			category: analysis.category,
			summary: analysis.summary,
			department: departmentByCategory[analysis.category],
		},
	})
}

export const createSupportRequest = async ({ userId, orderId, message }: z.infer<typeof createSupportRequestSchema>) => {
	const order = await prisma.order.findUnique({
		where: { id: orderId, userId },
		select: { id: true },
	})

	if (!order) {
		return null
	}

	const supportRequest = await prisma.supportRequest.create({
		data: {
			message,
			orderId: order.id,
			messages: { create: { role: SupportMessageRole.CUSTOMER, message } },
		},
	})

	return analyzeAndDraftSupportRequest(supportRequest.id, supportRequest.message)
}

const analyzeAndDraftSupportRequest = async (id: string, message: string) => {
	const analyzedRequest = await analyzeAndUpdateSupportRequest(id, message)
	if (analyzedRequest.category !== TriageCategory.DELIVERY) {
		return analyzedRequest
	}

	const result = await draftSupportRequestReply(analyzedRequest.id)
	if (result.kind === 'saved' || result.kind === 'alreadyInReview') {
		return result.supportRequest
	}

	if (result.kind === 'replyUnavailable' || result.kind === 'generationFailed') {
		return {
			...analyzedRequest,
			replyError: result.kind === 'replyUnavailable' ? 'REPLY_UNAVAILABLE' : 'GENERATION_FAILED',
		}
	}

	return analyzedRequest
}

export const listSupportRequests = (replyStatus?: SupportReplyStatus) => {
	return prisma.supportRequest.findMany({
		where: replyStatus === undefined ? {} : { replyStatus },
		orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
	})
}

export const getSupportRequestById = (id: string) => {
	return prisma.supportRequest.findUnique({
		where: { id },
		include: { messages: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] } },
	})
}

export const createSupportMessage = async (supportRequestId: string, message: string) => {
	const supportRequest = await prisma.supportRequest.findUnique({
		where: { id: supportRequestId },
		select: { id: true },
	})

	if (!supportRequest) {
		return null
	}

	const customerMessage = await prisma.supportMessage.create({
		data: { supportRequestId, role: SupportMessageRole.CUSTOMER, message },
	})
	const result = await draftSupportRequestReply(supportRequestId, customerMessage.id)

	if (result.kind === 'replyUnavailable' || result.kind === 'generationFailed') {
		return {
			message: customerMessage,
			reply: null,
			replyStatus: null,
			replyError: result.kind === 'replyUnavailable' ? 'REPLY_UNAVAILABLE' : 'GENERATION_FAILED',
		}
	}

	return {
		message: customerMessage,
		reply: result.kind === 'saved' ? result.assistantMessage : null,
		replyStatus: result.kind === 'saved' || result.kind === 'alreadyInReview' ? result.replyStatus : null,
	}
}

export const draftSupportRequestReply = async (id: string, customerMessageId?: string) => {
	const supportRequest = await prisma.supportRequest.findUnique({
		where: { id },
		include: {
			messages: {
				orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
				select: { id: true, role: true, message: true },
			},
			order: { select: { number: true, status: true, estimatedDelivery: true } },
		},
	})

	if (!supportRequest) {
		return { kind: 'notFound' } as const
	}

	const { message, status, category, order, messages } = supportRequest
	if (status !== SupportRequestStatus.ANALYZED || category !== TriageCategory.DELIVERY || !order) {
		return { kind: 'ineligible' } as const
	}

	if (supportRequest.replyStatus === SupportReplyStatus.NEEDS_REVIEW) {
		const { messages, order, ...saved } = supportRequest
		const { reply, replyStatus, reviewReason } = saved
		return { kind: 'alreadyInReview', supportRequest: saved, reply, replyStatus, reviewReason } as const
	}

	const lastIndex = messages.findIndex(({ id }) => id === customerMessageId)
	const conversation = lastIndex < 0 ? messages : messages.slice(0, lastIndex + 1)
	const [firstMessage] = conversation
	const history = firstMessage?.role === SupportMessageRole.CUSTOMER && firstMessage.message === message
		? conversation
		: [{ role: SupportMessageRole.CUSTOMER, message }, ...conversation]

	let decision: Awaited<ReturnType<typeof decideDeliveryReply>>
	try {
		decision = await decideDeliveryReply(history, order)
	} catch (error) {
		const upstreamStatus = error instanceof GeminiHttpError ? error.status : undefined
		console.error('Support reply generation failed', {
			supportRequestId: id,
			errorType: error instanceof Error ? error.name : 'unknown',
			upstreamStatus,
		})

		if (upstreamStatus === 503) {
			return { kind: 'replyUnavailable' } as const
		}

		return { kind: 'generationFailed', error } as const
	}

	const needsReview = decision.action === 'HANDOFF'
	const replyData = {
		reply: needsReview
			? 'Sinalizei sua solicitação para revisão humana.'
			: decision.reply,
		replyStatus: needsReview ? SupportReplyStatus.NEEDS_REVIEW : SupportReplyStatus.DRAFTED,
		reviewReason: needsReview ? decision.reason : null,
	}

	return prisma.$transaction(async (tx) => {
		const [saved] = await tx.supportRequest.updateManyAndReturn({
			where: {
				id,
				OR: [{ replyStatus: null }, { replyStatus: SupportReplyStatus.DRAFTED }],
			},
			data: replyData,
		})

		if (!saved) {
			const existing = await tx.supportRequest.findUnique({ where: { id } })
			if (!existing) {
				return { kind: 'notFound' } as const
			}
			const { reply, replyStatus, reviewReason } = existing
			return { kind: 'alreadyInReview', supportRequest: existing, reply, replyStatus, reviewReason } as const
		}

		const assistantMessage = await tx.supportMessage.create({
			data: { supportRequestId: id, role: SupportMessageRole.ASSISTANT, message: replyData.reply },
		})

		return { kind: 'saved', supportRequest: saved, assistantMessage, ...replyData } as const
	})
}

export const retrySupportRequest = async (id: string) => {
	const [requestToRetry] = await prisma.supportRequest.updateManyAndReturn({
		where: { id, status: SupportRequestStatus.FAILED },
		data: { status: SupportRequestStatus.PENDING },
		select: { id: true, message: true },
	})

	if (!requestToRetry) {
		const existing = await prisma.supportRequest.findUnique({
			where: { id },
			select: { id: true },
		})

		return { kind: existing ? 'conflict' : 'notFound' };
	}

	const supportRequest = await analyzeAndDraftSupportRequest(requestToRetry.id, requestToRetry.message)

	return { kind: 'updated', supportRequest };
}
