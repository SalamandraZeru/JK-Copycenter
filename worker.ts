// Worker personalizado: o site do OpenNext + uma tarefa agendada (cron da Cloudflare).
// A tarefa faz uma consulta leve ao Supabase todo dia, para o plano gratuito
// não pausar o banco por falta de uso em semanas sem pedidos.
// @ts-expect-error -- arquivo gerado pelo build do OpenNext (não existe antes do build)
import { default as handler } from './.open-next/worker.js';

interface KeepAliveEnv {
  NEXT_PUBLIC_SUPABASE_URL?: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
}

async function keepSupabaseAwake(env: KeepAliveEnv): Promise<void> {
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.warn('keep-alive: variáveis do Supabase ausentes');
    return;
  }
  const url = `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/services?select=id&is_active=eq.true&limit=1`;
  const response = await fetch(url, {
    headers: {
      apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
    },
  });
  console.log(`keep-alive: Supabase respondeu ${response.status}`);
}

export default {
  fetch: handler.fetch,
  async scheduled(_controller: unknown, env: KeepAliveEnv, ctx: { waitUntil(promise: Promise<unknown>): void }) {
    ctx.waitUntil(keepSupabaseAwake(env));
  },
};

// @ts-expect-error -- mesmas classes exportadas pelo worker gerado
export { DOQueueHandler, DOShardedTagCache, BucketCachePurge } from './.open-next/worker.js';
