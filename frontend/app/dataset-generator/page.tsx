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
  const [generalInputs, setGeneralInputs] = useState<DescriptorGroup[]>([]);
  const [formulationInputs, setFormulationInputs] = useState<DescriptorGroup[]>([]);
  const [outputs, setOutputs] = useState<DescriptorGroup[]>([]);
  const [numRows, setNumRows] = useState<number | ''>(10);

  const addDescriptorGroup = (category: 'general input' | 'formulation input' | 'output') => {
    const newGroup = {
      id: crypto.randomUUID(),
      name: '',
      min: '',
      max: '',
      units: ''
    };

    if (category === 'general input') {
      setGeneralInputs([...generalInputs, newGroup]);
    } else if (category === 'formulation input') {
      setFormulationInputs([...formulationInputs, newGroup]);
    } else if (category === 'output') {
      setOutputs([...outputs, newGroup]);
    }
  };

  const removeDescriptorGroup = (category: 'general input' | 'formulation input' | 'output', id: string) => {
    if (category === 'general input') {
      setGeneralInputs(generalInputs.filter(group => group.id !== id));
    } else if (category === 'formulation input') {
      setFormulationInputs(formulationInputs.filter(group => group.id !== id));
    } else if (category === 'output') {
      setOutputs(outputs.filter(group => group.id !== id));
    }
  };

  const updateDescriptorGroup = (category: 'general input' | 'formulation input' | 'output', id: string, field: keyof DescriptorGroup, value: string) => {
    if (category === 'general input') {
      setGeneralInputs(generalInputs.map(group => 
        group.id === id ? { ...group, [field]: value } : group
      ));
    } else if (category === 'formulation input') {
      setFormulationInputs(formulationInputs.map(group => 
        group.id === id ? { ...group, [field]: value } : group
      ));
    } else if (category === 'output') {
      setOutputs(outputs.map(group => 
        group.id === id ? { ...group, [field]: value } : group
      ));
    }
  };




  // const generateData = () => {
  async function generateData() {
    // print a bunch of stuff just to check the user input is being captured correctly. Can probably delete remove this eventually... 
    console.log(`Generating ${numRows} rows of data...`);
    console.log(`General Inputs:`);
    generalInputs.forEach(group => {console.log(`- Name: ${group.name}, Min: ${group.min}, Max: ${group.max}, Units: ${group.units}`);});
    console.log(`Formulation Inputs:`);
    formulationInputs.forEach(group => {console.log(`- Name: ${group.name}, Min: ${group.min}, Max: ${group.max}, Units: ${group.units}`);});
    console.log(`Outputs:`);
    outputs.forEach(group => {console.log(`- Name: ${group.name}, Min: ${group.min}, Max: ${group.max}, Units: ${group.units}`);});
    console.log(`Completed generating data.`);



    try {
      const response = await fetch(
        `http://localhost:8000/api/dataset-generator/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            general_inputs: generalInputs,
            formulation_inputs: formulationInputs,
            outputs: outputs,
            num_rows: numRows,
          }),
        }
      );
      const data = await response.json();
      setPlotData(data.plot_data);
    } catch (error) {
      console.error('Error fetching synthetic demo data:', error);
    }



    
  };





  // useEffect(() => {
  //   async function fetchDatasetGeneratorData() {



  //     // print a bunch of stuff just to check the user input is being captured correctly. Can probably delete remove this eventually... 
  //     console.log(`Generating ${numRows} rows of data...`);
  //     console.log(`General Inputs:`);
  //     generalInputs.forEach(group => {console.log(`- Name: ${group.name}, Min: ${group.min}, Max: ${group.max}, Units: ${group.units}`);});
  //     console.log(`Formulation Inputs:`);
  //     formulationInputs.forEach(group => {console.log(`- Name: ${group.name}, Min: ${group.min}, Max: ${group.max}, Units: ${group.units}`);});
  //     console.log(`Outputs:`);
  //     outputs.forEach(group => {console.log(`- Name: ${group.name}, Min: ${group.min}, Max: ${group.max}, Units: ${group.units}`);});
  //     console.log(`Completed generating data.`);
    


  //     try {
  //       const response = await fetch(
  //         `http://localhost:8000/api/dataset-generator/`, {
  //           method: 'POST',
  //           headers: {
  //             'Content-Type': 'application/json',
  //           },
  //           body: JSON.stringify({
  //             general_inputs: generalInputs,
  //             formulation_inputs: formulationInputs,
  //             outputs: outputs,
  //             num_rows: numRows,
  //           }),
  //         }
  //       );
  //       const data = await response.json();
  //       setPlotData(data.plot_data);
  //     } catch (error) {
  //       console.error('Error fetching scatter plot data:', error);
  //     }
  //   };

  //   fetchDatasetGeneratorData();
  // }, [selectedModel]);


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
          <p>TODOs: 1. Make "name", "min", and "max" fields required, 2. preview rows of generated data (include interactive table somehow?), 3. Add capability for CSV export via another button, 4. (someday) add an "advanced" menu that allows users to specify their coefficients</p>
        </div>
        <div className="w-full max-w-4xl">
          <div className="mb-6 flex items-center">
            <label className="block text-sm font-medium mb-1 mr-2">
              Number of Rows
            </label>
            <input
              type="number"
              value={numRows}
              onChange={(e) => setNumRows(Number(e.target.value) || '')}
              min="1"
              className="w-full p-2 border rounded mr-2"
            />
            <button
              onClick={generateData}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
            >
              Generate Data
            </button>
          </div>

          {/* General Inputs Section */}
          <div className="mb-6 p-4 border-2 border-gray-400 rounded-lg">
            <h2 className="text-lg font-bold mb-2">General Inputs</h2>
            <button
              onClick={() => addDescriptorGroup('general input')}
              className="mb-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Add General Input
            </button>
            {generalInputs.map(group => (
              <div key={group.id} className="mb-6 p-4 border rounded-lg relative">
                <button
                  onClick={() => removeDescriptorGroup('general input', group.id)}
                  className="absolute top-2 right-2 text-red-500 hover:text-red-700"
                >
                  ✕
                </button>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Descriptor name</label>
                    <input
                      type="text"
                      value={group.name}
                      onChange={(e) => updateDescriptorGroup('general input', group.id, 'name', e.target.value)}
                      className="w-full p-2 border rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Minimum possible value</label>
                    <input
                      type="number"
                      value={group.min}
                      onChange={(e) => updateDescriptorGroup('general input', group.id, 'min', e.target.value)}
                      className="w-full p-2 border rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Maximum possible value</label>
                    <input
                      type="number"
                      value={group.max}
                      onChange={(e) => updateDescriptorGroup('general input', group.id, 'max', e.target.value)}
                      className="w-full p-2 border rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Units (optional)</label>
                    <input
                      type="text"
                      value={group.units}
                      onChange={(e) => updateDescriptorGroup('general input', group.id, 'units', e.target.value)}
                      className="w-full p-2 border rounded"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Formulation Inputs Section */}
          <div className="mb-6 p-4 border-2 border-gray-400 rounded-lg">
            <h2 className="text-lg font-bold mb-2">Formulation Inputs</h2>
            <button
              onClick={() => addDescriptorGroup('formulation input')}
              className="mb-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Add Formulation Input
            </button>
            {formulationInputs.map(group => (
              <div key={group.id} className="mb-6 p-4 border rounded-lg relative">
                <button
                  onClick={() => removeDescriptorGroup('formulation input', group.id)}
                  className="absolute top-2 right-2 text-red-500 hover:text-red-700"
                >
                  ✕
                </button>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Descriptor name</label>
                    <input
                      type="text"
                      value={group.name}
                      onChange={(e) => updateDescriptorGroup('formulation input', group.id, 'name', e.target.value)}
                      className="w-full p-2 border rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Minimum possible value</label>
                    <input
                      type="number"
                      value={group.min}
                      onChange={(e) => updateDescriptorGroup('formulation input', group.id, 'min', e.target.value)}
                      className="w-full p-2 border rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Maximum possible value</label>
                    <input
                      type="number"
                      value={group.max}
                      onChange={(e) => updateDescriptorGroup('formulation input', group.id, 'max', e.target.value)}
                      className="w-full p-2 border rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Units (optional)</label>
                    <input
                      type="text"
                      value={group.units}
                      onChange={(e) => updateDescriptorGroup('formulation input', group.id, 'units', e.target.value)}
                      className="w-full p-2 border rounded"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Outputs Section */}
          <div className="mb-6 p-4 border-2 border-gray-400 rounded-lg">
            <h2 className="text-lg font-bold mb-2">Outputs</h2>
            <button
              onClick={() => addDescriptorGroup('output')}
              className="mb-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Add Output
            </button>
            {outputs.map(group => (
              <div key={group.id} className="mb-6 p-4 border rounded-lg relative">
                <button
                  onClick={() => removeDescriptorGroup('output', group.id)}
                  className="absolute top-2 right-2 text-red-500 hover:text-red-700"
                >
                  ✕
                </button>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Descriptor name</label>
                    <input
                      type="text"
                      value={group.name}
                      onChange={(e) => updateDescriptorGroup('output', group.id, 'name', e.target.value)}
                      className="w-full p-2 border rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Minimum possible value</label>
                    <input
                      type="number"
                      value={group.min}
                      onChange={(e) => updateDescriptorGroup('output', group.id, 'min', e.target.value)}
                      className="w-full p-2 border rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Maximum possible value</label>
                    <input
                      type="number"
                      value={group.max}
                      onChange={(e) => updateDescriptorGroup('output', group.id, 'max', e.target.value)}
                      className="w-full p-2 border rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Units (optional)</label>
                    <input
                      type="text"
                      value={group.units}
                      onChange={(e) => updateDescriptorGroup('output', group.id, 'units', e.target.value)}
                      className="w-full p-2 border rounded"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
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
