'use client';

import dynamic from 'next/dynamic';
import Image from "next/image";
import Link from 'next/link';
import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import Sidebar from '../components/Sidebar';
import { useModel } from '../contexts/ModelContext';

// Dynamically import Plot from plotly.js-dist-min
const Plot = dynamic(() => import('react-plotly.js'), { ssr: false });

// TODO: don't re-make this interface in every page; pull it out into some other place and then import it in each of your pages.
interface PlotDataType {
    data: any[];
    layout: any;
}

const ScatterPlotsPage = () => {
  const { selectedModel } = useModel();
  const [plotData, setPlotData] = useState<PlotDataType | null>(null);
  const [variableOptions, setVariableOptions] = useState<{ value: string; label: string }[]>([]);
  const [selectedVariables, setSelectedVariables] = useState<string[]>(["Variable 1", "Variable 2"]);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    const fetchVariableOptions = async () => {
      if (selectedModel) {
        try {
          // const response = await fetch(`http://localhost:8000/api/variable-options/${selectedModel}`);
          const response = await fetch(`./api/variable-options/${selectedModel}`);
          const data = await response.json();
          const options = data.variable_options.map((option: string) => ({ value: option, label: option }));
          setVariableOptions(options);

          if (options.length >= 2) {
            setSelectedVariables([options[0].value, options[1].value]);
          }
        } catch (error) {
          console.error('Error fetching variable options:', error);
        }
      }
    };

    fetchVariableOptions();
  }, [selectedModel]);
 
  
  useEffect(() => {
    if (selectedVariables.length === 0) {
      setError("At least one variable must be selected.");
    } else if (selectedVariables.length > 3) {
      setError("Too many variables selected. Only 1 to 3 selected variables are allowed.");
    } else {
      setError(""); // Clear error if valid
    }
  }, [selectedVariables]);


  useEffect(() => {
    async function fetchScatterPlotData() {
      try {
        const response = await fetch(
          `./api/scatter-plots/${selectedModel}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ selected_variables: selectedVariables }), // Send as JSON
          }
        );

        const data = await response.json();
        setPlotData(data.plot_data);
      } catch (error) {
        console.error('Error fetching scatter plot data:', error);
      }
    };

    if (selectedVariables.length > 0 && selectedVariables.length <= 3) {
      fetchScatterPlotData();
    }
  }, [selectedModel, selectedVariables]);


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
