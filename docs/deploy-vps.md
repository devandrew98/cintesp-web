# 🚀 Deploy na VPS — CINTESP Web + Supabase self-hosted (Docker)

Guia para colocar no ar, na VPS, com **dois subdomínios** e **HTTPS automático**:

- **`app.SEU-DOMINIO`** → a plataforma (front React, container `cintesp-web`)
- **`api.SEU-DOMINIO`** → o **Supabase self-hosted** (banco + auth + realtime)

> A plataforma é um site estático que fala **direto** com o Supabase. Não há
> back-end próprio. Tudo roda em Docker.

---

## 🧭 Arquitetura

```
                 Internet (HTTPS)
                        │
              ┌─────────┴──────────┐
              │   Caddy (proxy)    │  ← TLS automático (Let's Encrypt)
              │  portas 80 / 443   │
              └───┬────────────┬───┘
      app.dominio │            │ api.dominio
                  ▼            ▼
        ┌──────────────┐   ┌───────────────────────────┐
        │ cintesp-web  │   │ Supabase self-hosted (Kong │
        │ (nginx:80)   │   │ :8000 → db, auth, rest,    │
        │  este repo   │   │ realtime, storage, studio) │
        └──────────────┘   └───────────────────────────┘
```

- **Este repositório** sobe o `cintesp-web` + o `Caddy` (arquivo `docker-compose.yml`).
- **O Supabase** sobe pela **compose oficial do Supabase** (passo 2). O Caddy só faz proxy para ele.

---

## ✅ Pré-requisitos (na VPS)

- Ubuntu/Debian com **Docker** e **Docker Compose v2** (`docker compose version`).
- Um domínio e acesso ao **DNS**.
- Portas **80** e **443** abertas para a internet.
- `git` instalado.

Instalar Docker (se preciso):
```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # relogar depois
```

---

## 1) DNS — criar os subdomínios

No painel de DNS do domínio, crie **dois registros A** apontando para o **IP da VPS**:

| Tipo | Nome | Valor |
|---|---|---|
| A | `app` | IP-DA-VPS |
| A | `api` | IP-DA-VPS |

Aguarde propagar (`ping app.SEU-DOMINIO` deve responder o IP da VPS).

---

## 2) Subir o Supabase self-hosted

Usamos a compose **oficial** do Supabase (mantida por eles):

```bash
git clone --depth 1 https://github.com/supabase/supabase
cd supabase/docker
cp .env.example .env
```

Edite o `.env` do Supabase e defina, no mínimo:

- `POSTGRES_PASSWORD` — senha forte do Postgres.
- `JWT_SECRET` — segredo com **32+ caracteres** (aleatório).
- `ANON_KEY` e `SERVICE_ROLE_KEY` — **JWTs** gerados a partir do `JWT_SECRET`
  (gere em: https://supabase.com/docs/guides/self-hosting/docker#generate-api-keys).
- `SITE_URL=https://app.SEU-DOMINIO`
- `API_EXTERNAL_URL=https://api.SEU-DOMINIO`
- `SUPABASE_PUBLIC_URL=https://api.SEU-DOMINIO`
- `ADDITIONAL_REDIRECT_URLS=https://app.SEU-DOMINIO`
- `DASHBOARD_USERNAME` / `DASHBOARD_PASSWORD` — protege o Studio.
- (E-mail) configure o **SMTP** (`SMTP_*`) para o e-mail de confirmação de cadastro.
  Para uso interno/rápido, dá para desligar a confirmação: `ENABLE_EMAIL_AUTOCONFIRM=true`.

Suba:
```bash
docker compose up -d
docker compose ps        # tudo "healthy"
```

O gateway (Kong) fica em **http://localhost:8000** na VPS. É por ele que o Caddy
vai servir o `api.SEU-DOMINIO`.

> 🔑 **Guarde a `ANON_KEY`** (a que começa com `eyJ...`). Ela vai no `.env` do front.
> A `SERVICE_ROLE_KEY` é **secreta** — nunca no front, nunca no navegador.

### 2.1) Aplicar o schema do CINTESP no banco

Abra o **Studio** do Supabase (protegido pelo usuário/senha do painel) → **SQL Editor**
e rode, **nesta ordem**, o conteúdo dos arquivos da pasta `docs/` deste repositório:

1. `supabase-schema.sql`
2. `supabase-seed.sql`
3. `supabase-policies.sql`
4. `supabase-participantes.sql`

(Opcional, para começar do zero depois: `supabase-reset-total.sql`.)

O **primeiro usuário que se cadastrar** na plataforma vira **Administrador**
(há um gatilho no `policies.sql`).

---

## 3) Subir a plataforma (este repositório)

```bash
git clone https://github.com/devandrew98/cintesp-web
cd cintesp-web
cp .env.docker.example .env
nano .env
```

Preencha o `.env`:
```env
APP_DOMAIN=app.SEU-DOMINIO
API_DOMAIN=api.SEU-DOMINIO
ACME_EMAIL=voce@SEU-DOMINIO

VITE_SUPABASE_URL=https://api.SEU-DOMINIO
VITE_SUPABASE_ANON_KEY=eyJ...   # a ANON_KEY do Supabase (passo 2)
VITE_USE_MOCK=false

SUPABASE_UPSTREAM=host.docker.internal:8000
```

Suba (constrói a imagem do front e liga o Caddy com TLS):
```bash
docker compose up -d --build
docker compose logs -f caddy     # acompanha a emissão dos certificados
```

O Caddy pega os certificados HTTPS automaticamente (precisa das portas 80/443
abertas e do DNS já apontando). Em ~1 min:

- **https://app.SEU-DOMINIO** → a plataforma
- **https://api.SEU-DOMINIO** → a API do Supabase

---

## 4) Verificação

1. Abra **https://app.SEU-DOMINIO** → deve mostrar a tela de **login**.
2. Clique em **Criar conta** e cadastre-se (esse primeiro vira **Administrador**).
   - Se a confirmação de e-mail estiver ligada, confirme pelo e-mail antes de entrar.
3. Entre. Defina sua disponibilidade em **Meu Horário** e veja no **Quadro**.

Se o login der **"Erro de configuração / chave inválida"**, veja o Troubleshooting.

---

## 🔄 Atualizações futuras (novas versões)

```bash
cd cintesp-web
git pull
docker compose up -d --build
```
Trocar só a URL/chave do Supabase **não exige rebuild**: edite o `.env` e rode
`docker compose up -d` (o container regenera o `config.js` no start).

---

## 🔐 Segurança (importante)

- **Firewall:** exponha só **80/443** (e SSH). **Bloqueie o acesso externo à porta
  8000** do Supabase — o público deve chegar ao Supabase **só via `api.SEU-DOMINIO`**
  (Caddy/HTTPS). Ex.: `ufw deny 8000`.
- **Studio:** mantenha protegido pelo usuário/senha; de preferência não exponha
  publicamente (acesse via túnel SSH).
- **`SERVICE_ROLE_KEY`** e `.env` **nunca** vão para o GitHub (já ignorados).
- As tabelas têm **RLS** (segurança por papel) — o `anon` não lê nada sem login.

---

## 🧩 Alternativa: sem o Caddy (proxy próprio)

Se a VPS já usa **Nginx Proxy Manager**, **Traefik**, etc., rode só o front e
aponte seu proxy para ele:
```bash
docker compose up -d --build web       # sobe só o "web"
```
E no seu proxy, mande `app.SEU-DOMINIO` → o container `cintesp-web` (porta 80).

---

## 🆘 Troubleshooting

**"Erro de configuração: a chave (VITE_SUPABASE_ANON_KEY) está inválida"**
- Confira o `.env`: `VITE_SUPABASE_ANON_KEY` é a **ANON_KEY** do Supabase (`eyJ...`),
  **não** a `SERVICE_ROLE_KEY` nem a URL.
- `VITE_SUPABASE_URL` deve ser `https://api.SEU-DOMINIO` (sem `/rest/v1` no fim).
- Depois de mudar o `.env`: `docker compose up -d` (regenera o `config.js`).
- Abra `https://app.SEU-DOMINIO/config.js` no navegador — deve mostrar a URL e a
  chave corretas. Se estiver vazio, o `.env` não foi lido.
- O console do navegador (F12) mostra avisos `[CINTESP]` quando a chave tem formato estranho.

**"Failed to fetch" no login**
- `api.SEU-DOMINIO` não está acessível. Cheque o DNS, o Caddy (`docker compose logs caddy`)
  e se o Supabase (Kong :8000) está de pé (`curl -I http://localhost:8000`).

**Certificado HTTPS não emite**
- DNS ainda não propagou, ou portas 80/443 fechadas. Veja `docker compose logs caddy`.

**Realtime (quadro ao vivo) não atualiza**
- No Supabase, habilite a replicação realtime das tabelas `disponibilidade`,
  `avisos`, `mudancas_turno` (Studio → Database → Replication).
