'use client';

import { useCallback, useEffect, useState } from 'react';
import { scrollToEntry } from './scroll';

export function useTimelineNavigation(ids: readonly string[]) {
  const [activeId, setActiveId] = useState(ids[0] ?? '');

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, '');
    if (!hash || !ids.includes(hash)) return;
    setActiveId(hash);
    const frame = window.requestAnimationFrame(() => {
      scrollToEntry(hash, { updateHash: false });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [ids]);

  useEffect(() => {
    if (ids.length === 0) return;

    let frame = 0;
    const update = () => {
      const marker = window.innerHeight * 0.3;
      let best = ids[0];
      let bestDist = Number.POSITIVE_INFINITY;
      for (const id of ids) {
        const el = document.getElementById(id);
        if (!el) continue;
        const dist = Math.abs(el.getBoundingClientRect().top - marker);
        if (dist < bestDist) {
          bestDist = dist;
          best = id;
        }
      }
      setActiveId((prev) => (prev === best ? prev : best));
    };

    const onScroll = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [ids]);

  const goTo = useCallback((id: string) => {
    setActiveId(id);
    scrollToEntry(id);
  }, []);

  return { activeId, goTo };
}
