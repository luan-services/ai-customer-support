import { OrderStatus } from '../generated/prisma/enums'
import { prisma } from '../src/lib/prisma'

const users = [
	{ id: '7fb43c27-bb18-457a-a0a9-518383e96b28', name: 'Marina Alves' },
	{ id: 'dc10acb0-401c-4468-8ea0-af5522b630f9', name: 'Rafael Costa' },
] as const

const [marina, rafael] = users
const orders = [
	{
		number: 'PED-1001',
		userId: marina.id,
		status: OrderStatus.IN_TRANSIT,
		estimatedDelivery: new Date('2026-11-30'),
	},
	{
		number: 'PED-1002',
		userId: marina.id,
		status: OrderStatus.DELIVERED,
	},
	{
		number: 'PED-1003',
		userId: rafael.id,
		status: OrderStatus.PROCESSING,
	},
	{
		number: 'PED-1004',
		userId: rafael.id,
		status: OrderStatus.IN_TRANSIT,
		estimatedDelivery: new Date('2026-12-02'),
	},
]

try {
	await prisma.$transaction([
		...users.map((user) => prisma.user.upsert({
			where: { id: user.id },
			create: user,
			update: {},
		})),
		...orders.map((order) => prisma.order.upsert({
			where: { number: order.number },
			create: order,
			update: {},
		})),
	])
	console.log('Seed concluído. Usuários fictícios:')
	console.table(users)
} finally {
	await prisma.$disconnect()
}
