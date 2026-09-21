import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Cookies e armazenamento local', description: 'Recursos essenciais usados pela JK Copycenter no navegador.' };

export default function CookiesPage() {
  return <article className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
    <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#b4232d]">Versão 1.0 · 14 de setembro de 2026</p>
    <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">Cookies e armazenamento local</h1>
    <div className="prose prose-slate mt-10 max-w-none prose-headings:font-black prose-a:text-blue-700">
      <p>O site atual não carrega Google Analytics, Meta Pixel ou publicidade. Por isso, mostramos um aviso informativo, e não uma escolha enganosa entre aceitar e rejeitar tecnologias que não existem.</p>
      <h2>O que é necessário</h2>
      <div className="overflow-x-auto"><table><thead><tr><th>Recurso</th><th>Uso</th><th>Duração</th></tr></thead><tbody><tr><td>Cookies Supabase</td><td>Autenticação e renovação segura da sessão</td><td>Conforme a sessão</td></tr><tr><td><code>jk_upload_session</code></td><td>Vincular upload temporário ao visitante</td><td>24 horas</td></tr><tr><td>Armazenamento do carrinho</td><td>Continuar itens de papelaria e a apresentação do pedido</td><td>Até limpeza ou troca de versão</td></tr><tr><td>Session storage</td><td>Evitar duplicidade, manter intenção e protocolo na aba</td><td>Até fechar a aba ou concluir</td></tr><tr><td>Cache do PWA</td><td>Carregar somente interface e ativos públicos</td><td>Até nova versão</td></tr></tbody></table></div>
      <h2>Como controlar</h2><p>Você pode limpar cookies e dados do site no navegador. Isso pode encerrar a sessão, apagar o carrinho ou impedir a retomada de um upload. Fechar o aviso grava apenas que ele já foi visto; não autoriza analytics ou publicidade.</p>
      <h2>Se o uso mudar</h2><p>Uma tecnologia opcional só poderá carregar depois de atualizar este inventário e oferecer escolha prévia, granular e reversível. Rejeitar deverá ser tão fácil quanto aceitar.</p>
      <p>Consulte também o <Link href="/privacidade">Aviso de Privacidade</Link> e o canal de <Link href="/direitos-do-titular">direitos do titular</Link>.</p>
    </div>
  </article>;
}
