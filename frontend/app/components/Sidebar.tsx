'use client';

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import SidebarTooltip from './SidebarTooltip'

export default function Sidebar() {
  const pathName = usePathname()

  return (
    // TODO: add all the other pages from dash-ml-dashboard
    <aside style={{ backgroundColor: '#dbdbdbff' }} className="w-64 dark:bg-gray-800 p-6 hidden sm:block">
      <nav className="flex flex-col gap-[6px]">
        <Link 
          href="/"
          className={`flex items-center gap-2 p-1 pl-2 rounded-lg 
            ${pathName === '/' ? 'bg-black text-white' : 'hover:bg-gray-200'} text-[14.5px]`}
        >
          Home
          <SidebarTooltip title="Return to the home page, where you can select a different model to analyze." />
        </Link>
        <Link 
          href="/overview"
          className={`flex items-center gap-2 p-1 pl-2 rounded-lg 
            ${pathName === '/overview' ? 'bg-black text-white' : 'hover:bg-gray-200'} text-[14.5px]`}
        >
          Overview
          <SidebarTooltip title="View model details and test-set performance metrics for the selected model." />
        </Link>
        <Link 
          href="/violin-plots"
          className={`flex items-center gap-2 p-1 pl-2 rounded-lg 
            ${pathName === '/violin-plots' ? 'bg-black text-white' : 'hover:bg-gray-200'} text-[14.5px]`}
        >
          Violin Plots
          <SidebarTooltip title="View violin plots of all input & output variables to quickly inspect their distributions (useful for assessing normality, detecting outliers, etc)." />
        </Link>
        <Link 
          href="/scatter-plots"
          className={`flex items-center gap-2 p-1 pl-2 rounded-lg 
            ${pathName === '/scatter-plots' ? 'bg-black text-white' : 'hover:bg-gray-200'} text-[14.5px]`}
        >
          Scatter Plots
          <SidebarTooltip title="Create scatter plots comparing any input or output features of the selected model, including interactive 3D scatter plots." />
        </Link>
        <Link
          href="/correlation-heatmaps"
          className={`flex items-center gap-2 p-1 pl-2 rounded-lg 
            ${pathName === '/correlation-heatmaps' ? 'bg-black text-white' : 'hover:bg-gray-200'} text-[14.5px]`}
        >
          Correlation Heatmaps
          <SidebarTooltip title="View heatmaps of the correlation coefficients between features (on an input-to-input, input-to-output, or output-to-output basis)." />
        </Link>
        <Link
          href="/shap-summary-plots"
          className={`flex items-center gap-2 p-1 pl-2 rounded-lg 
            ${pathName === '/shap-summary-plots' ? 'bg-black text-white' : 'hover:bg-gray-200'} text-[14.5px]`}
        >
          SHAP Summary Plots
          <SidebarTooltip title="SHAP-based model interpretability plots illustrating the directional influence of each feature on a given output, highlighting global trends across the entire dataset." />
        </Link>
        {/* <Link
          href="/shap-feature-effects-plots"
          className={`flex items-center gap-2 p-1 pl-2 rounded-lg 
            ${pathName === '/shap-feature-effects-plots' ? 'bg-black text-white' : 'hover:bg-gray-200'} text-[14.5px]`}
        >
            
          SHAP Feature Effects Plots
        </Link> */}
        <Link
          href="/shap-waterfall-plots"
          className={`flex items-center gap-2 p-1 pl-2 rounded-lg 
            ${pathName === '/shap-waterfall-plots' ? 'bg-black text-white' : 'hover:bg-gray-200'} text-[14.5px]`}
        >
          SHAP Waterfall Plots
          <SidebarTooltip title="SHAP-based model interpretability plots illustrating the directional influence of each feature on a given output, focusing on individual predictions given by the model." />
        </Link>
        <Link
          href="/molecular-design"
          className={`flex items-center gap-2 p-1 pl-2 rounded-lg 
            ${pathName === '/molecular-design' ? 'bg-black text-white' : 'hover:bg-gray-200'} text-[14.5px]`}
        >
          Molecular Design
          <SidebarTooltip title="Visualize chemical structures resulting from a molecular design task. Similar molecules are grouped closer together, acting as a 'molecular space map'. (NOTE: Independent of the selected model.)" />
        </Link>
        <Link
          href="/dataset-generator"
          className={`flex items-center gap-2 p-1 pl-2 rounded-lg 
            ${pathName === '/dataset-generator' ? 'bg-black text-white' : 'hover:bg-gray-200'} text-[14.5px]`}
        >
          Dataset Generator
          <SidebarTooltip title="Quickly generate synthetic datasets for ML modeling, derived from randomly-defined trends between input and output variables. (NOTE: Independent of the selected model.)" />
        </Link>
        <Link
          href="/object-detection"
          className={`flex items-center gap-2 p-1 pl-2 rounded-lg 
            ${pathName === '/object-detection' ? 'bg-black text-white' : 'hover:bg-gray-200'} text-[14.5px]`}
        >
          Object Detection
          <SidebarTooltip title="A fine-tuned computer vision model trained to identify red blood cells, white blood cells, and platelets in microscope images. (NOTE: Independent of the selected model.)" />
        </Link>
      </nav>
    </aside>
  )
}
