import Image from "next/image";
import Link from 'next/link'  // Add this import at the top

export default function Overview() {
    return (
      // Replace the outer div with a sidebar layout
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside className="w-64 bg-gray-100 dark:bg-gray-800 p-6 hidden sm:block">
          <nav className="flex flex-col gap-4">
            <Link 
              href="/"
              className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700"
            >
              <Image
                src="https://nextjs.org/icons/next.svg"
                alt="Home"
                width={20}
                height={20}
                className="dark:invert"
              />
              Home
            </Link>
            <Link 
              href="/correlation-heatmaps"
              className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700"
            >
              <Image
                src="/snowflake.svg"
                alt="Correlation Heatmaps"
                width={20}
                height={20}
                className="dark:invert"
              />
              Correlation Heatmaps
            </Link>
            {/* Placeholder for future links */}
            {/* You can add more Link components here as you create new pages */}
          </nav>
        </aside>
  
        {/* Main content */}
        <div className="flex-1 grid grid-rows-[20px_1fr_20px] items-center justify-items-center p-8 pb-20 gap-16 sm:p-20">
          // ... existing main content and footer ...
        </div>
      </div>
    );
  }