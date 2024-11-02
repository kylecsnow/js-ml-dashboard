import Link from 'next/link'

export default function Sidebar() {
  return (
    <aside className="w-64 bg-gray-100 dark:bg-gray-800 p-6 hidden sm:block">
      <nav className="flex flex-col gap-4">
        <Link 
          href="/"
          className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700"
        >
          Home
        </Link>
        <Link 
          href="/overview"
          className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700"
        >
          Overview
        </Link>
        <Link 
          href="/correlation-heatmaps"
          className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700"
        >
          Correlation Heatmaps
        </Link>
      </nav>
    </aside>
  )
}
