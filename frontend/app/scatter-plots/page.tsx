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
  const [isDropdownOpen, setIsDropdownOpen] = useState(false); // State to manage dropdown visibility
  const [selectedVariables, setSelectedVariables] = useState<string[]>([]);
  const [plotData, setPlotData] = useState<PlotDataType | null>(null);


  const variableOptions = [
    { value: 'option1', label: 'Option 1' },
    { value: 'option2', label: 'Option 2' },
    { value: 'option3', label: 'Option 3' },
    { value: 'option4', label: 'Option 4' },
  ];

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  const handleCheckboxChange = (value: string) => {
      setSelectedVariables(prev =>
          prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
      );
  };
    

    // TODO: finish this block of code, which should call the backend API...


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

          {/* TODO: add a multi-select drop down here for multiple inputs...*/}

          {/* <select
          value={selectedVariables}
            onChange={(e) => setSelectedVariables(e.target.value)}
            className="px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          >
            <option value="input-input">Option 1</option>
            <option value="input-output">Option 2</option>
          </select> */}

          <div className="relative">
            {/* <button onClick={toggleDropdown} className="px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white">
              Select Variables
            </button>
            {isDropdownOpen && (
              <div className="absolute z-10 bg-white border border-gray-300 rounded-lg shadow-lg mt-1">
                {variableOptions.map(option => (
                  <label key={option.value} className="flex items-center p-2">
                    <input
                      type="checkbox"
                      checked={selectedVariables.includes(option.value)}
                      onChange={() => handleCheckboxChange(option.value)}
                      className="mr-2"
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            )} */}
            <Select
              defaultValue={[variableOptions[0], variableOptions[1]]}
              isMulti
              name="selected-variables"
              options={variableOptions}
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
  )
}

export default ScatterPlotsPage
