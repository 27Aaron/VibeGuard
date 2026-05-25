"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

import type { LlmSettingsRow } from "@/components/admin/types";
import { CustomSelect } from "@/components/ui/custom-select";
import { activateLlmSettingsAction } from "@/lib/actions/settings";
import type { AppLang } from "@/lib/i18n";

type ProfileActiveSwitcherProps = {
  profiles: LlmSettingsRow[];
  lang: AppLang;
};

export function ProfileActiveSwitcher({
  profiles,
  lang,
}: ProfileActiveSwitcherProps) {
  const router = useRouter();
  const [isActionPending, startActionTransition] = useTransition();

  if (profiles.length === 0) return null;

  return (
    <div className="ml-auto flex items-center gap-2">
      <label className="text-sm text-muted-foreground">
        {lang === "zh" ? "生效配置：" : "Active config:"}
      </label>
      <CustomSelect
        className="min-w-[220px]"
        value={profiles.find((p) => p.isActive)?.id ?? ""}
        onChange={(targetId) => {
          if (!targetId) return;
          startActionTransition(async () => {
            const fd = new FormData();
            fd.set("id", targetId);
            fd.set("lang", String(lang));
            await activateLlmSettingsAction(fd);
            router.refresh();
          });
        }}
        disabled={isActionPending}
        options={profiles.map((p) => ({
          value: p.id,
          label: `${p.name} (${p.model})`,
        }))}
      />
    </div>
  );
}
