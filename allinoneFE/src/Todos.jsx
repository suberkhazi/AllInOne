import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Trash2, CheckCircle, Circle, Edit2, Download, Save, X } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const Todos = ({ token }) => {
  const [todos, setTodos] = useState([]);
  const [newTask, setNewTask] = useState('');

  // Edit State
  const [editingId, setEditingId] = useState(null);
  const [editTaskText, setEditTaskText] = useState('');

  const fetchTodos = async () => {
    try {
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/todos`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTodos(res.data);
    } catch (err) { console.error("Fetch failed", err); }
  };

  useEffect(() => { fetchTodos(); }, []);

  const addTask = async (e) => {
    e.preventDefault();
    if (!newTask.trim()) return;
    try {
      await axios.post(`${import.meta.env.VITE_API_URL}/todos`, { task: newTask }, { headers: { Authorization: `Bearer ${token}` } });
      setNewTask('');
      fetchTodos();
    } catch (err) { alert("Failed to add task"); }
  };

  const toggleComplete = async (todo) => {
    try {
      await axios.put(`${import.meta.env.VITE_API_URL}/todos/${todo.id}`, { task: todo.task, is_completed: !todo.is_completed }, { headers: { Authorization: `Bearer ${token}` } });
      fetchTodos();
    } catch (err) { alert("Failed to update status"); }
  };

  const startEditing = (todo) => {
    setEditingId(todo.id);
    setEditTaskText(todo.task);
  };

  const saveEdit = async (todo) => {
    try {
      await axios.put(`${import.meta.env.VITE_API_URL}/todos/${todo.id}`, { task: editTaskText, is_completed: todo.is_completed }, { headers: { Authorization: `Bearer ${token}` } });
      setEditingId(null);
      fetchTodos();
    } catch (err) { alert("Failed to save edit"); }
  };

  const deleteTask = async (id) => {
    if (!window.confirm("Delete this task?")) return;
    try {
      await axios.delete(`${import.meta.env.VITE_API_URL}/todos/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      fetchTodos();
    } catch (err) { alert("Delete failed"); }
  };

  // --- PDF EXPORT FUNCTION ---
  const exportPDF = () => {
    const doc = new jsPDF();

    // Title
    doc.setFontSize(18);
    doc.text('All In One: To-Do List', 14, 22);

    // Generate Table Data
    const tableData = todos.map(todo => [
      todo.is_completed ? 'Done' : 'Pending',
      todo.task,
      new Date(todo.created_at).toLocaleDateString('de-DE')
    ]);

    // Draw the table using the modern syntax!
    autoTable(doc, {
      startY: 30,
      head: [['Status', 'Task Description', 'Created Date']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246] },
      styles: { fontSize: 10 }
    });

    doc.save('Todos.pdf');
  };

  return (
    <div className="max-w-3xl space-y-6">

      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white">To-Do List</h2>
        <button onClick={exportPDF} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-lg border border-slate-700 transition">
          <Download size={16} /> Export PDF
        </button>
      </div>

      <form onSubmit={addTask} className="flex gap-2">
        <input
          type="text" value={newTask} onChange={(e) => setNewTask(e.target.value)} placeholder="What needs to be done?"
          className="flex-1 bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500"
        />
        <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white px-6 rounded-xl transition font-bold flex items-center gap-2">
          <Plus size={20} /> Add
        </button>
      </form>

      <div className="space-y-3">
        {todos.map((todo) => (
          <div key={todo.id} className="flex items-center justify-between bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 hover:border-slate-600 transition group">

            {/* Left Side: Status & Text */}
            <div className="flex items-center gap-4 flex-1">
              <button onClick={() => toggleComplete(todo)}>
                {todo.is_completed ? <CheckCircle className="text-green-500" /> : <Circle className="text-slate-500" />}
              </button>

              {editingId === todo.id ? (
                <input
                  type="text" autoFocus
                  className="flex-1 bg-slate-900 border border-blue-500 rounded px-2 py-1 text-white focus:outline-none"
                  value={editTaskText} onChange={(e) => setEditTaskText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && saveEdit(todo)}
                />
              ) : (
                <span className={`text-lg ${todo.is_completed ? 'line-through text-slate-500' : 'text-slate-200'}`}>
                  {todo.task}
                </span>
              )}
            </div>

            {/* Right Side: Actions */}
            <div className="flex items-center gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition">
              {editingId === todo.id ? (
                <>
                  <button onClick={() => saveEdit(todo)} className="p-2 text-green-400 hover:bg-slate-700 rounded-lg"><Save size={18} /></button>
                  <button onClick={() => setEditingId(null)} className="p-2 text-slate-400 hover:bg-slate-700 rounded-lg"><X size={18} /></button>
                </>
              ) : (
                <>
                  <button onClick={() => startEditing(todo)} className="p-2 text-blue-400 hover:bg-slate-700 rounded-lg"><Edit2 size={18} /></button>
                  <button onClick={() => deleteTask(todo.id)} className="p-2 text-red-400 hover:bg-slate-700 rounded-lg"><Trash2 size={18} /></button>
                </>
              )}
            </div>

          </div>
        ))}
      </div>
    </div>
  );
};

export default Todos;