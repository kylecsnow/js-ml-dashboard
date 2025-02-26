'use client';

import dynamic from 'next/dynamic';
import Image from "next/image";
import Link from 'next/link';
import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
// import { Switch } from '@headlessui/react';
import { useModel } from '../contexts/ModelContext';

// Dynamically import Plot from plotly.js-dist-min
const Plot = dynamic(() => import('react-plotly.js'), { ssr: false });

interface PlotDataType {
  data: any[];
  layout: any;
}


const CorrelationHeatmapsPage = () => {
  const { selectedModel } = useModel();
  const [selectedHeatmapType, setSelectedHeatmapType] = useState('input-output');
  const [plotData, setPlotData] = useState<PlotDataType | null>(null);
  // const [clusterMapToggle, setClusterMapToggle] = useState<boolean>(false);

  useEffect(() => {
    async function fetchHeatmapData() {
      if (!selectedModel) {
        console.error('No model selected');
        return;
      }

      try {
        const response = await fetch(
          `./api/correlation-heatmap/${selectedModel}/${selectedHeatmapType}`
        );
        const data = await response.json();
        setPlotData(data.plot_data);
      } catch (error) {
        console.error('Error fetching heatmap:', error);
      }
    }

    fetchHeatmapData();
  }, [selectedModel, selectedHeatmapType]);


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
        <div className="flex gap-4 items-center">
          <select
            value={selectedHeatmapType}
            onChange={(e) => setSelectedHeatmapType(e.target.value)}
            className="px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          >
            <option value="input-input">Input-Input Correlations</option>
            <option value="input-output">Input-Output Correlations</option>
            <option value="output-output">Output-Output Correlations</option>
          </select>
          {/* <div>
            <label className="mr-2">Cluster variables</label>
            <Switch
              checked={clusterMapToggle}
              onChange={setClusterMapToggle}
              className={`${
                clusterMapToggle ? 'bg-blue-600' : 'bg-gray-200'
              } relative inline-flex items-center h-6 rounded-full w-11`}
            >
              <span className="sr-only">Cluster variables</span>
              <span
                className={`${
                  clusterMapToggle ? 'translate-x-6' : 'translate-x-1'
                } inline-block w-4 h-4 transform bg-white rounded-full transition`}
              />
            </Switch>
          </div> */}
        </div>

        {/* <div>
          <p>(TODOs: 1. get toggle switches actually working for grouping/clustering variables, and 2. choosing whether to hide certain features (possibly showing a number entry field for the threshold) - #2 might be hard to do though, actually...)</p>
        </div> */}
        <div className="w-full max-w-8xl mx-auto">
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

export default CorrelationHeatmapsPage
