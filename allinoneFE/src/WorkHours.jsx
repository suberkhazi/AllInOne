import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Play, Square, Coffee, CheckCircle, Filter, Clock, Download, Edit2, Trash2, Save, X } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const WorkHours = ({ token }) => {
  const userEmail = localStorage.getItem('userEmail');
  const [entries, setEntries] = useState([]);
  const [status, setStatus] = useState(localStorage.getItem('wh_status') || 'idle');
  const [punchInTime, setPunchInTime] = useState(localStorage.getItem('wh_punchIn') ? new Date(localStorage.getItem('wh_punchIn')) : null);
  const [breakStartTime, setBreakStartTime] = useState(localStorage.getItem('wh_breakStart') ? new Date(localStorage.getItem('wh_breakStart')) : null);
  const [totalBreakMinutes, setTotalBreakMinutes] = useState(Number(localStorage.getItem('wh_breakTotal')) || 0);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);

  // Edit State
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({ punch_in: '', punch_out: '', break_minutes: 0 });

  useEffect(() => {
    localStorage.setItem('wh_status', status);
    if (punchInTime) localStorage.setItem('wh_punchIn', punchInTime.toISOString()); else localStorage.removeItem('wh_punchIn');
    if (breakStartTime) localStorage.setItem('wh_breakStart', breakStartTime.toISOString()); else localStorage.removeItem('wh_breakStart');
    localStorage.setItem('wh_breakTotal', totalBreakMinutes);
  }, [status, punchInTime, breakStartTime, totalBreakMinutes]);

  const fetchHours = async () => {
    try {
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/work-hours`, { headers: { Authorization: `Bearer ${token}` } });
      setEntries(res.data);
    } catch (err) { console.error(err); }
  };

  useEffect(() => { fetchHours(); }, []);

  const formatTime = (date) => date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  const formatDate = (date) => date.toISOString().split('T')[0];

  // --- TRACKER ACTIONS ---
  const handlePunchIn = () => { setPunchInTime(new Date()); setStatus('working'); };
  const handleTakeBreak = () => { setBreakStartTime(new Date()); setStatus('break'); };
  const handleEndBreak = () => {
    const diffMins = Math.floor((new Date() - breakStartTime) / 60000);
    setTotalBreakMinutes(prev => prev + diffMins);
    setBreakStartTime(null);
    setStatus('working');
  };

  const handlePunchOut = async () => {
    const now = new Date();
    let finalBreak = totalBreakMinutes;
    if (status === 'break' && breakStartTime) finalBreak += Math.floor((now - breakStartTime) / 60000);

    const payload = { work_date: formatDate(punchInTime), punch_in: formatTime(punchInTime), punch_out: formatTime(now), break_minutes: finalBreak };
    try {
      await axios.post(`${import.meta.env.VITE_API_URL}/work-hours`, payload, { headers: { Authorization: `Bearer ${token}` } });
      setStatus('idle'); setPunchInTime(null); setBreakStartTime(null); setTotalBreakMinutes(0);
      fetchHours();
    } catch (err) { alert("Failed to save work hours."); }
  };

  // --- EDIT & DELETE ACTIONS ---
  const startEditing = (entry) => {
    setEditingId(entry.id);
    setEditData({ punch_in: entry.punch_in.substring(0, 5), punch_out: entry.punch_out.substring(0, 5), break_minutes: entry.break_minutes });
  };

  const saveEdit = async (id) => {
    try {
      await axios.put(`${import.meta.env.VITE_API_URL}/work-hours/${id}`, editData, { headers: { Authorization: `Bearer ${token}` } });
      setEditingId(null);
      fetchHours();
    } catch (err) { alert("Failed to update hours."); }
  };

  const deleteEntry = async (id) => {
    if (!window.confirm("Are you sure you want to delete this shift?")) return;
    try {
      await axios.delete(`${import.meta.env.VITE_API_URL}/work-hours/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      fetchHours();
    } catch (err) { alert("Failed to delete hours."); }
  };

  // --- CALCULATIONS ---
  const calculateNet = (inTime, outTime, pause) => {
    if (!inTime || !outTime) return "0.00";
    const [h1, m1] = inTime.split(':').map(Number);
    const [h2, m2] = outTime.split(':').map(Number);
    return (((h2 * 60 + m2) - (h1 * 60 + m1) - Number(pause)) / 60).toFixed(2);
  };

  const filteredEntries = entries.filter(entry => (new Date(entry.work_date).getMonth() + 1) === Number(selectedMonth));
  const totalMonthlyHours = filteredEntries.reduce((sum, entry) => sum + Number(calculateNet(entry.punch_in, entry.punch_out, entry.break_minutes)), 0);

  // --- PDF EXPORT ---
  const exportPDF = () => {
    const doc = new jsPDF();
    const monthName = new Date(0, selectedMonth - 1).toLocaleString('en-US', { month: 'long' });

    doc.setFontSize(18);
    doc.text(`All In One: Monthly Timesheet`, 14, 22);
    doc.setFontSize(12);
    doc.text(`Month: ${monthName} | Total Net Hours: ${totalMonthlyHours.toFixed(2)}h`, 14, 30);

    const tableData = filteredEntries.map(entry => [
      new Date(entry.work_date).toLocaleDateString('de-DE'),
      `${entry.punch_in.substring(0, 5)} - ${entry.punch_out.substring(0, 5)}`,
      `${entry.break_minutes} min`,
      `${calculateNet(entry.punch_in, entry.punch_out, entry.break_minutes)} h`
    ]);

    autoTable(doc, {
      startY: 38,
      head: [['Date', 'Time (In - Out)', 'Break', 'Net Hours']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [245, 158, 11] },
      styles: { fontSize: 10 }
    });

    doc.save(`Timesheet_${monthName}.pdf`);
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {userEmail === 'her@gmail.com' && (
        <div className="bg-pink-500/10 border border-pink-500/30 p-4 rounded-2xl mb-6 flex items-center gap-4 animate-pulse">
          <span className="text-2xl">❤️</span>
          <div>
            <h3 className="text-pink-400 font-bold text-lg">Hey Gundu,</h3>
            <p className="text-pink-300/80 text-sm">All the best. Waiting to see you soon....</p>
          </div>
        </div>
      )}
      {/* LIVE TRACKER CARD */}
      <div className="bg-slate-900/80 p-8 rounded-3xl border border-slate-700 flex flex-col items-center text-center shadow-xl">
        {status === 'idle' && (
          <>
            <h3 className="text-2xl font-bold mb-6 text-white">Ready to start the day?</h3>
            <button onClick={handlePunchIn} className="flex items-center gap-2 bg-green-600 hover:bg-green-500 px-10 py-4 rounded-full font-black text-xl text-white transition shadow-lg"><Play size={24} /> Punch In</button>
          </>
        )}
        {status === 'working' && (
          <>
            <h3 className="text-3xl font-black text-blue-400 mb-2">🧑‍💻 Working hard!</h3>
            <p className="text-slate-400 mb-8 font-medium">Don't forget to drink water! 💧</p>
            <div className="flex flex-col sm:flex-row gap-4">
              <button onClick={handleTakeBreak} className="flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-400 text-white px-8 py-4 rounded-full font-bold transition shadow-lg"><Coffee size={20} /> Take Break</button>
              <button onClick={handlePunchOut} className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 text-white px-8 py-4 rounded-full font-bold transition shadow-lg"><Square size={20} /> Punch Out</button>
            </div>
          </>
        )}
        {status === 'break' && (
          <>
            <h3 className="text-3xl font-black text-orange-400 mb-2">☕ On Break</h3>
            <button onClick={handleEndBreak} className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-10 py-4 rounded-full font-bold text-lg transition shadow-lg mt-4"><CheckCircle size={24} /> End Break & Resume</button>
          </>
        )}
        {punchInTime && <p className="mt-8 text-sm font-medium text-slate-500 bg-slate-800 px-4 py-2 rounded-full">Punched in at {formatTime(punchInTime)} • Accumulated Break: {totalBreakMinutes}m</p>}
      </div>

      {/* HISTORY & FILTERS */}
      <div className="bg-slate-800/50 rounded-3xl border border-slate-700 p-6 space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 border-b border-slate-700 pb-6">
          <div className="flex items-center gap-3 w-full md:w-auto">
            <Filter className="text-blue-400" size={20} />
            <select className="bg-slate-900 border border-slate-600 text-white rounded-xl p-3 w-full md:w-48 focus:outline-none focus:border-blue-500" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
              {Array.from({ length: 12 }, (_, i) => (<option key={i + 1} value={i + 1}>{new Date(0, i).toLocaleString('en-US', { month: 'long' })}</option>))}
            </select>
          </div>

          <div className="flex items-center gap-6 w-full md:w-auto">
            <button onClick={exportPDF} className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-4 py-3 rounded-xl transition font-bold text-sm w-full md:w-auto justify-center">
              <Download size={18} /> Export Timesheet
            </button>
            <div className="text-right hidden md:block">
              <p className="text-sm text-slate-400 font-medium">Net Hours</p>
              <p className="text-3xl font-black text-orange-400">{totalMonthlyHours.toFixed(2)}h</p>
            </div>
          </div>
        </div>

        {/* TABLE */}
        <div className="overflow-x-auto">
          {filteredEntries.length === 0 ? <p className="text-slate-500 text-center py-8 font-medium">No hours logged for this month.</p> : (
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="text-slate-400 text-sm border-b border-slate-700">
                  <th className="p-4 font-medium">Date</th>
                  <th className="p-4 font-medium">In - Out</th>
                  <th className="p-4 font-medium text-center">Break (min)</th>
                  <th className="p-4 font-medium text-right">Net Hours</th>
                  <th className="p-4 font-medium text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.map(entry => (
                  <tr key={entry.id} className="border-b border-slate-700/50 hover:bg-slate-800/50 transition">
                    <td className="p-4 text-white font-medium">{new Date(entry.work_date).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })}</td>

                    {/* EDIT MODE TOGGLE */}
                    {editingId === entry.id ? (
                      <>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <input type="time" className="bg-slate-900 border border-blue-500 rounded px-2 py-1 text-white text-sm" value={editData.punch_in} onChange={(e) => setEditData({ ...editData, punch_in: e.target.value })} />
                            <span className="text-slate-500">-</span>
                            <input type="time" className="bg-slate-900 border border-blue-500 rounded px-2 py-1 text-white text-sm" value={editData.punch_out} onChange={(e) => setEditData({ ...editData, punch_out: e.target.value })} />
                          </div>
                        </td>
                        <td className="p-4 text-center">
                          <input type="number" className="w-16 bg-slate-900 border border-blue-500 rounded px-2 py-1 text-white text-sm text-center" value={editData.break_minutes} onChange={(e) => setEditData({ ...editData, break_minutes: e.target.value })} />
                        </td>
                        <td className="p-4 text-right font-black text-slate-500">...</td>
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button onClick={() => saveEdit(entry.id)} className="text-green-400 hover:bg-slate-700 p-2 rounded"><Save size={18} /></button>
                            <button onClick={() => setEditingId(null)} className="text-slate-400 hover:bg-slate-700 p-2 rounded"><X size={18} /></button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="p-4 text-slate-300"><Clock size={14} className="inline mr-2 text-slate-500" />{entry.punch_in.substring(0, 5)} - {entry.punch_out.substring(0, 5)}</td>
                        <td className="p-4 text-center font-medium text-orange-400">{entry.break_minutes}m</td>
                        <td className="p-4 text-right font-black text-green-400">{calculateNet(entry.punch_in, entry.punch_out, entry.break_minutes)}h</td>
                        <td className="p-4 text-center opacity-100 md:opacity-0 hover:opacity-100 transition">
                          <div className="flex items-center justify-center gap-2">
                            <button onClick={() => startEditing(entry)} className="text-blue-400 hover:bg-slate-700 p-2 rounded"><Edit2 size={16} /></button>
                            <button onClick={() => deleteEntry(entry.id)} className="text-red-400 hover:bg-slate-700 p-2 rounded"><Trash2 size={16} /></button>
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
    </div>
  );
};

export default WorkHours;