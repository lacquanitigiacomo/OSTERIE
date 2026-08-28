interface RuntimeEnvironment extends Record<string, unknown> {
  VITE_WS_URL?: string
  VITE_CONTROLLER_URL?: string
}

interface RuntimeConfigInput {
  location: URL
  env?: RuntimeEnvironment
}

const normalizeRoomCode = (value: string | null) => {
  const normalized = (value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4)
  return normalized.length === 4 ? normalized : 'ABCD'
}

const addRoomQuery = (base: string, roomCode: string) => {
  const url = new URL(base)
  url.searchParams.set('room', roomCode)
  return url.toString()
}

const usePageHostForLocalEndpoint = (value: string, pageHost: string) => {
  const url = new URL(value)
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') url.hostname = pageHost
  return url.toString()
}

export const createRuntimeConfig = ({ location, env = {} }: RuntimeConfigInput) => {
  const roomCode = normalizeRoomCode(location.searchParams.get('room'))
  const socketBase = env.VITE_WS_URL
    ? usePageHostForLocalEndpoint(env.VITE_WS_URL, location.hostname)
    : `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws`
  const socketUrl = new URL(socketBase)
  socketUrl.searchParams.set('role', 'tv')
  socketUrl.searchParams.set('roomCode', roomCode)

  return {
    roomCode,
    socketUrl: socketUrl.toString(),
    joinUrl: addRoomQuery(env.VITE_CONTROLLER_URL
      ? usePageHostForLocalEndpoint(env.VITE_CONTROLLER_URL, location.hostname)
      : location.origin, roomCode)
  }
}
