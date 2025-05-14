import { useCommonStore } from '@/store'

import GamePage from '@/pages/GamePage'
import ResultPage from '@/pages/ResultPage'
import HomePage from '@/pages/HomePage'

function App() {
  const { page } = useCommonStore()

  if (page === 'home') {
    return <HomePage />
  } else if (page === 'game') {
    return <GamePage />
  } else if (page === 'result') {
    return <ResultPage />
  }

  return <>what? nothing!</>
}

export default App
