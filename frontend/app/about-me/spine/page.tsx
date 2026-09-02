'use client';

import { useEffect } from 'react';
import AboutMeChrome from '../components/AboutMeChrome';
import EntryCopy from '../components/EntryCopy';
import EntryVisual from '../components/EntryVisual';
import { TIMELINE, TIMELINE_IDS } from '../data';
import { KIND_META } from '../types';
import { useTimelineNavigation } from '../useTimelineNavigation';

export default function SpinePage() {
  const { activeId, goTo } = useTimelineNavigation(TIMELINE_IDS);

  useEffect(() => {
    const node = document.querySelector(`[data-dock-id="${activeId}"]`);
    if (!(node instanceof HTMLElement)) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    node.scrollIntoView({
      inline: 'center',
      block: 'nearest',
      behavior: reduced ? 'auto' : 'smooth',
    });
  }, [activeId]);

  return (
    <AboutMeChrome
      activeSlug="spine"
      title="A spine down the middle"
      lede="The timeline is the page: nodes on a center line, stories alternating left and right. Use the year dock to jump without hunting."
      subnav={
        <nav aria-label="Timeline" className="border-t border-white/60">
          <ol className="mx-auto flex max-w-4xl gap-2 overflow-x-auto px-4 py-3 sm:px-6">
            {TIMELINE.map((entry) => {
              const active = entry.id === activeId;
              const meta = KIND_META[entry.kind];
              return (
                <li key={entry.id}>
                  <a
                    data-dock-id={entry.id}
                    href={`#${entry.id}`}
                    aria-current={active ? 'true' : undefined}
                    onClick={(event) => {
                      event.preventDefault();
                      goTo(entry.id);
                    }}
                    className={`flex shrink-0 flex-col items-center rounded-2xl px-3 py-1.5 ${
                      active ? 'bg-white shadow-sm' : 'hover:bg-white/70'
                    }`}
                  >
                    <span className={`h-2 w-2 rounded-full ${meta.dot} ${active ? meta.glow : ''}`} />
                    <span
                      className={`mt-1 font-[family-name:var(--font-geist-mono)] text-[11px] uppercase tracking-[0.12em] ${
                        active ? meta.activeText : 'text-slate-500'
                      }`}
                    >
                      {entry.year}
                    </span>
                  </a>
                </li>
              );
            })}
          </ol>
        </nav>
      }
    >
      <div className="relative mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <div className="absolute bottom-12 left-4 top-12 w-px bg-slate-300 md:left-1/2 md:-translate-x-px" />
        <ol className="space-y-12 md:space-y-16">
          {TIMELINE.map((entry, index) => {
            const left = index % 2 === 0;
            const active = entry.id === activeId;
            const meta = KIND_META[entry.kind];
            return (
              <li key={entry.id} id={entry.id} className="relative scroll-mt-48 md:scroll-mt-40">
                <a
                  href={`#${entry.id}`}
                  aria-label={`Jump to ${entry.year}`}
                  onClick={(event) => {
                    event.preventDefault();
                    goTo(entry.id);
                  }}
                  className={`absolute left-4 z-10 h-3.5 w-3.5 -translate-x-1/2 rounded-full ring-4 ring-[#f4f6f9] md:left-1/2 ${meta.dot} ${
                    active ? `${meta.glow} scale-125` : ''
                  }`}
                  style={{ top: '1.75rem' }}
                />
                <article
                  className={`ml-10 overflow-hidden rounded-3xl border border-white/80 bg-white/65 shadow-[0_24px_80px_rgba(87,102,129,0.12)] backdrop-blur-[3px] transition-transform md:ml-0 md:w-[calc(50%-2rem)] ${
                    left ? 'md:mr-auto' : 'md:ml-auto'
                  } ${active ? 'md:scale-[1.01]' : ''}`}
                >
                  <EntryVisual entry={entry} className="aspect-[16/9]" />
                  <div className="px-6 py-6">
                    <EntryCopy
                      entry={entry}
                      headingClassName="text-xl font-semibold tracking-tight text-slate-800 sm:text-2xl"
                    />
                  </div>
                </article>
              </li>
            );
          })}
        </ol>
      </div>
    </AboutMeChrome>
  );
}
