export function scrollToEntry(
  id: string,
  options?: {
    updateHash?: boolean;
    container?: HTMLElement | null;
    topOffset?: number;
  },
) {
  const el = document.getElementById(id);
  if (!el) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const container = options?.container;
  const topOffset = options?.topOffset ?? 0;

  if (container) {
    const elRect = el.getBoundingClientRect();
    const rootRect = container.getBoundingClientRect();
    const top = container.scrollTop + (elRect.top - rootRect.top) - topOffset;
    container.scrollTo({ top, behavior: reduced ? 'auto' : 'smooth' });
  } else {
    el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  }

  if (options?.updateHash === false) return;
  history.replaceState(null, '', `#${id}`);
}
