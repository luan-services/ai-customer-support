import { SupportRequestStatus } from '../../../generated/prisma/enums'
import { analyzeSupportMessage } from '../../lib/gemini'
import { prisma } from '../../lib/prisma'
import { departmentByCategory } from './support-requests.triage'

export const createSupportRequest = async (message: string) => {
	const supportRequest = await prisma.supportRequest.create({
		data: { message },
	})
	const where = { id: supportRequest.id }
	let analysis: Awaited<ReturnType<typeof analyzeSupportMessage>>

	try {
		analysis = await analyzeSupportMessage(supportRequest.message)
	} catch {
		console.error('Support request analysis failed', supportRequest.id)

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

export const listSupportRequests = () => {
	return prisma.supportRequest.findMany({
		orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
	})
}

export const getSupportRequestById = (id: string) => {
	return prisma.supportRequest.findUnique({ where: { id } })
}
