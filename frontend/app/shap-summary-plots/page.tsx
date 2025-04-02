'use client';

import dynamic from 'next/dynamic';
import Image from "next/image";
import Link from 'next/link';
import { PlotDataType } from '@/types/types';
import Select from 'react-select';
import Sidebar from '../components/Sidebar';
import Spinner from '../components/Spinner';
import { useState, useEffect } from 'react';
import { useModel } from '../contexts/ModelContext';

const Plot = dynamic(() => import('react-plotly.js'), { ssr: false });


const ShapSummaryPlotsPage = () => {
  const { selectedModel } = useModel();
  const [plotData, setPlotData] = useState<PlotDataType | null>(null);
  const [outputVariableOptions, setOutputVariableOptions] = useState<{ value: string; label: string }[]>([]);
  const [selectedOutputVariable, setSelectedOutputVariable] = useState<string>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>("");


  useEffect(() => {
    const fetchOutputVariableOptions = async () => {
      if (selectedModel) {
        try {
          setIsLoading(true);
          const response = await fetch(`./api/output-variable-options/${selectedModel}`);
          const data = await response.json();
          const options = data.output_variable_options.map((option: string) => ({ value: option, label: option }));
          setOutputVariableOptions(options);

          // Set the first option as selected by default
          if (options.length >= 1) {
            setSelectedOutputVariable(options[0].value);
          }
          setIsLoading(false);
        } catch (error) {
          console.error('Error fetching variable options:', error);
        }
      }
    };

    fetchOutputVariableOptions();
  }, [selectedModel]);

  
  useEffect(() => {
    async function fetchShapSummaryPlotData() {
      if (!selectedModel || !selectedOutputVariable) {
        return;
      }

      // Clear any existing error
      setError("");

      try {
        setIsLoading(true);
        const response = await fetch(
          `./api/shap-summary-plots/${selectedModel}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ selected_output: selectedOutputVariable }), // Send as JSON
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          if (response.status === 400) {
            setError(errorData.detail);
          } else if (response.status === 500) {
            setError("An error occurred. Please check that you are not selecting a categorical output. If you've verified that the selected output is numerical, this may be an internal server error.");
          } else {
            setError(errorData.detail || "An unexpected error occurred");
          }
          return;
        }  

        const data = await response.json();


        setPlotData(data.plot_data);
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching scatter plot data:', error);
      } 
    };

    fetchShapSummaryPlotData();
  }, [selectedModel, selectedOutputVariable]);


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
        <div className="relative">
        <label>{"Selected output variable:"}</label>
        <Select
            options={outputVariableOptions}
            onChange={(selected: { value: string; label: string } | null) => {
              if (selected) {
                setSelectedOutputVariable(selected.value);
              }
            }}
            value={outputVariableOptions.filter(option => selectedOutputVariable?.includes(option.value))}
            name="selected-variables"
            classNamePrefix="select"
          />
        </div>
        {/* <div>
          <h3>TODOs:</h3>
            <ol className="list-decimal ml-6">
              <li>get loading animation working... with less delay between it disappearing & the plot being shown?</li>
            </ol>
        </div> */}
        <div className="w-full max-w-8xl mx-auto">
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}
          {isLoading ? <Spinner /> : 
            plotData && (
              <Plot
                data={plotData.data}
                layout={plotData.layout}
                config={{ responsive: true }}
                style={{ width: '100%', height: '750px' }}
              />
          )}
        </div>
      </div>
    </div>
  );
};


export default ShapSummaryPlotsPage;
