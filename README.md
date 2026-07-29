# CINTESP WEB — Sistema de Gestão de Quadro de Funcionários

Plataforma **web (PWA)** para controle e gerenciamento do quadro de pesquisadores:
disponibilidade em tempo real, horários, avisos, funções, áreas de atuação e
administração de usuários. Feito para instalar também no celular (PWA) e, numa fase
futura, virar app nativo reaproveitando o mesmo backend.

> 📌 **Para saber em que fase o projeto está, veja [ROADMAP.md](./ROADMAP.md).**
>
> 🚀 **Para publicar ou reverter uma versão, veja [DEPLOY.md](./DEPLOY.md).**

---

## 🧱 Stack (o que foi usado)

| Camada | Ferramenta | Por quê |
|---|---|---|
| Build/Dev | **Vite** | Dev server rápido, build otimizado |
| UI | **React 18 + TypeScript** | Componentização + tipagem segura |
| Estilo | **Tailwind CSS** | Design system consistente, tema claro/escuro |
| Ícones | **lucide-react** | Ícones de linha (iguais aos dos prints) |
| Rotas | **React Router** | Navegação SPA |
| Estado servidor | **TanStack Query** | Cache/consultas ao banco |
| Estado UI | **Zustand** | Tema e sidebar (leve) |
| PWA | **vite-plugin-pwa** | Instalável no celular, offline básico |
| Datas | **date-fns** | Formatação em pt-BR |
| **Banco / Auth / Realtime** | **Supabase** (Postgres) | Login pronto + atualização em tempo real |

**Banco de dados escolhido:** **Supabase (PostgreSQL gerenciado)** — entrega o "tempo real"
do quadro de disponibilidade, autenticação pronta e SDK que também serve para mobile.
O schema está em [`docs/supabase-schema.sql`](./docs/supabase-schema.sql).

> Alternativas consideradas: estender a `cintespbr-api` (Node/Express/Knex + MySQL) que você
> já tem, ou um backend novo com PostgreSQL + Prisma. Optamos pelo Supabase pelo tempo real
> e menor esforço de infraestrutura.

---

## 🚀 Como rodar

```bash
# 1) Instalar dependências (já feito nesta pasta)
npm install

# 2) Ambiente — copie o exemplo e ajuste quando tiver o Supabase
cp .env.example .env
#   Enquanto VITE_USE_MOCK=true, roda com dados de exemplo (sem banco).

# 3) Rodar em desenvolvimento
npm run dev        # http://localhost:5180

# 4) Build de produção / preview
npm run build
npm run preview
```

---

## 📂 Estrutura

```
CINTESTPWEB/
├─ ROADMAP.md              ← status e fases do projeto (LEIA PRIMEIRO)
├─ README.md               ← este arquivo
├─ docs/
│  └─ supabase-schema.sql  ← schema do banco (aplicar na Fase 4)
├─ public/                 ← favicon e ícones PWA
├─ src/
│  ├─ main.tsx             ← entrada (providers, tema)
│  ├─ App.tsx              ← rotas
│  ├─ index.css            ← Tailwind + estilos base
│  ├─ types.ts             ← modelo de domínio
│  ├─ lib/
│  │  ├─ supabase.ts       ← cliente Supabase (liga com as chaves)
│  │  └─ utils.ts          ← helpers (classes, iniciais, cores)
│  ├─ store/
│  │  └─ ui.ts             ← tema (claro/escuro) + sidebar (Zustand)
│  ├─ data/
│  │  └─ mock.ts           ← dados de exemplo (enquanto sem banco)
│  ├─ components/
│  │  ├─ layout/           ← Sidebar, Topbar, AppLayout, nav
│  │  └─ ui/               ← Avatar, Badge, StatCard, SectionCard, DonutChart…
│  └─ pages/
│     ├─ Dashboard.tsx     ← ✅ pronto (prints 1 e 3)
│     └─ Placeholder.tsx   ← telas das próximas fases
└─ ...configs (vite, tailwind, tsconfig, postcss)
```

---

## 🔌 Conectando o Supabase (Fase 4)

1. Crie um projeto em https://app.supabase.com
2. Rode o `docs/supabase-schema.sql` no **SQL Editor**.
3. Em **Project Settings → API**, copie a URL e a **anon key**.
4. No `.env`:
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=xxxx
   VITE_USE_MOCK=false
   ```
5. Reinicie o `npm run dev`.

---

## 📱 Mobile

O app já é um **PWA**: no celular, abra a URL e use "Adicionar à tela inicial".
Um app **nativo** (iOS/Android) com Expo/React Native está previsto para a Fase 6,
reaproveitando o mesmo Supabase.
