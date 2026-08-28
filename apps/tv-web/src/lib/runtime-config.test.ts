import { describe, expect, it } from 'vitest'
import { createRuntimeConfig } from './runtime-config'

describe('TV runtime configuration', () => {
  it('normalizes the room and builds development endpoints', () => {
    expect(createRuntimeConfig({
      location: new URL('http://192.168.1.20:5173/?room=ab-12'),
      env: { VITE_WS_URL: 'ws://192.168.1.20:3000/ws', VITE_CONTROLLER_URL: 'http://192.168.1.20:5174' }
    })).toEqual({
      roomCode: 'AB12',
      socketUrl: 'ws://192.168.1.20:3000/ws?role=tv&roomCode=AB12',
      joinUrl: 'http://192.168.1.20:5174/?room=AB12'
    })
  })

  it('uses safe same-origin defaults when environment values are absent', () => {
    expect(createRuntimeConfig({ location: new URL('https://game.test/tv') })).toEqual({
      roomCode: 'ABCD',
      socketUrl: 'wss://game.test/ws?role=tv&roomCode=ABCD',
      joinUrl: 'https://game.test/?room=ABCD'
    })
  })

  it('replaces localhost endpoints with the TV page host for real phones', () => {
    const config = createRuntimeConfig({
      location: new URL('http://192.168.1.20:5173/?room=ABCD'),
      env: { VITE_WS_URL: 'ws://localhost:8787/ws', VITE_CONTROLLER_URL: 'http://localhost:5174' }
    })

    expect(config.socketUrl).toBe('ws://192.168.1.20:8787/ws?role=tv&roomCode=ABCD')
    expect(config.joinUrl).toBe('http://192.168.1.20:5174/?room=ABCD')
  })
})
