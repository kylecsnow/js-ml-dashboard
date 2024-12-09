'use client';

import dynamic from 'next/dynamic';
import Image from "next/image";
import Link from 'next/link';
import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { useModel } from '../contexts/ModelContext';

// Dynamically import Plot from plotly.js-dist-min
const Plot = dynamic(() => import('react-plotly.js'), { ssr: false });

interface PlotDataType {
  data: any[];
  layout: any;
}

const CorrelationHeatmapsPage = () => {
  const { selectedModel } = useModel();
  const [selectedHeatmapType, setSelectedHeatmapType] = useState('input-input');
  const [plotData, setPlotData] = useState<PlotDataType | null>(null);
  // const [loading, setLoading] = useState(false);

  useEffect(() => {

    async function fetchHeatmapData() {
      try {
        const response = await fetch(
          `http://localhost:8000/api/correlation-heatmap/${selectedModel}/${selectedHeatmapType}`
        );
        const data = await response.json();
        setPlotData(data.plot_data);
      } catch (error) {
        console.error('Error fetching heatmap:', error);
      } finally {
        // setLoading(false);
      }
    }

    fetchHeatmapData();
  }, [selectedModel, selectedHeatmapType]);


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

          <select
            value={selectedHeatmapType}
            onChange={(e) => setSelectedHeatmapType(e.target.value)}
            className="px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          >
            <option value="input-input">Input-Input Correlations</option>
            <option value="input-output">Input-Output Correlations</option>
            <option value="output-output">Output-Output Correlations</option>
          </select>
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
          <p>TODOs: re-size the heatmaps to fit the page better</p>
        </div>
        <div className="w-full max-w-4xl">
          {/* {loading ? (
            <div>Loading...</div>
          ) : plotData && ( */}

          {/* TODO: make the correlation heatmaps bigger */}
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
