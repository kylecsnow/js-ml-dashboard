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
        {entry.href ? (
          <a
            href={entry.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-sky-800 underline decoration-sky-800/30 underline-offset-2 hover:decoration-sky-800"
          >
            {entry.org}
          </a>
        ) : (
          <p className="text-sm font-medium text-slate-600">{entry.org}</p>
        )}
      </div>
      <p className="text-base leading-relaxed text-slate-600">{entry.body}</p>
      {entry.download ? (
        <a
          href={entry.download.href}
          download
          className="inline-flex text-sm font-medium text-sky-800 underline decoration-sky-800/30 underline-offset-2 hover:decoration-sky-800"
        >
          {entry.download.label}
        </a>
      ) : null}
      {entry.highlights && entry.highlights.length > 0 ? (
        <ul className="space-y-1.5 font-[family-name:var(--font-geist-mono)] text-sm text-slate-600">
          {entry.highlights.map((item) => (
            <li key={typeof item === 'string' ? item : item.label} className="flex gap-2">
              <span className="mt-[0.55em] h-1 w-1 shrink-0 rounded-full bg-slate-400" />
              {typeof item === 'string' ? (
                <span>{item}</span>
              ) : (
                <a
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-800 underline decoration-sky-800/30 underline-offset-2 hover:decoration-sky-800"
                >
                  {item.label}
                </a>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
