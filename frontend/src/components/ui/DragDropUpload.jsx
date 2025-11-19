import { UploadCloud, FileText } from 'lucide-react';
import { useState, useCallback } from 'react';
import PropTypes from 'prop-types';

export function DragDropUpload({ onFileSelect }) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith('.csv')) {
        setSelectedFile(file);
        onFileSelect?.(file);
      } else {
        // Trigger error toast - handled by parent component
        onFileSelect?.(null, new Error('Only CSV files are allowed'));
      }
    }
  }, [onFileSelect]);

  const handleChange = useCallback((e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      onFileSelect?.(file);
    }
  }, [onFileSelect]);

  const handleRemove = useCallback((e) => {
    e.stopPropagation();
    setSelectedFile(null);
    onFileSelect?.(null);
  }, [onFileSelect]);

  return (
    <div className="w-full">
      <label 
        className={`
          flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-200
          ${dragActive 
            ? 'border-blue-500 bg-blue-500/10' 
            : 'border-zinc-700 bg-zinc-900/50 hover:border-zinc-500 hover:bg-zinc-900'
          }
        `}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <div className="flex flex-col items-center justify-center pt-5 pb-6">
          {selectedFile ? (
            <div className="flex flex-col items-center">
              <div className="h-12 w-12 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center mb-3">
                <FileText size={24} />
              </div>
              <p className="mb-1 text-sm text-white font-medium">{selectedFile.name}</p>
              <p className="text-xs text-zinc-500">{(selectedFile.size / 1024).toFixed(1)} KB</p>
              <button
                type="button"
                onClick={handleRemove}
                className="mt-2 text-xs text-zinc-500 hover:text-white transition-colors"
              >
                Remove
              </button>
            </div>
          ) : (
            <>
              <UploadCloud className={`w-10 h-10 mb-3 ${dragActive ? 'text-blue-400' : 'text-zinc-500'}`} />
              <p className="mb-2 text-sm text-zinc-400">
                <span className="font-semibold text-white">Click to upload</span> or drag and drop
              </p>
              <p className="text-xs text-zinc-600">Historical Sales Data (.CSV)</p>
            </>
          )}
        </div>
        <input type="file" className="hidden" accept=".csv" onChange={handleChange} />
      </label>
    </div>
  );
}

DragDropUpload.propTypes = {
  onFileSelect: PropTypes.func,
};

