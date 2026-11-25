import type { ErrorHandler } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { ZodError } from 'zod'

export const errorHandler: ErrorHandler = (error, c) => {
	if (error instanceof HTTPException && error.status < 500) {
		if (error.cause instanceof ZodError) {
			return c.json({
				success: false,
				code: 'VALIDATION_ERROR',
				message: error.message,
				details: error.cause.issues.map(({ path, message }) => ({ path, message })),
			}, error.status)
		}

		return c.json({
			success: false,
			code: `HTTP_${error.status}`,
			message: error.message,
		}, error.status)
	}

	return c.json({
		success: false,
		code: 'INTERNAL_SERVER_ERROR',
		message: 'Internal Server Error',
	}, 500)
}
