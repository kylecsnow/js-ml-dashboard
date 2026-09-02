import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "About Me · Kyle's AI/ML Dashboard",
};

export default function AboutMeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
