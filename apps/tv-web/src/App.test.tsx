import { act, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { PublicGameState } from '@osterie/protocol'
import { App } from './App'
import type { ConnectionState, GameSocket } from './lib/game-socket'

const lobby: PublicGameState = {
  roomCode: 'ABCD', status: 'lobby', activePlayerId: null,
  lastRoll: null, lastDice: null, pendingEvent: null,
  players: [{ playerId: 'gino', nickname: 'Gino', position: 0 }]
}

const playing: PublicGameState = {
  roomCode: 'ABCD', status: 'playing', activePlayerId: 'gino',
  lastRoll: 4, lastDice: [1, 3], pendingEvent: null,
  players: [
    { playerId: 'gino', nickname: 'Gino', position: 7 },
    { playerId: 'marco', nickname: 'Marco', position: 3 }
  ]
}

const fakeSocket = (initial: PublicGameState) => {
  let listener: ((state: PublicGameState, connection: ConnectionState) => void) | undefined
  let connectionState: ConnectionState = 'connected'
  const socket: GameSocket = {
    getSnapshot: () => initial,
    getConnectionState: () => connectionState,
    subscribe: (next) => {
      listener = next
      return () => { listener = undefined }
    }
  }
  return {
    socket,
    setConnectionState: (next: ConnectionState) => { connectionState = next },
    emit: (state: PublicGameState) => listener?.(state, connectionState)
  }
}

describe('TV application', () => {
  it('shows a room code, join QR and public players in the lobby', () => {
    const connection = fakeSocket(lobby)
    render(<App socket={connection.socket} joinUrl="https://game.test/?room=ABCD" />)

    expect(screen.getByText('ABCD')).toBeVisible()
    expect(screen.getByRole('img', { name: 'QR per entrare nella stanza ABCD' })).toBeVisible()
    expect(screen.getByText('Gino')).toBeVisible()
    expect(screen.queryByText(/budget|ubriachezza|dignità/i)).not.toBeInTheDocument()
  })

  it('switches to the board when a public playing snapshot arrives', () => {
    const connection = fakeSocket(lobby)
    render(<App socket={connection.socket} />)

    act(() => connection.emit(playing))

    expect(screen.getByText('È il turno di Gino')).toBeVisible()
    expect(screen.getAllByTestId('board-space')).toHaveLength(12)
    expect(screen.getByText('Osteria del Gallo')).toBeVisible()
    expect(within(screen.getByTestId('player-gino')).getByText('7')).toBeVisible()
  })

  it('announces a dice result derived from a player movement', () => {
    const connection = fakeSocket({ ...playing, players: [{ ...playing.players[0], position: 2 }, playing.players[1]] })
    render(<App socket={connection.socket} />)

    act(() => connection.emit(playing))

    expect(screen.getByText(/Gino ha lanciato/).closest('[role="status"]')).toHaveTextContent('Gino ha lanciato Totale 4')
  })

  it('shows connection feedback without exposing private statistics', () => {
    const connection = fakeSocket(lobby)
    connection.setConnectionState('reconnecting')
    render(<App socket={connection.socket} joinUrl="https://controller.test/?room=ABCD" />)

    expect(screen.getByRole('status')).toHaveTextContent('Riconnessione')
    expect(screen.queryByText(/budget|ubriachezza|dignità/i)).not.toBeInTheDocument()
  })
})
