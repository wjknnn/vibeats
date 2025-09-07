import { Button } from '@/components/Button'
import { useCommonStore } from '@/store'
import { useSoundStore } from '@/store/soundStore'
import { useEffect, useRef } from 'react'

export default function HomePage() {
  const { setPage } = useCommonStore()
  const { addPlayer, getPlayer, tone } = useSoundStore()

  // 필터 인스턴스 useRef로 관리
  const lowpassRef = useRef(
    new tone.Filter({
      type: 'lowpass',
      frequency: 20000,
      Q: 1,
    }).toDestination()
  )

  // player 세팅 함수
  const setupPlayer = (player: any) => {
    player.loop = true
    player.loopStart = 0
    player.loopEnd = 141
    player.fadeIn = 2
    player.fadeOut = 2
    player.volume.value = -20
    player.disconnect()
    player.connect(lowpassRef.current)
  }

  // 효과 적용/해제 함수
  const setMuffled = (muffled: boolean) => {
    const now = tone.now()
    const freq = muffled ? 500 : 20000
    const vol = muffled ? -35 : -20
    lowpassRef.current.frequency.linearRampToValueAtTime(freq, now + 0.5)
    const player = getPlayer('mySound')
    if (player) player.volume.rampTo(vol, 0.5)
  }

  useEffect(() => {
    addPlayer('mySound', '/src/assets/music/home_bgm.mp3').then(() => {
      const player = getPlayer('mySound')
      if (player) setupPlayer(player)
      setTimeout(() => player?.start(), 2000)
    })
  }, [])

  return (
    <div>
      <button onClick={() => setPage('game')}>Start</button>
      <button onClick={() => getPlayer('homeBGM')?.start()}>Play Sound</button>
      <br />
      <div className='flex flex-col w-full h-[800px] justify-center items-center gap-2'>
        {Array.from({ length: 5 }, (_, i) => (
          <Button key={i} />
        ))}
      </div>
      <button onClick={() => setMuffled(true)}>모달 효과 적용</button>
      <button onClick={() => setMuffled(false)}>모달 효과 해제</button>
    </div>
  )
}
