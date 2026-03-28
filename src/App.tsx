import { BrowserRouter, Routes, Route, Navigate } from 'react-router'

import IntroPage from '@/pages/IntroPage'
import HomePage from '@/pages/HomePage'
import GamePage from '@/pages/GamePage'
import ResultPage from '@/pages/ResultPage'
import MusicListPage from '@/pages/MusicList'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path='/' element={<IntroPage />} />
        <Route path='/home' element={<HomePage />} />
        <Route path='/game' element={<GamePage />} />
        <Route path='/result' element={<ResultPage />} />
        <Route path='/music-list' element={<MusicListPage />} />
        <Route path='*' element={<Navigate to='/' replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
