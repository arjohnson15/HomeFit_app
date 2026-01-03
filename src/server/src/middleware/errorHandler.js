import logger from '../utils/logger.js'

export const errorHandler = (err, req, res, next) => {
  // Log the error
  logger.error({
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    body: req.body,
    user: req.user?.id
  })

  // Prisma errors
  if (err.code === 'P2002') {
    return res.status(409).json({
      message: 'A record with this value already exists',
      field: err.meta?.target?.[0]
    })
  }

  if (err.code === 'P2025') {
    return res.status(404).json({
      message: 'Record not found'
    })
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      message: 'Validation error',
      errors: err.errors
    })
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      message: 'Invalid token'
    })
  }

  // Default error response
  const statusCode = err.statusCode || 500
  const message = process.env.NODE_ENV === 'production'
    ? 'An unexpected error occurred'
    : err.message

  res.status(statusCode).json({
    message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  })
}

// Custom error class
export class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message)
    this.statusCode = statusCode
    this.name = 'AppError'
  }
}
