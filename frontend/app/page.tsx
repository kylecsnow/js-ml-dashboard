'use client';

import Image from "next/image";
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useModel } from './contexts/ModelContext';
import AsciiFlowBackground from './components/AsciiFlowBackground';

const DEFAULT_MODEL = 'pharma-tablets_RF';

export default function Home() {
  const [models, setModels] = useState<string[]>([]);
  const { selectedModel, setSelectedModel } = useModel();

  useEffect(() => {
    async function fetchModels() {
      try {
        const response = await fetch('./api/models');
        const data = await response.json();
        setModels(data.models);
        if (data.models.length > 0 && !selectedModel && !localStorage.getItem('selectedModel')) {
          const defaultModel = data.models.includes(DEFAULT_MODEL)
            ? DEFAULT_MODEL
            : data.models[0];
          setSelectedModel(defaultModel);
        }
      } catch (error) {
        console.error('Error fetching models:', error);
      }
    }

    fetchModels();
  }, [selectedModel, setSelectedModel]); // this is like the inputs of a callback from Plotly Dash; the effect only activates if one of these dependencies changes


  return (
    <div className="relative grid min-h-screen grid-rows-[20px_1fr_20px] items-center justify-items-center overflow-hidden bg-[radial-gradient(circle_at_20%_15%,#ffffff_0%,#f7f9fb_43%,#eff1f5_100%)] p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <AsciiFlowBackground />
      <main className="relative z-10 row-start-2 flex flex-col items-center gap-8 rounded-3xl border border-white/80 bg-white/65 px-9 py-10 shadow-[0_24px_80px_rgba(87,102,129,0.12)] backdrop-blur-[3px] sm:items-start sm:px-12">
        <div className="space-y-2">
          <p className="font-[family-name:var(--font-geist-mono)] text-xs uppercase tracking-[0.22em] text-slate-500">Model workbench</p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-800 sm:text-4xl">Kyle&apos;s AI/ML Dashboard</h1>
        </div>
        <ol className="list-inside list-decimal text-sm text-center sm:text-left font-[family-name:var(--font-geist-mono)]">
          <li>Select a model...</li>
          <li>Click Analyze!</li>
        </ol>

        <div className="flex gap-4 items-center flex-col sm:flex-row">
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              src="/snowflake.svg"
              alt="My snowflake logomark"
              width={20}
              height={20}
            />
            Analyze
          </Link>
        </div>
      </main>
      <footer className="relative z-10 row-start-3 flex gap-6 flex-wrap items-center justify-center">
      </footer>
    </div>
  );
}
