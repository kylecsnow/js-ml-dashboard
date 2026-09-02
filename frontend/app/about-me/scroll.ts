export function scrollToEntry(id: string, options?: { updateHash?: boolean }) {
  const el = document.getElementById(id);
  if (!el) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });

  if (options?.updateHash === false) return;
  history.replaceState(null, '', `#${id}`);
}
