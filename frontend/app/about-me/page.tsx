'use client';

import { useEffect, useRef } from 'react';
import AboutMeShell from './components/AboutMeShell';
import EntryCopy from './components/EntryCopy';
import EntryVisual from './components/EntryVisual';
import KindBadge from './components/KindBadge';
import { TIMELINE } from './data';
import { KIND_META, timelineSortYear } from './types';
import { useTimelineNavigation } from './useTimelineNavigation';

const CARD_CLASS =
  'overflow-hidden rounded-3xl border border-white/80 bg-white/65 shadow-[0_24px_80px_rgba(87,102,129,0.12)] backdrop-blur-[3px]';

const ENTRIES = [...TIMELINE].sort((a, b) => timelineSortYear(b) - timelineSortYear(a));
const ENTRY_IDS = ENTRIES.map((entry) => entry.id);
const SCROLL_TOP_OFFSET = 16;

export default function AboutMePage() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLElement>(null);
  const { activeId, goTo } = useTimelineNavigation(ENTRY_IDS, {
    rootRef: scrollRef,
    topOffset: SCROLL_TOP_OFFSET,
  });
  const activeIndex = Math.max(0, ENTRIES.findIndex((entry) => entry.id === activeId));
  const progress = ENTRIES.length > 1 ? activeIndex / (ENTRIES.length - 1) : 0;

  useEffect(() => {
    const scroller = scrollRef.current;
    const rail = railRef.current;
    if (!scroller) return;

    const onWheel = (event: WheelEvent) => {
      if (scroller.contains(event.target as Node)) return;
      if (rail?.contains(event.target as Node) && rail.scrollHeight > rail.clientHeight + 1) {
        const atTop = rail.scrollTop <= 0 && event.deltaY < 0;
        const atBottom =
          rail.scrollTop + rail.clientHeight >= rail.scrollHeight - 1 && event.deltaY > 0;
        if (!atTop && !atBottom) return;
      }
      event.preventDefault();
      scroller.scrollTop += event.deltaY;
    };

    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) return;

      const page = scroller.clientHeight * 0.9;
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        scroller.scrollBy({ top: 48 });
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        scroller.scrollBy({ top: -48 });
      } else if (event.key === 'PageDown' || event.key === ' ') {
        if (event.key === ' ' && (tag === 'A' || tag === 'BUTTON')) return;
        event.preventDefault();
        scroller.scrollBy({ top: page });
      } else if (event.key === 'PageUp') {
        event.preventDefault();
        scroller.scrollBy({ top: -page });
      } else if (event.key === 'Home') {
        event.preventDefault();
        scroller.scrollTo({ top: 0 });
      } else if (event.key === 'End') {
        event.preventDefault();
        scroller.scrollTo({ top: scroller.scrollHeight });
      }
    };

    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  return (
    <AboutMeShell
      title="About Me"
      legend={
        <p className="mt-3 flex flex-wrap items-center gap-2">
          <KindBadge kind="work" />
          <KindBadge kind="publication" />
          <KindBadge kind="patent" />
          <KindBadge kind="education" />
        </p>
      }
      subnav={
        <nav aria-label="Timeline years" className="border-t border-white/60 px-4 py-2 md:hidden">
          <ol className="flex gap-2 overflow-x-auto">
            {ENTRIES.map((entry) => {
              const active = entry.id === activeId;
              return (
                <li key={entry.id}>
                  <a
                    href={`#${entry.id}`}
                    aria-current={active ? 'true' : undefined}
                    onClick={(event) => {
                      event.preventDefault();
                      goTo(entry.id);
                    }}
                    className={`block shrink-0 rounded-full px-3 py-1.5 font-[family-name:var(--font-geist-mono)] text-xs ${
                      active ? 'bg-slate-900 text-white' : 'bg-white/70 text-slate-600'
                    }`}
                  >
                    {entry.year}
                  </a>
                </li>
              );
            })}
          </ol>
        </nav>
      }
    >
      <div className="mx-auto flex h-full max-w-6xl gap-8 px-4 sm:px-6">
        <nav
          ref={railRef}
          aria-label="Timeline"
          className="hidden h-full w-56 shrink-0 overflow-y-auto self-stretch py-2 md:block"
        >
          <div className="relative pl-4">
            <div className="absolute bottom-3 left-[7px] top-3 w-px bg-slate-300" />
            <div
              className="absolute left-[7px] top-3 w-px bg-slate-800 transition-[height] duration-500"
              style={{ height: `calc(${progress} * (100% - 1.5rem))` }}
            />
            <ol className="relative space-y-1">
              {ENTRIES.map((entry) => {
                const active = entry.id === activeId;
                const meta = KIND_META[entry.kind];
                return (
                  <li key={entry.id}>
                    <a
                      href={`#${entry.id}`}
                      aria-current={active ? 'true' : undefined}
                      onClick={(event) => {
                        event.preventDefault();
                        goTo(entry.id);
                      }}
                      className={`group relative flex flex-col rounded-xl py-2 pl-5 pr-2 transition-colors ${
                        active ? 'bg-white/80' : 'hover:bg-white/55'
                      }`}
                    >
                      <span
                        className={`absolute left-[-9px] top-3.5 h-2.5 w-2.5 rounded-full ring-2 ring-white ${meta.dot} ${
                          active ? meta.glow : ''
                        }`}
                      />
                      <span
                        className={`font-[family-name:var(--font-geist-mono)] text-[11px] uppercase tracking-[0.14em] ${
                          active ? meta.activeText : 'text-slate-600'
                        }`}
                      >
                        {entry.year}
                      </span>
                      <span className={`text-sm leading-snug ${active ? 'font-medium text-slate-800' : 'text-slate-700'}`}>
                        {entry.summary}
                      </span>
                    </a>
                  </li>
                );
              })}
            </ol>
          </div>
        </nav>

        <div
          ref={scrollRef}
          className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain pb-24 pt-2"
          aria-label="Timeline entries"
        >
          <div className="space-y-10">
            {ENTRIES.map((entry) => (
              <article key={entry.id} id={entry.id} className={CARD_CLASS}>
                <div className="grid gap-0 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                  <EntryVisual entry={entry} className="aspect-[4/3] md:aspect-auto md:min-h-[280px]" />
                  <div className="px-6 py-6 sm:px-8 sm:py-8">
                    <EntryCopy entry={entry} />
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </AboutMeShell>
  );
}
