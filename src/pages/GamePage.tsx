import { Note, Player } from '@/components'
import { useSettingStore } from '@/store'
import { useCallback, useEffect, useState } from 'react'
import { useAudioManager } from '@/audio/AudioManagerContext'

// import beatmap from '@/assets/beatmap/Ado - odo.json'
import beatmap from '@/assets/beatmap/Ado - odo (hard).json'
import { LOCAL_SPEED, NOTE_HEIGHT } from '@/common/general'

type NoteData = {
  id: string
  order: number
  color: string
  height: number
  time: number // 노트의 판정 타이밍(ms) 추가
}

const Judge = {
  PERFECT: 0,
  GREAT: 1,
  GOOD: 2,
  BAD: 3,
  MISS: 4,
} as const

const JudgeColor = {
  PERFECT: 'perfect-gradient-text',
  GREAT: 'text-[#ED9CFF]',
  GOOD: 'text-[#6ACBFF]',
  BAD: 'text-[#7EFFBE]',
  MISS: 'text-[#EFEFEF]',
} as const

type JudgeResult = {
  id: string
  judge: keyof typeof Judge
  offset?: number // 판정 오프셋(ms), 음수면 빠름, 양수면 느림
}

const LOCAL_OFFSET = 155

// 판정 기준(ms)
const JUDGE_WINDOW = {
  PERFECT: 40,
  GREAT: 80,
  GOOD: 120,
  BAD: 180,
  // MISS는 BAD보다 넓게 두지만, 입력 판정에는 사용하지 않음
  MISS: 9999,
} as const

// 입력 시간과 노트 시간의 차이로 판정 반환
function getJudge(noteTime: number, inputTime: number): keyof typeof Judge {
  const diff = Math.abs(noteTime - inputTime)
  if (diff <= JUDGE_WINDOW.PERFECT) return 'PERFECT'
  if (diff <= JUDGE_WINDOW.GREAT) return 'GREAT'
  if (diff <= JUDGE_WINDOW.GOOD) return 'GOOD'
  if (diff <= JUDGE_WINDOW.BAD) return 'BAD'
  return 'MISS'
}

export default function GamePage() {
  const [isStarted, setIsStarted] = useState(false)
  const [noteData, setNoteData] = useState<NoteData[]>([])
  const [isPress, setIsPress] = useState<boolean[]>([
    false,
    false,
    false,
    false,
  ])
  const [judgeResult, setJudgeResult] = useState<JudgeResult | undefined>(
    undefined
  )
  const [combo, setCombo] = useState(0)
  const [judgeHistory, setJudgeHistory] = useState<(keyof typeof Judge)[]>([])

  const audio = useAudioManager()

  const { speed } = useSettingStore()

  const end = (id: string) => {
    setNoteData((prev) => prev.filter((v) => v.id !== id))
  }

  const playMusic = useCallback(async () => {
    if (isStarted) return
    setIsStarted(true)

    const viewHeight = window.innerHeight * 0.8
    const player = audio.getPlayer(`song_${data.id}`)
    if (!player) return

    setTimeout(() => {
      player.start()
    }, (LOCAL_SPEED * 1000) / speed + data.offset)

    for (const note of beatmap.map) {
      const [order, delay, longDelay] = note

      const height =
        longDelay > 1
          ? ((longDelay - delay) / 1000) * viewHeight + NOTE_HEIGHT
          : NOTE_HEIGHT

      setTimeout(() => {
        setNoteData((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            order,
            color: order === 0 || order === 3 ? 'rgb(221, 215, 236)' : 'blue',
            height,
            time: delay + LOCAL_OFFSET, // 판정 타이밍(ms) 저장
          },
        ])
      }, delay + LOCAL_OFFSET)
    }
  }, [isStarted, speed, data])

  // 노트별로 입력 타이밍과 비교하여 판정
  const handleJudge = useCallback(
    (order: number) => {
      const now =
        (audio.getPlayer(`song_${data.id}`)?.now() ?? 0) - LOCAL_OFFSET / 2000
      const candidates = noteData
        .filter((note) => note.order === order)
        .map((note) => ({
          note,
          diff: Math.abs(note.time - now * 1000),
          offset: now * 1000 - note.time, // (+)면 느림, (-)면 빠름
        }))
        .filter(({ diff }) => diff <= JUDGE_WINDOW.BAD)
      if (candidates.length === 0) return

      const { note, offset } = candidates.sort((a, b) => a.diff - b.diff)[0]
      const judge = getJudge(note.time, now * 1000)

      setJudgeResult({
        id: crypto.randomUUID(),
        judge,
        offset,
      })

      // 콤보/정확도 갱신 (MISS가 아니면 1씩만 증가)
      setJudgeHistory((prev) => [...prev, judge])
      if (judge !== 'MISS') {
        setCombo((prev) => prev + 1)
      } else {
        setCombo(0)
      }

      end(note.id)
    },
    [noteData, audio, data]
  )

  useEffect(() => {
    const convertToOrder = (key: string) => {
      if (key === 'd') return 0
      if (key === 'f') return 1
      if (key === 'j') return 2
      if (key === 'k') return 3
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      const order = convertToOrder(e.key)
      if (order === undefined) return
      setIsPress((prev) => {
        if (prev[order]) return prev
        handleJudge(order)
        const newIsPress = [...prev]
        newIsPress[order] = true
        return newIsPress
      })
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      const order = convertToOrder(e.key)
      if (order === undefined) return
      setIsPress((prev) => {
        const newIsPress = [...prev]
        newIsPress[order] = false
        return newIsPress
      })
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [data, handleJudge])

  useEffect(() => {
    audio.addPlayer(`song_${data.id}`, data.url, { volume: data.volume })
  }, [data])

  // MISS 판정: BAD 범위 밖으로 내려간 노트 자동 처리
  useEffect(() => {
    if (!isStarted) return
    const timer = setInterval(() => {
      const now = audio.getPlayer(`song_${data.id}`)?.now() ?? 0
      setNoteData((prev) => {
        let missed = false
        const remain: NoteData[] = []
        prev.forEach((note) => {
          if (now * 1000 - note.time > JUDGE_WINDOW.BAD) {
            if (!missed) {
              setJudgeResult({
                id: crypto.randomUUID(),
                judge: 'MISS',
              })
              setCombo(0)
              missed = true
            }
            // 정확도 갱신 (MISS 여러개라도 1번만 추가)
            if (!missed) {
              setJudgeHistory((prev) => [...prev, 'MISS'])
            }
          } else {
            remain.push(note)
          }
        })
        // MISS가 한 번이라도 발생했으면 judgeHistory에 MISS 한 번만 추가
        if (missed) {
          setJudgeHistory((prev) => [...prev, 'MISS'])
        }
        return remain
      })
    }, 16)
    return () => clearInterval(timer)
  }, [isStarted, audio, data])

  // 정확도 계산 (소수점 한자리)
  const total = judgeHistory.filter(
    (j) =>
      j === 'PERFECT' ||
      j === 'GREAT' ||
      j === 'GOOD' ||
      j === 'BAD' ||
      j === 'MISS'
  ).length
  const correct = judgeHistory.filter(
    (j) => j === 'PERFECT' || j === 'GREAT' || j === 'GOOD' || j === 'BAD'
  ).length
  const accuracy = total === 0 ? 100 : ((correct / total) * 100).toFixed(1)

  // 판정 바 UI 컴포넌트
  function JudgeBar({ offset }: { offset: number }) {
    // offset: ms, -BAD~+BAD 구간에서 위치를 0~100%로 변환
    const range = JUDGE_WINDOW.BAD * 2
    const percent = Math.max(
      0,
      Math.min(1, (offset + JUDGE_WINDOW.BAD) / range)
    )
    return (
      <div className='absolute left-[50%] bottom-[calc(50%-80px)] w-[140px] h-6 translate-x-[-50%] z-50 pointer-events-none'>
        <div className='absolute left-0 top-0 h-full w-full bg-gradient-to-r from-transparent via-neutral-800/50 to-transparent' />
        {/* 중앙선 */}
        <div className='absolute left-[50%] top-0 h-full w-1 translate-x-[-2px] bg-white/80' />
        {/* 판정 위치 선 */}
        <div
          style={{
            left: `${percent * 100}%`,
          }}
          className='absolute top-0 h-full w-[2px] bg-sky-500 translate-x-[-1px] z-50'
        />
      </div>
    )
  }

  return (
    <main className='min-h-dvh w-full flex justify-center items-start overflow-hidden'>
      {/* 콤보/정확도 표시 */}
      <div
        style={{
          position: 'absolute',
          top: 24,
          right: 32,
          zIndex: 100,
          textAlign: 'right',
        }}
      >
        <div className='text-[32px] font-black text-sky-500 drop-shadow'>
          {combo > 0 && <span>{combo} Combo</span>}
        </div>
        <div className='text-[18px] font-bold text-neutral-700'>
          ACC {accuracy}%
        </div>
      </div>
      <button
        onClick={playMusic}
        className='absolute top-5 left-5 bg-zinc-950 border border-zinc-900 rounded-[8px] px-[12px] py-[4px] cursor-pointer'
      >
        Start
      </button>
      <Player>
        {noteData.map(({ id, order, height }) => (
          <Note
            key={id}
            id={id}
            order={order}
            duration={(LOCAL_SPEED * 1000 * 10) / speed}
            end={end}
            height={height}
          />
        ))}
        {isPress.map((v, index) => (
          <div
            key={index}
            className={`flex-1 flex justify-center h-full bg-gradient-to-t from-transparent via-20% to-transparent relative ${
              v ? 'via-[rgba(43,103,199,0.08)]' : 'via-transparent'
            }`}
          >
            <div
              className={`w-full h-[40dvh] absolute left-0 bottom-[20dvh] bg-gradient-to-t to-transparent ${
                v ? 'from-[rgba(69,178,255,0.16)]' : 'from-transparent'
              }`}
            />
            {judgeResult && v && (
              <div
                key={judgeResult.id}
                className='absolute bottom-[calc(20dvh-50px)] size-[100px] rounded-full bg-sky-500 animate-showJudge z-40'
              />
            )}
          </div>
        ))}
        {judgeResult && (
          <div
            key={judgeResult.id}
            className='absolute top-0 left-0 w-full h-full flex justify-center items-center animate-showJudge z-10'
          >
            <div
              className={`text-[40px] font-extrabold tracking-[-2%] text-shadow-2xs ${
                JudgeColor[judgeResult.judge]
              }`}
            >
              {judgeResult.judge}
            </div>
          </div>
        )}
        {judgeResult && typeof judgeResult.offset === 'number' && (
          <JudgeBar offset={judgeResult.offset} />
        )}
        <div className='absolute top-[calc(80dvh-4px)] bg-white h-[8px] w-full left-0' />
      </Player>
    </main>
  )
}

const data = {
  id: 1,
  title: 'Odo',
  artist: 'Ado',
  url: '/src/assets/music/Ado - Odo.mp3',
  map: '/src/assets/beatmap/Ado - odo (hard).json',
  offset: 0,
  volume: -16,
}
