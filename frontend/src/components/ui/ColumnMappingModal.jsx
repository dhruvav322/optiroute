import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import * as Dialog from '@radix-ui/react-dialog';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
import { X, AlertCircle } from 'lucide-react';
import { Button } from './LinearComponents.jsx';

export function ColumnMappingModal({ 
  open, 
  onOpenChange, 
  csvHeaders = [], 
  onConfirm 
}) {
  const [dateColumn, setDateColumn] = useState('');
  const [quantityColumn, setQuantityColumn] = useState('');
  const [skuColumn, setSkuColumn] = useState('');

  // Auto-detect columns when headers change
  useEffect(() => {
    if (csvHeaders.length === 0) return;

    // Try to find date column (case-insensitive)
    const dateCandidates = csvHeaders.filter(h => 
      /date|time|day|ds/.test(h.toLowerCase())
    );
    if (dateCandidates.length > 0 && !dateColumn) {
      setDateColumn(dateCandidates[0]);
    }

    // Try to find quantity column (case-insensitive)
    const qtyCandidates = csvHeaders.filter(h => 
      /quantity|qty|demand|sales|units|count|amount|value|y/.test(h.toLowerCase())
    );
    if (qtyCandidates.length > 0 && !quantityColumn) {
      setQuantityColumn(qtyCandidates[0]);
    }

    // Try to find SKU column (case-insensitive)
    const skuCandidates = csvHeaders.filter(h => 
      /sku|product|item|id|code/.test(h.toLowerCase())
    );
    if (skuCandidates.length > 0 && !skuColumn) {
      setSkuColumn(skuCandidates[0]);
    }
  }, [csvHeaders, dateColumn, quantityColumn, skuColumn]);

  const handleConfirm = () => {
    if (!dateColumn || !quantityColumn) {
      return; // Disabled button will prevent this
    }
    
    const mapping = {
      date: dateColumn,
      quantity: quantityColumn,
      ...(skuColumn && { sku: skuColumn }),
    };
    
    onConfirm(mapping);
    onOpenChange(false);
  };

  const handleReset = () => {
    setDateColumn('');
    setQuantityColumn('');
    setSkuColumn('');
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[10000]" />
        <Dialog.Content 
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[10001] w-full max-w-lg bg-[#18181b] border border-[#27272a] rounded-xl shadow-2xl outline-none"
        >
          <VisuallyHidden.Root>
            <Dialog.Title>Map CSV Columns</Dialog.Title>
          </VisuallyHidden.Root>

          <div className="p-6">
            {/* Header */}
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 bg-blue-500/20 text-blue-400 rounded-lg flex items-center justify-center">
                  <AlertCircle size={20} />
                </div>
                <div>
                  <Dialog.Title className="text-lg font-semibold text-white mb-1">
                    Map CSV Columns
                  </Dialog.Title>
                  <p className="text-sm text-muted">
                    Select which columns contain your date, quantity, and optionally SKU data.
                  </p>
                </div>
              </div>
              <Dialog.Close asChild>
                <button className="text-zinc-500 hover:text-white transition-colors">
                  <X size={20} />
                </button>
              </Dialog.Close>
            </div>

            {/* Mapping Form */}
            <div className="space-y-4 mb-6">
              {/* Date Column */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Date Column <span className="text-red-400">*</span>
                </label>
                <select
                  value={dateColumn}
                  onChange={(e) => setDateColumn(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  required
                >
                  <option value="">Select a column...</option>
                  {csvHeaders.map((header) => (
                    <option key={header} value={header} className="bg-zinc-900">
                      {header}
                    </option>
                  ))}
                </select>
              </div>

              {/* Quantity Column */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Quantity Column <span className="text-red-400">*</span>
                </label>
                <select
                  value={quantityColumn}
                  onChange={(e) => setQuantityColumn(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  required
                >
                  <option value="">Select a column...</option>
                  {csvHeaders.map((header) => (
                    <option key={header} value={header} className="bg-zinc-900">
                      {header}
                    </option>
                  ))}
                </select>
              </div>

              {/* SKU Column (Optional) */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  SKU/Product ID Column <span className="text-zinc-500 text-xs">(Optional)</span>
                </label>
                <select
                  value={skuColumn}
                  onChange={(e) => setSkuColumn(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                >
                  <option value="">None</option>
                  {csvHeaders.map((header) => (
                    <option key={header} value={header} className="bg-zinc-900">
                      {header}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted mt-1">
                  If not specified, all records will use "default_item"
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between gap-3 pt-4 border-t border-[#27272a]">
              <Button
                type="button"
                variant="ghost"
                onClick={handleReset}
                className="text-xs"
              >
                Reset
              </Button>
              <div className="flex gap-3">
                <Dialog.Close asChild>
                  <Button type="button" variant="secondary">
                    Cancel
                  </Button>
                </Dialog.Close>
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleConfirm}
                  disabled={!dateColumn || !quantityColumn}
                >
                  Confirm Mapping
                </Button>
              </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

ColumnMappingModal.propTypes = {
  open: PropTypes.bool.isRequired,
  onOpenChange: PropTypes.func.isRequired,
  csvHeaders: PropTypes.arrayOf(PropTypes.string).isRequired,
  onConfirm: PropTypes.func.isRequired,
};

