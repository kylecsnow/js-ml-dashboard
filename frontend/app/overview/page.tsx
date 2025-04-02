'use client';

import Image from 'next/image';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { PlotDataType } from '@/types/types';
import Sidebar from '../components/Sidebar';
import Spinner from '../components/Spinner';
import { useEffect, useState } from 'react';
import { useModel } from '../contexts/ModelContext';

const Plot = dynamic(() => import('react-plotly.js'), { ssr: false });

interface ModelOverviewData {
  dataset_name: string;
  model_outputs: string[];
  estimators_by_output: {
    [key: string]: {
      inputs_reals: string[];
      estimator_type: string;
      parity_plot_data: PlotDataType;
      residual_plot_data: PlotDataType;
    };
  };
}

export default function Overview() {
  const { selectedModel } = useModel();
  const [modelOverviewData, setModelOverviewData] = useState<ModelOverviewData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchModelOverview = async () => {
      if (selectedModel) {
        try {
          setIsLoading(true);
          const response = await fetch(`./api/overview/${selectedModel}`);
          const data = await response.json();


          console.log(data)
          
          
          setModelOverviewData(data);
        } catch (error) {
          console.error('Error fetching model overview:', error);
        } finally {
          setIsLoading(false);
        }
      }
    };

    fetchModelOverview();
  }, [selectedModel]);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      
      <div className="flex-1 flex flex-col items-center p-8 gap-4">
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
        <div className="flex-1 grid grid-rows-[20px_1fr_20px] items-center justify-items-center p-8 pb-20 gap-16 sm:p-20">
          <div>
            <h3>TODOs:</h3>
              <ol className="list-decimal ml-6">
                <li>Fix console errors upon loading page</li>
                <li>Show residual plots...?</li>
              </ol>
          </div>
          <div>
            {selectedModel && modelOverviewData ? (
              <>
                <h3>Training dataset: {modelOverviewData.dataset_name}</h3>
                <h3>Model types:</h3>
                {modelOverviewData.model_outputs.map(output => (
                  <p key={output}>
                    - {output}: {modelOverviewData.estimators_by_output[output].estimator_type}
                  </p>
                ))}
                {isLoading ? (
                  <Spinner />
                ) : (
                  modelOverviewData.model_outputs.map(output => (
                    <Plot
                      key={output}
                      data={modelOverviewData.estimators_by_output[output].parity_plot_data.data}
                      layout={modelOverviewData.estimators_by_output[output].parity_plot_data.layout}
                      config={{ responsive: true }}
                      style={{ width: '100%', height: '600px' }}
                    />
                  ))
                )}
              </>
            ) : (
              'No model selected'
            )}
          </div>
        </div>
      </div>
    </div>
  );
}