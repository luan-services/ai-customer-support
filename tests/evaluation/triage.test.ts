import { expect, test } from 'bun:test'
import { analyzeSupportMessage } from '../../src/lib/gemini'
import { departmentByCategory } from '../../src/routes/support-requests/support-requests.triage'
import fixture from '../fixtures/triage-cases.json'

const runGeminiEvaluation = process.env.RUN_GEMINI_EVAL === '1'

for (const { cases, expectedCategory, expectedDepartment } of fixture.groups) {
	const [entry] = cases
	if (!entry) {
		throw new Error(`O fixture não tem mensagens para ${expectedCategory}.`)
	}

	test.skipIf(!runGeminiEvaluation)(entry.id, async () => {
		const { category, summary } = await analyzeSupportMessage(entry.message)
		const department = departmentByCategory[category]

		console.log(`${entry.id} — ${entry.message}`)
		console.log(`  Resumo de referência: ${entry.expectedSummary}`)
		console.log(`  Resumo recebido: ${summary}`)

		expect<{ category: string; department: string }>({ category, department }).toEqual({
			category: expectedCategory,
			department: expectedDepartment,
		})
	}, 35_000)
}
