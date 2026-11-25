import { Hono } from 'hono'
import { prisma } from './lib/prisma'

const app = new Hono()

app.get('/health', (c) => {
  return c.json({ status: 'ok' }, 200)
})

try {
  await prisma.$queryRaw`SELECT 1`
} catch (error) {
  await prisma.$disconnect()
  throw error
}

console.log('PostgreSQL connection verified')

export default app
