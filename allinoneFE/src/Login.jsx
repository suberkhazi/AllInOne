import React, { useState } from 'react';
import axios from 'axios';
import { Mail, Lock, User, ArrowRight, Shield } from 'lucide-react';

const Login = ({ setToken }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {

      if (isRegistering) {
        // 1. Register the user
        await axios.post(`${import.meta.env.VITE_API_URL}/register`, formData);
        alert("Account created! Logging you in...");
      }

      // 2. Log them in (happens automatically after register, or directly if logging in)
      const res = await axios.post(`${import.meta.env.VITE_API_URL}/login`, {
        email: formData.email,
        password: formData.password
      });

      localStorage.setItem('token', res.data.token);
      localStorage.setItem('userEmail', formData.email || email);
      setToken(res.data.token);
    } catch (err) {
      alert("Error: " + (err.response?.data?.error || "Server error"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4">
      <div className="w-full max-w-md bg-slate-900/50 backdrop-blur-xl border border-slate-800 p-8 rounded-3xl shadow-2xl relative overflow-hidden">

        <div className="flex justify-center mb-6 relative z-10">
          <div className="bg-blue-600/20 p-4 rounded-full border border-blue-500/30">
            <Shield className="text-blue-500" size={40} />
          </div>
        </div>

        <h2 className="text-3xl font-bold text-center text-white mb-2 relative z-10">
          {isRegistering ? 'Create Account' : 'Welcome Back'}
        </h2>
        <p className="text-slate-400 text-center mb-8 relative z-10">
          {isRegistering ? 'Join the Beryllium Network' : 'Sign in to All in One'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
          {isRegistering && (
            <div className="relative">
              <User className="absolute left-4 top-3.5 text-slate-500" size={20} />
              <input
                type="text" placeholder="Full Name" required={isRegistering}
                className="w-full bg-slate-800/50 border border-slate-700 rounded-xl py-3 pl-12 pr-4 text-white focus:outline-none focus:border-blue-500 transition"
                value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
          )}

          <div className="relative">
            <Mail className="absolute left-4 top-3.5 text-slate-500" size={20} />
            <input
              type="email" placeholder="Email Address" required
              className="w-full bg-slate-800/50 border border-slate-700 rounded-xl py-3 pl-12 pr-4 text-white focus:outline-none focus:border-blue-500 transition"
              value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-4 top-3.5 text-slate-500" size={20} />
            <input
              type="password" placeholder="Password" required
              className="w-full bg-slate-800/50 border border-slate-700 rounded-xl py-3 pl-12 pr-4 text-white focus:outline-none focus:border-blue-500 transition"
              value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            />
          </div>

          <button type="submit" disabled={isLoading} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-4 rounded-xl transition flex justify-center items-center gap-2 shadow-lg shadow-blue-900/20">
            {isLoading ? 'Processing...' : <><ArrowRight size={20} /> {isRegistering ? 'Sign Up' : 'Access Secure Panel'}</>}
          </button>
        </form>

        <div className="mt-6 text-center relative z-10">
          <button onClick={() => setIsRegistering(!isRegistering)} className="text-slate-400 hover:text-blue-400 transition text-sm">
            {isRegistering ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;