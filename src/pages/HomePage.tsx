import { type Player } from 'tone'
import { useEffect } from 'react'
import { useAudioManager } from '@/audio/AudioManagerContext'
import { useCommonStore } from '@/store'
import { MainContainer } from '@/components/MainContainer'

export default function HomePage() {
  const { setPage } = useCommonStore()
  const audio = useAudioManager()

  const setupPlayer = (player: Player) => {
    player.loop = true
    player.loopStart = 0
    player.loopEnd = 141
    player.fadeIn = 2
    player.fadeOut = 2
    player.volume.value = -20
    player.autostart = true
  }

  useEffect(() => {
    audio.addPlayer('bgm', 'home', '/music/home_bgm.mp3').then(() => {
      const player = audio.getPlayer('bgm_home')
      if (player) setupPlayer(player)
    })
  }, [])

  const className =
    'flex justify-center items-center w-full h-14 rounded-lg border border-neutral-200 text-[24px] font-bold hover:bg-neutral-50 cursor-pointer'

  return (
    <MainContainer className='flex-col bg-white text-black'>
      <h1 className='text-[48px] font-black mb-10 perfect-gradient-text saturate-200 contrast-75'>
        VIBEATS
      </h1>
      <section className='max-w-[400px] w-full flex flex-col gap-2'>
        <button className={className} onClick={() => setPage('musicList')}>
          노래 선택
        </button>
        <button className={className}>설정</button>
      </section>
      <button onClick={() => setPage('game')}>Start</button>
      <button onClick={() => audio.getPlayer('bgm_home')?.start()}>
        Play Sound
      </button>
      <br />
      <button onClick={() => audio.setBgmMuffled(true)}>모달 효과 적용</button>
      <button onClick={() => audio.setBgmMuffled(false)}>모달 효과 해제</button>
    </MainContainer>
  )
}
