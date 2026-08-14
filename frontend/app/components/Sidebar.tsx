'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import SidebarTooltip from './SidebarTooltip';

const MIN_SIDEBAR_WIDTH = 180;
const DEFAULT_SIDEBAR_WIDTH = 256;
const MAX_SIDEBAR_WIDTH = 480;

const NAV_ITEMS = [
  {
    href: '/',
    label: 'Home',
    tooltip: 'Return to the home page, where you can select a different model to analyze.',
  },
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
] as const;

export default function Sidebar() {
  const pathName = usePathname();
  const [width, setWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [collapsed, setCollapsed] = useState(false);
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
  }, []);

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

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('sidebarCollapsed', String(next));
      return next;
    });
  };

  if (collapsed) {
    return (
      <div className="hidden sm:block flex-shrink-0 w-0">
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label="Expand sidebar"
          aria-expanded={false}
          className="fixed left-0 top-6 z-40 flex h-7 w-7 items-center justify-center rounded-r-md border border-l-0 border-gray-300 bg-[#dbdbdb] shadow-md hover:bg-gray-200"
        >
          <ChevronRightIcon fontSize="small" />
        </button>
      </div>
    );
  }

  return (
    <div
      className="relative hidden sm:block flex-shrink-0"
      style={{ width }}
    >
      <aside
        style={{ backgroundColor: '#dbdbdbff', width }}
        className="relative h-full min-h-screen overflow-hidden p-6 dark:bg-gray-800"
      >
        <div className="mb-3 flex items-center justify-end">
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label="Collapse sidebar"
            aria-expanded={true}
            className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-gray-200"
          >
            <ChevronLeftIcon fontSize="small" />
          </button>
        </div>

        <nav className="flex flex-col gap-[6px]">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 rounded-lg p-1 pl-2 text-[14.5px] ${
                pathName === item.href ? 'bg-black text-white' : 'hover:bg-gray-200'
              }`}
            >
              {item.label}
              <SidebarTooltip title={item.tooltip} />
            </Link>
          ))}
        </nav>

        <div
          className="absolute top-0 right-0 z-10 h-full w-1.5 cursor-ew-resize hover:bg-blue-400/40 active:bg-blue-500/50"
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
  );
}
