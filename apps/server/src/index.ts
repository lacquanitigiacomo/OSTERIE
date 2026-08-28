import { createDemoHttpServer } from './http-server'

const port = Number.parseInt(process.env.PORT ?? '8787', 10)
if (!Number.isInteger(port) || port < 0 || port > 65_535) {
  throw new Error('PORT must be an integer between 0 and 65535')
}

const server = createDemoHttpServer()
server.listen(port, '0.0.0.0', () => {
  console.log(`Osterie demo server listening on http://0.0.0.0:${port}`)
})

const shutdown = () => server.close(() => process.exit(0))
process.once('SIGINT', shutdown)
process.once('SIGTERM', shutdown)
