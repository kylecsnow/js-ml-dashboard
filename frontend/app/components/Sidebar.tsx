'use client';

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import SidebarTooltip from './SidebarTooltip'

export default function Sidebar() {
  const pathName = usePathname()

  return (
    // TODO: add all the other pages from dash-ml-dashboard
    <aside style={{ backgroundColor: '#dbdbdbff' }} className="w-64 dark:bg-gray-800 p-6 hidden sm:block">
      <nav className="flex flex-col gap-[6px]">
        <Link 
          href="/"
          className={`flex items-center gap-2 p-1 pl-2 rounded-lg 
            ${pathName === '/' ? 'bg-black text-white' : 'hover:bg-gray-200'} text-[14.5px]`}
        >
          Home
          <SidebarTooltip title="Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua." />
        </Link>
        <Link 
          href="/overview"
          className={`flex items-center gap-2 p-1 pl-2 rounded-lg 
            ${pathName === '/overview' ? 'bg-black text-white' : 'hover:bg-gray-200'} text-[14.5px]`}
        >
          Overview
          <SidebarTooltip title="View model performance metrics and summary statistics" />
        </Link>
        <Link 
          href="/violin-plots"
          className={`flex items-center gap-2 p-1 pl-2 rounded-lg 
            ${pathName === '/violin-plots' ? 'bg-black text-white' : 'hover:bg-gray-200'} text-[14.5px]`}
        >
          Violin Plots
          <SidebarTooltip title="Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua." />
        </Link>
        <Link 
          href="/scatter-plots"
          className={`flex items-center gap-2 p-1 pl-2 rounded-lg 
            ${pathName === '/scatter-plots' ? 'bg-black text-white' : 'hover:bg-gray-200'} text-[14.5px]`}
        >
          Scatter Plots
          <SidebarTooltip title="Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua." />
        </Link>
        <Link
          href="/correlation-heatmaps"
          className={`flex items-center gap-2 p-1 pl-2 rounded-lg 
            ${pathName === '/correlation-heatmaps' ? 'bg-black text-white' : 'hover:bg-gray-200'} text-[14.5px]`}
        >
          Correlation Heatmaps
          <SidebarTooltip title="Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua." />
        </Link>
        <Link
          href="/shap-summary-plots"
          className={`flex items-center gap-2 p-1 pl-2 rounded-lg 
            ${pathName === '/shap-summary-plots' ? 'bg-black text-white' : 'hover:bg-gray-200'} text-[14.5px]`}
        >
          SHAP Summary Plots
          <SidebarTooltip title="Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua." />
        </Link>
        {/* <Link
          href="/shap-feature-effects-plots"
          className={`flex items-center gap-2 p-1 pl-2 rounded-lg 
            ${pathName === '/shap-feature-effects-plots' ? 'bg-black text-white' : 'hover:bg-gray-200'} text-[14.5px]`}
        >
            
          SHAP Feature Effects Plots
        </Link> */}
        <Link
          href="/shap-waterfall-plots"
          className={`flex items-center gap-2 p-1 pl-2 rounded-lg 
            ${pathName === '/shap-waterfall-plots' ? 'bg-black text-white' : 'hover:bg-gray-200'} text-[14.5px]`}
        >
          SHAP Waterfall Plots
          <SidebarTooltip title="Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua." />
        </Link>
        <Link
          href="/molecular-design"
          className={`flex items-center gap-2 p-1 pl-2 rounded-lg 
            ${pathName === '/molecular-design' ? 'bg-black text-white' : 'hover:bg-gray-200'} text-[14.5px]`}
        >
          Molecular Design
          <SidebarTooltip title="Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua." />
        </Link>
        <Link
          href="/dataset-generator"
          className={`flex items-center gap-2 p-1 pl-2 rounded-lg 
            ${pathName === '/dataset-generator' ? 'bg-black text-white' : 'hover:bg-gray-200'} text-[14.5px]`}
        >
          Dataset Generator
          <SidebarTooltip title="Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua." />
        </Link>
        <Link
          href="/object-detection"
          className={`flex items-center gap-2 p-1 pl-2 rounded-lg 
            ${pathName === '/object-detection' ? 'bg-black text-white' : 'hover:bg-gray-200'} text-[14.5px]`}
        >
          Object Detection
          <SidebarTooltip title="Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua." />
        </Link>
      </nav>
    </aside>
  )
}
