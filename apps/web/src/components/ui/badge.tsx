import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent",
        secondary: "",
        destructive: "border-transparent",
        outline: "",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  const baseClasses = cn(
    "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors"
  )

  let variantClasses = ""
  if (variant === "secondary") {
    // 用户会传入具体的样式类
    variantClasses = className || ""
  } else if (variant === "destructive") {
    variantClasses = "bg-red-500/10 text-red-300 border-red-500/20 hover:bg-red-500/20"
  } else if (variant === "outline") {
    variantClasses = "border-slate-600"
  }

  return (
    <div
      className={cn(baseClasses, variantClasses, className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }