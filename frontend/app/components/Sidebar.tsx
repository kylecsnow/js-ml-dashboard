'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import MenuIcon from '@mui/icons-material/Menu';
import SidebarTooltip from './SidebarTooltip';

const MIN_SIDEBAR_WIDTH = 180;
const DEFAULT_SIDEBAR_WIDTH = 256;
const MAX_SIDEBAR_WIDTH = 480;

type NavItem = {
  href: string;
  label: string;
  tooltip: string;
};

type NavSection = {
  id: 'ml-dashboard' | 'bonus';
  label: string;
  items: readonly NavItem[];
};

const HOME_ITEM: NavItem = {
  href: '/',
  label: 'Home',
  tooltip: 'Return to the home page, where you can select a different model to analyze.',
};

const NAV_SECTIONS: readonly NavSection[] = [
  {
    id: 'ml-dashboard',
    label: 'ML Dashboard',
    items: [
      {
        href: '/overview',
        label: 'Overview',
        tooltip: 'View model details and test-set performance metrics for the selected model.',
      },
      {
        href: '/violin-plots',
        label: 'Violin Plots',
        tooltip:
          'View violin plots of all input & output variables to quickly inspect their distributions (useful for assessing normality, detecting outliers, etc).',
      },
      {
        href: '/scatter-plots',
        label: 'Scatter Plots',
        tooltip:
          'Create scatter plots comparing any input or output features of the selected model, including interactive 3D scatter plots.',
      },
      {
        href: '/correlation-heatmaps',
        label: 'Correlation Heatmaps',
        tooltip:
          'View heatmaps of the correlation coefficients between features (on an input-to-input, input-to-output, or output-to-output basis).',
      },
      {
        href: '/shap-summary-plots',
        label: 'SHAP Summary Plots',
        tooltip:
          'SHAP-based model interpretability plots illustrating the directional influence of each feature on a given output, highlighting global trends across the entire dataset.',
      },
      {
        href: '/shap-waterfall-plots',
        label: 'SHAP Waterfall Plots',
        tooltip:
          'SHAP-based model interpretability plots illustrating the directional influence of each feature on a given output, focusing on individual predictions given by the model.',
      },
    ],
  },
  {
    id: 'bonus',
    label: 'Bonus',
    items: [
      {
        href: '/molecular-design',
        label: 'Molecular Design',
        tooltip:
          "Visualize chemical structures resulting from a molecular design task. Similar molecules are grouped closer together, acting as a 'molecular space map'. (NOTE: Independent of the selected model.)",
      },
      {
        href: '/dataset-generator',
        label: 'Dataset Generator',
        tooltip:
          'Quickly generate synthetic datasets for ML modeling, derived from randomly-defined trends between input and output variables. (NOTE: Independent of the selected model.)',
      },
      {
        href: '/object-detection',
        label: 'Object Detection',
        tooltip:
          'A fine-tuned computer vision model trained to identify red blood cells, white blood cells, and platelets in microscope images. (NOTE: Independent of the selected model.)',
      },
    ],
  },
];

const DEFAULT_OPEN_SECTIONS: Record<NavSection['id'], boolean> = {
  'ml-dashboard': true,
  bonus: true,
};

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      className={`flex items-center gap-2 rounded-lg p-1 pl-2 text-[14.5px] ${
        active ? 'bg-black text-white' : 'hover:bg-gray-200'
      }`}
    >
      {item.label}
      <SidebarTooltip title={item.tooltip} />
    </Link>
  );
}

const TOGGLE_TAB_CLASS =
  'fixed left-0 top-[max(1.5rem,env(safe-area-inset-top))] z-40 items-center justify-center rounded-r-md border border-l-0 border-gray-300 bg-[#dbdbdb] shadow-md hover:bg-gray-200';

export default function Sidebar() {
  const pathName = usePathname();
  const [width, setWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openSections, setOpenSections] = useState(DEFAULT_OPEN_SECTIONS);
  const widthDragRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const widthRef = useRef(width);
  widthRef.current = width;

  useEffect(() => {
    const savedWidth = localStorage.getItem('sidebarWidth');
    const savedCollapsed = localStorage.getItem('sidebarCollapsed');
    if (savedWidth) {
      const parsed = Number(savedWidth);
      if (!Number.isNaN(parsed)) {
        setWidth(Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, parsed)));
      }
    }
    if (savedCollapsed === 'true') setCollapsed(true);

    const savedSections = localStorage.getItem('sidebarSections');
    let next = { ...DEFAULT_OPEN_SECTIONS };
    if (savedSections) {
      try {
        const parsed = JSON.parse(savedSections) as Partial<Record<NavSection['id'], boolean>>;
        next = { ...next, ...parsed };
      } catch {
        // keep defaults if storage is invalid
      }
    }
    const activeSection = NAV_SECTIONS.find((section) =>
      section.items.some((item) => item.href === pathName),
    );
    if (activeSection) next[activeSection.id] = true;
    setOpenSections(next);
  }, [pathName]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathName]);

  useEffect(() => {
    function onMove(e: MouseEvent | TouchEvent) {
      if (!widthDragRef.current) return;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const delta = clientX - widthDragRef.current.startX;
      const maxWidth = Math.min(MAX_SIDEBAR_WIDTH, window.innerWidth * 0.5);
      const nextWidth = Math.min(
        maxWidth,
        Math.max(MIN_SIDEBAR_WIDTH, widthDragRef.current.startWidth + delta),
      );
      setWidth(nextWidth);
    }
    function onUp() {
      if (widthDragRef.current) {
        localStorage.setItem('sidebarWidth', String(widthRef.current));
      }
      widthDragRef.current = null;
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove);
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMobileOpen(false);
    }
    window.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen]);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('sidebarCollapsed', String(next));
      return next;
    });
  };

  const toggleSection = (id: NavSection['id']) => {
    setOpenSections((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      localStorage.setItem('sidebarSections', JSON.stringify(next));
      return next;
    });
  };

  return (
    <>
      {!mobileOpen && (
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Open sidebar"
          aria-expanded={false}
          className={`${TOGGLE_TAB_CLASS} flex h-10 w-10 sm:hidden`}
        >
          <MenuIcon fontSize="small" />
        </button>
      )}

      {collapsed && (
        <div className="hidden w-0 flex-shrink-0 sm:block">
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label="Expand sidebar"
            aria-expanded={false}
            className={`${TOGGLE_TAB_CLASS} hidden h-7 w-7 sm:flex`}
          >
            <ChevronRightIcon fontSize="small" />
          </button>
        </div>
      )}

      {mobileOpen && (
        <button
          type="button"
          aria-label="Dismiss sidebar"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 sm:hidden"
        />
      )}

      <div
        className={[
          'flex-shrink-0',
          mobileOpen ? 'fixed inset-y-0 left-0 z-50' : 'hidden',
          collapsed ? 'sm:hidden' : 'sm:relative sm:block',
        ].join(' ')}
        style={{ width }}
      >
        <aside
          style={{ backgroundColor: '#dbdbdbff', width }}
          className="relative h-full min-h-screen overflow-y-auto overflow-x-hidden p-6 shadow-xl sm:shadow-none dark:bg-gray-800"
        >
          <div className="mb-3 flex items-center justify-end">
            {mobileOpen && (
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Close sidebar"
                className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-gray-200 sm:hidden"
              >
                <ChevronLeftIcon fontSize="small" />
              </button>
            )}
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label="Collapse sidebar"
              aria-expanded={true}
              className="hidden h-7 w-7 items-center justify-center rounded-md hover:bg-gray-200 sm:flex"
            >
              <ChevronLeftIcon fontSize="small" />
            </button>
          </div>

          <nav aria-label="Sidebar" className="flex flex-col gap-[6px]">
            <NavLink item={HOME_ITEM} active={pathName === HOME_ITEM.href} />

            {NAV_SECTIONS.map((section) => {
              const isOpen = openSections[section.id];
              const panelId = `sidebar-section-${section.id}`;
              return (
                <div key={section.id} className="mt-2 flex flex-col gap-[6px] border-t border-black/10 pt-2">
                  <button
                    type="button"
                    onClick={() => toggleSection(section.id)}
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    className="flex w-full appearance-none items-center justify-between border-0 bg-transparent px-2 py-0.5 text-left text-[11px] font-semibold tracking-[0.06em] text-neutral-800 hover:text-black"
                  >
                    {section.label}
                    <ExpandMoreIcon
                      fontSize="inherit"
                      className={`text-[16px] text-neutral-600 transition-transform ${isOpen ? '' : '-rotate-90'}`}
                    />
                  </button>
                  {isOpen && (
                    <div id={panelId} className="flex flex-col gap-[6px]">
                      {section.items.map((item) => (
                        <NavLink key={item.href} item={item} active={pathName === item.href} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          <div
            className="absolute top-0 right-0 z-10 hidden h-full w-1.5 cursor-ew-resize hover:bg-blue-400/40 active:bg-blue-500/50 sm:block"
            onMouseDown={(e) => {
              widthDragRef.current = { startX: e.clientX, startWidth: width };
              e.preventDefault();
            }}
            onTouchStart={(e) => {
              widthDragRef.current = { startX: e.touches[0].clientX, startWidth: width };
            }}
          />
        </aside>
      </div>
    </>
  );
}
