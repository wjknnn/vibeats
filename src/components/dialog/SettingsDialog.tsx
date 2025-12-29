import { useAudioManager } from '@/audio/AudioManagerContext'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'

type SettingsDialog = {
  open?: boolean
  setOpen?: (open?: boolean) => void
  trigger?: React.ReactNode
}

export const SettingsDialog = ({ open, setOpen, trigger }: SettingsDialog) => {
  const audio = useAudioManager()

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
      <DialogContent className='h-[600px] w-[1200px]'></DialogContent>
    </Dialog>
  )
}
