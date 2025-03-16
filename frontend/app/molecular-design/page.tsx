'use client';

import dynamic from 'next/dynamic';
import Image from "next/image";
import Link from 'next/link';
import { PlotDataType } from '@/types/types';
import Script from 'next/script';
import Sidebar from '@/app/components/Sidebar';
import SmilesDrawer from 'smiles-drawer';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useModel } from '@/app/contexts/ModelContext';

const Plot = dynamic(() => import('react-plotly.js'), { ssr: false });



// TODO: fix this mess
const ShowMolecule: React.FC<ShowMoleculeProps> = ({ molecule }) => {
  const [molgenResults] = al;skfdj;aweac;
  const smiles = molecule?.SMILES
  const svgRef = useRef<SVGSVGElement>(null);



  const display2DMolecule = useCallback(() => {
    // const svgRef = useRef(null);
    // const [showTooltip, setShowTooltip] = useState(false);
    
    if (!smiles || !svgRef.current) return;
    
    // first, clear the SVG
    while (svgRef.current.firstChild) {
      svgRef.current.removeChild(svgRef.current.firstChild);
    }
    
    const drawer = new SmilesDrawer.SvgDrawer({
      width: 400,
      height: 400,
      bondThickness: 1.5,
      fontSizeLarge: 12,
      fontSizeSmall: 10,
    });
    
    SmilesDrawer.parse(smiles, function (tree) {
      if (svgRef.current) {
        drawer.draw(tree, svgRef.current, 'light');
        console.log('2D Molecule drawn successfully');
      }
    }, function (error) {
      console.error('SMILES parsing error:', error);
    });
  }, [smiles]);
}


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
    <>
      {/* TODO: try to get these 3 Scripts working */}
      <Script
        src="https://code.jquery.com/jquery-3.6.0.min.js"
        strategy="beforeInteractive"
        onLoad={() => console.log('jQuery loaded successfully')}
        />
      <Script
        src="https://3Dmol.org/build/3Dmol-min.js"
        strategy="beforeInteractive"
        onLoad={() => console.log('3Dmol loaded successfully')}
        />
      <Script
        src="https://3Dmol.org/build/3Dmol.ui-min.js"
        strategy="beforeInteractive"
        onLoad={() => console.log('3Dmol.ui loaded successfully')}
      />
      
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
          <div>
            <h1>Under construction...</h1>
          </div>
          <div>
            <h3>TODOs:</h3>
            <ol className="list-decimal ml-6">
              <li>Plotly molecular space diagram</li>
              <li>Try plotting with Plotly.js instead of plotly on the backend?</li>
              <li>Try out a 2D molecule viewer (`smilesDrawer`?)</li>
              <li>Try out a 3D molecule viewer (`3Dmol.js`?)</li>
              <li>Try out ASKCOS (askcos.mit.edu) molecule editor...? (figure out why certain things don't work: 1) copy-pasting, 2) structure cleanup, 3) inputting SMILES.</li>
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
    </>
  );
};


export default MolecularDesignPage;
