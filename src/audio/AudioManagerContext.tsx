import React, { createContext, useContext } from 'react'
import { audioManager } from './AudioManager'

const AudioManagerContext = createContext(audioManager)

export const AudioManagerProvider = ({
  children,
}: {
  children: React.ReactNode
}) => (
  <AudioManagerContext.Provider value={audioManager}>
    {children}
  </AudioManagerContext.Provider>
)

export const useAudioManager = () => useContext(AudioManagerContext)
