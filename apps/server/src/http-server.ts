import { createServer, type Server as HttpServer } from 'node:http'
import type { GameRng } from './game/rng'
import { createGameServer } from './server'

export const createDemoHttpServer = (rng?: GameRng): HttpServer => {
  const httpServer = createServer((request, response) => {
    if (request.method === 'GET' && request.url === '/health') {
      response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
      response.end('{"status":"ok"}')
      return
    }

    response.writeHead(404, { 'content-type': 'application/json; charset=utf-8' })
    response.end('{"error":"not_found"}')
  })

  const gameServer = createGameServer(httpServer, rng)
  httpServer.once('close', () => gameServer.close())
  return httpServer
}
