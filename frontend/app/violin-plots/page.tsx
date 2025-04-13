'use client';

import dynamic from 'next/dynamic';
import Image from "next/image";
import Link from 'next/link';
import { PlotDataType } from '@/types/types';
import Sidebar from '../components/Sidebar';
import Spinner from '../components/Spinner';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useModel } from '../contexts/ModelContext';
import { Switch } from '@headlessui/react';

const Plot = dynamic(() => import('react-plotly.js'), { ssr: false });


const ViolinPlotsPage = () => {
  const { selectedModel } = useModel();
  const [plotData, setPlotData] = useState<PlotDataType | null>(null);
  const [boxPlotToggle, setBoxPlotToggle] = useState<boolean>(true);
  const [dataPointsToggle, setDataPointsToggle] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalVariables, setTotalVariables] = useState(0);
  const [plotCache, setPlotCache] = useState<{[key: string]: PlotDataType}>({});
  const [tempPageSize, setTempPageSize] = useState(10); // Temporary state for input
  const [tempPageNumber, setTempPageNumber] = useState(1); // Temporary state for page number input

  
  useEffect(() => {
    async function fetchViolinPlotData() {
      if (!selectedModel) {
        setIsLoading(false);
        return;
      }
      
      const cacheKey = `${selectedModel}-${boxPlotToggle}-${dataPointsToggle}-${currentPage}-${pageSize}`;
      
      // Check cache first
      if (plotCache[cacheKey]) {
        setPlotData(plotCache[cacheKey]);
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
              page: currentPage,
              page_size: pageSize
            }),
          }
        );
        const data = await response.json();
        setPlotData(data.plot_data);
        setTotalVariables(data.total_variables || 0);
        // Update cache
        setPlotCache(prev => ({
          ...prev,
          [cacheKey]: data.plot_data
        }));
      } catch (error) {
        console.error('Error fetching violin plot data:', error);
        setIsLoading(false);
      }
    };

    fetchViolinPlotData();
  }, [selectedModel, boxPlotToggle, dataPointsToggle, currentPage, pageSize]);


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

  // Update pagination controls to show total pages
  const totalPages = Math.ceil(totalVariables / pageSize);

  // Memoize the handlePageSizeChange function
  const handlePageSizeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    
    // Allow empty input (which will be handled when Update is clicked)
    if (inputValue === '') {
      setTempPageSize(0); // Use 0 as a placeholder for empty input
      return;
    }

    const newSize = parseInt(inputValue, 10);
    if (!isNaN(newSize) && newSize > 0 && newSize <= 50) {
      setTempPageSize(newSize);
    }
  }, []);

  // Handle page number input change
  const handlePageNumberChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    
    // Allow empty input
    if (inputValue === '') {
      setTempPageNumber(0); // Use 0 as a placeholder for empty input
      return;
    }

    const newPage = parseInt(inputValue, 10);
    if (!isNaN(newPage) && newPage > 0) {
      setTempPageNumber(newPage);
    }
  }, []);

  // Update the handleUpdateClick function to handle both page size and page number changes
  const handleUpdateClick = useCallback(() => {
    // Handle page size
    const newPageSize = tempPageSize === 0 ? pageSize : tempPageSize;
    
    // Handle page number
    const newPageNumber = tempPageNumber === 0 ? currentPage : Math.min(Math.max(tempPageNumber, 1), totalPages);
    
    setPageSize(newPageSize);
    setCurrentPage(newPageNumber);
  }, [tempPageSize, pageSize, tempPageNumber, currentPage, totalPages]);

  // Update the input value to show empty string when tempPageSize is 0
  const inputValue = tempPageSize === 0 ? '' : tempPageSize.toString();

  // Update the page number input value to show empty string when tempPageNumber is 0
  const pageNumberInputValue = tempPageNumber === 0 ? '' : tempPageNumber.toString();

  // Update tempPageNumber when currentPage changes
  useEffect(() => {
    setTempPageNumber(currentPage);
  }, [currentPage]);

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
        <div className="w-full flex flex-col items-center gap-4">
          <div className="flex gap-4 items-center">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-300"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage(p => p + 1)}
              disabled={currentPage >= totalPages}
              className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-300"
            >
              Next
            </button>
            <div className="flex gap-2 items-center">
              <span>Page</span>
              <input
                type="number"
                min="1"
                max={totalPages}
                value={pageNumberInputValue}
                onChange={handlePageNumberChange}
                className="w-16 px-2 py-1 border rounded"
              />
              <span>of {totalPages}</span>
            </div>
            <button
              onClick={handleUpdateClick}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Update
            </button>
            <div className="flex gap-2 items-center">
              <label htmlFor="pageSize">Plots per page:</label>
              <input
                type="number"
                id="pageSize"
                min="1"
                max="50"
                value={inputValue}
                onChange={handlePageSizeChange}
                className="w-20 px-2 py-1 border rounded"
              />
            </div>
          </div>
          
          <div className="flex gap-4 items-center">
          </div>

          {/* Memoize the plot component */}
          {useMemo(() => (
            <div className="w-full flex justify-center">
              {isLoading ? <Spinner /> : 
                plotData && (
                <Plot
                  data={plotData.data}
                  layout={plotData.layout}
                  config={{
                    responsive: true,
                    displayModeBar: false,
                    scrollZoom: false
                  }}
                  style={{ width: '85%', height: '600px' }}
                />
              )}
            </div>
          ), [isLoading, plotData])}
        </div>
      </div>
    </div>
  );
};


export default ViolinPlotsPage;
