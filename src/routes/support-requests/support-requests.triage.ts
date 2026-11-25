import { z } from 'zod'

const triageCategorySchema = z.enum([
	'DELIVERY',
	'EXCHANGE_OR_RETURN',
	'BILLING',
	'ORDER_CHANGE_OR_CANCELLATION',
	'PRODUCT_NOT_AS_DESCRIBED',
	'DAMAGED_PRODUCT',
	'OTHER',
])

export const triageResultSchema = z.object({
	category: triageCategorySchema,
	summary: z.string().trim().min(1),
})

type TriageCategory = z.infer<typeof triageCategorySchema>
type Department = 'LOGISTICS' | 'AFTER_SALES' | 'FINANCE' | 'CUSTOMER_SUPPORT'

export const departmentByCategory: Readonly<Record<TriageCategory, Department>> = {
	DELIVERY: 'LOGISTICS',
	EXCHANGE_OR_RETURN: 'AFTER_SALES',
	BILLING: 'FINANCE',
	ORDER_CHANGE_OR_CANCELLATION: 'CUSTOMER_SUPPORT',
	PRODUCT_NOT_AS_DESCRIBED: 'AFTER_SALES',
	DAMAGED_PRODUCT: 'AFTER_SALES',
	OTHER: 'CUSTOMER_SUPPORT',
}
