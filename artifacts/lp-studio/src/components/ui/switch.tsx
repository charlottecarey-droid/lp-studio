import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

type SwitchProps = React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root> & {
  /**
   * When true (default), render a compact "On"/"Off" status label next to the
   * pill that reflects the live state. Set to false to hide it in dense
   * layouts or where the surrounding UI already shows the state text.
   */
  showStateLabel?: boolean
}

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  SwitchProps
>(({ className, showStateLabel = true, checked, defaultChecked, onCheckedChange, disabled, ...props }, ref) => {
  // Track state internally so the label works for both controlled
  // (`checked`) and uncontrolled (`defaultChecked`) usage, updating
  // instantly on toggle.
  const isControlled = checked !== undefined
  const [internalChecked, setInternalChecked] = React.useState(defaultChecked ?? false)
  const current = isControlled ? checked : internalChecked

  const handleCheckedChange = (next: boolean) => {
    if (!isControlled) setInternalChecked(next)
    onCheckedChange?.(next)
  }

  const root = (
    <SwitchPrimitives.Root
      className={cn(
        "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input",
        className
      )}
      checked={checked}
      defaultChecked={defaultChecked}
      onCheckedChange={handleCheckedChange}
      disabled={disabled}
      {...props}
      ref={ref}
    >
      <SwitchPrimitives.Thumb
        className={cn(
          "pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0"
        )}
      />
    </SwitchPrimitives.Root>
  )

  if (!showStateLabel) return root

  return (
    <span className="inline-flex items-center gap-2">
      <span
        aria-hidden="true"
        className={cn(
          "min-w-[1.75rem] text-right text-xs font-medium text-muted-foreground select-none",
          disabled && "opacity-50"
        )}
      >
        {current ? "On" : "Off"}
      </span>
      {root}
    </span>
  )
})
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
