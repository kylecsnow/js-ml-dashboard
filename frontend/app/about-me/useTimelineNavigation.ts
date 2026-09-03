'use client';

import { useCallback, useEffect, useState } from 'react';
import { scrollToEntry } from './scroll';

export function useTimelineNavigation(
  ids: readonly string[],
  options?: {
    rootRef?: { current: HTMLElement | null };
    topOffset?: number;
  },
) {
  const [activeId, setActiveId] = useState(ids[0] ?? '');
  const rootRef = options?.rootRef;
  const topOffset = options?.topOffset ?? 0;

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, '');
    if (!hash || !ids.includes(hash)) return;
    setActiveId(hash);
    const frame = window.requestAnimationFrame(() => {
      scrollToEntry(hash, {
        updateHash: false,
        container: rootRef?.current,
        topOffset,
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [ids, rootRef, topOffset]);

  useEffect(() => {
    if (ids.length === 0) return;

    const root = rootRef?.current ?? null;
    let frame = 0;
    const update = () => {
      const marker = root
        ? root.getBoundingClientRect().top + Math.min(root.clientHeight * 0.28, 140)
        : window.innerHeight * 0.3;
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
    window.addEventListener('resize', onScroll);
    if (root) {
      root.addEventListener('scroll', onScroll, { passive: true });
    } else {
      window.addEventListener('scroll', onScroll, { passive: true });
    }
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', onScroll);
      if (root) {
        root.removeEventListener('scroll', onScroll);
      } else {
        window.removeEventListener('scroll', onScroll);
      }
    };
  }, [ids, rootRef, topOffset]);

  const goTo = useCallback(
    (id: string) => {
      setActiveId(id);
      scrollToEntry(id, { container: rootRef?.current, topOffset });
    },
    [rootRef, topOffset],
  );

  return { activeId, goTo };
}
