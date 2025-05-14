import { Note } from '@/components'
import { useSettingStore } from '@/store'
import { useEffect, useState } from 'react'
import { useSound } from 'use-sound'

import beatmap from '@/assets/beatmap/Ado - Odo.json'
// import beatmap from '@/assets/beatmap/Ado - odo (hard).json'
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
  const [play] = useSound(music, { volume: 0.1 })

  const { speed, setSpeed } = useSettingStore()

  const end = (id: string) => {
    setNoteData((prev) => prev.filter((v) => v.id !== id))
  }

  const playMusic = () => {
    const speedValue = 4
    const newSpeed = speedValue / 4
    setSpeed(speedValue)
    const viewHeight = window.innerHeight * 0.8
    setTimeout(() => play(), 1000 / newSpeed)
    for (const note of beatmap.map) {
      const [order, delay, longDelay] = note

      const height =
        (longDelay > 1 ? ((longDelay - delay) / 1000) * viewHeight : 0) + 20

      setTimeout(() => {
        setNoteData((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            order,
            color: order === 0 || order === 3 ? 'yellow' : 'blue',
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
    <div className='min-h-dvh w-full flex justify-center items-start'>
      <button onClick={playMusic}>Click me</button>
      <div className='w-[485px] flex justify-center h-dvh bg-zinc-950 relative border-r border-l border-zinc-800'>
        {noteData.map(({ id, order, color, height }) => (
          <Note
            key={id}
            id={id}
            order={order}
            duration={40000 / speed}
            color={color}
            end={end}
            height={height}
          />
        ))}
        {isPress.map((isPress, index) => (
          <div
            key={index}
            className={`flex-1 h-full bg-gradient-to-t from-transparent via-20% to-transparent ${
              isPress ? 'via-zinc-800' : 'via-zinc-950'
            }`}
          />
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
        <Line order={1} />
        <Line order={2} />
        <Line order={3} />
        <div className='absolute top-[80dvh] outline h-0 w-full left-0 outline-white' />
      </div>
    </div>
  )
}

const Line = ({ order }: { order: number }) => (
  <div
    className='w-px h-full bg-zinc-900 absolute'
    style={{ left: order * 120 }}
  />
)
