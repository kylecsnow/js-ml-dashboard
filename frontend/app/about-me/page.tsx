'use client';

import Link from 'next/link';
import AboutMeChrome from './components/AboutMeChrome';
import { ABOUT_ME_VARIANTS } from './variants';

const CARD_CLASS =
  'flex h-full min-w-0 w-full flex-col overflow-hidden rounded-3xl border border-white/80 bg-white/65 shadow-[0_24px_80px_rgba(87,102,129,0.12)] backdrop-blur-[3px]';

function RailPreview() {
  return (
    <div className="flex h-36 gap-3 bg-gradient-to-br from-sky-50 to-slate-100 p-4">
      <div className="flex w-14 flex-col items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full bg-[#1c76e4]" />
        <span className="w-px flex-1 bg-slate-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#8a48cd]" />
        <span className="w-px flex-1 bg-slate-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#129e76]" />
      </div>
      <div className="flex flex-1 flex-col gap-2 pt-1">
        <div className="h-8 rounded-lg bg-white/80 ring-1 ring-slate-200" />
        <div className="h-8 rounded-lg bg-white/50 ring-1 ring-slate-200/70" />
        <div className="h-8 rounded-lg bg-white/50 ring-1 ring-slate-200/70" />
      </div>
    </div>
  );
}

function FilmstripPreview() {
  return (
    <div className="flex h-36 flex-col bg-gradient-to-br from-violet-50 to-slate-100">
      <div className="flex gap-1.5 border-b border-white/80 px-3 py-2">
        {['#1c76e4', '#8a48cd', '#129e76', '#1c76e4'].map((color, i) => (
          <div key={color + i} className="h-8 flex-1 rounded bg-white/80 ring-1 ring-slate-200">
            <div className="h-1 rounded-t" style={{ backgroundColor: color }} />
          </div>
        ))}
      </div>
      <div className="m-3 flex flex-1 overflow-hidden rounded-lg bg-white/80 ring-1 ring-slate-200">
        <div className="w-2/5 bg-[#1c76e4]/15" />
        <div className="flex-1 space-y-1.5 p-2">
          <div className="h-2 w-3/4 rounded bg-slate-300/80" />
          <div className="h-2 w-full rounded bg-slate-200" />
          <div className="h-2 w-5/6 rounded bg-slate-200" />
        </div>
      </div>
    </div>
  );
}

function SpinePreview() {
  return (
    <div className="relative flex h-36 items-center justify-center bg-gradient-to-br from-emerald-50 to-slate-100 px-4">
      <div className="absolute left-1/2 top-3 h-[calc(100%-1.5rem)] w-px -translate-x-1/2 bg-slate-300" />
      <div className="grid w-full grid-cols-2 gap-x-10 gap-y-3">
        <div className="h-10 rounded-lg bg-white/80 ring-1 ring-slate-200" />
        <div />
        <div />
        <div className="h-10 rounded-lg bg-white/80 ring-1 ring-slate-200" />
      </div>
      <span className="absolute left-1/2 top-8 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-[#1c76e4]" />
      <span className="absolute left-1/2 top-[4.6rem] h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-[#8a48cd]" />
    </div>
  );
}

const PREVIEWS = {
  'vertical-rail': RailPreview,
  filmstrip: FilmstripPreview,
  spine: SpinePreview,
} as const;

export default function AboutMeHub() {
  return (
    <AboutMeChrome
      activeSlug="hub"
      title="About Me"
      lede="Three layouts, one content file. Pick a framework — work, publications, and patents are already wired as clickable timeline entries. Swap the copy and images in data.ts when you are ready."
    >
      <main className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-6 px-4 pb-16 pt-6 sm:px-6 md:grid-cols-3">
        {ABOUT_ME_VARIANTS.map((variant) => {
          const Preview = PREVIEWS[variant.slug];
          return (
            <section key={variant.slug} className={CARD_CLASS}>
              <Preview />
              <div className="flex flex-1 flex-col gap-3 px-6 py-6">
                <p className="font-[family-name:var(--font-geist-mono)] text-xs uppercase tracking-[0.22em] text-slate-500">
                  {variant.kicker}
                </p>
                <h2 className="text-2xl font-semibold tracking-tight">{variant.name}</h2>
                <p className="text-sm leading-relaxed text-slate-600">{variant.summary}</p>
                <Link
                  href={variant.href}
                  className="mt-auto inline-flex h-10 w-fit items-center rounded-full bg-foreground px-5 text-sm text-background transition-colors hover:bg-[#383838]"
                >
                  Open
                </Link>
              </div>
            </section>
          );
        })}
      </main>
    </AboutMeChrome>
  );
}
