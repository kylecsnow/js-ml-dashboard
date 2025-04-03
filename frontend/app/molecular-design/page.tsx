'use client';

import dynamic from 'next/dynamic';
import Image from "next/image";
import Link from 'next/link';
import Script from 'next/script';
import Sidebar from '@/app/components/Sidebar';
import { PlotDataType } from '@/types/types';
// import SmilesDrawer from 'smiles-drawer';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useModel } from '@/app/contexts/ModelContext';

const Plot = dynamic(() => import('react-plotly.js'), { ssr: false });


// TODO: someday figure out how the heck this jotai stuff works
// NOTE: *never* put this inside of a useEffect!!


// SOMEDAY: fix this mess, but start from scratch. 
// const ShowMolecule = () => {
//   const molecule = useAtomValue(selectedMoleculeAtom);
//   const smiles = molecule?.SMILES;
//   const svgRef = useRef<SVGSVGElement>(null);



//   const display2DMolecule = useCallback(() => {
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
//     });
    
//     SmilesDrawer.parse(smiles, function (tree) {
//       if (svgRef.current) {
//         drawer.draw(tree, svgRef.current, 'light');
//       }
//     });
//   }, [smiles]);

//   return (
//         console.log('2D Molecule drawn successfully');
//   );
//     }, function (error) {
//       console.error('SMILES parsing error:', error);


// TODO (SOMEDAY): Try out ASKCOS (askcos.mit.edu) molecule editor...? (figure out why certain things don't work: 1) copy-pasting, 2) structure cleanup, 3) inputting SMILES.






const MolecularDesignPage = () => {
  const [molgenResults, setMolgenResults] = useState<any[]>([]);
  const { selectedModel } = useModel();
  const [plotData, setPlotData] = useState<PlotDataType | null>(null);
  const [selectedSMILES, setSelectedSMILES] = useState<string | null>(null);
  const [selectedMoleculeImage, setSelectedMoleculeImage] = useState<string | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<{x: number, y: number} | null>(null);
  const [colorProp, setColorProp] = useState<string[] | null>(null);
  
  // const hiddenButtonsConfig = getHiddenButtonsConfig();
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  
 
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        // First fetch molgen results
        const molgenResponse = await fetch(
          `./api/molecular-design/${selectedModel}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}), // Add empty body to satisfy POST request
          }
        );
        
        if (!molgenResponse.ok) {
          throw new Error(`HTTP error! status: ${molgenResponse.status}`);
        }
        
        const molgenData = await molgenResponse.json();
        setMolgenResults(molgenData.molgen_results);
        console.log("Successfully fetched molgenData!");
      } catch (err) {
        console.error('Failed to fetch initial data:', err);
        setHasError(true);
        setErrorMessage('Failed to load molecular data. Please try again later.');
      }
    };

    if (selectedModel) {
      fetchInitialData();
    }
  }, [selectedModel]); // Only run when selectedModel changes


  useEffect(() => {
    if (!selectedModel || !molgenResults.length) return;
    
    async function fetchMolecularSpacePlotData() {
      try {
        const response = await fetch(
          `./api/molecular-space-map/${selectedModel}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
              color_property: colorProp, 
              molgen_results: molgenResults 
            }),
          }
        );
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        setPlotData(data.plot_data);
      } catch (error) {
        console.error('Error fetching scatter plot data:', error);
        setHasError(true);
        setErrorMessage('Failed to load plot data. Please try again later.');
      }
    };

    fetchMolecularSpacePlotData();
  }, [molgenResults, selectedModel, colorProp]);



  const handlePointClick = async (pointData: any) => {
    console.log("Click detected!");
    
    if (pointData.points && pointData.points[0]) {
      const point = pointData.points[0];
      
      // Store the selected point coordinates
      setSelectedPoint({
        x: point.x,
        y: point.y
      });
      
      // Find the corresponding molecule data in molgenResults
      const pointIndex = point.pointIndex;
      const selectedMolecule = molgenResults[pointIndex];

      console.log("SelectedMolecule:")
      console.log(selectedMolecule)
      
      if (selectedMolecule && selectedMolecule.SMILES) {
        setSelectedSMILES(selectedMolecule.SMILES);
      } else {
        console.log("No image found for selected molecule");
      }
    } else {
      console.log("No point data found in click event");
    }
  };  

  
  useEffect(() => {
    async function displayMoleculeImage() {
      if (!selectedSMILES) return;
      
      try {
        const response = await fetch(
          `./api/display-molecule-image/`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ smiles: selectedSMILES }),
          }
        );
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        setSelectedMoleculeImage(data.molecule_image);
      } catch (error) {
        console.error('Error fetching molecule image:', error);
        setSelectedMoleculeImage(null);
        setHasError(true);
        setErrorMessage('Failed to load molecule image. Please try again.');
      }
    };

    displayMoleculeImage();
  }, [selectedSMILES]);

 
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
      {/* <Script
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
      /> */}
      
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
            {/* <h2>
              {selectedModel
                ? `Selected model: ${selectedModel}`
                : 'No model selected'
              }
            </h2> */}
            <h2>
              Selected Dataset: Vapor Pressure of Molecules
            </h2>
          </div>

          {/* <div>
            <h3>TODOs:</h3>
            <ol className="list-decimal ml-6">
              <li>select different properties to color-code by</li>
              <li>support more than one dataset</li>
              <li>Try plotting with Plotly.js instead of plotly on the backend?</li>
              <li>Try out a 2D molecule viewer (`smilesDrawer`?)</li>
              <li>Try out a 3D molecule viewer (`3Dmol.js`?)</li>
            </ol>
          </div> */}

          <div className="flex flex-row items-center justify-between w-full">
            <div>
              <h3>Put 2D/3D view of molecules here...</h3>
              <div>
              {selectedMoleculeImage ? (
                <img 
                  src={selectedMoleculeImage} 
                  alt="Selected molecule"
                  className="w-full"
                />
              ) : (
                <div className="flex items-center justify-center h-48 bg-gray-100 rounded-lg">
                  <p className="text-gray-500">Click a point to view molecule</p>
                </div>
              )}
              </div>
            </div>
            <div className="w-full max-w-4xl">
              {plotData && (
                <Plot
                data={plotData.data}
                // layout={plotData.layout}
                layout={{
                  ...plotData.layout,
                  clickmode: 'event'
                }}
                config={{ responsive: true }}
                style={{ width: '100%', height: '600px' }}
                onClick={handlePointClick}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};


export default MolecularDesignPage;
