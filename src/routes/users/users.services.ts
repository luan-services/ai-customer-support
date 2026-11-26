import { prisma } from '../../lib/prisma'

export const listUserOrders = async (userId: string) => {
	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: {
			orders: {
				orderBy: [{ createdAt: 'desc' }, { number: 'asc' }],
				select: {
					id: true,
					number: true,
					status: true,
					estimatedDelivery: true,
					createdAt: true,
				},
			},
		},
	})

	return user?.orders ?? null
}
