import type { ClientCommand } from '../../../../packages/protocol/src/index'
import { applyCommand, type ApplyCommandResult } from '../game/reducer'
import type { GameRng } from '../game/rng'
import { createGame, type GameState } from '../game/state'

interface GameRoom {
  state: GameState
}

export class RoomStore {
  private readonly rooms = new Map<string, GameRoom>()

  getState(roomCode: string): GameState {
    return this.getRoom(roomCode).state
  }

  apply(command: ClientCommand, rng: GameRng): ApplyCommandResult {
    const room = this.getRoom(command.roomCode)
    const result = applyCommand(room.state, command, rng)
    room.state = result.state
    return result
  }

  private getRoom(roomCode: string): GameRoom {
    const existing = this.rooms.get(roomCode)
    if (existing) return existing

    const room = { state: createGame(roomCode) }
    this.rooms.set(roomCode, room)
    return room
  }
}
