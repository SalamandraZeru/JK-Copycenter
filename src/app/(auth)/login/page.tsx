'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Mail, Lock, ShoppingBag } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const callbackErrors: Record<string, string> = {
  AdminAccessRequiresPassword: 'Administradores devem entrar com e-mail e senha.',
  InvalidAuthCode: 'Não foi possível concluir o acesso com Google. Tente novamente.',
};

export default function ClientLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [callbackError, setCallbackError] = useState<string | null>(null);

  useEffect(() => {
    setCallbackError(callbackErrors[new URLSearchParams(window.location.search).get('error') || ''] || null);
  }, []);

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message || 'E-mail ou senha incorretos.');
      setLoading(false);
      return;
    }

    router.push('/dashboard');
    router.refresh();
  }

  async function handleGoogleLogin() {
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/callback`,
          skipBrowserRedirect: true,
        },
      });

      if (oauthError || !data.url) {
        setError(
          /provider.*not enabled/i.test(oauthError?.message || '')
            ? 'O acesso com Google está indisponível. Tente entrar com e-mail e senha ou fale com a loja.'
            : oauthError?.message || 'Não foi possível iniciar o acesso com Google. Tente novamente.'
        );
        return;
      }

      window.location.assign(data.url);
    } catch {
      setError('Não foi possível verificar o acesso com Google. Tente novamente em instantes.');
    } finally {
      setLoading(false);
    }
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
          Minha Conta
        </h2>
        <p className="mt-2 text-center text-sm font-medium text-slate-600">
          Acesse para acompanhar seus pedidos, arquivos e favoritos
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white py-8 px-6 shadow-xl rounded-3xl sm:px-10 border border-slate-200">
          
          {(error || callbackError) && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 font-medium text-sm">
              {error || callbackError}
            </div>
          )}

          <form className="space-y-4" onSubmit={handleEmailLogin}>
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
                  className="w-full bg-white border border-slate-300 rounded-xl py-2.5 pl-11 pr-4 text-slate-900 font-medium text-sm shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#0F2040] hover:bg-[#CC1A1A] text-white text-sm font-bold py-3 px-4 rounded-xl shadow-md transition flex items-center justify-center gap-2 mt-4 disabled:opacity-50"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <div className="mt-4">
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 text-sm font-bold py-2.5 px-4 rounded-xl shadow-sm transition flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.03 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                />
              </svg>
              Continuar com Google
            </button>
          </div>

          <div className="mt-6 flex items-center justify-between text-xs font-semibold">
            <Link href="/registro" className="text-blue-700 hover:underline">
              Não tem conta? Cadastre-se
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
