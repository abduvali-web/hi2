import * as React from "react"

import { cn } from "@/lib/utils"

export interface InputProps extends React.ComponentProps<"input"> {
  error?: string
  "aria-label"?: string
  "aria-describedby"?: string
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, ...props }, ref) => {
    const inputId = props.id || React.useId()
    const errorId = error ? `${inputId}-error` : undefined
    
    return (
      <div className="w-full">
        <input
          ref={ref}
          type={type}
          id={inputId}
          data-slot="input"
          aria-invalid={error ? "true" : "false"}
          aria-describedby={error ? errorId : props["aria-describedby"]}
          className={cn(
            "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
            "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
            "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
            error && "border-destructive",
            className
          )}
          {...props}
        />
        {error && (
          <p
            id={errorId}
            className="text-sm text-destructive mt-1.5"
            role="alert"
            aria-live="polite"
          >
            {error}
          </p>
        )}
      </div>
    )
  }
)

Input.displayName = "Input"

export { Input }
