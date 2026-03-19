import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { CheckCircle, ReceiptEuro, Clock, Activity, ShieldAlert, LogOut } from 'lucide-react';

const Dashboard = ({ token, setActiveTab }) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    todos: [], expenses: [], hours: [],
    analytics: { web: 0, mobile: 0, recentLogs: [] }
  });

  // --- ADMIN CHECK ---
  const userEmail = localStorage.getItem('userEmail')?.toLowerCase().trim();
  const isAdmin = userEmail === 'admin@poco.com';

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userEmail');
    window.location.reload();
  };

  useEffect(() => {
    const fetchEverything = async () => {
      try {
        const config = { headers: { Authorization: `Bearer ${token}` } };

        // Base requests for everyone
        const requests = [
          axios.get(`${import.meta.env.VITE_API_URL}/todos`, config),
          axios.get(`${import.meta.env.VITE_API_URL}/expenses`, config),
          axios.get(`${import.meta.env.VITE_API_URL}/work-hours`, config)
        ];

        // ONLY fetch analytics if the user is the Admin!
        if (isAdmin) {
          requests.push(axios.get(`${import.meta.env.VITE_API_URL}/analytics`, config));
        }

        const responses = await Promise.all(requests);

        setData({
          todos: responses[0].data,
          expenses: responses[1].data,
          hours: responses[2].data,
          // If admin, grab the 4th response. Otherwise, keep it empty.
          analytics: isAdmin ? responses[3].data : { web: 0, mobile: 0, recentLogs: [] }
        });

      } catch (err) {
        console.error("Failed to fetch dashboard data", err);
      } finally {
        setLoading(false);
      }
    };
    fetchEverything();
  }, [token, isAdmin]);

  // Calculations for standard metrics
  const pendingTodos = data.todos.filter(t => !t.is_completed).length;
  const currentMonth = new Date().getMonth() + 1;
  const monthlyExpenses = data.expenses.filter(e => (new Date(e.expense_date).getMonth() + 1) === currentMonth).reduce((sum, e) => sum + Number(e.amount), 0);

  const calculateNet = (inT, outT, brk) => {
    if (!inT || !outT) return 0;
    const [h1, m1] = inT.split(':').map(Number);
    const [h2, m2] = outT.split(':').map(Number);
    return (((h2 * 60 + m2) - (h1 * 60 + m1) - Number(brk)) / 60);
  };
  const monthlyHours = data.hours.filter(h => (new Date(h.work_date).getMonth() + 1) === currentMonth).reduce((sum, h) => sum + calculateNet(h.punch_in, h.punch_out, h.break_minutes), 0);

  if (loading) return <div className="flex h-64 items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div></div>;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-10 flex justify-between items-start">
        <div>
          <h2 className="text-3xl font-black text-white mb-2">Command Center</h2>
          <p className="text-slate-400">Welcome back. Here is your overview for this month.</p>
        </div>
        <button
          onClick={handleLogout}
          className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 p-3 rounded-2xl transition flex items-center gap-2"
        >
          <LogOut size={20} />
          <span className="font-bold text-sm hidden sm:block">Sign Out</span>
        </button>
      </div>

      {/* --- ADMIN ONLY --- */}
      {isAdmin && (
        <div className="bg-slate-900/80 border border-slate-700 rounded-3xl p-6 shadow-xl mb-10">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-black text-white flex items-center gap-2">
              <Activity size={24} className="text-blue-500" /> Live Telemetry
            </h3>
            <span className="bg-red-500/10 text-red-400 border border-red-500/20 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
              <ShieldAlert size={14} /> Admin Only
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700">
              <p className="text-slate-400 text-sm font-bold">Web Visits</p>
              <p className="text-3xl font-black text-white">{data.analytics.web}</p>
            </div>
            <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700">
              <p className="text-slate-400 text-sm font-bold">Mobile Visits</p>
              <p className="text-3xl font-black text-white">{data.analytics.mobile}</p>
            </div>
            <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700 col-span-2">
              <p className="text-slate-400 text-sm font-bold">Total Network Traffic</p>
              <p className="text-3xl font-black text-green-400">
                {data.analytics.web + data.analytics.mobile} Requests
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-2">Recent Connections</p>
            {data.analytics.recentLogs.map((log, idx) => (
              <div key={idx} className="flex flex-col md:flex-row md:justify-between md:items-center bg-slate-800/30 p-3 rounded-lg border border-slate-700/50 gap-2">
                <div className="flex flex-col">
                  <span className="text-sm text-slate-300 font-mono">{log.ip_address}</span>
                  <span className="text-xs text-slate-500">{log.location}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-bold text-slate-300">{log.device_model}</p>
                    <p className="text-xs text-slate-500">{log.os}</p>
                  </div>
                  <span className={`text-xs font-bold px-2 py-1 rounded ${log.platform === 'web' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'}`}>
                    {log.platform.toUpperCase()}
                  </span>
                  <span className="text-xs text-slate-500 whitespace-nowrap">{new Date(log.accessed_at).toLocaleTimeString('de-DE')}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- STANDARD KPI METRICS (Visible to everyone) --- */}
      <h3 className="text-lg font-bold text-slate-300 mb-4">Your Metrics</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* To-Dos */}
        <div onClick={() => setActiveTab('todos')} className="bg-slate-900/80 p-6 rounded-3xl border border-slate-700 cursor-pointer hover:border-blue-500/50 transition group">
          <div className="bg-blue-500/20 w-12 h-12 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition"><CheckCircle className="text-blue-500" /></div>
          <p className="text-4xl font-black text-white mb-1">{pendingTodos}</p>
          <p className="text-slate-400 font-medium">Pending Tasks</p>
        </div>

        {/* Expenses */}
        <div onClick={() => setActiveTab('expenses')} className="bg-slate-900/80 p-6 rounded-3xl border border-slate-700 cursor-pointer hover:border-green-500/50 transition group">
          <div className="bg-green-500/20 w-12 h-12 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition"><ReceiptEuro className="text-green-500" /></div>
          <p className="text-4xl font-black text-white mb-1">€{monthlyExpenses.toFixed(2)}</p>
          <p className="text-slate-400 font-medium">Monthly Spend</p>
        </div>

        {/* Hours */}
        <div onClick={() => setActiveTab('hours')} className="bg-slate-900/80 p-6 rounded-3xl border border-slate-700 cursor-pointer hover:border-orange-500/50 transition group">
          <div className="bg-orange-500/20 w-12 h-12 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition"><Clock className="text-orange-500" /></div>
          <p className="text-4xl font-black text-white mb-1">{monthlyHours.toFixed(2)}h</p>
          <p className="text-slate-400 font-medium">Net Hours</p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;