'use client';

import AboutMeChrome from '../components/AboutMeChrome';
import EntryCopy from '../components/EntryCopy';
import EntryVisual from '../components/EntryVisual';
import KindBadge from '../components/KindBadge';
import { TIMELINE, TIMELINE_IDS } from '../data';
import { KIND_META } from '../types';
import { useTimelineNavigation } from '../useTimelineNavigation';

const CARD_CLASS =
  'overflow-hidden rounded-3xl border border-white/80 bg-white/65 shadow-[0_24px_80px_rgba(87,102,129,0.12)] backdrop-blur-[3px]';

export default function VerticalRailPage() {
  const { activeId, goTo } = useTimelineNavigation(TIMELINE_IDS);
  const activeIndex = Math.max(0, TIMELINE.findIndex((entry) => entry.id === activeId));
  const progress = TIMELINE.length > 1 ? activeIndex / (TIMELINE.length - 1) : 0;

  return (
    <AboutMeChrome
      activeSlug="vertical-rail"
      title="A sticky index, then the story"
      lede="Click any year on the rail. The page eases down to that chapter — work, paper, or patent — with a matching visual beside the copy."
      subnav={
        <nav aria-label="Timeline years" className="border-t border-white/60 px-4 py-2 md:hidden">
          <ol className="flex gap-2 overflow-x-auto">
            {TIMELINE.map((entry) => {
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
      <div className="mx-auto flex max-w-6xl gap-8 px-4 pb-24 pt-6 sm:px-6">
        <nav
          aria-label="Timeline"
          className="sticky top-20 hidden max-h-[calc(100svh-6rem)] w-52 shrink-0 overflow-y-auto self-start py-2 md:block"
        >
          <div className="relative pl-4">
            <div className="absolute bottom-3 left-[7px] top-3 w-px bg-slate-300" />
            <div
              className="absolute left-[7px] top-3 w-px bg-slate-800 transition-[height] duration-500"
              style={{ height: `calc(${progress} * (100% - 1.5rem))` }}
            />
            <ol className="relative space-y-1">
              {TIMELINE.map((entry) => {
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
                          active ? meta.activeText : 'text-slate-500'
                        }`}
                      >
                        {entry.year}
                      </span>
                      <span className={`text-sm leading-snug ${active ? 'font-medium text-slate-800' : 'text-slate-600'}`}>
                        {entry.summary}
                      </span>
                    </a>
                  </li>
                );
              })}
            </ol>
          </div>
        </nav>

        <div className="min-w-0 flex-1">
          <div className="space-y-10">
            {TIMELINE.map((entry) => (
              <article key={entry.id} id={entry.id} className={`${CARD_CLASS} scroll-mt-36 md:scroll-mt-28`}>
                <div className="grid gap-0 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                  <EntryVisual entry={entry} className="aspect-[4/3] md:aspect-auto md:min-h-[280px]" />
                  <div className="px-6 py-6 sm:px-8 sm:py-8">
                    <EntryCopy entry={entry} />
                  </div>
                </div>
              </article>
            ))}
          </div>

          <p className="mt-8 hidden items-center gap-3 text-xs text-slate-500 md:flex">
            <KindBadge kind="work" />
            <KindBadge kind="publication" />
            <KindBadge kind="patent" />
          </p>
        </div>
      </div>
    </AboutMeChrome>
  );
}
