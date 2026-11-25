import { prisma } from '../../lib/prisma'

export const createSupportRequest = (message: string) => {
	return prisma.supportRequest.create({
		data: { message },
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
