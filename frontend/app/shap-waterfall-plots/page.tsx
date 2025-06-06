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


const ShapWaterfallPlotsPage = () => {
  const { selectedModel } = useModel();
  const [plotData, setPlotData] = useState<PlotDataType | null>(null);
  const [outputVariableOptions, setOutputVariableOptions] = useState<{ value: string; label: string }[]>([]);
  const [selectedOutputVariable, setSelectedOutputVariable] = useState<string>();
  const [sampleOptions, setSampleOptions] = useState<{ value: string; label: string }[]>([]);
  const [selectedSample, setSelectedSample] = useState<string[]>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>("");


  useEffect(() => {
    const fetchOutputVariableOptions = async () => {
      if (!selectedModel) {
        setIsLoading(false);
        return;
      }

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
        setIsLoading(false);
      }
    };

    fetchOutputVariableOptions();
  }, [selectedModel]);


  useEffect(() => {
    const fetchSampleOptions = async () => {
      if (!selectedModel) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const response = await fetch(`./api/sample-options/${selectedModel}`);
        const data = await response.json();
        const options = data.sample_options.map((option: string) => ({ value: option, label: option }));
        setSampleOptions(options);

        // Set the first option as selected by default
        if (options.length >= 1) {
          setSelectedSample([options[0].value]);
        }
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching variable options:', error);
        setIsLoading(false);
      }
    };

    fetchSampleOptions();
  }, [selectedModel, selectedOutputVariable]);
  

  useEffect(() => {
    async function fetchShapWaterfallPlotData() {
      if (!selectedModel || !selectedOutputVariable || !selectedSample) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const response = await fetch(
          `./api/shap-waterfall-plots/${selectedModel}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
              selected_output: selectedOutputVariable, 
              selected_sample: selectedSample 
            }),
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          if (response.status === 400) {
            setError(errorData.detail);
          } else if (response.status === 500) {
            setError("An error occurred. Please double-check to make sure you're not selecting a categorical output. Also, double-check that you didn't select a Neural Network model; the SHAP pages do not yet support these. If you've verified that the prior scenarios don't apply to you, this may be an internal server error.");
          } else {
            setError(errorData.detail || "An unexpected error occurred");
          }
          return;
        }

        const data = await response.json();
        setPlotData(data.plot_data);
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching waterfall plot data:', error);
        setIsLoading(false);
      }
    };

    fetchShapWaterfallPlotData();
  }, [selectedModel, selectedOutputVariable, selectedSample]);


  // TODO: someday, figure out how to pull this out as a function that can be imported to any page
  // handle plot rendering detection
  useEffect(() => {
    if (plotData) {
      // Add a small delay to ensure the plot is fully rendered
      const timer = setTimeout(() => {
        setIsLoading(false);
      }, 100); // Adjust this delay if needed
      
      return () => clearTimeout(timer);
    }
  }, [plotData]);


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
        <label>{"Selected output variable:"}</label>
        <Select
            options={outputVariableOptions}
            onChange={(selected: { value: string; label: string } | null) => {
              if (selected) {
                setSelectedOutputVariable(selected.value);
              }
            }}
            value={outputVariableOptions.filter(option => selectedOutputVariable?.includes(option.value))} // Set selected values
            name="selected-variables"
            classNamePrefix="select"
          />
        <label>{"Select a sample from the dataset:"}</label>
        <Select
            options={sampleOptions}
            onChange={(selected: { value: string; label: string } | null) => {
              if (selected) {
                setSelectedSample([selected.value]);
              }
            }}
            // value={selectedSample} // Set selected values
            value={sampleOptions.filter(option => selectedSample?.includes(option.value))} // Set selected values
            name="selected-sample"
            classNamePrefix="select"
          />        
        </div>
        {/* <div>
          <h3>TODOs:</h3>
            <ol className="list-decimal ml-6">
              <li></li>
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


export default ShapWaterfallPlotsPage;
