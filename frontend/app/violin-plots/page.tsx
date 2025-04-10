'use client';

import dynamic from 'next/dynamic';
import Image from "next/image";
import Link from 'next/link';
import { PlotDataType } from '@/types/types';
import Sidebar from '../components/Sidebar';
import Spinner from '../components/Spinner';
import { useState, useEffect } from 'react';
import { useModel } from '../contexts/ModelContext';
import { Switch } from '@headlessui/react';

const Plot = dynamic(() => import('react-plotly.js'), { ssr: false });


const ViolinPlotsPage = () => {
  const { selectedModel } = useModel();
  const [plotData, setPlotData] = useState<PlotDataType | null>(null);
  const [boxPlotToggle, setBoxPlotToggle] = useState<boolean>(true);
  const [dataPointsToggle, setDataPointsToggle] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(true);

  
  useEffect(() => {
    async function fetchViolinPlotData() {
      if (!selectedModel) {
        setIsLoading(false);
        return;
      }
      
      try {
        setIsLoading(true);
        const response = await fetch(
          `./api/violin-plots/${selectedModel}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              box_plot_toggle: boxPlotToggle,
              data_points_toggle: dataPointsToggle,
            }),
          }
        );
        const data = await response.json();
        setPlotData(data.plot_data);
      } catch (error) {
        console.error('Error fetching violin plot data:', error);
        setIsLoading(false);
      }
    };

    fetchViolinPlotData();
  }, [selectedModel, boxPlotToggle, dataPointsToggle]);


  // TODO: someday, figure out how to pull this out as a function that can be imported to any page
  // handle plot rendering detection
  useEffect(() => {
    if (plotData) {
      // Add a small delay to ensure the plot is fully rendered
      const timer = setTimeout(() => {
        setIsLoading(false);
      }, 300); // Adjust this delay if needed
      
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
        <div className="flex gap-2">
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
        </div>
        {/* <div>
          <h3>TODOs:</h3>
            <ol className="list-decimal ml-6">
              <li></li>
            </ol>
        </div> */}
        <div className="w-full flex justify-center">
          {isLoading ? <Spinner /> : 
            plotData && (
            <Plot
              data={plotData.data}
              layout={plotData.layout}
              config={{ responsive: true }}
              style={{ width: '85%', height: '600px' }}
            />
          )}
        </div>
      </div>
    </div>
  );
};


export default ViolinPlotsPage;
