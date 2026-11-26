import { OrderStatus } from '../generated/prisma/enums'
import { draftDeliveryReply } from '../src/lib/gemini'

const message = 'Oi, meu pedido tá demorando. Vocês sabem quando chega?'
const orders = [
	{ number: 'PED-1001', status: OrderStatus.IN_TRANSIT, estimatedDelivery: new Date('2026-11-30') },
	{ number: 'PED-1002', status: OrderStatus.IN_TRANSIT, estimatedDelivery: null },
]

for (const order of orders) {
	const reply = await draftDeliveryReply(message, order)
	console.log(`${order.number} — ${reply}`)
}
