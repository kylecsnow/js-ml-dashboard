'use client';

import type { ReactNode, WheelEvent } from 'react';
import type { DescriptorGroup } from '../../dataset-generator/page';

interface DescriptorSectionProps {
  title: string;
  addLabel: string;
  isOpen: boolean;
  onToggle: () => void;
  groups: DescriptorGroup[];
  onAdd: () => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, field: keyof DescriptorGroup, value: string) => void;
  preventWheelChange: (e: WheelEvent<HTMLInputElement>) => void;
  renderCollapseIcon: (isOpen: boolean) => ReactNode;
}

const DescriptorSection = ({
  title,
  addLabel,
  isOpen,
  onToggle,
  groups,
  onAdd,
  onRemove,
  onUpdate,
  preventWheelChange,
  renderCollapseIcon,
}: DescriptorSectionProps) => {
  return (
    <div className="mb-6 p-4 border-2 border-gray-400 rounded-lg">
      <button
        type="button"
        onClick={onToggle}
        className="mb-2 w-full flex items-center gap-4 text-left"
      >
        {renderCollapseIcon(isOpen)}
        <h2 className="text-lg font-bold">{title}</h2>
      </button>
      {isOpen && (
        <>
          <button
            onClick={onAdd}
            className="mb-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            {addLabel}
          </button>
          {groups.map(group => (
            <div key={group.id} className="mb-6 p-4 border rounded-lg relative">
              <button
                onClick={() => onRemove(group.id)}
                className="absolute top-2 right-2 text-red-500 hover:text-red-700"
              >
                ✕
              </button>
              <div className="flex flex-col md:flex-row md:items-end gap-4">
                <div className="md:flex-1 md:min-w-0">
                  <label className="block text-sm font-medium mb-1">Variable name</label>
                  <input
                    type="text"
                    value={group.name}
                    onChange={(e) => onUpdate(group.id, 'name', e.target.value)}
                    className="w-full p-2 border border-gray-600 rounded"
                  />
                </div>
                <div className="md:w-32">
                  <label className="block text-sm font-medium mb-1">Lower bound</label>
                  <input
                    type="number"
                    value={group.min}
                    onChange={(e) => onUpdate(group.id, 'min', e.target.value)}
                    onWheel={preventWheelChange}
                    className="w-full p-2 border border-gray-600 rounded"
                  />
                </div>
                <div className="md:w-32">
                  <label className="block text-sm font-medium mb-1">Upper bound</label>
                  <input
                    type="number"
                    value={group.max}
                    onChange={(e) => onUpdate(group.id, 'max', e.target.value)}
                    onWheel={preventWheelChange}
                    className="w-full p-2 border border-gray-600 rounded"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Units (optional)</label>
                  <input
                    type="text"
                    value={group.units}
                    onChange={(e) => onUpdate(group.id, 'units', e.target.value)}
                    className="w-full p-2 border border-gray-600 rounded"
                  />
                </div>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
};

export default DescriptorSection;
