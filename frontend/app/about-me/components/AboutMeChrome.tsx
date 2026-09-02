'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import AsciiFlowBackground from '../../components/AsciiFlowBackground';
import { ABOUT_ME_VARIANTS, type AboutMeChromeSlug } from '../variants';

const TAB_CLASS =
  'rounded-full px-3 py-1.5 text-xs font-medium tracking-wide transition-colors sm:text-sm';

export default function AboutMeChrome({
  activeSlug,
  title,
  lede,
  subnav,
  children,
}: {
  activeSlug: AboutMeChromeSlug;
  title: string;
  lede: string;
  subnav?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_20%_15%,#ffffff_0%,#f7f9fb_43%,#eff1f5_100%)] font-[family-name:var(--font-geist-sans)] text-slate-800">
      <AsciiFlowBackground />
      <header className="sticky top-0 z-30 border-b border-white/70 bg-white/60 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <Link
            href="/"
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full bg-foreground px-4 text-sm text-background transition-colors hover:bg-[#383838]"
          >
            <Image src="/snowflake.svg" alt="" width={18} height={18} />
            Home
          </Link>
          <nav aria-label="About Me layouts" className="flex flex-wrap items-center gap-1.5">
            <Link
              href="/about-me"
              className={`${TAB_CLASS} ${
                activeSlug === 'hub' ? 'bg-slate-900 text-white' : 'bg-white/70 text-slate-600 hover:bg-white'
              }`}
            >
              Compare
            </Link>
            {ABOUT_ME_VARIANTS.map((variant) => (
              <Link
                key={variant.slug}
                href={variant.href}
                className={`${TAB_CLASS} ${
                  activeSlug === variant.slug
                    ? 'bg-slate-900 text-white'
                    : 'bg-white/70 text-slate-600 hover:bg-white'
                }`}
              >
                {variant.name}
              </Link>
            ))}
          </nav>
        </div>
        {subnav}
      </header>
      <div className="relative z-10">
        <div className="mx-auto max-w-6xl px-4 pb-2 pt-8 sm:px-6 sm:pt-10">
          <p className="font-[family-name:var(--font-geist-mono)] text-xs uppercase tracking-[0.22em] text-slate-500">
            Kyle&apos;s background / bio
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-800 sm:text-4xl">{title}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">{lede}</p>
        </div>
        {children}
      </div>
    </div>
  );
}
