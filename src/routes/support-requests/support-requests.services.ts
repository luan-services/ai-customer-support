import type { z } from 'zod'
import {
	OrderStatus,
	SupportMessageRole,
	SupportReplyStatus,
	SupportRequestStatus,
	TriageCategory,
} from '../../../generated/prisma/enums'
import { analyzeSupportMessage, draftDeliveryReply } from '../../lib/gemini'
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

	return analyzeAndUpdateSupportRequest(supportRequest.id, supportRequest.message)
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

	return prisma.supportMessage.create({
		data: { supportRequestId, role: SupportMessageRole.CUSTOMER, message },
	})
}

export const draftSupportRequestReply = async (id: string) => {
	const supportRequest = await prisma.supportRequest.findUnique({
		where: { id },
		select: {
			message: true,
			status: true,
			category: true,
			order: { select: { number: true, status: true, estimatedDelivery: true } },
		},
	})

	if (!supportRequest) {
		return { kind: 'notFound' } as const
	}

	const { message, status, category, order } = supportRequest
	if (status !== SupportRequestStatus.ANALYZED || category !== TriageCategory.DELIVERY || !order) {
		return { kind: 'ineligible' } as const
	}

	const replyData = order.status === OrderStatus.DELIVERED
		? {
			replyStatus: SupportReplyStatus.NEEDS_REVIEW,
			reviewReason: 'ORDER_MARKED_DELIVERED',
			reply: 'Seu pedido consta como entregue. Se você não recebeu a encomenda, precisamos verificar o que aconteceu com a entrega.',
		}
		: {
			replyStatus: SupportReplyStatus.DRAFTED,
			reviewReason: null,
			reply: await draftDeliveryReply(message, order),
		}

	await prisma.supportRequest.update({ where: { id }, data: replyData })

	return { kind: 'saved', ...replyData } as const
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

	const supportRequest = await analyzeAndUpdateSupportRequest(requestToRetry.id, requestToRetry.message)

	return { kind: 'updated', supportRequest };
}
