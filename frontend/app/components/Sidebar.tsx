'use client';

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function Sidebar() {
  const pathName = usePathname()

  return (
    // TODO: add all the other pages from dash-ml-dashboard
    <aside className="w-64 bg-gray-100 dark:bg-gray-800 p-6 hidden sm:block">
      <nav className="flex flex-col gap-[6px]">
        <Link 
          href="/"
          className={`flex items-center gap-2 p-1 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-[14.5px]
            ${pathName === '/' ? 'bg-black text-white' : ''}`}
        >
          Home
        </Link>
        <Link 
          href="/overview"
          className={`flex items-center gap-2 p-1 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-[14.5px]
            ${pathName === '/overview' ? 'bg-black text-white' : ''}`}
        >
          Overview
        </Link>
        <Link 
          href="/correlation-heatmaps"
          className={`flex items-center gap-2 p-1 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-[14.5px]
            ${pathName === '/correlation-heatmaps' ? 'bg-black text-white' : ''}`}
        >
          Correlation Heatmaps
        </Link>
      </nav>
    </aside>
  )
}
