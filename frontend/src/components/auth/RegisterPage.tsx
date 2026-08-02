import React, { useState } from 'react';
import { Sparkles, Mail, Lock, User, ArrowRight, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

import { InsightLogo } from '../ui/InsightLogo';

interface RegisterPageProps {
  onSwitchToLogin: () => void;
  onContinueAsGuest: () => void;
}

export const RegisterPage: React.FC<RegisterPageProps> = ({
  onSwitchToLogin,
  onContinueAsGuest,
}) => {
  const { registerWithEmail, loginWithGoogle, authError } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password) return;
    if (password.length < 6) {
      setLocalError('Password must be at least 6 characters.');
      return;
    }
    setLocalError(null);
    setIsSubmitting(true);
    try {
      await registerWithEmail(email, password, name);
    } catch (err: any) {
      setLocalError(err.message || 'Registration failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setLocalError(null);
    setIsSubmitting(true);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      setLocalError(err.message || 'Google sign-up failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-1">
            <InsightLogo size="xl" showText={false} />
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Create your Insight<span className="text-blue-600">AI</span> Account</h1>
          <p className="text-xs text-slate-500 font-medium">Instant AI Data Analytics & Persistence</p>
        </div>

        <Card className="shadow-soft-xl p-7 space-y-5 border-slate-200/80">
          {(localError || authError) && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center space-x-2">
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
              <span>{localError || authError}</span>
            </div>
          )}

          {/* Google Sign-Up */}
          <button
            type="button"
            onClick={handleGoogle}
            disabled={isSubmitting}
            className="w-full bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs py-3 rounded-2xl border border-slate-200 shadow-soft-xs flex items-center justify-center space-x-2 transition-all cursor-pointer"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            <span>Sign up with Google</span>
          </button>

          <div className="relative flex items-center justify-center">
            <div className="border-t border-slate-200 w-full"></div>
            <span className="bg-white px-3 text-[10px] uppercase tracking-wider text-slate-400 font-extrabold absolute">OR</span>
          </div>

          {/* Registration Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Full Name</label>
              <div className="relative">
                <User className="h-4 w-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Alex Sterling"
                  className="w-full bg-slate-50 text-slate-800 text-xs pl-9 pr-3 py-2.5 rounded-2xl border border-slate-200 focus:outline-hidden focus:border-blue-500 font-semibold"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Work Email</label>
              <div className="relative">
                <Mail className="h-4 w-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="alex@enterprise.com"
                  className="w-full bg-slate-50 text-slate-800 text-xs pl-9 pr-3 py-2.5 rounded-2xl border border-slate-200 focus:outline-hidden focus:border-blue-500 font-semibold"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Password</label>
              <div className="relative">
                <Lock className="h-4 w-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full bg-slate-50 text-slate-800 text-xs pl-9 pr-3 py-2.5 rounded-2xl border border-slate-200 focus:outline-hidden focus:border-blue-500 font-semibold"
                />
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="md"
              className="w-full"
              isLoading={isSubmitting}
              rightIcon={<ArrowRight className="h-4 w-4" />}
            >
              Create Account
            </Button>
          </form>

          {/* Switch to Login */}
          <div className="pt-2 text-center text-xs text-slate-500 font-medium space-y-3 border-t border-slate-100">
            <div>
              Already have an account?{' '}
              <button
                onClick={onSwitchToLogin}
                className="font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
              >
                Sign in
              </button>
            </div>

            <div>
              <button
                onClick={onContinueAsGuest}
                className="text-xs text-slate-600 hover:text-slate-900 font-bold bg-slate-100/80 hover:bg-slate-200/80 px-4 py-2 rounded-2xl transition-all cursor-pointer"
              >
                Continue in Guest / Demo Mode →
              </button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
