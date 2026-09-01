'use client';

import Image from "next/image";
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useModel } from './contexts/ModelContext';
import AsciiFlowBackground from './components/AsciiFlowBackground';

const DEFAULT_MODEL = 'pharma-tablets_RF';

const CARD_CLASS =
  'flex h-full min-w-0 w-full flex-col items-start gap-6 overflow-hidden rounded-3xl border border-white/80 bg-white/65 px-8 py-8 shadow-[0_24px_80px_rgba(87,102,129,0.12)] backdrop-blur-[3px]';

const BUTTON_CLASS =
  'rounded-full border border-solid border-transparent transition-colors inline-flex items-center justify-center bg-foreground text-background gap-2 hover:bg-[#383838] dark:hover:bg-[#ccc] text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 shrink-0';

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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_20%_15%,#ffffff_0%,#f7f9fb_43%,#eff1f5_100%)] p-6 sm:p-10 font-[family-name:var(--font-geist-sans)]">
      <AsciiFlowBackground />
      <main className="relative z-10 grid w-full max-w-6xl grid-cols-1 gap-6 md:grid-cols-[repeat(3,minmax(0,1fr))]">
        <section className={CARD_CLASS}>
          <div className="space-y-2">
            <p className="font-[family-name:var(--font-geist-mono)] text-xs uppercase tracking-[0.22em] text-slate-500">Kyle&apos;s Background / Bio</p>
            <h2 className="text-3xl font-semibold tracking-tight text-slate-800">About Me</h2>
            <p className="text-sm font-[family-name:var(--font-geist-mono)]">Coming soon...</p>
          </div>
        </section>

        <section className={CARD_CLASS}>
          <div className="space-y-2">
            <p className="font-[family-name:var(--font-geist-mono)] text-xs uppercase tracking-[0.22em] text-slate-500">Model workbench</p>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-800">Kyle&apos;s AI/ML Dashboard</h1>
          </div>
          <ol className="list-inside list-decimal text-sm font-[family-name:var(--font-geist-mono)]">
            <li>Select a model...</li>
            <li>Click Analyze!</li>
          </ol>

          <div className="mt-auto flex w-full min-w-0 flex-col items-start gap-3">
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full min-w-0 rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a model</option>
              {models.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
            <Link className={BUTTON_CLASS} href="/overview">
              <Image
                src="/snowflake.svg"
                alt="My snowflake logomark"
                width={20}
                height={20}
              />
              Analyze
            </Link>
          </div>
        </section>

        <section className={CARD_CLASS}>
          <div className="space-y-2">
            <p className="font-[family-name:var(--font-geist-mono)] text-xs uppercase tracking-[0.22em] text-slate-500">Bonus</p>
            <h2 className="text-3xl font-semibold tracking-tight text-slate-800">More Capabilities</h2>
          </div>
          <ol className="list-inside list-decimal text-sm font-[family-name:var(--font-geist-mono)]">
            <li>Agentic AI powered synthetic data generator</li>
            <li>Computer Vision (blood cell detection)</li>
            <li>Molecular Space Mapping</li>
          </ol>

          <div className="mt-auto">
            <Link className={BUTTON_CLASS} href="/dataset-generator">
              <Image
                src="/snowflake.svg"
                alt="My snowflake logomark"
                width={20}
                height={20}
              />
              Open
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
