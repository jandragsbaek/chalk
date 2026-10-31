import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "../lib/utils.ts";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-1.5 text-xs font-semibold uppercase leading-5 tracking-wide font-stretch-condensed",
  {
    defaultVariants: { variant: "default" },
    variants: {
      variant: {
        default: "border-primary bg-primary text-primary-foreground",
        muted: "border-input bg-transparent text-muted-foreground",
      },
    },
  },
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span data-slot="badge" className={cn(badgeVariants({ variant, className }))} {...props} />
  );
}

export { Badge };
