import * as React from "react";
import { Input as InputPrimitive } from "@base-ui/react/input";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-10 w-full min-w-0 rounded-full border border-black/6 bg-[#fcfcfa] px-3 py-1 text-base text-zinc-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-zinc-400 hover:bg-white focus-visible:border-emerald-700/30 focus-visible:ring-2 focus-visible:ring-emerald-700/10 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:border-white/10 dark:bg-white/[0.055] dark:text-stone-100 dark:shadow-none dark:placeholder:text-stone-500 dark:hover:bg-white/[0.08] dark:focus-visible:border-emerald-200/30 dark:focus-visible:ring-emerald-200/10 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
