'use client';

import dynamic from 'next/dynamic';
import Image from "next/image";
import Link from 'next/link';
import { PlotDataType } from '@/types/types';
import Select from 'react-select';
import Sidebar from '../components/Sidebar';
import SelectedModelPicker from '../components/SelectedModelPicker';
import Spinner from '../components/Spinner';
import { useEffect, useRef, useState } from 'react';
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
  const optionsModelRef = useRef('');

  useEffect(() => {
    optionsModelRef.current = '';
    setOutputVariableOptions([]);
    setSelectedOutputVariable(undefined);
    setSampleOptions([]);
    setSelectedSample(undefined);
    setPlotData(null);
    setError('');

    if (!selectedModel) {
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);

    const fetchPageOptions = async () => {
      try {
        const [outputResponse, sampleResponse] = await Promise.all([
          fetch(`./api/output-variable-options/${selectedModel}`, { signal: controller.signal }),
          fetch(`./api/sample-options/${selectedModel}`, { signal: controller.signal }),
        ]);
        const outputData = await outputResponse.json();
        const sampleData = await sampleResponse.json();
        const outputs = outputData.output_variable_options.map((option: string) => ({
          value: option,
          label: option,
        }));
        const samples = sampleData.sample_options.map((option: string) => ({
          value: option,
          label: option,
        }));
        optionsModelRef.current = selectedModel;
        setOutputVariableOptions(outputs);
        setSampleOptions(samples);
        setSelectedOutputVariable(outputs[0]?.value);
        setSelectedSample(samples[0] ? [samples[0].value] : undefined);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        console.error('Error fetching waterfall options:', err);
        setIsLoading(false);
      }
    };

    fetchPageOptions();
    return () => controller.abort();
  }, [selectedModel]);


  useEffect(() => {
    if (
      !selectedModel ||
      !selectedOutputVariable ||
      !selectedSample ||
      optionsModelRef.current !== selectedModel ||
      !outputVariableOptions.some((option) => option.value === selectedOutputVariable) ||
      !sampleOptions.some((option) => selectedSample.includes(option.value))
    ) {
      return;
    }

    const controller = new AbortController();
    setError('');
    setIsLoading(true);

    const fetchShapWaterfallPlotData = async () => {
      try {
        const response = await fetch(
          `./api/shap-waterfall-plots/${selectedModel}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              selected_output: selectedOutputVariable,
              selected_sample: selectedSample,
            }),
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          const errorData = await response.json();
          if (response.status === 400) {
            setError(errorData.detail);
          } else if (response.status === 500) {
            setError("An error occurred. Please double-check to make sure you're not selecting a categorical output. Also, double-check that you didn't select a Neural Network model; the SHAP pages do not yet support these. If you've verified that the prior scenarios don't apply to you, this may be an internal server error.");
          } else {
            setError(errorData.detail || 'An unexpected error occurred');
          }
          setIsLoading(false);
          return;
        }

        const data = await response.json();
        setError('');
        setPlotData(data.plot_data);
        setIsLoading(false);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        console.error('Error fetching waterfall plot data:', err);
        setIsLoading(false);
      }
    };

    fetchShapWaterfallPlotData();
    return () => controller.abort();
  }, [selectedModel, selectedOutputVariable, selectedSample, outputVariableOptions, sampleOptions]);

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
        <SelectedModelPicker />
        <div className="relative">
        <label>{"Selected output variable:"}</label>
        <Select
            options={outputVariableOptions}
            onChange={(selected: { value: string; label: string } | null) => {
              if (selected) {
                setSelectedOutputVariable(selected.value);
              }
            }}
            value={outputVariableOptions.filter((option) => option.value === selectedOutputVariable)}  // Set selected values
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
            value={sampleOptions.filter((option) => selectedSample?.includes(option.value))}  // Set selected values
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
