import { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import { ChevronDown, ChevronUp, Search } from 'lucide-react';

// Mock inventory data - in a real app, this would come from props/API
const generateInventoryData = (summary) => {
  if (!summary) return [];
  
  return [
    {
      id: 'SKU-001',
      name: 'Product A',
      category: 'Electronics',
      currentStock: summary.current_stock_level || 0,
      reorderPoint: summary.optimal_reorder_point || 0,
      safetyStock: summary.safety_stock || 0,
      status: summary.current_stock_level < (summary.optimal_reorder_point || 0) ? 'low' : 'ok',
      location: 'Warehouse-1',
      unitCost: 10.50,
    },
    {
      id: 'SKU-002',
      name: 'Product B',
      category: 'Electronics',
      currentStock: (summary.current_stock_level || 0) + 50,
      reorderPoint: (summary.optimal_reorder_point || 0) + 20,
      safetyStock: (summary.safety_stock || 0) + 10,
      status: 'ok',
      location: 'Warehouse-2',
      unitCost: 15.75,
    },
    {
      id: 'SKU-003',
      name: 'Product C',
      category: 'Parts',
      currentStock: Math.floor((summary.current_stock_level || 0) * 0.3),
      reorderPoint: (summary.optimal_reorder_point || 0) + 50,
      safetyStock: (summary.safety_stock || 0) + 15,
      status: 'low',
      location: 'Warehouse-1',
      unitCost: 8.25,
    },
  ];
};

function InventoryTable({ summary = null }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  
  const inventoryData = useMemo(() => generateInventoryData(summary), [summary]);

  const filteredData = useMemo(() => {
    if (!searchQuery) return inventoryData;
    const query = searchQuery.toLowerCase();
    return inventoryData.filter(
      (item) =>
        item.id.toLowerCase().includes(query) ||
        item.name.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query) ||
        item.location.toLowerCase().includes(query)
    );
  }, [inventoryData, searchQuery]);

  const sortedData = useMemo(() => {
    if (!sortConfig.key) return filteredData;
    
    return [...filteredData].sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];
      
      if (typeof aVal === 'string') {
        return sortConfig.direction === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      
      return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [filteredData, sortConfig]);

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const SortIcon = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) return null;
    return sortConfig.direction === 'asc' ? (
      <ChevronUp className="w-3 h-3 inline ml-1" />
    ) : (
      <ChevronDown className="w-3 h-3 inline ml-1" />
    );
  };

  SortIcon.propTypes = {
    columnKey: PropTypes.string.isRequired,
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800">
      <div className="border-b border-zinc-800 px-4 py-3 flex items-center gap-3">
        <Search className="w-4 h-4 text-zinc-500" strokeWidth={1.5} />
        <input
          type="text"
          placeholder="Search inventory..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 bg-transparent border-0 outline-none text-white placeholder:text-zinc-500 text-sm font-sans"
        />
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-800">
              {[
                { key: 'id', label: 'SKU' },
                { key: 'name', label: 'Product' },
                { key: 'category', label: 'Category' },
                { key: 'currentStock', label: 'Stock' },
                { key: 'reorderPoint', label: 'Reorder Point' },
                { key: 'safetyStock', label: 'Safety Stock' },
                { key: 'status', label: 'Status' },
                { key: 'location', label: 'Location' },
                { key: 'unitCost', label: 'Unit Cost' },
              ].map(({ key, label }) => (
                <th
                  key={key}
                  onClick={() => handleSort(key)}
                  className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider cursor-pointer hover:bg-zinc-800 transition-colors"
                >
                  <span className="flex items-center">
                    {label}
                    <SortIcon columnKey={key} />
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedData.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-sm text-zinc-500">
                  No inventory items found
                </td>
              </tr>
            ) : (
              sortedData.map((item, index) => (
                <tr
                  key={item.id}
                  className={`border-b border-zinc-800/50 hover:bg-zinc-800/50 transition-colors ${
                    index % 2 === 0 ? 'bg-zinc-900' : 'bg-zinc-950/50'
                  }`}
                >
                  <td className="px-4 py-3 text-sm font-mono-numbers text-white">
                    {item.id}
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-300">{item.name}</td>
                  <td className="px-4 py-3 text-sm text-zinc-400">{item.category}</td>
                  <td className="px-4 py-3 text-sm font-mono-numbers text-white">
                    {item.currentStock.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm font-mono-numbers text-zinc-400">
                    {item.reorderPoint.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm font-mono-numbers text-zinc-400">
                    {item.safetyStock.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        item.status === 'low'
                          ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                          : 'bg-green-500/10 text-green-400 border border-green-500/20'
                      }`}
                    >
                      {item.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm font-mono-numbers text-zinc-400">
                    {item.location}
                  </td>
                  <td className="px-4 py-3 text-sm font-mono-numbers text-zinc-400">
                    ${item.unitCost.toFixed(2)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

InventoryTable.propTypes = {
  summary: PropTypes.shape({
    current_stock_level: PropTypes.number,
    optimal_reorder_point: PropTypes.number,
    safety_stock: PropTypes.number,
  }),
};

export default InventoryTable;

