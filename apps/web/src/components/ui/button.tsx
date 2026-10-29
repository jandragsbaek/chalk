import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../../lib/utils.ts";

const buttonVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md border text-sm font-medium outline-none transition-[background-color,scale] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    defaultVariants: { variant: "default", size: "default" },
    variants: {
      variant: {
        default: "border-primary bg-primary text-primary-foreground hover:bg-primary/90",
        outline: "border-input bg-card hover:bg-muted",
        ghost: "border-transparent hover:bg-muted",
        "ghost-destructive":
          "border-transparent text-muted-foreground hover:bg-muted hover:text-destructive",
      },
      size: {
        default: "h-10 px-4",
        sm: "h-8 px-3 text-xs",
        icon: "size-8",
      },
    },
  },
);

interface ButtonProps
  extends useRender.ComponentProps<"button">, VariantProps<typeof buttonVariants> {}

function Button({ className, variant, size, render, ...props }: ButtonProps) {
  const defaultProps = {
    className: cn(buttonVariants({ variant, size, className })),
    type: render ? undefined : ("button" as const),
    "data-slot": "button",
  };
  return useRender({
    defaultTagName: "button",
    render,
    props: mergeProps<"button">(defaultProps, props),
  });
}

export { Button, buttonVariants };
