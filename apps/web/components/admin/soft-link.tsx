"use client";

import Link from "next/link";
import type { ReactNode } from "react";

type SoftLinkProps = {
  href: string;
  className?: string;
  children: ReactNode;
  disabled?: boolean;
};

export function SoftLink({
  href,
  className,
  children,
  disabled,
}: SoftLinkProps) {
  if (disabled) {
    return (
      <span aria-disabled="true" className={className}>
        {children}
      </span>
    );
  }

  return (
    <Link href={href} scroll={false} prefetch={true} className={className}>
      {children}
    </Link>
  );
}
