'use client';

import Image from 'next/image';
import Link from 'next/link';
import Sidebar from '../components/Sidebar';
import { useEffect } from 'react';
import { useModel } from '../contexts/ModelContext';


export default function Overview() {

  const { selectedModel } = useModel();

  // useEffect(() => {

  // }, [selectedModel]);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      
      <div className="flex-1 flex flex-col items-center p-8 gap-8">
        <div className="flex gap-4 items-center flex-col sm:flex-row">
          <Link
            className="rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-foreground text-background gap-2 hover:bg-[#383838] dark:hover:bg-[#ccc] text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5"
            href="./"
          >
            <Image
              className="dark:invert"
              src="/snowflake.svg"
              alt="My snowflake logomark"
              width={20}
              height={20}
            />
            Home
          </Link>

        </div>
        <div>
          <h2>
            {selectedModel 
              ? `Selected model: ${selectedModel}`
              : 'No model selected'
            }
          </h2>
        </div>

        {/* Main content */}
        <div className="flex-1 grid grid-rows-[20px_1fr_20px] items-center justify-items-center p-8 pb-20 gap-16 sm:p-20">
          <h1>Under Construction...</h1>
          <p>TODO: Show model metrics...?</p>
        </div>
      </div>
    </div>
  );
}