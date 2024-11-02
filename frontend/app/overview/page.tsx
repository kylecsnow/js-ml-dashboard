import Link from 'next/link'  // Add this import at the top
import Sidebar from '../components/Sidebar';

export default function Overview() {
    return (
      // Replace the outer div with a sidebar layout
      <div className="flex min-h-screen">
        <Sidebar></Sidebar>  
        {/* Main content */}
        <div className="flex-1 grid grid-rows-[20px_1fr_20px] items-center justify-items-center p-8 pb-20 gap-16 sm:p-20">
          // ... existing main content and footer ...
        </div>
      </div>
    );
  }