import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { randomUUID } from 'crypto'

export const registerRequestLoggerHooks = (server: FastifyInstance): void => {
  // Add request ID tracking and request logging
  server.addHook('onRequest', (req: FastifyRequest, reply: FastifyReply, done) => {
    // Ensure requestId is a string
    const reqIdHeader = req.headers['x-request-id']
    const requestId = Array.isArray(reqIdHeader) ? reqIdHeader[0] : (reqIdHeader || randomUUID())
    
    req.id = requestId
    reply.header('x-request-id', requestId)
    
    // Start timing the request and log that it's been received
    reply.startTime = Date.now()
    req.log.info({ url: req.url, method: req.method, requestId }, 'request received')
    
    done()
  })

  // Add response logging with timing information
  server.addHook('onResponse', (req: FastifyRequest, reply: FastifyReply, done) => {
    const responseTime = Date.now() - reply.startTime
    
    req.log.info({
      url: req.url,
      method: req.method,
      statusCode: reply.statusCode,
      durationMs: responseTime,
      requestId: req.id
    }, 'request completed')
    
    done()
  })
}
