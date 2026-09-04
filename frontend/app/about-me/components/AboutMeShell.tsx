'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import AsciiFlowBackground from '../../components/AsciiFlowBackground';

export default function AboutMeShell({
  title,
  legend,
  subnav,
  children,
}: {
  title: string;
  legend?: ReactNode;
  subnav?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="relative flex h-dvh flex-col overflow-hidden overscroll-none bg-[radial-gradient(circle_at_20%_15%,#ffffff_0%,#f7f9fb_43%,#eff1f5_100%)] font-[family-name:var(--font-geist-sans)] text-slate-800">
      <AsciiFlowBackground />
      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        <div className="relative z-20 mx-auto w-full max-w-6xl shrink-0 bg-gradient-to-b from-[#f7f9fb]/80 via-[#f7f9fb]/70 to-transparent px-4 pb-2 pt-5 sm:px-6 sm:pt-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-[family-name:var(--font-geist-mono)] text-xs uppercase tracking-[0.22em] text-slate-500">
                Kyle&apos;s background / bio
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-800 sm:text-4xl">{title}</h1>
              {legend}
            </div>
            <Link
              href="/"
              className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full bg-foreground px-4 text-sm text-background transition-colors hover:bg-[#383838]"
            >
              <Image src="/snowflake.svg" alt="" width={18} height={18} />
              Home
            </Link>
          </div>
          {subnav}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-full h-10 bg-gradient-to-b from-[#f7f9fb] to-transparent"
          />
        </div>
        <div className="relative min-h-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
