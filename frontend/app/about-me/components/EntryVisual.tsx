import type { TimelineEntry } from '../types';

export default function EntryVisual({
  entry,
  className = '',
}: {
  entry: TimelineEntry;
  className?: string;
}) {
  const fitClass = entry.image.fit === 'contain' ? 'object-contain' : 'object-cover';
  const visual = (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={entry.image.src}
        alt={entry.image.alt}
        className={`h-full w-full ${fitClass}${entry.image.padded ? ' p-8 sm:p-10' : ''}`}
      />
      {entry.image.caption ? (
        <figcaption className="absolute inset-x-0 bottom-0 bg-slate-900/55 px-3 py-1.5 font-[family-name:var(--font-geist-mono)] text-[11px] text-white">
          {entry.image.caption}
        </figcaption>
      ) : null}
    </>
  );

  return (
    <figure
      className={`relative h-full overflow-hidden ${
        entry.image.background
          ? ''
          : entry.image.fit === 'contain'
            ? 'bg-white'
            : 'bg-slate-200'
      } ${className}`}
      style={entry.image.background ? { backgroundColor: entry.image.background } : undefined}
    >
      {entry.download ? (
        <a
          href={entry.download.href}
          download
          className="block h-full w-full"
          aria-label={entry.download.label}
        >
          {visual}
        </a>
      ) : (
        visual
      )}
    </figure>
  );
}
