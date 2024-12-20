'use client';

import dynamic from 'next/dynamic';
import Image from "next/image";
import Link from 'next/link';
import Sidebar from '../components/Sidebar';
import { useState, useEffect } from 'react';
import { useModel } from '../contexts/ModelContext';

const Plot = dynamic(() => import('react-plotly.js'), { ssr: false });

// TODO: don't re-make this interface in every page; pull it out into some other place and then import it in each of your pages.
interface PlotDataType {
    data: any[];
    layout: any;
}

const ShapSummaryPlotsPage = () => {
  const { selectedModel } = useModel();
  const [plotData, setPlotData] = useState<PlotDataType | null>(null);
  const [outputVariableOptions, setOutputVariableOptions] = useState<{ value: string; label: string }[]>([]);
  const [selectedOutputVariable, setSelectedOutputVariable] = useState<string[]>([]);


  useEffect(() => {
    const fetchOutputVariableOptions = async () => {
      if (selectedModel) {
        try {
          const response = await fetch(`http://localhost:8000/api/output-variable-options/${selectedModel}`);
          const data = await response.json();
          const options = data.output_variable_options.map((option: string) => ({ value: option, label: option }));
          setOutputVariableOptions(options);

          // Set the first option as selected by default
          if (options.length >= 1) {
            setSelectedOutputVariable(options[0].value);
          }
        } catch (error) {
          console.error('Error fetching variable options:', error);
        }
      }
    };

    fetchOutputVariableOptions();
  }, [selectedModel]);


  
  useEffect(() => {
    async function fetchShapSummaryPlotData() {
      try {
        const response = await fetch(
          `http://localhost:8000/api/shap-summary-plots/${selectedModel}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ selected_variables: selectedOutputVariable }), // Send as JSON
          }
        );
        const data = await response.json();
        setPlotData(data.plot_data);
      } catch (error) {
        console.error('Error fetching scatter plot data:', error);
      }
    };

    fetchShapSummaryPlotData();
  }, [selectedModel, selectedOutputVariable]);


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
        <div>
          <h1>Under construction...</h1>
          <p>TODOs: Build the page!</p>
        </div>
        {/* <div className="flex gap-4">
          <div>
            <label className="mr-2">Show Box Plot</label>
            <Switch
              checked={boxPlotToggle}
              onChange={setBoxPlotToggle}
              className={`${
                boxPlotToggle ? 'bg-blue-600' : 'bg-gray-200'
              } relative inline-flex items-center h-6 rounded-full w-11`}
            >
              <span className="sr-only">Toggle Box Plot</span>
              <span
                className={`${
                  boxPlotToggle ? 'translate-x-6' : 'translate-x-1'
                } inline-block w-4 h-4 transform bg-white rounded-full transition`}
              />
            </Switch>
          </div>
          <div>
            <label className="mr-2">Show Data Points</label>
            <Switch
              checked={dataPointsToggle}
              onChange={setDataPointsToggle}
              className={`${
                dataPointsToggle ? 'bg-blue-600' : 'bg-gray-200'
              } relative inline-flex items-center h-6 rounded-full w-11`}
            >
              <span className="sr-only">Toggle Data Points</span>
              <span
                className={`${
                  dataPointsToggle ? 'translate-x-6' : 'translate-x-1'
                } inline-block w-4 h-4 transform bg-white rounded-full transition`}
              />
            </Switch>
          </div>
        </div> */}
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


export default ShapSummaryPlotsPage;
