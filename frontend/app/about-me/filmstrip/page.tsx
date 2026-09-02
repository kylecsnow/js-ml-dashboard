'use client';

import { useEffect } from 'react';
import AboutMeChrome from '../components/AboutMeChrome';
import EntryCopy from '../components/EntryCopy';
import EntryVisual from '../components/EntryVisual';
import { TIMELINE, TIMELINE_IDS } from '../data';
import { KIND_META } from '../types';
import { useTimelineNavigation } from '../useTimelineNavigation';

export default function FilmstripPage() {
  const { activeId, goTo } = useTimelineNavigation(TIMELINE_IDS);

  useEffect(() => {
    const node = document.querySelector(`[data-nav-id="${activeId}"]`);
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
      activeSlug="filmstrip"
      title="Years as a filmstrip"
      lede="The strip at the top is the timeline. Click a still and the chapter below pulls into place — image-led, one story at a time."
      subnav={
        <nav aria-label="Timeline" className="border-t border-white/60">
          <ol className="mx-auto flex max-w-6xl gap-3 overflow-x-auto px-4 py-3 sm:px-6">
            {TIMELINE.map((entry) => {
              const active = entry.id === activeId;
              const meta = KIND_META[entry.kind];
              return (
                <li key={entry.id} className="shrink-0">
                  <a
                    data-nav-id={entry.id}
                    href={`#${entry.id}`}
                    aria-current={active ? 'true' : undefined}
                    onClick={(event) => {
                      event.preventDefault();
                      goTo(entry.id);
                    }}
                    className={`block w-[7.5rem] overflow-hidden rounded-2xl bg-white/80 ring-1 transition-transform ${
                      active ? `scale-[1.04] ring-slate-800 ${meta.glow}` : 'ring-slate-200 hover:ring-slate-400'
                    }`}
                  >
                    <span className={`block h-1 ${meta.bar}`} />
                    <EntryVisual entry={entry} className="aspect-[4/3]" />
                    <span className="block px-2 py-1.5">
                      <span
                        className={`block font-[family-name:var(--font-geist-mono)] text-[10px] uppercase tracking-[0.14em] ${
                          active ? meta.activeText : 'text-slate-500'
                        }`}
                      >
                        {entry.year}
                      </span>
                      <span className="line-clamp-2 text-[11px] leading-snug text-slate-600">{entry.title}</span>
                    </span>
                  </a>
                </li>
              );
            })}
          </ol>
        </nav>
      }
    >
      <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6">
        {TIMELINE.map((entry, index) => {
          const imageFirst = index % 2 === 0;
          return (
            <article
              key={entry.id}
              id={entry.id}
              className="scroll-mt-[13.5rem] overflow-hidden rounded-3xl border border-white/80 bg-white/65 shadow-[0_24px_80px_rgba(87,102,129,0.12)] backdrop-blur-[3px] sm:scroll-mt-48"
            >
              <div
                className={`grid md:min-h-[calc(100svh-16rem)] md:grid-cols-2 ${
                  imageFirst ? '' : 'md:[&>*:first-child]:order-2'
                }`}
              >
                <EntryVisual entry={entry} className="min-h-[220px] md:h-full" />
                <div className="flex items-center px-6 py-8 sm:px-10 sm:py-12">
                  <EntryCopy
                    entry={entry}
                    headingClassName="text-3xl font-semibold tracking-tight text-slate-800 sm:text-4xl"
                  />
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </AboutMeChrome>
  );
}
