import { create } from 'zustand'

type Page = 'intro' | 'home' | 'game' | 'result' | 'musicList'

type CommonState = {
  page: Page
  setPage: (page: Page) => void
}

export const useCommonStore = create<CommonState>((set) => ({
  page: 'intro',
  setPage: (page: Page) => set({ page }),
}))
