'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Lock, Mail } from 'lucide-react';
import Link from 'next/link';

import { createClient } from '@/lib/supabase/client';

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError('E-mail ou senha inválidos.');
        setLoading(false);
        return;
      }

      window.location.href = '/admin/dashboard';
    } catch {
      setError('Não foi possível autenticar. Tente novamente.');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="flex justify-center mb-4">
          <div className="rounded-xl bg-white p-2 shadow-lg">
            <Image src="/images/brand/jk-monogram.webp" alt="JK Copycenter" width={360} height={404} className="h-14 w-auto" priority />
          </div>
        </div>
        <h2 className="text-center text-3xl font-extrabold text-white tracking-tight font-serif">
          Painel Administrativo
        </h2>
        <p className="mt-2 text-center text-sm font-medium text-slate-300">
          Acesso restrito para operadores e gerência da JK Copycenter
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4">
        <div className="bg-slate-900/95 backdrop-blur-xl py-8 px-6 shadow-2xl rounded-3xl sm:px-10 border border-slate-700">
          
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-950/80 border border-red-700 text-red-200 font-medium text-sm">
              {error}
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-200 mb-1.5">
                E-mail Corporativo
              </label>
              <div className="relative">
                <Mail className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2.5 pl-11 pr-4 text-white font-medium text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-slate-500 transition"
                  placeholder="admin@jkcopycenter.com.br"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-200 mb-1.5">
                Senha de Acesso
              </label>
              <div className="relative">
                <Lock className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2.5 pl-11 pr-4 text-white font-medium text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-slate-500 transition"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold py-3 px-4 rounded-xl shadow-md transition flex items-center justify-center gap-2 mt-4 disabled:opacity-50"
            >
              {loading ? 'Verificando...' : 'Acessar com Senha'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link href="/" className="text-xs font-semibold text-slate-400 hover:text-white transition">
              ← Voltar para a Loja Pública
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
