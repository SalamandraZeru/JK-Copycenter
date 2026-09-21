import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Termos de Uso', description: 'Condições de uso do site da JK Copycenter: compra de papelaria, solicitação de orçamento gráfico, arquivos, retenção e proteção de dados.' };

export default function TermosPage() {
  return <article className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
    <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#b4232d]">Versão 1.0 · 21 de setembro de 2026</p>
    <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">Termos de Uso</h1>
    <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600">Estas condições regem o uso do site da JK Copycenter, tanto para a compra de itens de papelaria quanto para a solicitação de orçamento de serviços gráficos. Ao usar o site, você concorda com estes termos.</p>
    <div className="prose prose-slate mt-10 max-w-none prose-headings:font-black prose-a:text-blue-700">
      <h2>1. Quem somos</h2>
      <p>O site é operado pela JK Copycenter, gráfica e papelaria com atendimento na Av. JK, 270, Jardim Colégio de Passos, Passos/MG. Contato pelo WhatsApp (35) 99106-6260. Neste documento, &ldquo;nós&rdquo; ou &ldquo;JK&rdquo; se refere à empresa, e &ldquo;você&rdquo; ou &ldquo;cliente&rdquo; a quem usa o site.</p>

      <h2>2. Dois fluxos, regras diferentes</h2>
      <p>O site separa claramente dois tipos de operação:</p>
      <ul>
        <li><strong>Papelaria — compra.</strong> Produtos com preço e estoque visíveis, adicionados ao carrinho e finalizados como pedido de compra.</li>
        <li><strong>Gráfica — solicitação de orçamento.</strong> Os serviços gráficos <strong>não têm preço automático</strong>. Você descreve o trabalho, escolhe as opções disponíveis e anexa os arquivos. A equipe analisa, prepara uma proposta e informa o valor. O envio da solicitação <strong>não gera cobrança</strong> nem confirma preço, prazo ou execução.</li>
      </ul>

      <h2>3. Orçamento gráfico e formação do preço</h2>
      <p>Nenhum valor de serviço gráfico exibido, sugerido ou estimado antes da análise deve ser considerado final. O preço de um serviço gráfico só existe depois que a equipe registra uma proposta formal, considerando material, acabamento, quantidade e viabilidade técnica. A proposta é válida pelo prazo nela indicado e a execução começa apenas após seu aceite e, quando aplicável, confirmação de pagamento.</p>

      <h2>4. Sua conta</h2>
      <p>Alguns recursos exigem conta. Você é responsável por manter seus dados de acesso protegidos e por atividades feitas na sua conta. Coletamos apenas o necessário para entrega e pedidos futuros, conforme o <Link href="/privacidade">Aviso de Privacidade</Link>.</p>

      <h2>5. Arquivos que você envia</h2>
      <p>Ao enviar arquivos para análise ou produção, você declara e garante que:</p>
      <ul>
        <li>possui os direitos necessários sobre o conteúdo, incluindo direitos autorais, marcas e imagem de terceiros;</li>
        <li>o material não é ilícito, fraudulento, difamatório nem viola direitos de terceiros ou a lei;</li>
        <li>autoriza a JK a processar, imprimir e reproduzir o arquivo estritamente para executar o trabalho solicitado.</li>
      </ul>
      <p>A JK pode recusar ou interromper trabalhos que violem estes termos ou a lei, sem que isso gere obrigação de execução. A responsabilidade pelo conteúdo enviado é do cliente.</p>

      <h2>6. Arquivos, privacidade e retenção</h2>
      <p>Os arquivos ficam em armazenamento privado, acessados por autorização temporária, e não são anexados às mensagens de WhatsApp. Após a conclusão ou o cancelamento do trabalho, os arquivos são <strong>eliminados fisicamente em até 15 dias</strong>; solicitações recusadas, expiradas ou abandonadas seguem a mesma janela, e uploads órfãos são eliminados 24 horas após o vencimento da intenção. Detalhes, uso de cookies e bases legais estão no <Link href="/privacidade">Aviso de Privacidade</Link>.</p>

      <h2>7. Pagamento, entrega e retirada</h2>
      <p>Para papelaria, valor, disponibilidade e formas de pagamento são exibidos antes da finalização. A entrega ou a retirada em Passos/MG segue as condições informadas no pedido. Para serviços gráficos, o pagamento ocorre conforme a proposta aceita.</p>

      <h2>8. Uso aceitável</h2>
      <p>Você concorda em não tentar burlar a segurança do site, automatizar acessos de forma abusiva, sobrecarregar os serviços, enviar código malicioso ou usar o site para fins ilícitos. Aplicamos limitação de requisições e outros controles para proteger a plataforma e os demais usuários.</p>

      <h2>9. Proteção de dados e segurança</h2>
      <p>Tratamos dados pessoais conforme a LGPD e o princípio da minimização: guardamos apenas o necessário para entrega e pedidos futuros. Aplicamos controles alinhados a boas práticas de segurança (OWASP), como HTTPS, controle de acesso por função, armazenamento privado de arquivos, validação de upload, links de acesso curtos, limitação de requisições, auditoria e rotinas de retenção. Nenhum sistema é totalmente infalível; incidentes são avaliados e tratados conforme o risco e os requisitos aplicáveis. Para exercer seus direitos, use o formulário de <Link href="/direitos-do-titular">direitos do titular</Link>.</p>

      <h2>10. Propriedade intelectual do site</h2>
      <p>A marca, o layout, os textos e os elementos visuais do site pertencem à JK Copycenter ou a seus licenciantes e não podem ser copiados ou reutilizados sem autorização. Isso não afeta os direitos que você mantém sobre os arquivos que envia.</p>

      <h2>11. Limitação de responsabilidade</h2>
      <p>O site é oferecido no estado em que se encontra. Na medida permitida pela lei, a JK não responde por indisponibilidades temporárias, por conteúdo enviado pelo cliente nem por danos indiretos. Nada nestes termos afasta direitos garantidos ao consumidor pela legislação aplicável.</p>

      <h2>12. Alterações</h2>
      <p>Podemos atualizar estes termos. Mudanças relevantes terão nova versão e data nesta página. O uso continuado após a atualização indica concordância com a versão vigente.</p>

      <h2>13. Lei aplicável e foro</h2>
      <p>Estes termos são regidos pela lei brasileira. Fica eleito o foro da comarca de Passos/MG para dirimir questões deste documento, sem prejuízo do foro do domicílio do consumidor quando a lei assim garantir.</p>

      <p className="text-sm">Este texto é operacional e deve ser revisado pela assessoria jurídica e pelo responsável formal da empresa antes da promoção para produção.</p>
    </div>
  </article>;
}
