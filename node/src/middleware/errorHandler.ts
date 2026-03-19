import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';

export interface ApiError {
  error: string;
  code: string;
  details?: any;
}

export function createError(statusCode: number, message: string, code: string, details?: any): any {
  const error = new Error(message) as any;
  error.statusCode = statusCode;
  error.code = code;
  error.details = details;
  return error;
}

export function errorHandler(error: FastifyError, request: FastifyRequest, reply: FastifyReply) {
  const statusCode = (error as any).statusCode || 500;
  const code = (error as any).code || 'INTERNAL_ERROR';
  const details = (error as any).details;

  request.log.error(error);

  return reply.status(statusCode).send({
    error: error.message,
    code,
    ...(details && { details })
  });
}

export function notFoundHandler(request: FastifyRequest, reply: FastifyReply) {
  return reply.status(404).send({
    error: 'Endpoint not found',
    code: 'NOT_FOUND'
  });
}
