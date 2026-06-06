'use client';

interface DeleteSchemaModalProps {
  schemaName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const DeleteSchemaModal = ({ schemaName, onConfirm, onCancel }: DeleteSchemaModalProps) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-96 shadow-xl">
        <h3 className="text-lg font-bold mb-4">Delete Schema</h3>
        <div className="mb-6 text-sm text-gray-700 dark:text-gray-300">
          <p>Are you sure you want to delete the following schema?</p>
          <p className="mt-2 font-semibold">{schemaName}</p>
          <p className="mt-2">This cannot be undone.</p>
        </div>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-300 dark:bg-gray-600 rounded hover:bg-gray-400 dark:hover:bg-gray-500"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Yes, Delete
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteSchemaModal;
