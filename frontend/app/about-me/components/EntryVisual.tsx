import type { TimelineEntry } from '../types';

export default function EntryVisual({
  entry,
  className = '',
}: {
  entry: TimelineEntry;
  className?: string;
}) {
  return (
    <figure className={`relative h-full overflow-hidden bg-slate-200 ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={entry.image.src}
        alt={entry.image.alt}
        className="h-full w-full object-cover"
      />
      {entry.image.caption ? (
        <figcaption className="absolute inset-x-0 bottom-0 bg-slate-900/55 px-3 py-1.5 font-[family-name:var(--font-geist-mono)] text-[11px] text-white">
          {entry.image.caption}
        </figcaption>
      ) : null}
    </figure>
  );
}
