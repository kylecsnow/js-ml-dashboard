'use client';

import dynamic from 'next/dynamic';
import Image from "next/image";
import Link from 'next/link';
import Script from 'next/script';
import Sidebar from '@/app/components/Sidebar';
import { PlotDataType } from '@/types/types';
import SmilesDrawer from 'smiles-drawer';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useModel } from '@/app/contexts/ModelContext';

const Plot = dynamic(() => import('react-plotly.js'), { ssr: false });



// TODO: fix this mess
// const ShowMolecule: React.FC<ShowMoleculeProps> = ({ molecule }) => {
//   const [molgenResults] = al;skfdj;aweac;
//   const smiles = molecule?.SMILES
//   const svgRef = useRef<SVGSVGElement>(null);



//   const display2DMolecule = useCallback(() => {
//     // const svgRef = useRef(null);
//     // const [showTooltip, setShowTooltip] = useState(false);
    
//     if (!smiles || !svgRef.current) return;
    
//     // first, clear the SVG
//     while (svgRef.current.firstChild) {
//       svgRef.current.removeChild(svgRef.current.firstChild);
//     }
    
//     const drawer = new SmilesDrawer.SvgDrawer({
//       width: 400,
//       height: 400,
//       bondThickness: 1.5,
//       fontSizeLarge: 12,
//       fontSizeSmall: 10,
//     });
    
//     SmilesDrawer.parse(smiles, function (tree) {
//       if (svgRef.current) {
//         drawer.draw(tree, svgRef.current, 'light');
//         console.log('2D Molecule drawn successfully');
//       }
//     }, function (error) {
//       console.error('SMILES parsing error:', error);
//     });
//   }, [smiles]);
// }


const MolecularDesignPage = () => {
  const { selectedModel } = useModel();
  const [plotData, setPlotData] = useState<PlotDataType | null>(null);

  // const hiddenButtonsConfig = getHiddenButtonsConfig();
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  
  useEffect(() => {
    if (!selectedModel) return;
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
 


  const turboColorscale: [number, string][] = [
    [0.0, 'rgb(48, 18, 59)'],
    [0.05263157894736842, 'rgb(61, 56, 142)'],
    [0.10526315789473684, 'rgb(67, 92, 202)'],
    [0.15789473684210525, 'rgb(67, 126, 240)'],
    [0.21052631578947367, 'rgb(58, 160, 251)'],
    [0.2631578947368421, 'rgb(36, 193, 225)'],
    [0.3157894736842105, 'rgb(31, 219, 193)'],
    [0.3684210526315789, 'rgb(46, 239, 157)'],
    [0.42105263157894735, 'rgb(91, 250, 114)'],
    [0.47368421052631576, 'rgb(139, 252, 77)'],
    [0.5263157894736842, 'rgb(181, 245, 56)'],
    [0.5789473684210527, 'rgb(213, 228, 53)'],
    [0.631578947368421, 'rgb(238, 203, 57)'],
    [0.6842105263157894, 'rgb(249, 173, 50)'],
    [0.7368421052631579, 'rgb(251, 137, 37)'],
    [0.7894736842105263, 'rgb(242, 97, 20)'],
    [0.8421052631578947, 'rgb(222, 65, 9)'],
    [0.894736842105263, 'rgb(196, 40, 3)'],
    [0.9473684210526315, 'rgb(163, 19, 1)'],
    [1.0, 'rgb(122, 4, 2)']  
  ];
  
  // Sample data
  const data = [
    { x: 1, y: 3, z: 20 },
    { x: 2, y: 4, z: 25 },
    { x: 3, y: 8, z: 30 },
    { x: 4, y: 6, z: 35 },
    { x: 5, y: 9, z: 40 },
    { x: 6, y: 5, z: 45 },
    { x: 7, y: 8, z: 50 },
    { x: 8, y: 3, z: 55 },
    { x: 9, y: 7, z: 60 }
  ];
  
  // Extract data arrays for Plotly
  const xValues = data.map(point => point.x);
  const yValues = data.map(point => point.y);
  const zValues = data.map(point => point.z);
  
  // Create the trace for the scatterplot with custom Turbo colorscale
  const trace: Partial<Plotly.ScatterData> = {
    x: xValues,
    y: yValues,
    mode: 'markers',
    marker: {
      size: 12,
      color: zValues,
      colorscale: turboColorscale,  // Use the custom Turbo colorscale
      colorbar: {
        title: 'Z Values',
        thickness: 20,
        titleside: 'right'
      },
      showscale: true
    },
    type: 'scatter'
  };
  
  // Layout configuration
  const layout = {
    title: 'Scatterplot with Custom Turbo Colorscale',
    xaxis: {
      title: 'X Values',
      zeroline: false
    },
    yaxis: {
      title: 'Y Values',
      zeroline: false
    },
    margin: { t: 50 }
  };








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
              <li>display molecule structure on-click</li>
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




{/* 
          <div>
            <Plot
              data={[trace]}
              layout={layout}
              config={{ responsive: true }}
              style={{ width: '100%', height: '400px' }}
            />
          </div> */}







        </div>
      </div>
    </>
  );
};


export default MolecularDesignPage;
