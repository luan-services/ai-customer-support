import { prisma } from '../../lib/prisma'

export const createSupportRequest = (message: string) => {
	return prisma.supportRequest.create({
		data: { message },
	})
}
