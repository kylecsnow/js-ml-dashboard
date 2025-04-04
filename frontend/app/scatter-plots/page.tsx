'use client';

import dynamic from 'next/dynamic';
import Image from "next/image";
import Link from 'next/link';
import { PlotDataType } from '@/types/types';
import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import Sidebar from '../components/Sidebar';
import { useModel } from '../contexts/ModelContext';

// Dynamically import Plot from plotly.js-dist-min
const Plot = dynamic(() => import('react-plotly.js'), { ssr: false });


const ScatterPlotsPage = () => {
  const { selectedModel } = useModel();
  const [plotData, setPlotData] = useState<PlotDataType | null>(null);
  const [variableOptions, setVariableOptions] = useState<{ value: string; label: string }[]>([]);
  const [selectedVariables, setSelectedVariables] = useState<string[]>(["Variable 1", "Variable 2"]);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    async function initializeAndFetchData() {
      if (!selectedModel) {
        return;
      }

      try {
        // First fetch the variable options
        const response = await fetch(`./api/variable-options/${selectedModel}`);
        const data = await response.json();
        const options = data.variable_options.map((option: string) => ({ value: option, label: option }));
        setVariableOptions(options);

        // TODO: may need to check if this couldn't cause inadvertent problems with simpler models, using less inputs...
        // Set initial variables only once
        if (options.length >= 2) {
          const initialVariables = [options[0].value, options[1].value];
          setSelectedVariables(initialVariables);

          // Only fetch plot data after we have valid variables
          const plotResponse = await fetch(
            `./api/scatter-plots/${selectedModel}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ selected_variables: initialVariables }),
            }
          );

          if (!plotResponse.ok) {
            throw new Error(`HTTP error! status: ${plotResponse.status}`);
          }

          const plotData = await plotResponse.json();
          setPlotData(plotData.plot_data);
        }
      } catch (error) {
        console.error('Error initializing data:', error);
        setError(error instanceof Error ? error.message : 'Failed to initialize data');
      }
    }

    initializeAndFetchData();
  }, [selectedModel]);

  useEffect(() => {
    async function fetchScatterPlotData() {
      if (!selectedModel || !selectedVariables || selectedVariables.length === 0) {
        return;
      }

      if (selectedVariables.length > 3) {
        setError("Too many variables selected. Only 1 to 3 selected variables are allowed.");
        return;
      }

      try {
        const response = await fetch(
          `./api/scatter-plots/${selectedModel}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ selected_variables: selectedVariables }),
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        setPlotData(data.plot_data);
        setError(""); // Clear any existing errors
      } catch (error) {
        console.error('Error fetching scatter plot data:', error);
        setError(error instanceof Error ? error.message : 'Failed to fetch plot data');
      }
    }

    // Only fetch if this isn't the initial render with default variables
    if (selectedVariables[0] !== "Variable 1") {
      fetchScatterPlotData();
    }
  }, [selectedModel, selectedVariables]);


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
          <Select
            isMulti
            options={variableOptions}
            onChange={(selected) => setSelectedVariables(selected.map(option => option.value))}
            value={variableOptions.filter(option => selectedVariables.includes(option.value))}
            name="selected-variables"
            className="basic-multi-select"
            classNamePrefix="select"
            styles={{ control: (base) => ({ ...base, width: '600px' }) }}
          />
        </div>
        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}
        <div
          className={`w-full max-w-5xl`}
          style={selectedVariables.length >= 3 ? {
            border: '2px solid #80888f',
            borderRadius: '8px',
            boxSizing: 'border-box',
            padding: '2px',
            paddingRight: '10px',
          } : {}}
        >
          {plotData && (
            <Plot
              data={plotData.data}
              layout={plotData.layout}
              config={{ responsive: true }}
              style={{ width: '99%', height: '600px' }}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default ScatterPlotsPage;
