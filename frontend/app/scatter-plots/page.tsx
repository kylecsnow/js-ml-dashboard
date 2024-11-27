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
  const [selectedVariables, setSelectedVariables] = useState<string[]>([]);

  useEffect(() => {
    const fetchVariableOptions = async () => {
      if (selectedModel) {
        try {
          const response = await fetch(`http://localhost:8000/api/variable-options/${selectedModel}`);
          const data = await response.json();
          const options = data.variable_options.map((option: string) => ({ value: option, label: option }));
          setVariableOptions(options);

          // Set the first two options as selected by default
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

    // const fetchScatterPlotData = async () => {
    async function fetchScatterPlotData() {
      try {
        const response = await fetch(
          `http://localhost:8000/api/scatter-plots/${selectedModel}`, {
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

    fetchScatterPlotData();
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

          {/* TODO: figure out how to put a border around the plot area if a 3D scatter plot is chosen...*/}
          <div className="relative">
            <Select
              isMulti
              options={variableOptions}
              onChange={(selected) => setSelectedVariables(selected.map(option => option.value))}
              value={variableOptions.filter(option => selectedVariables.includes(option.value))} // Set selected values
              name="selected-variables"
              className="basic-multi-select"
              classNamePrefix="select"
            />
          </div>
        </div>
        <div>
          <h2>
            {selectedModel 
              ? `Selected model: ${selectedModel}`
              : 'No model selected'
            }
          </h2>
        </div>
        <div>
          <h1>Under construction...</h1>
          <p>(TODOs: make the dropdown bar a constant width; needs a border when 3D scatterplot is shown; also needs to show errors if `selectedVariables.length` is not 2 or 3.)</p>
        </div>
        <div className="w-full max-w-4xl">
          {plotData && (
            <Plot
              data={plotData.data}
              layout={plotData.layout}
              config={{ responsive: true }}
              style={{ width: '100%', height: '600px' }}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default ScatterPlotsPage;
