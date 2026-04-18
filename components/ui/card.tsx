import * as React from "react";
import { cn } from "@/lib/utils";

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-2xl border border-fg/10 bg-white/70 p-6 shadow-sm backdrop-blur",
      className,
    )}
    {...props}
  />
));
Card.displayName = "Card";

export { Card };
