import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Upload, Plus, Loader2, Save, Trash2, ChevronDown, ChevronUp, Calendar, Filter, List, Receipt, Edit2, X, CheckSquare, Square } from 'lucide-react';

const Expenses = ({ token }) => {
  const [view, setView] = useState('scan');

  // --- SCANNER STATE ---
  const [pendingItems, setPendingItems] = useState([]);
  const [isScanning, setIsScanning] = useState(false);
  const [rawOcrText, setRawOcrText] = useState('');
  const [showRaw, setShowRaw] = useState(false);
  const [manualItem, setManualItem] = useState({ description: '', amount: '', expense_date: new Date().toISOString().split('T')[0] });

  // --- HISTORY STATE ---
  const [history, setHistory] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedIds, setSelectedIds] = useState([]); // For Bulk Delete
  const [editingId, setEditingId] = useState(null); // For Inline Edit
  const [editData, setEditData] = useState({ description: '', amount: '', expense_date: '' });

  const fetchHistory = async () => {
    try {
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/expenses`, { headers: { Authorization: `Bearer ${token}` } });
      setHistory(res.data);
      setSelectedIds([]); // Clear selections on fetch
    } catch (err) { console.error("Failed to fetch history", err); }
  };

  useEffect(() => { if (view === 'history') fetchHistory(); }, [view]);

  // --- SCANNER FUNCTIONS ---
  const handleManualAdd = (e) => {
    e.preventDefault();
    if (!manualItem.description || !manualItem.amount) return;
    setPendingItems([...pendingItems, { ...manualItem, id: Date.now() }]);
    setManualItem({ ...manualItem, description: '', amount: '' });
  };

  const handleScan = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsScanning(true); setRawOcrText('');
    const data = new FormData(); data.append('receipt', file);

    try {
      const res = await axios.post(`${import.meta.env.VITE_API_URL}/expenses/scan`, data, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' } });
      const newItems = res.data.items.map((item, index) => ({ ...item, id: Date.now() + index }));
      setPendingItems([...pendingItems, ...newItems]);
      setRawOcrText(res.data.raw || '');
      if (newItems.length === 0) { setShowRaw(true); alert("No items found. Check the raw OCR. Not fully optimized!"); }
    } catch (err) { alert("Failed to scan receipt. Please add items manually."); }
    finally { setIsScanning(false); e.target.value = null; }
  };

  const updatePendingItem = (id, field, value) => setPendingItems(pendingItems.map(item => item.id === id ? { ...item, [field]: value } : item));
  const removePendingItem = (id) => setPendingItems(pendingItems.filter(item => item.id !== id));

  const handleSubmitBatch = async () => {
    if (pendingItems.length === 0) return alert("List is empty!");
    try {
      await axios.post(`${import.meta.env.VITE_API_URL}/expenses/bulk`, { items: pendingItems }, { headers: { Authorization: `Bearer ${token}` } });
      alert("All items saved to database!");
      setPendingItems([]);
    } catch (err) { alert("Failed to save to database."); }
  };

  // --- HISTORY EDIT & DELETE FUNCTIONS ---
  const startEditing = (item) => {
    setEditingId(item.id);
    setEditData({ description: item.description, amount: item.amount, expense_date: item.expense_date.split('T')[0] });
  };

  const saveEdit = async (id) => {
    try {
      await axios.put(`${import.meta.env.VITE_API_URL}/expenses/${id}`, editData, { headers: { Authorization: `Bearer ${token}` } });
      setEditingId(null);
      fetchHistory();
    } catch (err) { alert("Failed to update expense"); }
  };

  const deleteSingle = async (id) => {
    if (!window.confirm("Delete this expense?")) return;
    try {
      await axios.post(`${import.meta.env.VITE_API_URL}/expenses/bulk-delete`, { ids: [id] }, { headers: { Authorization: `Bearer ${token}` } });
      fetchHistory();
    } catch (err) { alert("Failed to delete."); }
  };

  // --- BULK DELETE LOGIC ---
  const toggleSelection = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleAll = (filteredItems) => {
    if (selectedIds.length === filteredItems.length) {
      setSelectedIds([]); // Deselect all
    } else {
      setSelectedIds(filteredItems.map(item => item.id)); // Select all in current view
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedIds.length} items?`)) return;

    try {
      await axios.post(`${import.meta.env.VITE_API_URL}/expenses/bulk-delete`, { ids: selectedIds }, { headers: { Authorization: `Bearer ${token}` } });
      fetchHistory();
    } catch (err) { alert("Bulk delete failed."); }
  };

  // --- FILTERS ---
  const filteredHistory = history.filter(item => (new Date(item.expense_date).getMonth() + 1) === Number(selectedMonth));
  const totalFilteredAmount = filteredHistory.reduce((sum, item) => sum + Number(item.amount), 0);

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* Top Navigation Toggle */}
      <div className="flex bg-slate-900 border border-slate-800 rounded-lg p-1 w-fit mb-6">
        <button onClick={() => setView('scan')} className={`px-4 py-2 rounded-md text-sm font-bold transition flex items-center gap-2 ${view === 'scan' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
          <Plus size={16} /> New Expenses
        </button>
        <button onClick={() => { setView('history'); setSelectedMonth(new Date().getMonth() + 1); }} className={`px-4 py-2 rounded-md text-sm font-bold transition flex items-center gap-2 ${view === 'history' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
          <List size={16} /> History & Filters
        </button>
      </div>

      {view === 'scan' ? (
        // --- SCANNER VIEW ---
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-800/50 p-6 rounded-2xl border border-slate-700">
            <form onSubmit={handleManualAdd} className="space-y-4">
              <h3 className="font-bold text-slate-300">Manual Entry</h3>
              <div className="flex gap-2">
                <input type="text" placeholder="Item (e.g., Coffee)" required className="flex-1 bg-slate-900 border border-slate-700 rounded p-2 text-white" value={manualItem.description} onChange={e => setManualItem({ ...manualItem, description: e.target.value })} />
                <input type="number" step="0.01" placeholder="€ 0.00" required className="w-24 bg-slate-900 border border-slate-700 rounded p-2 text-white" value={manualItem.amount} onChange={e => setManualItem({ ...manualItem, amount: e.target.value })} />
                <button type="submit" className="bg-blue-600 hover:bg-blue-500 p-2 rounded text-white transition"><Plus /></button>
              </div>
            </form>
            <div className="space-y-4 md:border-l md:border-slate-700 md:pl-6">
              <h3 className="font-bold text-slate-300">Scan Receipt</h3>
              <div className="relative w-full h-12">
                <input type="file" accept="image/*" onChange={handleScan} disabled={isScanning} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                <div className={`absolute inset-0 flex items-center justify-center gap-2 rounded-lg font-bold transition ${isScanning ? 'bg-slate-700 text-slate-400' : 'bg-indigo-600 hover:bg-indigo-500 text-white'}`}>
                  {isScanning ? <><Loader2 className="animate-spin" /> Extracting...</> : <><Upload /> Upload & Extract</>}
                </div>
              </div>
            </div>
          </div>

          {rawOcrText && (
            <div className="bg-slate-900 rounded-2xl border border-slate-700 overflow-hidden">
              <button onClick={() => setShowRaw(!showRaw)} className="w-full flex items-center justify-between p-4 text-slate-400 hover:text-white transition text-sm">
                <span>🔍 Raw OCR Output (Debug Missed Items)</span>
                {showRaw ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              {showRaw && <pre className="p-4 pt-0 text-xs text-slate-500 whitespace-pre-wrap font-mono max-h-48 overflow-y-auto border-t border-slate-800">{rawOcrText}</pre>}
            </div>
          )}

          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-700">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">Pending List ({pendingItems.length})</h3>
              {pendingItems.length > 0 && <button onClick={handleSubmitBatch} className="bg-green-600 hover:bg-green-500 flex items-center gap-2 px-6 py-2 rounded-full font-bold transition"><Save size={18} /> Save All to DB</button>}
            </div>
            {pendingItems.length === 0 ? <p className="text-slate-500 text-center py-8">No items yet. Add manually or scan a receipt.</p> : (
              <div className="space-y-3">
                {pendingItems.map((item) => (
                  <div key={item.id} className="flex items-center gap-4 bg-slate-800 p-3 rounded-lg border border-slate-700">
                    <input type="date" className="bg-transparent text-sm text-slate-400 focus:outline-none" value={item.expense_date} onChange={(e) => updatePendingItem(item.id, 'expense_date', e.target.value)} />
                    <input type="text" className="flex-1 bg-transparent font-medium focus:outline-none text-white" value={item.description} onChange={(e) => updatePendingItem(item.id, 'description', e.target.value)} />
                    <div className="flex items-center gap-1"><span className="text-slate-500">€</span><input type="number" step="0.01" className="w-20 bg-transparent text-right font-bold text-green-400 focus:outline-none" value={item.amount} onChange={(e) => updatePendingItem(item.id, 'amount', e.target.value)} /></div>
                    <button onClick={() => removePendingItem(item.id)} className="text-slate-500 hover:text-red-500 transition ml-2"><Trash2 size={18} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        // --- HISTORY VIEW ---
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row items-center justify-between bg-slate-800/50 p-6 rounded-2xl border border-slate-700 gap-4">

            <div className="flex items-center gap-4 w-full md:w-auto">
              <div className="flex items-center gap-3">
                <Filter className="text-blue-400" size={20} />
                <select className="bg-slate-900 border border-slate-700 text-white rounded-lg p-3 focus:outline-none" value={selectedMonth} onChange={(e) => { setSelectedMonth(e.target.value); setSelectedIds([]); }}>
                  {Array.from({ length: 12 }, (_, i) => (<option key={i + 1} value={i + 1}>{new Date(0, i).toLocaleString('en-US', { month: 'long' })}</option>))}
                </select>
              </div>

              {/* Bulk Delete Button */}
              {selectedIds.length > 0 && (
                <button onClick={handleBulkDelete} className="flex items-center gap-2 bg-red-600/20 text-red-400 border border-red-500/30 hover:bg-red-600 hover:text-white px-4 py-3 rounded-lg transition font-bold text-sm">
                  <Trash2 size={16} /> Delete ({selectedIds.length})
                </button>
              )}
            </div>

            <div className="text-left md:text-right w-full md:w-auto bg-slate-900 md:bg-transparent p-4 md:p-0 rounded-lg">
              <p className="text-sm text-slate-400">Total for Month</p>
              <p className="text-3xl font-black text-green-400">€{totalFilteredAmount.toFixed(2)}</p>
            </div>
          </div>

          <div className="bg-slate-900 rounded-2xl border border-slate-700 overflow-x-auto">
            {filteredHistory.length === 0 ? <p className="text-slate-500 text-center py-10">No expenses logged for this month.</p> : (
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead>
                  <tr className="bg-slate-800/50 text-slate-400 text-sm border-b border-slate-700">
                    <th className="p-4 w-12 text-center">
                      <button onClick={() => toggleAll(filteredHistory)}>
                        {selectedIds.length === filteredHistory.length && filteredHistory.length > 0 ? <CheckSquare className="text-blue-400" size={18} /> : <Square className="text-slate-500" size={18} />}
                      </button>
                    </th>
                    <th className="p-4 font-medium"><Calendar size={16} className="inline mr-2" />Date</th>
                    <th className="p-4 font-medium"><Receipt size={16} className="inline mr-2" />Description</th>
                    <th className="p-4 font-medium text-right">Amount</th>
                    <th className="p-4 font-medium text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.map(item => (
                    <tr key={item.id} className={`border-b border-slate-800/50 transition ${selectedIds.includes(item.id) ? 'bg-blue-900/10' : 'hover:bg-slate-800/30'}`}>

                      <td className="p-4 text-center">
                        <button onClick={() => toggleSelection(item.id)}>
                          {selectedIds.includes(item.id) ? <CheckSquare className="text-blue-400" size={18} /> : <Square className="text-slate-600" size={18} />}
                        </button>
                      </td>

                      {editingId === item.id ? (
                        <>
                          <td className="p-4"><input type="date" className="bg-slate-800 border border-blue-500 rounded px-2 py-1 text-slate-300 text-sm" value={editData.expense_date} onChange={(e) => setEditData({ ...editData, expense_date: e.target.value })} /></td>
                          <td className="p-4"><input type="text" className="w-full bg-slate-800 border border-blue-500 rounded px-2 py-1 text-white text-sm" value={editData.description} onChange={(e) => setEditData({ ...editData, description: e.target.value })} /></td>
                          <td className="p-4 text-right"><input type="number" step="0.01" className="w-20 bg-slate-800 border border-blue-500 rounded px-2 py-1 text-white text-sm text-right" value={editData.amount} onChange={(e) => setEditData({ ...editData, amount: e.target.value })} /></td>
                          <td className="p-4 text-center">
                            <div className="flex justify-center gap-2">
                              <button onClick={() => saveEdit(item.id)} className="text-green-400 hover:bg-slate-700 p-2 rounded"><Save size={16} /></button>
                              <button onClick={() => setEditingId(null)} className="text-slate-400 hover:bg-slate-700 p-2 rounded"><X size={16} /></button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="p-4 text-slate-400 text-sm">{new Date(item.expense_date).toLocaleDateString('de-DE')}</td>
                          <td className="p-4 text-white font-medium">{item.description}</td>
                          <td className="p-4 text-right font-bold text-green-400">€{Number(item.amount).toFixed(2)}</td>
                          <td className="p-4 text-center opacity-100 md:opacity-0 hover:opacity-100 transition">
                            <div className="flex justify-center gap-2">
                              <button onClick={() => startEditing(item)} className="text-blue-400 hover:bg-slate-700 p-2 rounded"><Edit2 size={16} /></button>
                              <button onClick={() => deleteSingle(item.id)} className="text-red-400 hover:bg-slate-700 p-2 rounded"><Trash2 size={16} /></button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Expenses;