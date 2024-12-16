'use client';

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function Sidebar() {
  const pathName = usePathname()

  return (
    // TODO: add all the other pages from dash-ml-dashboard
    <aside style={{ backgroundColor: '#dbdbdbff' }} className="w-64 dark:bg-gray-800 p-6 hidden sm:block">
      <nav className="flex flex-col gap-[6px]">
        <Link 
          href="/"
          className={`flex items-center gap-2 p-1 pl-2 rounded-lg 
            ${pathName === '/' ? 'bg-black text-white' : 'hover:bg-gray-200 dark:hover:bg-gray-700'} text-[14.5px}`}
        >
          Home
        </Link>
        <Link 
          href="/overview"
          className={`flex items-center gap-2 p-1 pl-2 rounded-lg 
            ${pathName === '/overview' ? 'bg-black text-white' : 'hover:bg-gray-200 dark:hover:bg-gray-700'} text-[14.5px}`}
        >
          Overview
        </Link>
        <Link 
          href="/violin-plots"
          className={`flex items-center gap-2 p-1 pl-2 rounded-lg 
            ${pathName === '/violin-plots' ? 'bg-black text-white' : 'hover:bg-gray-200 dark:hover:bg-gray-700'} text-[14.5px}`}
        >
          Violin Plots
        </Link>
        <Link 
          href="/scatter-plots"
          className={`flex items-center gap-2 p-1 pl-2 rounded-lg 
            ${pathName === '/scatter-plots' ? 'bg-black text-white' : 'hover:bg-gray-200 dark:hover:bg-gray-700'} text-[14.5px}`}
        >
          Scatter Plots
        </Link>
        <Link
          href="/correlation-heatmaps"
          className={`flex items-center gap-2 p-1 pl-2 rounded-lg 
            ${pathName === '/correlation-heatmaps' ? 'bg-black text-white' : 'hover:bg-gray-200 dark:hover:bg-gray-700'} text-[14.5px}`}
        >
          Correlation Heatmaps
        </Link>
        <Link
          href="/shap-summary-plots"
          className={`flex items-center gap-2 p-1 pl-2 rounded-lg 
            ${pathName === '/shap-summary-plots' ? 'bg-black text-white' : 'hover:bg-gray-200 dark:hover:bg-gray-700'} text-[14.5px}`}
        >
          SHAP Summary Plots
        </Link>
      </nav>
    </aside>
  )
}
