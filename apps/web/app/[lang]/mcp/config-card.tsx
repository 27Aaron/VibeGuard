"use client";

import { CopyButton } from "@/components/ui/copy-button";

export function ConfigCard({ title, code }: { title: string; code: string }) {
  return (
    <div className="group relative flex flex-col rounded-[1rem] border border-black/5 bg-white/70 dark:border-white/10 dark:bg-white/[0.04]">
      <div className="flex items-center justify-between border-b border-black/5 px-4 py-2 dark:border-white/8">
        <p className="text-xs font-medium text-zinc-700 dark:text-stone-300">
          {title}
        </p>
        <CopyButton text={code} />
      </div>
      <pre className="overflow-x-auto px-4 py-3 text-xs leading-relaxed">
        <code className="font-mono text-zinc-800 dark:text-stone-300">
          {code}
        </code>
      </pre>
    </div>
  );
}
