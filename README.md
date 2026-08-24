# JK Copycenter

Aplicação web para a operação de gráfica rápida e papelaria da JK Copycenter. Ela reúne catálogo público, configurador de serviços, orçamento calculado no servidor, upload de arquivos, checkout com encaminhamento ao WhatsApp, portal do cliente e administração de produção.

## Funcionalidades

- Catálogo de produtos e serviços gráficos, com categorias administráveis.
- Campos de serviço dinâmicos: o administrador define opções, obrigatoriedade e combinações por serviço.
- Precificação por regras vinculadas ao serviço e aos seus campos reais; o valor final é recalculado no servidor.
- Upload de PDF, DOCX, imagens, ZIP e RAR, com validação estrutural, isolamento de processamento e aviso quando a contagem de páginas for estimada.
- Carrinho e checkout idempotente, com criação do pedido antes do redirecionamento para o WhatsApp e mensagem pré-formatada.
- Área do cliente para pedidos, arquivos, endereços, favoritos e perfil; inclui navegação móvel inferior.
- Área administrativa com RBAC (`super_admin`, `admin`, `producao` e `catalogo`), catálogo, regras de preço, pedidos, produção, usuários e auditoria.
- Dois PWAs independentes: a loja pública e a área administrativa, esta com escopo restrito a `/admin/`.

## Arquitetura e tecnologias

| Camada | Tecnologia |
| --- | --- |
| Aplicação | Next.js 16, React 19 e TypeScript |
| Interface | Tailwind CSS, Lucide, React Hook Form, SWR e Recharts |
| Dados e identidade | Supabase: PostgreSQL, Auth, Storage e RLS |
| Validação | Zod |
| Arquivos | `pdf-lib`, `sharp`, `yauzl` e `node-unrar-js` |
| Hospedagem | Cloudflare Workers via OpenNext |
| Qualidade | Vitest, ESLint, TypeScript e Playwright |

Estrutura principal:

```text
src/app/                 rotas públicas, autenticação, cliente, admin e APIs
src/components/          componentes de interface e navegação
src/lib/                 domínio: preço, checkout, upload, autenticação e Supabase
supabase/migrations/     histórico executável do banco e das políticas RLS
public/                  imagens, ícones, manifests e service workers
tests/                   testes unitários, integração e segurança
scripts/                 auxiliares necessários ao processamento seguro de arquivos
```

## Pré-requisitos

- Node.js 20 ou superior.
- Projeto Supabase com Auth, Database e Storage configurados.
- Conta Cloudflare com permissão para publicar o Worker.
- Supabase CLI e Wrangler autenticados para operar os ambientes remotos.

## Executar localmente

1. Instale as dependências:

   ```bash
   npm ci
   ```

2. Crie o arquivo de ambiente a partir do modelo:

   ```powershell
   Copy-Item .env.example .env.local
   ```

3. Preencha `.env.local` sem publicar valores reais:

   | Variável | Uso |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chave pública usada pelo cliente |
   | `SUPABASE_SERVICE_ROLE_KEY` | Chave privada, exclusivamente no servidor |
   | `NEXT_PUBLIC_SITE_URL` | URL canônica da loja |
   | `CRON_SECRET` | Autorização de rotinas protegidas, quando aplicável |

4. Inicie o ambiente de desenvolvimento:

   ```bash
   npm run dev
   ```

   A loja ficará disponível em `http://localhost:3000`.

## Banco de dados e Supabase

As migrations em `supabase/migrations/` são parte do produto e devem permanecer versionadas. Para aplicar em um projeto Supabase já revisado:

```bash
npx supabase login
npx supabase link --project-ref <PROJECT_REF>
npx supabase db push
```

Antes de executar migrations em ambiente remoto, confirme o projeto de destino e mantenha um backup apropriado. Buckets, políticas, dados de configuração e URLs permitidas no Auth devem corresponder ao ambiente publicado.

Para Google OAuth, habilite o provedor no Supabase e cadastre a URL de callback exata da aplicação em **Authentication → URL Configuration**. O login administrativo permanece restrito a e-mail e senha.

## Segurança

- Preços, descontos e taxa de entrega não são confiados ao navegador: o checkout recalcula os valores a partir das regras persistidas.
- O pedido é persistido antes de abrir o WhatsApp; abrir a conversa não confirma pagamento.
- Operações repetidas de checkout usam chave de idempotência para impedir pedidos duplicados.
- As APIs validam entrada e as áreas administrativas verificam papel e conta ativa.
- Uploads passam por validação de assinatura, limites estruturais, proteção contra path traversal e isolamento do processamento.
- A `SUPABASE_SERVICE_ROLE_KEY` nunca deve receber prefixo `NEXT_PUBLIC_`, entrar em código, README, issues ou commits.
- Arquivos `.env` são ignorados pelo Git.

## Qualidade

Execute estes comandos antes de publicar uma alteração:

```bash
npm run check
npm test
npm run build
```

Para validar o pacote de Cloudflare sem publicar:

```bash
npm run preview
```

## Deploy no Cloudflare Workers

1. Aplique e valide as migrations no projeto Supabase correto.
2. Cadastre as variáveis de ambiente no Worker. A chave `SUPABASE_SERVICE_ROLE_KEY` deve ser cadastrada como secret; não a coloque no repositório.
3. Atualize `NEXT_PUBLIC_SITE_URL` e as URLs de redirecionamento permitidas no Supabase Auth para o domínio final do Worker.
4. Rode a validação local descrita acima.
5. Publique:

   ```bash
   npm run deploy
   ```

6. Em produção, teste cadastro/login, OAuth de cliente, configurador, upload, checkout/WhatsApp, painel do cliente, permissões administrativas e instalação dos dois PWAs.

O arquivo `wrangler.jsonc` é a configuração de publicação do Worker.

## Publicação no GitHub

Antes do primeiro push, revise o que será enviado:

```bash
git status
git diff --check
git check-ignore -v .env.local
```

Versione código, migrations, testes, arquivos de configuração, assets usados e este README. Não versione `.env.local`, chaves, dumps de banco, relatórios internos, materiais de IA ou evidências de execução.

## Licença

Código proprietário da JK Copycenter. Todos os direitos reservados.
