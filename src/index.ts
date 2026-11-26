import { Hono } from 'hono'
import { prisma } from './lib/prisma'
import { errorHandler } from './middleware/error-handler'
import { supportRequestsRouter } from './routes/support-requests/support-requests.routes'
import { usersRouter } from './routes/users/users.routes'

const app = new Hono()

app.onError(errorHandler)

app.get('/health', (c) => {
  return c.json({ status: 'ok' }, 200)
})

app.route('/support-requests', supportRequestsRouter)
app.route('/users', usersRouter)

try {
  await prisma.$queryRaw`SELECT 1`
} catch (error) {
  await prisma.$disconnect()
  throw error
}

console.log('PostgreSQL connection verified')

export default app
