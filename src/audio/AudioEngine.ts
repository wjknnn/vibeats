export type PlayerType = 'bgm' | 'fx' | 'song'

type AudioNode = {
  source: AudioBufferSourceNode | null
  buffer: AudioBuffer
  gainNode: GainNode
  analyser?: AnalyserNode
  type: PlayerType
  loop: boolean
  loopStart: number
  loopEnd: number
  fadeIn: number
  fadeOut: number
  startedAt: number
  pausedAt: number
  playing: boolean
}

type AddPlayerOptions = {
  volume?: number
  loop?: boolean
  loopStart?: number
  loopEnd?: number
  fadeIn?: number
  fadeOut?: number
  autostart?: boolean
  onended?: () => void
}

type PoolEntry = {
  buffer: AudioBuffer
  gainNode: GainNode
  players: AudioBufferSourceNode[]
  volume: number
}

class AudioEngine {
  private ctx: AudioContext
  private players = new Map<string, AudioNode>()
  private pools = new Map<string, PoolEntry>()
  private bgmFilter: BiquadFilterNode | null = null
  private resumed = false

  constructor() {
    this.ctx = new AudioContext()
  }

  get context() {
    return this.ctx
  }

  get currentTime() {
    return this.ctx.currentTime
  }

  async resume() {
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume()
    }
    this.resumed = true
  }

  get isResumed() {
    return this.resumed
  }

  private async loadBuffer(url: string): Promise<AudioBuffer> {
    const res = await fetch(url)
    const arrayBuf = await res.arrayBuffer()
    return this.ctx.decodeAudioData(arrayBuf)
  }

  private dbToGain(db: number): number {
    return Math.pow(10, db / 20)
  }

  async addPlayer(
    type: PlayerType,
    name: string | number,
    url: string,
    options?: AddPlayerOptions
  ) {
    const id = `${type}_${name}`
    const buffer = await this.loadBuffer(url)
    const gainNode = this.ctx.createGain()
    gainNode.gain.value = this.dbToGain(options?.volume ?? 0)

    let analyser: AnalyserNode | undefined
    if (type === 'bgm' || type === 'song') {
      analyser = this.ctx.createAnalyser()
      analyser.fftSize = 2048
      analyser.smoothingTimeConstant = 0
      gainNode.connect(analyser)
      analyser.connect(this.ctx.destination)
    } else {
      gainNode.connect(this.ctx.destination)
    }

    this.players.set(id, {
      source: null,
      buffer,
      gainNode,
      analyser,
      type,
      loop: options?.loop ?? false,
      loopStart: options?.loopStart ?? 0,
      loopEnd: options?.loopEnd ?? 0,
      fadeIn: options?.fadeIn ?? 0,
      fadeOut: options?.fadeOut ?? 0,
      startedAt: 0,
      pausedAt: 0,
      playing: false,
    })

    if (options?.autostart) {
      this.play(id)
    }
  }

  play(id: string, offset?: number) {
    const node = this.players.get(id)
    if (!node) return

    if (node.source) {
      try { node.source.stop() } catch { /* already stopped */ }
    }

    const source = this.ctx.createBufferSource()
    source.buffer = node.buffer
    source.loop = node.loop
    if (node.loop) {
      source.loopStart = node.loopStart
      source.loopEnd = node.loopEnd > 0 ? node.loopEnd : node.buffer.duration
    }
    source.connect(node.gainNode)

    const startOffset = offset ?? node.pausedAt
    const now = this.ctx.currentTime

    if (node.fadeIn > 0) {
      const targetGain = node.gainNode.gain.value
      node.gainNode.gain.setValueAtTime(0, now)
      node.gainNode.gain.linearRampToValueAtTime(targetGain, now + node.fadeIn)
    }

    source.start(0, startOffset)
    node.source = source
    node.startedAt = now - startOffset
    node.pausedAt = 0
    node.playing = true

    source.onended = () => {
      node.playing = false
    }
  }

  /**
   * 미래의 특정 ctx 시각(초)에 재생을 예약한다. Conductor와 싱크를 맞추기 위한 용도.
   * @param when  this.context.currentTime 기준 절대 시각(초)
   */
  playScheduled(id: string, when: number, offset = 0) {
    const node = this.players.get(id)
    if (!node) return

    if (node.source) {
      try { node.source.stop() } catch { /* already stopped */ }
    }

    const source = this.ctx.createBufferSource()
    source.buffer = node.buffer
    source.loop = node.loop
    if (node.loop) {
      source.loopStart = node.loopStart
      source.loopEnd = node.loopEnd > 0 ? node.loopEnd : node.buffer.duration
    }
    source.connect(node.gainNode)

    if (node.fadeIn > 0) {
      const targetGain = node.gainNode.gain.value
      node.gainNode.gain.setValueAtTime(0, when)
      node.gainNode.gain.linearRampToValueAtTime(targetGain, when + node.fadeIn)
    }

    source.start(when, offset)
    node.source = source
    node.startedAt = when - offset
    node.pausedAt = 0
    node.playing = true

    source.onended = () => {
      node.playing = false
    }
  }

  stop(id: string) {
    const node = this.players.get(id)
    if (!node || !node.source) return

    if (node.fadeOut > 0) {
      const now = this.ctx.currentTime
      node.gainNode.gain.linearRampToValueAtTime(0, now + node.fadeOut)
      node.source.stop(now + node.fadeOut)
    } else {
      try { node.source.stop() } catch { /* already stopped */ }
    }
    node.playing = false
    node.pausedAt = 0
  }

  getPlaybackTime(id: string): number {
    const node = this.players.get(id)
    if (!node || !node.playing) return 0
    return this.ctx.currentTime - node.startedAt
  }

  getAnalyser(id: string): AnalyserNode | undefined {
    return this.players.get(id)?.analyser
  }

  getPlayer(id: string) {
    return this.players.get(id)
  }

  isPlaying(id: string): boolean {
    return this.players.get(id)?.playing ?? false
  }

  removePlayer(id: string) {
    const node = this.players.get(id)
    if (!node) return
    try { node.source?.stop() } catch { /* already stopped */ }
    node.gainNode.disconnect()
    node.analyser?.disconnect()
    this.players.delete(id)
  }

  setVolume(id: string, db: number) {
    const node = this.players.get(id)
    if (!node) return
    node.gainNode.gain.value = this.dbToGain(db)
  }

  setVolumeByType(type: PlayerType, db: number) {
    const gain = this.dbToGain(db)
    this.players.forEach((node, key) => {
      if (key.startsWith(`${type}_`)) {
        node.gainNode.gain.value = gain
      }
    })
  }

  // --- Pool (for SFX) ---

  async createPool(key: string, url: string, _poolSize = 5, volume = 0) {
    const buffer = await this.loadBuffer(url)
    const gainNode = this.ctx.createGain()
    gainNode.gain.value = this.dbToGain(volume)
    gainNode.connect(this.ctx.destination)

    this.pools.set(key, { buffer, gainNode, players: [], volume })
  }

  playFromPool(key: string) {
    const pool = this.pools.get(key)
    if (!pool) return
    const source = this.ctx.createBufferSource()
    source.buffer = pool.buffer
    source.connect(pool.gainNode)
    source.start()
  }

  removePool(key: string) {
    const pool = this.pools.get(key)
    if (!pool) return
    pool.gainNode.disconnect()
    this.pools.delete(key)
  }

  // --- BGM muffled effect ---

  setBgmMuffled(muffled: boolean, options?: { frequency?: number; volume?: number; duration?: number }) {
    const freq = muffled ? (options?.frequency ?? 500) : (options?.frequency ?? 20000)
    const vol = muffled ? (options?.volume ?? -35) : (options?.volume ?? -20)
    const duration = options?.duration ?? 0.5
    const now = this.ctx.currentTime

    if (!this.bgmFilter) {
      this.bgmFilter = this.ctx.createBiquadFilter()
      this.bgmFilter.type = 'lowpass'
      this.bgmFilter.frequency.value = 20000
      this.bgmFilter.Q.value = 1
      this.bgmFilter.connect(this.ctx.destination)

      this.players.forEach((node, key) => {
        if (key.startsWith('bgm_')) {
          node.gainNode.disconnect()
          node.gainNode.connect(this.bgmFilter!)
          if (node.analyser) {
            node.gainNode.connect(node.analyser)
          }
        }
      })
    }

    this.bgmFilter.frequency.linearRampToValueAtTime(freq, now + duration)

    this.players.forEach((node, key) => {
      if (key.startsWith('bgm_')) {
        node.gainNode.gain.linearRampToValueAtTime(this.dbToGain(vol), now + duration)
      }
    })
  }

  dispose() {
    this.players.forEach((_, key) => this.removePlayer(key))
    this.pools.forEach((_, key) => this.removePool(key))
    this.bgmFilter?.disconnect()
    this.bgmFilter = null
  }
}

export const audioEngine = new AudioEngine()
