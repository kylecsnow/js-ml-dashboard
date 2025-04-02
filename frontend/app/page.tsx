'use client';

import Image from "next/image";
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useModel } from './contexts/ModelContext';


export default function Home() {
  const [models, setModels] = useState<string[]>([]);
  const { selectedModel, setSelectedModel } = useModel();

  useEffect(() => {
    async function fetchModels() {
      try {
        // const response = await fetch('http://localhost:8000/api/models');
        const response = await fetch('./api/models');
        const data = await response.json();
        setModels(data.models);
        if (data.models.length > 0 && !selectedModel && !localStorage.getItem('selectedModel')) {
          setSelectedModel(data.models[0]);
        }
      } catch (error) {
        console.error('Error fetching models:', error);
      }
    }

    fetchModels();
  // }, []);
  }, [selectedModel, setSelectedModel]); // this is like the inputs of a callback from Plotly Dash; the effect only activates if one of these dependencies changes


  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <main className="flex flex-col gap-8 row-start-2 items-center sm:items-start">
        <h1>Kyle's ML Dashboard</h1>
        <ol className="list-inside list-decimal text-sm text-center sm:text-left font-[family-name:var(--font-geist-mono)]">
          <li>Select a model...</li>
          <li>Click Analyze!</li>
        </ol>

        <div className="flex gap-4 items-center flex-col sm:flex-row">
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          >
            <option value="">Select a model</option>
            {models.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </select>
          <Link
            className="rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-foreground text-background gap-2 hover:bg-[#383838] dark:hover:bg-[#ccc] text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5"
            href="/overview"
          >
            <Image
              className="dark:invert"
              src="/snowflake.svg"
              alt="My snowflake logomark"
              width={20}
              height={20}
            />
            Analyze
          </Link>
        </div>
      </main>
      <footer className="row-start-3 flex gap-6 flex-wrap items-center justify-center">
      </footer>
    </div>
  );
}
