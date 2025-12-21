import { useEffect, useState, useRef } from 'react'
import { useAudioManager } from '@/audio/AudioManagerContext'
import { useCommonStore } from '@/store'
import { MainContainer } from '@/components/MainContainer'

export default function MusicListPage() {
  const [selected, setSelected] = useState<number>(0)

  const debounceRef = useRef<number | null>(null)

  const audio = useAudioManager()

  const { setPage, setSelectedMusicId } = useCommonStore()

  const playGame = () => {
    setPage('game')
    setSelectedMusicId(data[selected].id)
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp') {
        setSelected((prev) => (prev === 0 ? data.length - 1 : prev - 1))
      } else if (e.key === 'ArrowDown') {
        setSelected((prev) => (prev === data.length - 1 ? 0 : prev + 1))
      }
    }

    const handleWheel = (e: WheelEvent) => {
      if (e.deltaY < 0) {
        setSelected((prev) => (prev === 0 ? data.length - 1 : prev - 1))
      } else {
        setSelected((prev) => (prev === data.length - 1 ? 0 : prev + 1))
      }
    }

    const handleEnter = (e: KeyboardEvent) => {
      if (e.key === 'Enter') playGame()
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('wheel', handleWheel)
    window.addEventListener('keydown', handleEnter)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('wheel', handleWheel)
      window.removeEventListener('keydown', handleEnter)
    }
  }, [data, selected])

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    let currPlayer = audio.getPlayer(`bgm_musicList${data[selected].id}`)
    let timeout: number | null = null
    let loofStopTimeout: number | null = null
    let loofReStartTimeout: number | null = null

    if (currPlayer) {
    } else {
      audio
        .addPlayer('bgm', `musicList${data[selected].id}`, data[selected].bgm)
        .then(
          () =>
            (currPlayer = audio.getPlayer(`bgm_musicList${data[selected].id}`))
        )
    }

    debounceRef.current = setTimeout(() => {
      let player = audio.getPlayer(`bgm_musicList${data[selected].id}`)

      if (player) {
        player.fadeIn = 0.5
        player.fadeOut = 2
        player.volume.value = data[selected].volume
        player.loop = true
        const highlightSec = parseInt(data[selected].highlight) / 1000
        player.loopStart = Math.max(0, highlightSec)
        timeout = setTimeout(() => player.start(), 500)
        loofStopTimeout = setTimeout(() => player.stop(), 15000)
        loofReStartTimeout = setTimeout(() => player.start(), 17500)
      }
    }, 500)

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
      if (currPlayer) currPlayer.stop()
      if (timeout) clearTimeout(timeout)
      if (loofStopTimeout) clearTimeout(loofStopTimeout)
      if (loofReStartTimeout) clearTimeout(loofReStartTimeout)
    }
  }, [data, selected])

  useEffect(() => {
    audio.getPlayer('bgm_home')?.stop()
  }, [])

  return (
    <MainContainer className='bg-white text-black'>
      <div className='flex gap-8 max-w-[1024px] w-full'>
        <section className='flex justify-center w-full items-center'>
          <p
            key={data[selected].id}
            className='text-[32px] font-black animate-appearBottom'
          >
            {data[selected].title}
          </p>
        </section>
        <section className='flex flex-col max-w-[520px] w-full gap-2'>
          {data.map((item, index) => (
            <div
              key={index}
              onClick={playGame}
              className={`px-4 py-2 border rounded-lg w-full cursor-pointer transition-all ${
                selected === index
                  ? 'scale-105 border-blue-500'
                  : 'border-neutral-200'
              }`}
            >
              <h3 className='text-[20px] font-bold'>{item.title}</h3>
              <p className='text-[14px] font-semibold text-neutral-500'>
                {item.artist}
              </p>
            </div>
          ))}
        </section>
      </div>
    </MainContainer>
  )
}

const data = [
  {
    id: 1,
    title: 'Odo',
    artist: 'Ado',
    bgm: '/music/Ado - Odo.mp3',
    highlight: '71700',
    volume: -16,
  },
  {
    id: 2,
    title: 'Show ( 唱 )',
    artist: 'Ado',
    bgm: '/music/Ado - Show.mp3',
    highlight: '66200',
    volume: -10,
  },
]
