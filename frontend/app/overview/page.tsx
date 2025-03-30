'use client';

import Image from 'next/image';
import Link from 'next/link';
import Sidebar from '../components/Sidebar';
import { useEffect, useState } from 'react';
import { useModel } from '../contexts/ModelContext';

interface ModelOverviewData {
  dataset_name: string;
  model_outputs: string[];
  estimators_by_output: {
    [key: string]: {
      inputs_reals: string[];
      estimator_type: string;
    };
  };
}

export default function Overview() {
  const { selectedModel } = useModel();
  const [modelOverviewData, setModelOverviewData] = useState<ModelOverviewData | null>(null);

  useEffect(() => {
    const fetchModelOverview = async () => {
      if (selectedModel) {
        try {
          const response = await fetch(`./api/overview/${selectedModel}`);
          const data = await response.json();
          setModelOverviewData(data);
        } catch (error) {
        console.error('Error fetching model overview:', error);
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
                <li>Show model performance metrics...?</li>
                <li>Show parity plots</li>
              </ol>
          </div>
          <div>
            {selectedModel && modelOverviewData
              ? <p>Training dataset: {modelOverviewData.dataset_name}</p>
              : 'No model selected'
            }
            {selectedModel && modelOverviewData
              ? modelOverviewData.model_outputs.map(output => (
                  <p key={output}>
                    Model type for {output}: {modelOverviewData.estimators_by_output[output].estimator_type}
                  </p>
                ))
              : 'No model selected'
            }
          </div>
        </div>
      </div>
    </div>
  );
}