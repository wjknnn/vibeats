import { useCommonStore } from '@/store'
import { useSoundStore } from '@/store/soundStore'

export default function IntroPage() {
  const { setPage } = useCommonStore()
  const { tone, createPool, addPlayer } = useSoundStore()

  return (
    <main className='flex justify-center items-center w-full min-h-dvh h-dvh max-h-dvh overflow-hidden'>
      <div className='intro-appear relative flex justify-center'>
        <p className='absolute -top-12 text-[32px] font-light tracking-wider opacity-0 animate-appearBottom [animation-delay:3s]'>
          Welcome to
        </p>
        <h1 className='intro-scale-up text-[64px] font-black tracking-[12px]'>
          VIBEATS
        </h1>
        <button
          onClick={() => {
            tone.start()
            createPool('buttonHover', '/src/assets/audio/ui1.m4a', 10)
            addPlayer('homeBGM', '/src/assets/music/home_bgm.mp3')
            setPage('home')
          }}
          className='bg-neutral-800 hover:bg-neutral-700 text-[20px] text-white font-medium py-2 px-4 rounded absolute -bottom-[80px] opacity-0 animate-appearBottom [animation-delay:3.2s] cursor-pointer'
        >
          Get Started
        </button>
      </div>
      <div className='intro-slider bg-white h-12 absolute left-[100%]' />
    </main>
  )
}
