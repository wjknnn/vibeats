import { create } from 'zustand'
import * as Tone from 'tone'

type PlayerPool = {
  url: string
  pool: Tone.Player[]
  poolSize: number
  play: () => void
}

type SoundStore = {
  tone: typeof Tone
  transport: any // deprecated 타입 회피
  players: Record<string, Tone.Player>
  pools: Record<string, PlayerPool>
  addPlayer: (key: string, url: string) => Promise<void>
  getPlayer: (key: string) => Tone.Player | undefined
  removePlayer: (key: string) => void
  createPool: (key: string, url: string, poolSize?: number) => void
  playFromPool: (key: string) => void
}

export const useSoundStore = create<SoundStore>((set, get) => ({
  tone: Tone,
  transport: Tone.Transport,
  players: {},
  pools: {},
  addPlayer: async (key, url) => {
    const player = new Tone.Player(url).toDestination()
    set((state) => ({
      players: { ...state.players, [key]: player },
    }))
  },
  getPlayer: (key) => {
    return get().players[key]
  },
  removePlayer: (key) => {
    const player = get().players[key]
    if (player) {
      player.dispose()
      set((state) => {
        const newPlayers = { ...state.players }
        delete newPlayers[key]
        return { players: newPlayers }
      })
    }
  },
  createPool: (key, url, poolSize = 5) => {
    const pool: Tone.Player[] = []
    for (let i = 0; i < poolSize; i++) {
      const player = new Tone.Player(url).toDestination()
      pool.push(player)
    }
    set((state) => ({
      pools: {
        ...state.pools,
        [key]: {
          url,
          pool,
          poolSize,
          play: () => get().playFromPool(key),
        },
      },
    }))
  },
  playFromPool: (key) => {
    const poolObj = get().pools[key]
    if (!poolObj) return
    const player = poolObj.pool.find((p) => !p.state || p.state === 'stopped')
    if (player) {
      player.start()
    } else {
      // 모두 재생 중이면 첫 번째 player를 강제로 재생
      poolObj.pool[0].start()
    }
  },
}))
