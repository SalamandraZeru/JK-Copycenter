# Deploy — JK Copycenter (Cloudflare Workers via GitHub)

Este projeto é publicado na **Cloudflare Workers** usando **OpenNext**
(`@opennextjs/cloudflare`). O método recomendado é **Workers Builds**: a
Cloudflare conecta no repositório do GitHub e **buda + publica automaticamente
a cada push** na branch de produção.

> Resumo do fluxo: `push na master` → Cloudflare buda com OpenNext → deploy no Worker.

---

## 1. Pré-requisitos

- Uma conta **Cloudflare** (pode ser qualquer conta — ex.: a conta da empresa).
- Acesso de **admin** ao repositório GitHub `SalamandraZeru/JK-Copycenter`
  (necessário para autorizar o app da Cloudflare a ler o repo).
- Projeto **Supabase** ativo (as chaves entram como variáveis, ver abaixo).

> A conta Cloudflare e a conta GitHub **não precisam ser da mesma pessoa** —
> basta autorizar a conexão com o repo na hora de conectar.

---

## 2. (Opcional) Remover o Worker antigo

Se existir um Worker publicado manualmente e você quiser recomeçar do zero:

`Cloudflare Dashboard → Workers & Pages → jk-copycenter → Settings → Delete`

Isso remove o script, a URL `*.workers.dev` e os **secrets** cadastrados nele.
**Não** remove o que está versionado no `wrangler.jsonc` (rate limits e vars) —
esses voltam sozinhos no primeiro build via Git. O site fica fora do ar até o
primeiro build do Git concluir.

---

## 3. Conectar o repositório (Workers Builds)

1. `Workers & Pages → Create → Import a repository`
2. Autorizar o GitHub e escolher `SalamandraZeru/JK-Copycenter`.
3. **Branch de produção:** `master` (garanta que o código novo já foi mergeado
   na master antes de conectar).
4. **Configuração de build:**
   - **Build command:** `npx opennextjs-cloudflare build`
   - **Deploy command:** `npx opennextjs-cloudflare deploy`
   - **Root directory:** `/` (raiz do repo)
   - **Node version:** `20` (variável de build `NODE_VERSION=20`)

---

## 4. Variáveis e secrets (cadastrar no painel Cloudflare)

Os valores reais **não** ficam no Git. Cadastre na conta Cloudflare que hospeda
o Worker.

### 4.1 Variáveis de BUILD (obrigatório)

As variáveis `NEXT_PUBLIC_*` são embutidas no código **em tempo de build**, então
precisam existir como **build variables** (não apenas runtime):

| Variável | Descrição |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chave pública (anon) do Supabase |
| `NEXT_PUBLIC_SITE_URL` | URL final do site (ver nota abaixo) |
| `NODE_VERSION` | `20` |

### 4.2 Secrets de RUNTIME (privados)

Cadastre como **secrets** do Worker (nunca como variável pública):

| Secret | Descrição |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Chave service role do Supabase (somente backend) |
| `CRON_SECRET` | (Opcional) autenticação de rotinas agendadas/webhooks |

### 4.3 Já versionado (não precisa cadastrar)

Definidos em `wrangler.jsonc` e aplicados no deploy automaticamente:

- `SERVICE_MANUAL_QUOTE_ENABLED = "true"`
- Rate limits: `JK_PRICING_PREVIEW_RATE_LIMIT`, `JK_UPLOAD_INTENTS_RATE_LIMIT`,
  `JK_UPLOAD_RATE_LIMIT`, `JK_PRIVACY_REQUEST_RATE_LIMIT`

> **Atenção — `NEXT_PUBLIC_SITE_URL`:** cada conta Cloudflare tem seu próprio
> subdomínio `*.workers.dev`. Ao publicar em uma conta diferente, a URL muda
> (ex.: `jk-copycenter.<subdominio-da-conta>.workers.dev`). Ajuste
> `NEXT_PUBLIC_SITE_URL` para a URL real (ou para o domínio próprio, quando houver).

---

## 5. Pós-deploy (checklist)

- [ ] Primeiro build concluído com sucesso no painel (Workers Builds → Logs).
- [ ] Site abre na nova URL `*.workers.dev`.
- [ ] `NEXT_PUBLIC_SITE_URL` aponta para a URL correta (senão links/WhatsApp saem errados).
- [ ] **Supabase Auth → URL Configuration:** adicionar a nova URL do site em
      *Site URL* e *Redirect URLs* (inclui o login com Google).
- [ ] Testar: fluxo de orçamento gráfico (WhatsApp), upload de arquivo, galeria,
      login no admin.

---

## 6. Deploy manual (alternativa / emergência)

Sem o Git, dá para publicar da máquina local:

```bash
npx wrangler login
npm run deploy
```

O script `deploy` roda: `opennextjs-cloudflare build` →
`verify-cloudflare-build-secrets` (guarda contra vazamento de secrets no bundle) →
`opennextjs-cloudflare deploy`.

---

## 7. Banco de dados (Supabase)

O schema é versionado em `supabase/migrations/`. As migrações já foram aplicadas
no projeto remoto. Ao apontar para um novo projeto Supabase, aplique-as antes do
primeiro deploy e atualize as variáveis da seção 4.
