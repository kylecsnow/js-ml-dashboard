'use client';

import React, { useState } from 'react';
import Image from "next/image";
import Link from 'next/link';
import Sidebar from '../components/Sidebar';

const CorrelationHeatmapsPage = () => {
  const [selectedDataset, setSelectedDataset] = useState('dataset1');

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      
      {/* Main content */}
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

          <select
            value={selectedDataset}
            onChange={(e) => setSelectedDataset(e.target.value)}
            className="px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          >
            <option value="Input-Input Correlations">Input-Input Correlations</option>
            <option value="Input-Output Correlations">Input-Output Correlations</option>
            <option value="Output-Output Correlations">Output-Output Correlations</option>
          </select>
        </div>
        <div>
          <h1>Under construction...</h1>
        </div>
      </div>
    </div>
  )
}

export default CorrelationHeatmapsPage
