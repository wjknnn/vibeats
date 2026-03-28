import { create } from 'zustand'

type CommonState = {
  selectedMusicId: number | null
  setSelectedMusicId: (id: number | null) => void
}

export const useCommonStore = create<CommonState>((set) => ({
  selectedMusicId: null,
  setSelectedMusicId: (id: number | null) => set({ selectedMusicId: id }),
}))
