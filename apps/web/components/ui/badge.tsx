import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-4xl border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default:
          "bg-zinc-950 text-stone-50 [a]:hover:bg-zinc-800 dark:bg-stone-100 dark:text-zinc-950",
        secondary:
          "border-emerald-900/18 bg-[#dfe9e2] text-emerald-950 dark:border-emerald-200/14 dark:bg-[#121b17] dark:text-emerald-100",
        destructive:
          "bg-destructive/10 text-destructive focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:focus-visible:ring-destructive/40 [a]:hover:bg-destructive/20",
        outline:
          "border-black/8 bg-[#eef2f7] text-zinc-700 [a]:hover:bg-[#e7ecf4] [a]:hover:text-zinc-950 dark:border-white/8 dark:bg-[#11161d] dark:text-stone-200 dark:[a]:hover:bg-[#151b22] dark:[a]:hover:text-white",
        ghost:
          "text-zinc-600 hover:bg-[#eef2f7] hover:text-zinc-950 dark:text-stone-300 dark:hover:bg-white/[0.06] dark:hover:text-white",
        link: "text-emerald-800 underline-offset-4 hover:underline dark:text-emerald-300",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props,
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  });
}

export { Badge, badgeVariants };
