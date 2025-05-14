import { useCommonStore } from '@/store'

export default function HomePage() {
  const { setPage } = useCommonStore()

  return (
    <div>
      <button onClick={() => setPage('game')}>Start</button>
    </div>
  )
}
