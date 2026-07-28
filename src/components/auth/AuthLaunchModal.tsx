import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Mail, Lock, User, ArrowRight, ShieldCheck, CheckCircle2, 
  AlertCircle, X, Sparkles, HelpCircle, TrendingUp, BarChart3, 
  PieChart, Activity, Layers, Database, Cpu, Loader2
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { InsightLogo } from '../ui/InsightLogo';

interface AuthLaunchModalProps {
  initialMode?: 'login' | 'register';
  onClose: () => void;
  onContinueAsGuest: () => void;
}

export const AuthLaunchModal: React.FC<AuthLaunchModalProps> = ({
  initialMode = 'register',
  onClose,
  onContinueAsGuest,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [isExiting, setIsExiting] = useState(false);
  const { loginWithEmail, registerWithEmail, loginWithGoogle, resetPassword, authError } = useAuth();

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSmoothClose = (action?: () => void) => {
    setIsExiting(true);
    setTimeout(() => {
      if (action) action();
      else onClose();
    }, 400);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setResetSent(false);

    if (mode === 'register') {
      if (!name.trim() || !email.trim() || !password) return;
      if (password.length < 6) {
        setLocalError('Password must be at least 6 characters.');
        return;
      }
      setIsSubmitting(true);
      try {
        await registerWithEmail(email, password, name);
        handleSmoothClose();
      } catch (err: any) {
        setLocalError(err.message || 'Registration failed.');
        setIsSubmitting(false);
      }
    } else {
      if (!email.trim() || !password) return;
      setIsSubmitting(true);
      try {
        await loginWithEmail(email, password);
        handleSmoothClose();
      } catch (err: any) {
        setLocalError(err.message || 'Login failed.');
        setIsSubmitting(false);
      }
    }
  };

  const handleGoogle = async () => {
    setLocalError(null);
    setIsSubmitting(true);
    try {
      await loginWithGoogle();
      handleSmoothClose();
    } catch (err: any) {
      setLocalError(err.message || 'Google authentication failed.');
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setLocalError('Please enter your email address first.');
      return;
    }
    try {
      await resetPassword(email);
      setResetSent(true);
      setLocalError(null);
    } catch (err: any) {
      setLocalError('Password reset failed: ' + err.message);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: isExiting ? 0 : 1, scale: isExiting ? 0.98 : 1, filter: isExiting ? 'blur(8px)' : 'blur(0px)' }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="fixed inset-0 z-50 overflow-hidden bg-[#F6F6F4] flex flex-col md:flex-row"
    >
      {/* Background Soft Ambient Light Glows */}
      <div className="absolute top-0 left-0 w-1/2 h-full bg-gradient-to-tr from-emerald-100/40 via-cyan-100/30 to-transparent pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-1/2 h-full bg-gradient-to-bl from-blue-100/40 via-lime-100/20 to-transparent pointer-events-none" />

      {/* Close Modal Button Top Floating */}
      <button
        onClick={() => handleSmoothClose(onClose)}
        className="absolute top-5 right-6 z-50 p-2.5 rounded-full bg-white/80 hover:bg-white text-slate-500 hover:text-slate-900 border border-slate-200/80 shadow-md backdrop-blur-md transition-all duration-200 cursor-pointer flex items-center space-x-1.5 text-xs font-bold active:scale-95"
      >
        <span>Close</span>
        <X className="w-4 h-4" />
      </button>

      {/* ======================================================== */}
      {/* LEFT HALF WINDOW: Multi-Chart Animated Showcase (Left -> Right) */}
      {/* ======================================================== */}
      <div className="w-full md:w-1/2 h-1/2 md:h-full flex flex-col justify-between p-6 md:p-12 relative overflow-hidden select-none">
        {/* Brand Header */}
        <div className="relative z-10 flex items-center space-x-3">
          <InsightLogo size="lg" />
          <span className="text-[10px] font-extrabold uppercase bg-emerald-100/90 text-emerald-800 px-2.5 py-0.5 rounded border border-emerald-300">
            Enterprise AI
          </span>
        </div>

        {/* Multi-Chart Combination Showcase */}
        <div className="relative w-full h-full flex items-center justify-center my-auto py-4">
          <motion.div
            initial={{ opacity: 0, x: '-80%', scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-xl flex flex-col justify-center space-y-4 z-10"
          >
            {/* 1. Main Hero Area Growth Wave Chart */}
            <div className="bg-white/85 backdrop-blur-xl border border-white/90 shadow-2xl rounded-3xl p-5 md:p-6 relative overflow-hidden group">
              {/* Card Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-emerald-500 to-cyan-500 flex items-center justify-center text-white shadow-md">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 tracking-tight">Enterprise Analytics Stream</h3>
                    <p className="text-[10px] font-bold text-slate-400">DuckDB Sub-5ms Relational SQL Engine</p>
                  </div>
                </div>
                <div className="flex items-center space-x-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-1 rounded-full text-xs font-extrabold shadow-xs">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
                  <span>+38.4% YoY Growth</span>
                </div>
              </div>

              {/* Animated Wave Area Chart SVG */}
              <div className="h-44 w-full relative">
                <svg viewBox="0 0 500 180" className="w-full h-full overflow-visible">
                  <defs>
                    <linearGradient id="heroAreaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#10B981" stopOpacity="0.45" />
                      <stop offset="50%" stopColor="#06B6D4" stopOpacity="0.2" />
                      <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.0" />
                    </linearGradient>
                    <linearGradient id="heroLineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#84CC16" />
                      <stop offset="35%" stopColor="#10B981" />
                      <stop offset="70%" stopColor="#06B6D4" />
                      <stop offset="100%" stopColor="#2563EB" />
                    </linearGradient>
                  </defs>

                  {/* Grid Lines */}
                  <line x1="0" y1="35" x2="500" y2="35" stroke="#CBD5E1" strokeDasharray="4 4" strokeWidth="1" opacity="0.6" />
                  <line x1="0" y1="85" x2="500" y2="85" stroke="#CBD5E1" strokeDasharray="4 4" strokeWidth="1" opacity="0.6" />
                  <line x1="0" y1="135" x2="500" y2="135" stroke="#CBD5E1" strokeDasharray="4 4" strokeWidth="1" opacity="0.6" />

                  {/* Filled Wave Area */}
                  <motion.path
                    d="M 0 150 Q 70 110, 140 125 T 280 65 T 400 75 T 500 15 L 500 180 L 0 180 Z"
                    fill="url(#heroAreaGrad)"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 1.0, delay: 0.2 }}
                  />

                  {/* Glowing Line Path Drawing Left-to-Right */}
                  <motion.path
                    d="M 0 150 Q 70 110, 140 125 T 280 65 T 400 75 T 500 15"
                    fill="none"
                    stroke="url(#heroLineGrad)"
                    strokeWidth="4.5"
                    strokeLinecap="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 1.2, delay: 0.3, ease: "easeInOut" }}
                  />

                  {/* Glowing Data Point Nodes */}
                  {[
                    { x: 140, y: 125, val: "$420K" },
                    { x: 280, y: 65, val: "$890K" },
                    { x: 500, y: 15, val: "$1.42M" }
                  ].map((pt, idx) => (
                    <g key={idx}>
                      <motion.circle
                        cx={pt.x}
                        cy={pt.y}
                        r="7"
                        fill="#2563EB"
                        stroke="#FFFFFF"
                        strokeWidth="3.5"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.8 + idx * 0.2 }}
                        className="shadow-lg"
                      />
                      <motion.rect
                        x={pt.x - 24}
                        y={pt.y - 30}
                        width="48"
                        height="20"
                        rx="10"
                        fill="#0F172A"
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.9 + idx * 0.2 }}
                      />
                      <motion.text
                        x={pt.x}
                        y={pt.y - 17}
                        fill="#FFFFFF"
                        fontSize="9"
                        fontWeight="bold"
                        textAnchor="middle"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 1.0 + idx * 0.2 }}
                      >
                        {pt.val}
                      </motion.text>
                    </g>
                  ))}
                </svg>
              </div>
            </div>

            {/* 2. Secondary Row: Animated Bar Chart + Precision Donut Meter */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Card A: Animated Multi-Segment Bar Chart */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.5 }}
                className="bg-white/85 backdrop-blur-xl border border-white/90 shadow-xl rounded-2xl p-4 flex flex-col justify-between"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <BarChart3 className="w-4 h-4 text-cyan-600" />
                    <span className="text-xs font-black text-slate-900">Revenue Drivers</span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400">Share %</span>
                </div>
                <div className="space-y-2.5">
                  {[
                    { label: 'E-Commerce Sales', pct: '88%', color: 'bg-gradient-to-r from-emerald-400 to-emerald-600' },
                    { label: 'SaaS Subscription', pct: '74%', color: 'bg-gradient-to-r from-cyan-400 to-cyan-600' },
                    { label: 'Enterprise Services', pct: '56%', color: 'bg-gradient-to-r from-blue-500 to-indigo-600' }
                  ].map((item, i) => (
                    <div key={i} className="space-y-1">
                      <div className="flex justify-between text-[10px] font-bold text-slate-700">
                        <span>{item.label}</span>
                        <span>{item.pct}</span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden p-0.5">
                        <motion.div
                          className={`h-full ${item.color} rounded-full`}
                          initial={{ width: 0 }}
                          animate={{ width: item.pct }}
                          transition={{ duration: 0.9, delay: 0.6 + i * 0.15, ease: "easeOut" }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* Card B: AI Radial Donut & Fast-Path Metric Badge */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.6 }}
                className="bg-white/85 backdrop-blur-xl border border-white/90 shadow-xl rounded-2xl p-4 flex flex-col justify-between space-y-2"
              >
                <div className="flex items-center space-x-3">
                  <div className="relative w-14 h-14 shrink-0 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                      <path
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="#E2E8F0"
                        strokeWidth="3.5"
                      />
                      <motion.path
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="url(#donutGradMeter)"
                        strokeWidth="3.5"
                        strokeDasharray="98, 100"
                        strokeLinecap="round"
                        initial={{ strokeDasharray: "0, 100" }}
                        animate={{ strokeDasharray: "98, 100" }}
                        transition={{ duration: 1.2, delay: 0.75 }}
                      />
                      <defs>
                        <linearGradient id="donutGradMeter" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#10B981" />
                          <stop offset="100%" stopColor="#06B6D4" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <div className="absolute flex flex-col items-center">
                      <span className="text-xs font-black text-slate-900">98%</span>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900">Grounded Accuracy</h4>
                    <p className="text-[10px] text-slate-500 font-medium leading-tight">Deterministic Fast-Path SQL Validation</p>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-xl p-2 flex items-center justify-between text-[10px] font-bold text-slate-600 border border-slate-200/80">
                  <div className="flex items-center space-x-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                    <span>In-Memory Execution</span>
                  </div>
                  <span className="text-emerald-700 font-mono">&lt; 5ms</span>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>

        {/* Footer Credit */}
        <div className="relative z-10 hidden md:flex items-center justify-between text-[11px] font-medium text-slate-500 font-mono tracking-wide">
          <span>© 2026 InsightAI, Inc.</span>
          <span className="hover:text-slate-800 transition-colors cursor-pointer">Privacy & Terms</span>
        </div>
      </div>

      {/* ======================================================== */}
      {/* RIGHT HALF WINDOW: Sliding Sign Up / Sign In Window */}
      {/* ======================================================== */}
      <motion.div
        initial={{ x: '100%', opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="w-full md:w-1/2 h-1/2 md:h-full flex items-center justify-center p-6 md:p-12 relative z-20 overflow-y-auto"
      >
        <div className="w-full max-w-md bg-white/80 backdrop-blur-2xl border border-white/90 shadow-2xl rounded-3xl p-8 md:p-10 relative overflow-hidden">
          
          {/* Top Header Navigation Link */}
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400 mb-6">
            <span className="text-slate-400 font-mono text-[10px] uppercase tracking-wider">InsightAI Private Beta</span>
            <button
              onClick={() => alert('Contacting InsightAI Support... Email: support@insightai.io')}
              className="text-slate-500 hover:text-slate-900 transition-colors flex items-center space-x-1 cursor-pointer"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Contact us</span>
            </button>
          </div>

          {/* Smooth Mode Transition Container */}
          <AnimatePresence mode="wait">
            <motion.div
              key={mode}
              initial={{ opacity: 0, y: 15, filter: 'blur(6px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -15, filter: 'blur(6px)' }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-6"
            >
              {/* Form Header */}
              <div className="space-y-1.5">
                <h2 className="text-3xl font-black text-slate-950 tracking-tight">
                  {mode === 'register' ? 'Sign up' : 'Sign in'}
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  {mode === 'register'
                    ? 'Create your free account to unlock AI analytics & cloud sync.'
                    : 'Welcome back. Enter your credentials to access your workspace.'}
                </p>
              </div>

              {/* Alert Messages */}
              {(localError || authError) && (
                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center space-x-2">
                  <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                  <span>{localError || authError}</span>
                </div>
              )}

              {resetSent && (
                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold space-y-1">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>Password reset request sent to <strong>{email}</strong>!</span>
                  </div>
                </div>
              )}

              {/* Form Controls */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === 'register' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Full Name</label>
                    <div className="relative">
                      <User className="h-4 w-4 text-slate-400 absolute left-3.5 top-3" />
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Alex Sterling"
                        className="w-full bg-slate-50/80 hover:bg-slate-50 text-slate-900 text-xs pl-10 pr-4 py-2.5 rounded-xl border border-slate-200/90 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 font-semibold transition-all"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Email</label>
                  <div className="relative">
                    <Mail className="h-4 w-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="alex@enterprise.com"
                      className="w-full bg-slate-50/80 hover:bg-slate-50 text-slate-900 text-xs pl-10 pr-4 py-2.5 rounded-xl border border-slate-200/90 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 font-semibold transition-all"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700">Password</label>
                    {mode === 'login' && (
                      <button
                        type="button"
                        onClick={handleForgotPassword}
                        className="text-[11px] font-bold text-emerald-600 hover:text-emerald-800 transition-colors cursor-pointer"
                      >
                        Lost password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="h-4 w-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={mode === 'register' ? 'At least 6 characters' : '••••••••'}
                      className="w-full bg-slate-50/80 hover:bg-slate-50 text-slate-900 text-xs pl-10 pr-4 py-2.5 rounded-xl border border-slate-200/90 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 font-semibold transition-all"
                    />
                  </div>
                </div>

                {/* Main Pill Submit Button with Check Icon & Ripple Loading */}
                <div className="pt-2 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => handleSmoothClose(onContinueAsGuest)}
                    className="text-xs text-slate-500 hover:text-slate-900 font-bold hover:underline transition-all cursor-pointer"
                  >
                    Continue as Guest →
                  </button>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white rounded-full font-bold text-xs shadow-lg hover:shadow-xl transition-all duration-200 flex items-center space-x-2 cursor-pointer disabled:opacity-50"
                  >
                    <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center text-white shrink-0">
                      {isSubmitting ? (
                        <Loader2 className="w-3 h-3 text-white animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-3 h-3 text-white" />
                      )}
                    </div>
                    <span>{isSubmitting ? 'Processing...' : mode === 'register' ? 'Sign up' : 'Sign in'}</span>
                  </button>
                </div>
              </form>

              {/* Social Sign-In Divider */}
              <div className="relative flex items-center justify-center pt-1">
                <div className="border-t border-slate-200/80 w-full"></div>
                <span className="bg-white/90 px-3 text-[10px] uppercase tracking-wider text-slate-400 font-extrabold absolute rounded-full">OR</span>
              </div>

              {/* Google Sign-In */}
              <button
                type="button"
                onClick={handleGoogle}
                disabled={isSubmitting}
                className="w-full bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs py-2.5 rounded-xl border border-slate-200/90 shadow-xs flex items-center justify-center space-x-2 transition-all duration-200 active:scale-98 cursor-pointer"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>Continue with Google</span>
              </button>

              {/* Mode Switch Link with Smooth Animation */}
              <div className="pt-2 text-center text-xs text-slate-500 font-medium border-t border-slate-100">
                {mode === 'register' ? (
                  <span>
                    Already have an account?{' '}
                    <button
                      type="button"
                      onClick={() => { setMode('login'); setLocalError(null); }}
                      className="font-extrabold text-emerald-600 hover:text-emerald-800 hover:underline transition-all cursor-pointer"
                    >
                      Sign in
                    </button>
                  </span>
                ) : (
                  <span>
                    Don't have an account?{' '}
                    <button
                      type="button"
                      onClick={() => { setMode('register'); setLocalError(null); }}
                      className="font-extrabold text-emerald-600 hover:text-emerald-800 hover:underline transition-all cursor-pointer"
                    >
                      Sign up free
                    </button>
                  </span>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
};
