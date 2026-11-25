import { z } from 'zod'
import { Department, TriageCategory } from '../../../generated/prisma/enums'

export const triageResultSchema = z.object({
	category: z.enum(TriageCategory),
	summary: z.string().trim().min(1),
})

export const departmentByCategory: Readonly<Record<TriageCategory, Department>> = {
	[TriageCategory.DELIVERY]: Department.LOGISTICS,
	[TriageCategory.EXCHANGE_OR_RETURN]: Department.AFTER_SALES,
	[TriageCategory.BILLING]: Department.FINANCE,
	[TriageCategory.ORDER_CHANGE_OR_CANCELLATION]: Department.CUSTOMER_SUPPORT,
	[TriageCategory.PRODUCT_NOT_AS_DESCRIBED]: Department.AFTER_SALES,
	[TriageCategory.DAMAGED_PRODUCT]: Department.AFTER_SALES,
	[TriageCategory.OTHER]: Department.CUSTOMER_SUPPORT,
}
