import * as Tone from 'tone'

export type PlayerOptions = Partial<Tone.PlayerOptions>
export type PlayerType = 'bgm' | 'fx' | 'song'
export type ToneFFT = Tone.FFT

type PlayerNode = {
  player: Tone.Player
  fft?: Tone.FFT
}

function applyPlayerOptions(player: Tone.Player, options?: PlayerOptions) {
  if (!options) return
  Object.entries(options).forEach(([k, v]) => {
    const key = k as keyof Omit<PlayerOptions, 'onload' | 'onerror' | 'url'>
    if (key === 'volume' && typeof v === 'number') {
      player.volume.value = v
    } else {
      try {
        ;(player[key] as PlayerOptions[keyof PlayerOptions]) = v
      } catch {}
    }
  })
}

class AudioManager {
  players: Map<string, PlayerNode> = new Map()
  pools: Map<string, Tone.Player[]> = new Map()

  private bgmLowpass: Tone.Filter | null = null

  async addPlayer(
    key: PlayerType,
    name: string | number,
    url: string,
    options?: PlayerOptions
  ) {
    const id = `${key}_${name}`
    const player = new Tone.Player(url)
    applyPlayerOptions(player, options)

    let fft: Tone.FFT | undefined

    if (key === 'bgm' || key === 'song') {
      fft = new Tone.FFT({
        size: 1024,
        smoothing: 0,
      })
      player.connect(fft)
      fft.toDestination()
    } else {
      player.toDestination()
    }

    this.players.set(id, { player, fft })
  }

  getPlayer(key: string) {
    return this.players.get(key)
  }

  removePlayer(key: string) {
    const player = this.players.get(key)
    if (player) {
      player.player.dispose()
      this.players.delete(key)
    }
  }

  createPool(key: string, url: string, poolSize = 5, options?: PlayerOptions) {
    const pool: Tone.Player[] = []
    for (let i = 0; i < poolSize; i++) {
      const player = new Tone.Player(url).toDestination()
      applyPlayerOptions(player, options)
      pool.push(player)
    }
    this.pools.set(key, pool)
  }

  playFromPool(key: string) {
    const pool = this.pools.get(key)
    if (!pool) return
    const player = pool.find((p) => !p.state || p.state === 'stopped')
    if (player) {
      player.start()
    } else {
      pool[0].start()
    }
  }

  removePool(key: string) {
    const pool = this.pools.get(key)
    if (pool) {
      pool.forEach((p) => p.dispose())
      this.pools.delete(key)
    }
  }

  setMusicVolume(volume: number) {
    this.players.forEach((player) => {
      player.player.volume.value = volume
    })
    // 풀에 있는 플레이어도 모두 적용
    this.pools.forEach((pool) => {
      pool.forEach((player) => {
        player.volume.value = volume
      })
    })
  }

  setVolumeByType(type: PlayerType, volume: number) {
    const keyPrefix = `${type}_`

    // 단일 플레이어
    this.players.forEach((player, key) => {
      if (key.startsWith(keyPrefix)) {
        player.player.volume.value = volume
      }
    })
    // 풀 플레이어
    this.pools.forEach((pool, key) => {
      if (key.startsWith(keyPrefix)) {
        pool.forEach((player) => {
          player.volume.value = volume
        })
      }
    })
  }

  /**
   * 배경음(bgm_ prefix) 플레이어에 먹먹한(로우패스) 효과 적용
   * @param muffled true: 먹먹하게, false: 원래대로
   * @param options frequency/volume 등 커스텀 가능
   */
  setBgmMuffled(
    muffled: boolean,
    options?: { frequency?: number; volume?: number; duration?: number }
  ) {
    const freq = muffled
      ? options?.frequency ?? 500
      : options?.frequency ?? 20000
    const vol = muffled ? options?.volume ?? -35 : options?.volume ?? -20
    const duration = options?.duration ?? 0.5

    // 필터가 없으면 생성 및 연결
    if (!this.bgmLowpass) {
      this.bgmLowpass = new Tone.Filter({
        type: 'lowpass',
        frequency: 20000,
        Q: 1,
      }).toDestination()
      // 모든 bgm_ 플레이어에 연결
      this.players.forEach((node, key) => {
        if (key.startsWith('bgm')) {
          node.player.disconnect()
          node.player.connect(this.bgmLowpass!)
          if (node.fft) node.player.connect(node.fft)
        }
      })
    }
    // 필터 파라미터 변경
    const now = Tone.now()
    this.bgmLowpass.frequency.linearRampToValueAtTime(freq, now + duration)
    // 볼륨 조절
    this.players.forEach((player, key) => {
      if (key.startsWith('bgm')) {
        player.player.volume.rampTo(vol, duration)
      }
    })
  }

  get tone() {
    return Tone
  }

  get transport() {
    return Tone.Transport
  }
}

export const audioManager = new AudioManager()
