import { useAudioManager } from '@/audio/AudioManagerContext'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { useSettingStore } from '@/store'
import { Gamepad, Gamepad2, Settings, Speaker } from 'lucide-react'
import { useState } from 'react'

type SettingsDialog = {
  open?: boolean
  setOpen?: (open?: boolean) => void
  trigger?: React.ReactNode
}

export const SettingsDialog = ({ open, setOpen, trigger }: SettingsDialog) => {
  const [tab, setTab] = useState<number>(0)

  const audio = useAudioManager()

  const tabs = [
    { name: '기본 설정', icon: <Settings /> },
    { name: '음향 설정', icon: <Speaker /> },
    { name: '게임 설정', icon: <Gamepad2 /> },
    { name: '조작 설정', icon: <Gamepad /> },
  ]

  const onOpenChange = (open: boolean) => {
    audio.setBgmMuffled(open, { volume: open ? -24 : -12 })

    if (setOpen) setOpen(open)
    else return open
  }

  return (
    <Dialog
      open={open === undefined ? undefined : open}
      onOpenChange={onOpenChange}
    >
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className='h-[600px] w-[1200px]'>
        <section className='h-full flex flex-col p-2 gap-1 bg-white/30 border border-white/40 rounded-lg w-[240px]'>
          {tabs.map((v, i) => (
            <button
              key={i}
              onClick={() => setTab(i)}
              className={`flex items-center gap-2 font-medium justify-between p-3 rounded-md text-[18px] cursor-pointer transition-colors ${
                tab === i
                  ? 'bg-white text-zinc-400'
                  : 'hover:bg-white/20 active:bg-white/30'
              }`}
            >
              <p
                className={
                  tab === i ? 'perfect-gradient-text brightness-90' : ''
                }
              >
                {v.name}
              </p>
              {v.icon}
            </button>
          ))}
        </section>
        <section className='flex-1 h-full overflow-hidden overflow-y-auto'>
          <SettingTab tab={tab} />
        </section>
      </DialogContent>
    </Dialog>
  )
}

type SettingTabProps = {
  tab: number
}

const SettingTab = ({ tab }: SettingTabProps) => {
  const setting = useSettingStore()

  switch (tab) {
    case 0:
      return <TabContainer>기본 설정</TabContainer>
    case 1:
      return (
        <TabContainer>
          <div className='flex items-center w-full gap-5'>
            <p className='min-w-20'>노래 음량</p>
            <div className='bg-white/20 h-10 flex-1 rounded-lg'></div>
            {setting.musicVolume + 90}
          </div>
        </TabContainer>
      )
    case 2:
      return <TabContainer>기본 설정</TabContainer>
    case 3:
      return <TabContainer>기본 설정</TabContainer>
  }
}

const TabContainer = ({ children }: { children: React.ReactNode }) => (
  <div className='flex flex-col gap-1 w-full h-max p-2 pr-20'>{children}</div>
)
