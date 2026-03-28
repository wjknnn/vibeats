import { createContext, useContext } from 'react'
import { audioEngine } from './AudioEngine'

const AudioEngineContext = createContext(audioEngine)

export const AudioEngineProvider = ({ children }: { children: React.ReactNode }) => (
  <AudioEngineContext.Provider value={audioEngine}>
    {children}
  </AudioEngineContext.Provider>
)

export const useAudio = () => useContext(AudioEngineContext)
