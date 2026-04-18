import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl text-base font-extrabold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "bg-accent text-white border-2 border-fg shadow-comic hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-comic-sm active:translate-x-[2px] active:translate-y-[2px] active:shadow-comic-pressed",
        soft:
          "bg-accent-soft text-fg border-2 border-fg shadow-comic-sm hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-comic-pressed active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
        bot:
          "bg-bot text-white border-2 border-fg shadow-comic hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-comic-sm active:translate-x-[2px] active:translate-y-[2px] active:shadow-comic-pressed",
        ghost: "text-fg hover:bg-accent-soft",
        outline:
          "border-2 border-fg bg-white/70 shadow-comic-sm hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-comic-pressed",
      },
      size: {
        default: "h-12 px-5",
        lg: "h-14 px-6 text-lg",
        sm: "h-10 px-4 text-sm",
        icon: "h-12 w-12",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size }), className)}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
