type MainContainerProps = React.ComponentProps<'main'>

export const MainContainer = ({ className, ...props }: MainContainerProps) => {
  return (
    <main
      className={`flex justify-center items-center w-full min-h-dvh h-dvh max-h-dvh overflow-hidden ${className}`}
      {...props}
    />
  )
}
