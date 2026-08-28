import { get } from 'node:http'
import { once } from 'node:events'
import { afterEach, describe, expect, it } from 'vitest'
import { createDemoHttpServer } from './http-server'

describe('demo HTTP server', () => {
  const servers: Array<{ close: () => void }> = []

  afterEach(() => {
    for (const server of servers.splice(0)) server.close()
  })

  it('serves a health check for local and hosted demos', async () => {
    const server = createDemoHttpServer()
    servers.push(server)
    server.listen(0, '127.0.0.1')
    await once(server, 'listening')
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Expected TCP address')

    const response = await new Promise<{ status: number | undefined; body: string }>((resolve, reject) => {
      get(`http://127.0.0.1:${address.port}/health`, (result) => {
        let body = ''
        result.setEncoding('utf8')
        result.on('data', (chunk) => { body += chunk })
        result.on('end', () => resolve({ status: result.statusCode, body }))
      }).on('error', reject)
    })

    expect(response).toEqual({ status: 200, body: '{"status":"ok"}' })
  })
})
