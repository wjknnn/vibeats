import { useSoundStore } from '@/store/soundStore'

export const Button = () => {
  const { playFromPool } = useSoundStore()

  return (
    <button
      onMouseEnter={() => playFromPool('buttonHover')}
      className='w-[200px] h-6 bg-white text-black flex justify-center items-center hover:bg-neutral-100 cursor-pointer'
    >
      Button
    </button>
  )
}
