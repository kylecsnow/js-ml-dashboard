import { KIND_META, type TimelineKind } from '../types';

export default function KindBadge({ kind }: { kind: TimelineKind }) {
  const meta = KIND_META[kind];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-[family-name:var(--font-geist-mono)] text-[10px] font-medium uppercase tracking-[0.16em] ${meta.chip}`}
    >
      {meta.label}
    </span>
  );
}
