export const TIMELINE_KINDS = ['work', 'publication', 'patent', 'education'] as const;

export type TimelineKind = (typeof TIMELINE_KINDS)[number];

export type TimelineImage = {
  /** Path under `frontend/public`, e.g. `/about-me/lab.jpg`. */
  src: string;
  alt: string;
  caption?: string;
};

export type TimelineEntry = {
  /** Unique slug; used as the section id and hash (`#northwind-labs`). */
  id: string;
  kind: TimelineKind;
  /** Display label, e.g. `2020–2023` or `2019`. */
  year: string;
  /** Numeric year for sorting / scrubber position. Use the start year for ranges. */
  startYear: number;
  title: string;
  org: string;
  location?: string;
  /** One-liner shown on compact timeline ticks. */
  summary: string;
  /** Longer copy for the expanded section. */
  body: string;
  highlights?: string[];
  image: TimelineImage;
};

export const KIND_META: Record<
  TimelineKind,
  {
    label: string;
    chip: string;
    dot: string;
    activeText: string;
    glow: string;
    bar: string;
  }
> = {
  work: {
    label: 'Work',
    chip: 'bg-sky-50 text-sky-800 ring-1 ring-inset ring-sky-200',
    dot: 'bg-[#1c76e4]',
    activeText: 'text-[#1c76e4]',
    glow: 'shadow-[0_0_0_4px_rgba(28,118,228,0.2)]',
    bar: 'bg-[#1c76e4]',
  },
  publication: {
    label: 'Publication',
    chip: 'bg-violet-50 text-violet-800 ring-1 ring-inset ring-violet-200',
    dot: 'bg-[#8a48cd]',
    activeText: 'text-[#8a48cd]',
    glow: 'shadow-[0_0_0_4px_rgba(138,72,205,0.2)]',
    bar: 'bg-[#8a48cd]',
  },
  patent: {
    label: 'Patent',
    chip: 'bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-200',
    dot: 'bg-[#129e76]',
    activeText: 'text-[#129e76]',
    glow: 'shadow-[0_0_0_4px_rgba(18,158,118,0.2)]',
    bar: 'bg-[#129e76]',
  },
  education: {
    label: 'Education',
    chip: 'bg-amber-50 text-amber-900 ring-1 ring-inset ring-amber-200',
    dot: 'bg-[#c4841d]',
    activeText: 'text-[#b45309]',
    glow: 'shadow-[0_0_0_4px_rgba(196,132,29,0.2)]',
    bar: 'bg-[#c4841d]',
  },
};
