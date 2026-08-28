import { useState, type FormEvent } from 'react'

interface JoinFormProps {
  initialRoomCode?: string
  onJoin: (details: { nickname: string; roomCode: string }) => void
}

export function JoinForm({ initialRoomCode = '', onJoin }: JoinFormProps) {
  const [nickname, setNickname] = useState('')
  const [roomCode, setRoomCode] = useState(initialRoomCode.toUpperCase())

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const normalizedNickname = nickname.trim()
    const normalizedRoomCode = roomCode.trim().toUpperCase()
    if (normalizedNickname && normalizedRoomCode.length === 4) {
      onJoin({ nickname: normalizedNickname, roomCode: normalizedRoomCode })
    }
  }

  return (
    <form className="join-form" onSubmit={submit}>
      <h1>Entra in osteria</h1>
      <label>Nome<input value={nickname} maxLength={20} required onChange={(event) => setNickname(event.target.value)} /></label>
      <label>Codice stanza<input value={roomCode} maxLength={4} minLength={4} required autoCapitalize="characters" onChange={(event) => setRoomCode(event.target.value.toUpperCase())} /></label>
      <button type="submit">Unisciti alla partita</button>
    </form>
  )
}
