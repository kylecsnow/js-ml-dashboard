'use client';

// import 'ketcher-react/dist/index.css';
// import { ButtonsConfig, Editor, InfoModal } from 'ketcher-react';
// import {
//   Ketcher,
//   RemoteStructServiceProvider,
//   StructServiceProvider,
// } from 'ketcher-core';

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

// TODO: need to learn what this part is actually doing
// declare global {
//   interface Window {
//     ketcher: Ketcher;
//   }
// }


// const getHiddenButtonsConfig = (): ButtonsConfig => {
//   const searchParams = new URLSearchParams(window.location.search);
//   const hiddenButtons = searchParams.get('hiddenControls');

//   if (!hiddenButtons) return {};

//   return hiddenButtons.split(',').reduce<Record<string, { hidden: boolean }>>((acc, button) => {
//     if (button) acc[button] = { hidden: true };

//     return acc;
//   }, {});
// };

// let structServiceProvider: StructServiceProvider =
//   new RemoteStructServiceProvider(
//     process.env.API_PATH || process.env.REACT_APP_API_PATH || '',
//   );

// if (process.env.MODE === 'standalone') {
//   const {
//     StandaloneStructServiceProvider,
//     // eslint-disable-next-line @typescript-eslint/no-var-requires
//   } = require('ketcher-standalone');
//   structServiceProvider =
//     new StandaloneStructServiceProvider() as StructServiceProvider;
// }


const MolecularDesignPage = () => {
  const { selectedModel } = useModel();
  const [plotData, setPlotData] = useState<PlotDataType | null>(null);

  // const hiddenButtonsConfig = getHiddenButtonsConfig();
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  
  useEffect(() => {
    async function fetchMolecularDesignData() {
      try {
        const response = await fetch(
          // `http://localhost:8000/api/molecular-design/${selectedModel}`, {
          `./api/molecular-design/${selectedModel}`, {
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

    fetchMolecularDesignData();
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
        <div>
          <h3>TODOs:</h3>
          <ol className="list-decimal ml-6">
            <li>Build the page!</li>
            <li>maybe try the Bokeh plot here...? Will it even work with React/Javascript?</li>
            <li>Try to include Ketcher as a molecule editor...? (figure out why certain things don't work: 1) copy-pasting, 2) structure cleanup, 3) inputting SMILES.</li>
          </ol>

        </div>

        {/* <Editor
          errorHandler={(message: string) => {
            setHasError(true);
            setErrorMessage(message.toString());
          }}
          buttons={hiddenButtonsConfig}
          staticResourcesUrl={process.env.PUBLIC_URL || ''}
          structServiceProvider={structServiceProvider}
          onInit={(ketcher: Ketcher) => {
            window.ketcher = ketcher;

            window.parent.postMessage(
              {
                eventType: 'init',
              },
              '*',
            );
            window.scrollTo(0, 0);
          }}
        /> */}
        {/* {hasError && (
          <InfoModal
            message={errorMessage}
            close={() => {
              setHasError(false);

              // Focus on editor after modal is closed
              const cliparea: HTMLElement | null =
                document.querySelector('.cliparea');
              cliparea?.focus();
            }}
          />
        )} */}

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


export default MolecularDesignPage;
