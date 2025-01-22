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

interface DescriptorGroup {
  id: string;
  name: string;
  min: string;
  max: string;
  units: string;
}

const DatasetGeneratorPage = () => {
  const { selectedModel } = useModel();
  const [plotData, setPlotData] = useState<PlotDataType | null>(null);
  const [descriptorGroups, setDescriptorGroups] = useState<DescriptorGroup[]>([]);
  const [numRows, setNumRows] = useState<number | ''>('');

  const addDescriptorGroup = () => {
    setDescriptorGroups([
      ...descriptorGroups,
      {
        id: crypto.randomUUID(),
        name: '',
        min: '',
        max: '',
        units: ''
      }
    ]);
  };

  const removeDescriptorGroup = (id: string) => {
    setDescriptorGroups(descriptorGroups.filter(group => group.id !== id));
  };

  const updateDescriptorGroup = (id: string, field: keyof DescriptorGroup, value: string) => {
    setDescriptorGroups(descriptorGroups.map(group => 
      group.id === id ? { ...group, [field]: value } : group
    ));
  };

  useEffect(() => {
    async function fetchDatasetGeneratorData() {
      try {
        const response = await fetch(
          `http://localhost:8000/api/dataset-generator/`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
            // body: JSON.stringify({
            //   box_plot_toggle: boxPlotToggle,
            //   data_points_toggle: dataPointsToggle,
            // }),
          }
        );
        const data = await response.json();
        setPlotData(data.plot_data);
      } catch (error) {
        console.error('Error fetching scatter plot data:', error);
      }
    };

    fetchDatasetGeneratorData();
  }, [selectedModel]);


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
          <h1>Under construction...</h1>
          <p>TODOs: Build the page!</p>
        </div>
        <div className="w-full max-w-4xl">
          <div className="mb-6">
            <label className="block text-sm font-medium mb-1">
              Number of Rows
            </label>
            <input
              type="number"
              value={numRows}
              onChange={(e) => setNumRows(Number(e.target.value) || '')}
              min="1"
              className="w-full p-2 border rounded"
            />
          </div>

          <button
            onClick={addDescriptorGroup}
            className="mb-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Add Descriptor Group
          </button>

          {descriptorGroups.map(group => (
            <div key={group.id} className="mb-6 p-4 border rounded-lg relative">
              <button
                onClick={() => removeDescriptorGroup(group.id)}
                className="absolute top-2 right-2 text-red-500 hover:text-red-700"
              >
                ✕
              </button>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Descriptor name
                  </label>
                  <input
                    type="text"
                    value={group.name}
                    onChange={(e) => updateDescriptorGroup(group.id, 'name', e.target.value)}
                    className="w-full p-2 border rounded"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Minimum possible value
                  </label>
                  <input
                    type="number"
                    value={group.min}
                    onChange={(e) => updateDescriptorGroup(group.id, 'min', e.target.value)}
                    className="w-full p-2 border rounded"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Maximum possible value
                  </label>
                  <input
                    type="number"
                    value={group.max}
                    onChange={(e) => updateDescriptorGroup(group.id, 'max', e.target.value)}
                    className="w-full p-2 border rounded"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Units (optional)
                  </label>
                  <input
                    type="text"
                    value={group.units}
                    onChange={(e) => updateDescriptorGroup(group.id, 'units', e.target.value)}
                    className="w-full p-2 border rounded"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

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
  );
};


export default DatasetGeneratorPage;
