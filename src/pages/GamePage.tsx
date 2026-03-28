import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useAudio } from '@/audio/AudioEngineContext'
import { useSettingStore, useCommonStore } from '@/store'
import { GameEngine, JUDGE_COLOR, JUDGE_WINDOW, type JudgeResult } from '@/engine'
import { loadBeatmap } from '@/data/beatmap'
import { getSongById } from '@/data/songs'
import { Player } from '@/components'
import { PLAYER_WIDTH, NOTE_HEIGHT, KEY_BINDINGS } from '@/common/general'

function calcApproachTime(speed: number) {
  return 6000 / Math.pow(1.6, speed - 1)
}

// 4키 기준 레인 색상: 외곽=보라, 안쪽=파랑
const LANE_COLORS_4 = [
  { note: '#c8a2ff', glow: 'rgba(180,140,255,0.4)', head: '#b87aff' },
  { note: '#7ab8ff', glow: 'rgba(100,170,255,0.4)', head: '#5a9fff' },
  { note: '#7ab8ff', glow: 'rgba(100,170,255,0.4)', head: '#5a9fff' },
  { note: '#c8a2ff', glow: 'rgba(180,140,255,0.4)', head: '#b87aff' },
]

function getLaneColor(lane: number, keys: number) {
  if (keys === 4) return LANE_COLORS_4[lane]
  // 기본
  return { note: '#c8a2ff', glow: 'rgba(180,140,255,0.4)', head: '#b87aff' }
}

function JudgeBar({ offset }: { offset: number }) {
  const range = JUDGE_WINDOW.BAD * 2
  const percent = Math.max(0, Math.min(1, (offset + JUDGE_WINDOW.BAD) / range))
  const isEarly = offset < 0
  return (
    <div className='absolute left-1/2 bottom-[calc(50%-100px)] w-[160px] h-5 -translate-x-1/2 z-50 pointer-events-none'>
      <div className='absolute inset-0 rounded-full bg-white/[0.04] border border-white/[0.08]' />
      {/* PERFECT 구간 표시 */}
      <div className='absolute top-0 h-full rounded-full bg-white/[0.06]'
        style={{
          left: `${((JUDGE_WINDOW.BAD - JUDGE_WINDOW.PERFECT) / range) * 100}%`,
          width: `${(JUDGE_WINDOW.PERFECT * 2 / range) * 100}%`,
        }}
      />
      {/* 중앙선 */}
      <div className='absolute left-1/2 top-[2px] bottom-[2px] w-[2px] -translate-x-[1px] bg-white/30 rounded-full' />
      {/* 판정 위치 */}
      <div
        style={{ left: `${percent * 100}%` }}
        className={`absolute top-[1px] bottom-[1px] w-[3px] -translate-x-[1px] rounded-full z-50 ${
          isEarly ? 'bg-cyan-400' : 'bg-amber-400'
        }`}
      />
    </div>
  )
}

export default function GamePage() {
  const navigate = useNavigate()
  const audio = useAudio()
  const { speed, keys, setSpeed } = useSettingStore()
  const { selectedMusicId } = useCommonStore()
  const engineRef = useRef<GameEngine | null>(null)
  const musicTimerRef = useRef<number>(0)
  const notesContainerRef = useRef<HTMLDivElement>(null)
  const renderRafRef = useRef(0)

  const [combo, setCombo] = useState(0)
  const [accuracy, setAccuracy] = useState(100)
  const [judgeResult, setJudgeResult] = useState<JudgeResult | null>(null)
  const [pressedLanes, setPressedLanes] = useState<boolean[]>(new Array(keys).fill(false))
  const [currentSpeed, setCurrentSpeed] = useState(speed)

  const approachTimeMsRef = useRef(calcApproachTime(speed))
  const initialApproachRef = useRef(calcApproachTime(speed))
  const song = getSongById(selectedMusicId ?? 1)
  const laneWidth = PLAYER_WIDTH / keys
  const judgeLine = typeof window !== 'undefined' ? window.innerHeight * 0.8 : 600

  // 노트 DOM 렌더 루프
  const startRenderLoop = useCallback(() => {
    const render = () => {
      const engine = engineRef.current
      const container = notesContainerRef.current
      if (!engine || !container) {
        renderRafRef.current = requestAnimationFrame(render)
        return
      }

      const state = engine.state
      const gameTime = state.gameTimeMs
      const approachMs = approachTimeMsRef.current
      const visible = state.visibleNotes
      const existingEls = container.children
      const neededCount = visible.length
      const lw = laneWidth
      const noteGap = 4 // 노트 양쪽 패딩

      while (container.childElementCount < neededCount) {
        const el = document.createElement('div')
        el.style.position = 'absolute'
        el.style.pointerEvents = 'none'
        el.style.borderRadius = '4px'
        container.appendChild(el)
      }
      for (let i = neededCount; i < existingEls.length; i++) {
        ;(existingEls[i] as HTMLElement).style.display = 'none'
      }

      const jLine = judgeLine

      for (let i = 0; i < neededCount; i++) {
        const note = visible[i]
        const el = existingEls[i] as HTMLElement
        const isLong = note.endTime > 0
        const color = getLaneColor(note.lane, keys)

        const timeUntilStart = note.time - gameTime
        const startProgress = timeUntilStart / approachMs
        const startY = jLine - startProgress * jLine

        if (isLong) {
          const timeUntilEnd = note.endTime - gameTime
          const endProgress = timeUntilEnd / approachMs
          const endY = jLine - endProgress * jLine

          const headY = note.holding ? jLine : Math.min(startY, jLine + NOTE_HEIGHT)
          const tailY = endY

          const top = tailY - NOTE_HEIGHT
          const height = headY - tailY + NOTE_HEIGHT

          if (height <= 0) {
            el.style.display = 'none'
            continue
          }

          el.style.display = ''
          el.style.left = `${note.lane * lw + noteGap}px`
          el.style.width = `${lw - noteGap * 2}px`
          el.style.top = `${top}px`
          el.style.height = `${height}px`
          el.style.background = `linear-gradient(180deg, ${color.note}40 0%, ${color.note}90 90%, ${color.head} 100%)`
          el.style.borderRadius = '4px'
          el.style.boxShadow = note.holding
            ? `0 0 16px ${color.glow}, inset 0 -4px 8px ${color.head}80`
            : `0 0 8px ${color.glow}60`
          el.style.opacity = note.holding ? '1' : '0.9'
          el.style.borderBottom = `3px solid ${color.head}`
          el.style.borderTop = `2px solid ${color.note}60`
        } else {
          const top = startY - NOTE_HEIGHT

          el.style.display = ''
          el.style.left = `${note.lane * lw + noteGap}px`
          el.style.width = `${lw - noteGap * 2}px`
          el.style.height = `${NOTE_HEIGHT}px`
          el.style.top = `${top}px`
          el.style.background = `linear-gradient(180deg, ${color.note}cc, ${color.head})`
          el.style.borderRadius = '4px'
          el.style.boxShadow = `0 0 10px ${color.glow}, 0 2px 4px rgba(0,0,0,0.4)`
          el.style.opacity = '1'
          el.style.borderBottom = 'none'
          el.style.borderTop = 'none'
        }
      }

      renderRafRef.current = requestAnimationFrame(render)
    }

    renderRafRef.current = requestAnimationFrame(render)
  }, [judgeLine, laneWidth, keys])

  // 엔진 UI 콜백
  const lastComboRef = useRef(0)
  const lastJudgeIdRef = useRef(0)
  const lastPressedRef = useRef<boolean[]>(new Array(keys).fill(false))

  const onEngineUpdate = useCallback(() => {
    const engine = engineRef.current
    if (!engine) return
    const state = engine.state

    if (state.combo !== lastComboRef.current) {
      lastComboRef.current = state.combo
      setCombo(state.combo)
      setAccuracy(state.accuracy)
    }

    const jr = state.judgeResult
    if (jr && jr.id !== lastJudgeIdRef.current) {
      lastJudgeIdRef.current = jr.id
      setJudgeResult({ ...jr })
      setCombo(state.combo)
      setAccuracy(state.accuracy)
    } else if (!jr && lastJudgeIdRef.current !== 0) {
      lastJudgeIdRef.current = 0
      setJudgeResult(null)
    }

    const lp = state.pressedLanes
    const prev = lastPressedRef.current
    let changed = false
    for (let i = 0; i < lp.length; i++) {
      if (lp[i] !== prev[i]) { changed = true; break }
    }
    if (changed) {
      lastPressedRef.current = [...lp]
      setPressedLanes([...lp])
    }
  }, [])

  const startGame = useCallback(async () => {
    if (!song) return
    const songPlayerId = `song_${song.id}`
    const initApproach = initialApproachRef.current

    const [raw] = await Promise.all([
      loadBeatmap(song.beatmapUrl),
      audio.addPlayer('song', String(song.id), song.musicUrl, { volume: song.volume }),
    ])

    const engine = new GameEngine({ keys, approachTimeMs: initApproach })
    engine.loadBeatmap(raw.map)
    engine.setOnUpdate(onEngineUpdate)
    engine.setOnFinish(() => {
      audio.stop(songPlayerId)
      const score = engine.score
      navigate('/result', {
        replace: true,
        state: {
          accuracy: score.accuracy,
          maxCombo: score.maxCombo,
          totalNotes: score.totalNotes,
          counts: score.counts,
        },
      })
    })

    engineRef.current = engine
    engine.start()
    startRenderLoop()

    musicTimerRef.current = window.setTimeout(() => {
      audio.play(songPlayerId)
    }, initApproach + (song.offset ?? 0))
  }, [song, audio, keys, navigate, onEngineUpdate, startRenderLoop])

  useEffect(() => {
    const keyMap = KEY_BINDINGS[keys] ?? KEY_BINDINGS[4]
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '=' || e.key === '+') {
        setCurrentSpeed((prev) => {
          const next = Math.min(7, Math.round((prev + 0.1) * 10) / 10)
          approachTimeMsRef.current = calcApproachTime(next)
          engineRef.current?.setApproachTime(approachTimeMsRef.current)
          setSpeed(next)
          return next
        })
        return
      }
      if (e.key === '-') {
        setCurrentSpeed((prev) => {
          const next = Math.max(1, Math.round((prev - 0.1) * 10) / 10)
          approachTimeMsRef.current = calcApproachTime(next)
          engineRef.current?.setApproachTime(approachTimeMsRef.current)
          setSpeed(next)
          return next
        })
        return
      }
      const lane = keyMap.indexOf(e.key)
      if (lane === -1) return
      engineRef.current?.handleKeyDown(lane)
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      const lane = keyMap.indexOf(e.key)
      if (lane === -1) return
      engineRef.current?.handleKeyUp(lane)
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [keys, setSpeed])

  useEffect(() => {
    const timer = setTimeout(() => startGame(), 500)
    return () => {
      clearTimeout(timer)
      clearTimeout(musicTimerRef.current)
      cancelAnimationFrame(renderRafRef.current)
      engineRef.current?.destroy()
      if (song) audio.removePlayer(`song_${song.id}`)
    }
  }, [startGame, song, audio])

  return (
    <main className='min-h-dvh w-full flex justify-center items-start overflow-hidden bg-[#050508]'>
      {/* 콤보/정확도 — 플레이어 왼쪽 */}
      <div className='fixed top-[55%] z-[100] text-right pointer-events-none'
        style={{ right: `calc(50% + ${PLAYER_WIDTH / 2 + 40}px)` }}
      >
        {combo > 0 && (
          <div key={combo} className='combo-pop'>
            <div className='text-[56px] font-black leading-none text-white drop-shadow-[0_0_20px_rgba(100,180,255,0.5)]'>
              {combo}
            </div>
            <div className='text-[14px] font-bold tracking-[4px] text-white/50 uppercase mt-1'>
              combo
            </div>
          </div>
        )}
        <div className='text-[16px] font-bold text-white/30 mt-4 tabular-nums'>
          {accuracy.toFixed(2)}%
        </div>
      </div>

      {/* 속도 표시 — 플레이어 오른쪽 하단 */}
      <div className='fixed bottom-8 z-[100] pointer-events-none'
        style={{ left: `calc(50% + ${PLAYER_WIDTH / 2 + 24}px)` }}
      >
        <div className='text-[13px] font-medium text-white/20 tabular-nums'>
          {currentSpeed.toFixed(1)}x
        </div>
      </div>

      <Player>
        {/* 노트 컨테이너 */}
        <div ref={notesContainerRef} className='absolute inset-0 pointer-events-none z-20' />

        {/* 레인 키프레스 이펙트 */}
        {pressedLanes.map((pressed, index) => {
          const color = getLaneColor(index, keys)
          return (
            <div
              key={index}
              style={{ left: index * laneWidth, width: laneWidth }}
              className='absolute top-0 h-full pointer-events-none z-10'
            >
              {/* 키프레스 레인 하이라이트 */}
              {pressed && (
                <div
                  className='absolute inset-0'
                  style={{
                    background: `linear-gradient(to top, ${color.glow} 0%, transparent 60%)`,
                  }}
                />
              )}
              {/* 판정선 위 히트 이펙트 */}
              {pressed && (
                <div
                  className='absolute left-1/2 -translate-x-1/2'
                  style={{
                    bottom: '20dvh',
                    width: laneWidth - 4,
                    height: '6px',
                    background: color.head,
                    boxShadow: `0 0 20px ${color.glow}, 0 0 40px ${color.glow}`,
                    borderRadius: '3px',
                  }}
                />
              )}
              {/* 히트 원형 이펙트 */}
              {judgeResult && pressed && (
                <div
                  key={judgeResult.id}
                  className='absolute left-1/2 -translate-x-1/2 animate-showJudge z-40'
                  style={{
                    bottom: 'calc(20dvh - 30px)',
                    width: 60,
                    height: 60,
                    borderRadius: '50%',
                    background: `radial-gradient(circle, ${color.head}80 0%, transparent 70%)`,
                    boxShadow: `0 0 30px ${color.glow}`,
                  }}
                />
              )}
            </div>
          )
        })}

        {/* 판정 텍스트 */}
        {judgeResult && (
          <div
            key={judgeResult.id}
            className='absolute left-1/2 z-30 pointer-events-none'
            style={{
              bottom: 'calc(20dvh + 40px)',
              animation: 'judge-hit 0.5s cubic-bezier(0.4, 0.1, 0.2, 1.24) forwards',
            }}
          >
            <div
              className={`text-[36px] font-black tracking-tight ${JUDGE_COLOR[judgeResult.type]}`}
              style={{
                textShadow: '0 0 20px rgba(0,0,0,0.8), 0 2px 8px rgba(0,0,0,0.6)',
                filter: judgeResult.type === 'PERFECT' ? 'brightness(1.2)' : 'none',
              }}
            >
              {judgeResult.type}
            </div>
          </div>
        )}

        {/* 판정 바 */}
        {judgeResult && typeof judgeResult.offset === 'number' && (
          <JudgeBar offset={judgeResult.offset} />
        )}

        {/* 판정선 */}
        <div
          className='absolute w-full left-0 z-30'
          style={{ top: 'calc(80dvh - 2px)' }}
        >
          <div className='h-[3px] w-full bg-gradient-to-r from-transparent via-white/90 to-transparent' />
          <div className='h-[1px] w-full bg-gradient-to-r from-transparent via-white/20 to-transparent mt-[1px]' />
          {/* 판정선 글로우 */}
          <div
            className='absolute left-0 w-full'
            style={{
              top: '-8px',
              height: '20px',
              background: 'linear-gradient(to bottom, transparent, rgba(255,255,255,0.03), transparent)',
            }}
          />
        </div>

        {/* 판정선 아래 어둡게 */}
        <div
          className='absolute w-full left-0 bottom-0 z-[5]'
          style={{
            top: '80dvh',
            background: 'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.6) 100%)',
          }}
        />
      </Player>
    </main>
  )
}
