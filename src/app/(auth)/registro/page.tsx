'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Mail, Lock, User, Phone, ArrowRight, ShoppingBag } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function ClientRegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          phone,
        },
      },
    });

    if (authError) {
      setError(authError.message || 'Erro ao criar conta.');
      setLoading(false);
      return;
    }

    router.push(data.session ? '/dashboard' : '/login?registered=1');
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center mb-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-xl shadow-blue-500/20">
            <ShoppingBag className="w-8 h-8" />
          </div>
        </div>
        <h2 className="text-center text-3xl font-extrabold text-slate-900 tracking-tight font-serif">
          Criar Nova Conta
        </h2>
        <p className="mt-2 text-center text-sm font-medium text-slate-600">
          Cadastre-se para gerenciar seus pedidos e impressões na JK Copycenter
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white py-8 px-6 shadow-xl rounded-3xl sm:px-10 border border-slate-200">
          
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 font-medium text-sm">
              {error}
            </div>
          )}

          <form className="space-y-4" onSubmit={handleRegister}>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-800 mb-1.5">
                Nome Completo
              </label>
              <div className="relative">
                <User className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className="w-full bg-white border border-slate-300 rounded-xl py-2.5 pl-11 pr-4 text-slate-900 font-medium text-sm shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition"
                  placeholder="Seu nome completo"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-800 mb-1.5">
                WhatsApp / Telefone
              </label>
              <div className="relative">
                <Phone className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  className="w-full bg-white border border-slate-300 rounded-xl py-2.5 pl-11 pr-4 text-slate-900 font-medium text-sm shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition"
                  placeholder="(11) 99999-9999"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-800 mb-1.5">
                E-mail
              </label>
              <div className="relative">
                <Mail className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full bg-white border border-slate-300 rounded-xl py-2.5 pl-11 pr-4 text-slate-900 font-medium text-sm shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition"
                  placeholder="seu@email.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-800 mb-1.5">
                Senha
              </label>
              <div className="relative">
                <Lock className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full bg-white border border-slate-300 rounded-xl py-2.5 pl-11 pr-4 text-slate-900 font-medium text-sm shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition"
                  placeholder="Mínimo 6 caracteres"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#0F2040] hover:bg-[#CC1A1A] text-white text-sm font-bold py-3 px-4 rounded-xl shadow-md transition flex items-center justify-center gap-2 mt-4 disabled:opacity-50"
            >
              {loading ? 'Cadastrando...' : 'Criar Conta'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-6 flex items-center justify-between text-xs font-semibold">
            <Link href="/login" className="text-blue-700 hover:underline">
              Já tem uma conta? Entrar
            </Link>
            <Link href="/" className="text-slate-700 hover:text-slate-900 transition">
              ← Voltar à Loja
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
