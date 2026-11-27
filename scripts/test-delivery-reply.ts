import { OrderStatus, SupportMessageRole } from '../generated/prisma/enums'
import { decideDeliveryReply } from '../src/lib/gemini'

const order = { number: 'PED-1002', status: OrderStatus.DELIVERED, estimatedDelivery: null }
const missingDelivery = {
	role: SupportMessageRole.CUSTOMER,
	message: 'Aqui aparece entregue, mas eu não recebi nada. Conseguem me ajudar?',
}
const cases = [
	{
		name: 'Consulta de status',
		history: [{ role: SupportMessageRole.CUSTOMER, message: 'Oi, meu pedido já foi entregue?' }],
		action: 'REPLY',
		reason: 'NONE',
	},
	{
		name: 'Primeiro relato de entrega não recebida',
		history: [missingDelivery],
		action: 'ASK_FOR_INFO',
		reason: 'NONE',
	},
	{
		name: 'Cliente já verificou quem poderia ter recebido',
		history: [
			missingDelivery,
			{ role: SupportMessageRole.ASSISTANT, message: 'Você chegou a verificar com quem mora com você, com a portaria ou com algum vizinho?' },
			{ role: SupportMessageRole.CUSTOMER, message: 'Sim, já falei com todo mundo de casa, com a portaria e com os vizinhos. Ninguém recebeu.' },
		],
		action: 'HANDOFF',
		reason: 'INVESTIGATION_REQUIRED',
	},
	{
		name: 'Pedido explícito de atendente',
		history: [
			missingDelivery,
			{ role: SupportMessageRole.CUSTOMER, message: 'Prefiro falar com uma pessoa, por favor.' },
		],
		action: 'HANDOFF',
		reason: 'HUMAN_REQUESTED',
	},
] as const

for (const scenario of cases) {
	const decision = await decideDeliveryReply(scenario.history, order)
	const matches = decision.action === scenario.action && decision.reason === scenario.reason
	console.log(`${matches ? 'OK' : 'DIVERGÊNCIA'} — ${scenario.name}`)
	console.log(`  Esperado: ${scenario.action} / ${scenario.reason}`)
	console.log(`  Recebido: ${decision.action} / ${decision.reason}`)
	console.log(`  Resposta: ${decision.reply}`)

	if (!matches) {
		process.exitCode = 1
	}
}
