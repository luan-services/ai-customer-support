import { SupportRequestStatus } from '../../../generated/prisma/enums'
import { analyzeSupportMessage } from '../../lib/gemini'
import { prisma } from '../../lib/prisma'
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

export const createSupportRequest = async (message: string) => {
	const supportRequest = await prisma.supportRequest.create({
		data: { message },
	})

	return analyzeAndUpdateSupportRequest(supportRequest.id, supportRequest.message)
}

export const listSupportRequests = () => {
	return prisma.supportRequest.findMany({
		orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
	})
}

export const getSupportRequestById = (id: string) => {
	return prisma.supportRequest.findUnique({ where: { id } })
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
