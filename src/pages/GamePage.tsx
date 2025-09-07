import { Note, Player } from '@/components'
import { useSettingStore } from '@/store'
import { useEffect, useRef, useState } from 'react'
import * as Tone from 'tone'

// import beatmap from '@/assets/beatmap/Ado - odo.json'
import beatmap from '@/assets/beatmap/Ado - odo (hard).json'
import music from '@/assets/music/Ado - Odo.mp3'

type NoteData = {
  id: string
  order: number
  color: string
  height: number
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
  const playerRef = useRef<Tone.Player | null>(null)

  const { speed, setSpeed } = useSettingStore()

  const end = (id: string) => {
    setNoteData((prev) => prev.filter((v) => v.id !== id))
  }

  const playMusic = async () => {
    if (isStarted) return
    setIsStarted(true)

    const speedValue = 4
    const newSpeed = speedValue / 4
    setSpeed(speedValue)

    const viewHeight = window.innerHeight * 0.8

    // Tone.js: 오디오 컨텍스트를 resume하고, Player를 생성하여 음악 재생
    await Tone.start()
    if (!playerRef.current) {
      playerRef.current = new Tone.Player({
        url: music,
        volume: -20, // 대략 0.1 볼륨에 해당
        autostart: false,
      }).toDestination()
    }
    setTimeout(() => {
      playerRef.current?.start()
    }, 1000 / newSpeed)

    for (const note of beatmap.map) {
      const [order, delay, longDelay] = note

      const height =
        longDelay > 1 ? ((longDelay - delay) / 1000) * viewHeight : 24

      setTimeout(() => {
        setNoteData((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            order,
            color: order === 0 || order === 3 ? 'rgb(221, 215, 236)' : 'blue',
            height,
          },
        ])
      }, delay)
    }
  }

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
        setJudgeResult({
          id: crypto.randomUUID(),
          judge: Object.keys(Judge)[
            Math.floor(Math.random() * 5)
          ] as keyof typeof Judge,
        })
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
  }, [])

  return (
    <main className='min-h-dvh w-full flex justify-center items-start overflow-hidden'>
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
            duration={40000 / speed}
            end={end}
            height={height}
          />
        ))}
        {isPress.map((v, index) => (
          <div
            key={index}
            className={`flex-1 h-full bg-gradient-to-t from-transparent via-20% to-transparent relative ${
              v ? 'via-[rgba(43,103,199,0.08)]' : 'via-transparent'
            }`}
          >
            <div
              className={`w-full h-[40dvh] absolute left-0 bottom-[20dvh] bg-gradient-to-t to-transparent ${
                v ? 'from-[rgba(69,178,255,0.16)]' : 'from-transparent'
              }`}
            />
          </div>
        ))}
        {judgeResult && (
          <div
            key={judgeResult.id}
            className='absolute top-0 left-0 w-full h-full flex justify-center items-center animate-showJudge z-10'
          >
            <div
              className={`text-[40px] font-extrabold tracking-[-2%] shadow-2xl ${
                JudgeColor[judgeResult.judge]
              }`}
            >
              {judgeResult.judge}
            </div>
          </div>
        )}
        <div className='absolute top-[calc(80dvh-4px)] bg-white h-[8px] w-full left-0' />
      </Player>
    </main>
  )
}
