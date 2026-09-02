import type { TimelineEntry } from '../types';
import KindBadge from './KindBadge';

export default function EntryCopy({
  entry,
  headingClassName = 'text-2xl font-semibold tracking-tight text-slate-800 sm:text-3xl',
}: {
  entry: TimelineEntry;
  headingClassName?: string;
}) {
  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <KindBadge kind={entry.kind} />
        <p className="font-[family-name:var(--font-geist-mono)] text-xs uppercase tracking-[0.16em] text-slate-500">
          {entry.year}
          {entry.location ? ` · ${entry.location}` : ''}
        </p>
      </div>
      <div className="space-y-1">
        <h2 className={headingClassName}>{entry.title}</h2>
        <p className="text-sm font-medium text-slate-600">{entry.org}</p>
      </div>
      <p className="text-base leading-relaxed text-slate-600">{entry.body}</p>
      {entry.highlights && entry.highlights.length > 0 ? (
        <ul className="space-y-1.5 font-[family-name:var(--font-geist-mono)] text-sm text-slate-600">
          {entry.highlights.map((item) => (
            <li key={item} className="flex gap-2">
              <span className="mt-[0.55em] h-1 w-1 shrink-0 rounded-full bg-slate-400" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
