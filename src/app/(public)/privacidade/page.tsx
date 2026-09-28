import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Privacidade', description: 'Como a JK Copycenter trata dados pessoais e arquivos de pedidos.' };

export default function PrivacidadePage() {
  return <article className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
    <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#b4232d]">Versão 1.0 · 14 de setembro de 2026</p>
    <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">Aviso de Privacidade</h1>
    <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600">Este aviso explica, em linguagem direta, quais dados a JK Copycenter usa para atender pedidos, analisar arquivos e manter o serviço seguro.</p>
    <div className="prose prose-slate mt-10 max-w-none prose-headings:font-black prose-a:text-blue-700">
      <h2>Quem cuida dos dados</h2><p>A JK Copycenter, com atendimento na Av. JK, 270, Jardim Colégio de Passos, Passos/MG, atua como controladora dos dados usados na relação com seus clientes. O canal atual para privacidade é o formulário de <Link href="/direitos-do-titular">direitos do titular</Link> ou o WhatsApp (35) 99106-6260.</p>
      <h2>Dados usados</h2><ul><li>nome, telefone, e-mail e dados de conta;</li><li>endereço, somente quando necessário para entrega ou salvo pelo cliente;</li><li>serviços, produtos, opções, observações, proposta, pagamento e histórico do pedido;</li><li>arquivos enviados para análise e produção;</li><li>dados técnicos mínimos de segurança, autenticação, prevenção a abuso e auditoria.</li></ul>
      <p>Não pedimos dados pessoais sensíveis em campos de texto. Como uma arte pode conter informações escolhidas pelo cliente, todo arquivo é tratado como privado.</p>
      <h2>Finalidades e bases</h2><p>Os dados são usados para responder orçamentos, executar pedidos, entregar produtos, manter a conta, prevenir fraude, registrar decisões e atender obrigações ou direitos. Conforme o caso, o tratamento se relaciona a procedimentos preliminares, execução de contrato, obrigação legal, exercício regular de direitos ou legítimo interesse avaliado. Consentimento fica reservado a usos realmente opcionais.</p>
      <h2>Arquivos e retenção</h2><p>Arquivos ficam em bucket privado e são acessados por autorização temporária. Em pedidos ativos, permanecem disponíveis para análise e produção. Depois da conclusão ou cancelamento, são eliminados fisicamente em 15 dias. Solicitações recusadas, expiradas ou abandonadas seguem a janela de 15 dias; uploads órfãos são eliminados 24 horas após vencer a intenção. Metadados mínimos do pedido podem permanecer quando necessários para obrigações e defesa de direitos.</p>
      <h2>Compartilhamentos necessários</h2><p>Usamos Supabase para autenticação, banco e arquivos; Cloudflare para executar, entregar e proteger o site; Google somente quando o cliente escolhe esse login; ViaCEP quando solicita preenchimento por CEP; WhatsApp/Meta quando inicia a conversa; e prestadores de entrega apenas quando há entrega. Não vendemos dados pessoais.</p>
      <h2>Transferência e segurança</h2><p>Provedores de infraestrutura podem processar dados em outros países conforme seus contratos e salvaguardas. Aplicamos HTTPS, acesso por função, bucket privado, validação de upload, limitação de requisições, links curtos, auditoria e rotinas de retenção. Nenhum sistema é infalível; incidentes são avaliados e tratados conforme risco e requisitos aplicáveis.</p>
      <h2>Seus direitos</h2><p>Você pode pedir confirmação, acesso, correção, informações sobre compartilhamento, anonimização, bloqueio ou eliminação quando aplicável, revogação de consentimento, oposição e outros direitos previstos na LGPD. Para evitar entrega a terceiros, poderemos confirmar sua identidade sem pedir dados excessivos. <Link href="/direitos-do-titular">Registre uma solicitação e receba protocolo</Link>.</p>
      <h2>Cookies e armazenamento local</h2><p>O site usa apenas cookies e armazenamento local <strong>necessários</strong> — nunca publicidade ou analytics. Eles servem para manter o login e a segurança da sessão, vincular uploads temporários ao seu acesso, preservar o carrinho e a continuidade do pedido e permitir o funcionamento do aplicativo (PWA). Por serem essenciais, exibimos apenas um aviso informativo, sem banner de &ldquo;aceitar/rejeitar&rdquo;. Você pode limpar cookies e dados do site pelo navegador quando quiser, ciente de que isso pode encerrar a sessão ou apagar o carrinho. Se um dia adotarmos alguma tecnologia opcional, ela só carregará após escolha prévia, granular e reversível.</p>
      <h2>Mudanças neste aviso</h2><p>Mudanças relevantes terão nova versão e data nesta página.</p>
      <p className="text-sm">Este texto operacional deve ser revisado pela assessoria jurídica e pelo responsável formal da empresa antes da promoção para produção.</p>
    </div>
  </article>;
}
