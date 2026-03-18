import React, { useState, useEffect } from 'react';
import Login from './Login';
import Dashboard from './Dashboard';
import Todos from './Todos';
import WorkHours from './WorkHours';
import Expenses from './Expenses';
import { LayoutDashboard, CheckSquare, Clock, Receipt, LogOut, Wifi, WifiOff } from 'lucide-react';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Listen for network changes
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    import('axios').then((axios) => {
      // Basic browser extraction
      let browserName = "Unknown Browser";
      if (navigator.userAgent.includes("Chrome")) browserName = "Chrome";
      else if (navigator.userAgent.includes("Safari")) browserName = "Safari";
      else if (navigator.userAgent.includes("Firefox")) browserName = "Firefox";

      axios.default.post(`${import.meta.env.VITE_API_URL}/track-access`, {
        platform: 'web',
        device_model: navigator.platform || 'Desktop', // e.g., "MacIntel" or "Win32"
        os: browserName
      }).catch(() => console.log("Analytics ping skipped."));
    });
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!token) return <Login setToken={setToken} />;

  const handleLogout = () => { localStorage.removeItem('token'); setToken(null); };

  const tabs = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'todos', icon: CheckSquare, label: 'To-Dos' },
    { id: 'hours', icon: Clock, label: 'Hours' },
    { id: 'expenses', icon: Receipt, label: 'Expenses' },
  ];

  const NetworkBadge = () => (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold transition-all ${isOnline ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
      {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
      {isOnline ? 'Connected to F1 Server' : 'Offline Mode'}
    </div>
  );

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden">

      {/* DESKTOP SIDEBAR */}
      <aside className="hidden md:flex w-64 border-r border-slate-800 bg-slate-950 p-6 flex-col justify-between z-10">
        <div>
          <h1 className="text-2xl font-black mb-2 bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">All In One</h1>
          <div className="mb-8"><NetworkBadge /></div>

          <nav className="space-y-2">
            {tabs.map(tab => (
              <button
                key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-3 w-full p-3 rounded-xl transition font-medium ${activeTab === tab.id ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'}`}
              >
                <tab.icon size={20} /> {tab.label}
              </button>
            ))}
          </nav>
        </div>
        <button onClick={handleLogout} className="flex items-center gap-3 text-slate-500 hover:text-red-400 p-3 transition font-medium">
          <LogOut size={20} /> Logout
        </button>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 overflow-y-auto pb-24 md:pb-0 relative">
        <header className="md:hidden flex justify-between items-center p-4 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-10">
          <h1 className="text-xl font-black bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">Beryllium</h1>
          <NetworkBadge />
        </header>

        <div className="p-4 md:p-10 max-w-6xl mx-auto">
          {activeTab === 'dashboard' && <Dashboard token={token} setActiveTab={setActiveTab} />}
          {activeTab === 'todos' && <Todos token={token} />}
          {activeTab === 'hours' && <WorkHours token={token} />}
          {activeTab === 'expenses' && <Expenses token={token} />}
        </div>
      </main>

      {/* MOBILE BOTTOM NAVIGATION */}
      <nav className="md:hidden fixed bottom-0 w-full bg-slate-950/90 backdrop-blur-lg border-t border-slate-800 flex justify-around p-2 z-20">
        {tabs.map(tab => (
          <button
            key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex flex-col items-center p-2 rounded-lg transition ${activeTab === tab.id ? 'text-blue-400' : 'text-slate-500'}`}
          >
            <tab.icon size={24} className={activeTab === tab.id ? 'mb-1' : 'mb-1 opacity-70'} />
            <span className="text-[10px] font-medium">{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

export default App;