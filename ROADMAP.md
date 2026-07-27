# 🗺️ CINTESP WEB — Roadmap & Controle de Versões

> **Este é o arquivo mestre de status do projeto.**
> Sempre que quiser saber em que fase estamos, leia só o topo (STATUS ATUAL).
> Ao retomar o desenvolvimento, comece por este arquivo: o STATUS ATUAL diz exatamente
> onde o projeto parou, sem precisar reler o código todo.

---

## 📍 STATUS ATUAL

| Campo | Valor |
|---|---|
| **Versão** | `v0.8.1` |
| **Fase atual** | ✅ **Fase 7 concluída** — Participantes + importação de planilha (.xlsx/.csv) |
| **Data** | 27/07/2026 |
| **Front rodando?** | Sim — `npm run dev` → http://localhost:5180 |
| **Repositório** | 🔒 privado — `github.com/devandrew98/cintesp-web` (branch `main`) |
| **Banco (Supabase)** | ✅ Conectado e em uso — projeto `qjdvahlcxxkafotlnzrb` (auth + todas as telas) |
| **Modo de dados** | `VITE_USE_MOCK=false` (banco real Supabase) |

**Resumo em uma linha:** o app está **pronto para testes reais** — login (Supabase Auth),
todas as telas lendo/gravando no banco real, o pesquisador define a própria disponibilidade
e horário, o admin gerencia funções/áreas/instituições e avisos, o quadro/avisos atualizam
ao vivo (realtime) e agora dá para **importar uma planilha de participantes** (alunos) com
conferência antes de gravar. Deploy é o próximo passo (Fase 6).

> ⚠️ **Ação necessária para a Fase 7:** rode `docs/supabase-participantes.sql` uma vez no
> SQL Editor do Supabase para criar as tabelas `participantes` e `importacoes`.
> Enquanto não rodar, a tela de Participantes não consegue gravar no banco.

> ✅ **Como testar:** entre em `/login` (ou convide colegas em Supabase → Authentication → Invite user).
> Defina sua disponibilidade em **Meu Horário** e veja aparecer no **Quadro**. O 1º usuário é Administrador.
> _Rode `docs/supabase-fix-duplicados.sql` uma vez se ainda não rodou (o seed foi executado 2×)._

> ⚠️ **Fase 4 depende de você:** para conectar o banco real é preciso criar o projeto no
> Supabase e me passar `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (ver README). Enquanto
> isso não vem, dá para avançar na **Fase 5** (telas restantes) ainda em modo mock.

---

## 🎯 Fases do Projeto

Legenda: ✅ concluída · 🚧 em andamento · ⬜ pendente

### ✅ Fase 0 — Fundação (CONCLUÍDA)
- [x] Projeto Vite + React + TypeScript
- [x] Tailwind CSS + tema (design system verde CINTESP)
- [x] Modo claro/escuro com persistência
- [x] Layout responsivo (sidebar desktop + drawer mobile)
- [x] Navegação/rotas (React Router) de todas as seções
- [x] PWA (manifest + service worker via vite-plugin-pwa)
- [x] Camada de dados mock + tipos do domínio
- [x] Cliente Supabase preparado (liga quando tiver as chaves)

### ✅ Fase 1 — Dashboard (CONCLUÍDA)
- [x] Cabeçalho com saudação dinâmica + botão Atualizar
- [x] 4 KPIs (Disponíveis, Em atendimento, Ausentes, Mudanças)
- [x] Lista "Disponíveis agora" com avatares e horários
- [x] "Resumo da Equipe" com gráfico donut + legenda + dica
- [x] Listas "Em atendimento" e "Ausentes"
- [x] "Acesso rápido" (atalhos)
- [x] "Próximas mudanças de turno" + "Avisos"
- [x] Rodapé "Sincronizado agora"
- _Referência: prints 1 e 3_

### ✅ Fase 2 — Avisos (CONCLUÍDA)
- [x] Página de Avisos: KPIs (ativos, programados, lidos, visualizações)
- [x] Lista "Avisos Recentes" + coluna "Avisos em Destaque"
- [x] Busca por título/descrição e filtros por tipo (botão "Filtros")
- [x] Botão + modal "Novo Aviso" funcional (adiciona à lista em tempo real)
- [x] Tipos: importante, reunião, treinamento, geral (ícones e cores)
- [x] Banner "Receber avisos por e-mail"
- [x] Componentes reutilizáveis novos: `Button`, `Modal`, `Field/Input/Textarea/Select`
- _Referência: print 4_

### ✅ Fase 3 — Administração / Usuários (CONCLUÍDA)
- [x] Barra de abas da Administração (Usuários, Funções, Horários, Áreas, Instituições, Config.)
- [x] Lista de usuários + busca + filtro de status + paginação
- [x] Detalhe do usuário (abas: Informações, Função, Horários, Áreas, Histórico)
- [x] **Editor de horários por dia/turno** (manhã/tarde) com modo edição + salvar
- [x] Função e permissões (troca de função + chips)
- [x] Áreas de atuação (tags coloridas + adicionar)
- [x] Histórico de alterações (linha do tempo)
- [x] Modal "Novo Usuário" funcional (adiciona e seleciona na hora)
- [x] **CRUD de Funções** (telas dedicadas): criar/editar/excluir + editor de permissões
- [x] **CRUD de Áreas de Atuação**: criar/editar/excluir + seletor de cor
- [x] **CRUD de Instituições**: criar/editar/excluir (nome + sigla)
- [x] Exclusão protegida: itens em uso não podem ser removidos (integridade)
- [x] Tela de **Configurações** (aparência, notificações, sobre) — feita na Fase 6
- [ ] _Pendente (menor):_ modelos de **Horários** (aba "Horários" segue como placeholder)
- _Referência: print 2_

### ✅ Fase 4 — Integração Supabase (banco real) — CONCLUÍDA
- [x] Projeto Supabase criado e **conectado** (`.env` com URL + anon key)
- [x] `schema.sql` + `seed.sql` + `policies.sql` (grants + RLS por papel + gatilho de perfil) aplicados
- [x] **Autenticação** completa: login/cadastro (`/login`), sessão, **proteção de rotas**, logout
- [x] 1ª conta criada (Administrador) e **login validado** ✅
- [x] **Todas as telas migradas** para o banco (React Query): Dashboard, Quadro, Pesquisadores, Busca,
      Agenda, Meu Horário, Relatórios, Avisos e Administração (Funções/Áreas/Instituições/Usuários)
- [x] Escrita real validada: definir disponibilidade reflete no Quadro; CRUD de admin persiste (RLS `is_admin`)
- [x] **Realtime** ligado (quadro/avisos/mudanças) — `hooks/useRealtime`
- [ ] _Refinamentos (próximos):_ admin editar função/áreas de outro usuário; editar o próprio perfil;
      convite de usuários dentro do app; upload de foto (Supabase Storage)

### ✅ Fase 5 — Demais telas (CONCLUÍDA)
- [x] Quadro de Disponibilidade (KPIs + filtros por status/área/função + busca)
- [x] Meu Horário (perfil + editor do próprio horário, reaproveitando o `HorarioEditor`)
- [x] Pesquisadores (diretório com busca/filtros + modal de detalhe com horário da semana)
- [x] Agenda do Dia (linha do tempo das mudanças + disponibilidade atual ordenada)
- [x] Busca Rápida (campo em destaque + chips de status, filtragem ao vivo)
- [x] Novos componentes/helpers: `ui/PesquisadorCard`, `lib/pesquisadores.ts`, `pesquisadores/PesquisadorDetailModal`

### 🚧 Fase 6 — Mobile, Relatórios e Deploy (QUASE CONCLUÍDA)
- [x] **Relatórios e exportações** (KPIs, donut + barras, **Exportar CSV** real)
- [x] **Configurações e notificações** (aparência/tema, preferências, "sobre")
- [x] PWA: banner **"Instalar app"** (`beforeinstallprompt`) + offline (workbox) + `apple-mobile-web-app`
- [x] Configs de deploy prontas: `vercel.json` e `public/_redirects` (fallback SPA)
- [ ] **Deploy de fato** (Vercel/Netlify) — depende de você conectar a conta e definir as variáveis
- [ ] _Opcional:_ ícones PWA em PNG 192/512 (hoje usa `favicon.svg` com `sizes: any`)
- [ ] _Opcional:_ App nativo com Expo/React Native reaproveitando o Supabase

### ✅ Fase 7 — Participantes (alunos) e importação de planilha — CONCLUÍDA
- [x] Nova entidade **`participantes`** (nome, CPF, nascimento, curso, turma, matrícula,
      e-mail, telefone, cidade/UF, status) — **sem exigir login**, diferente de `usuarios`
- [x] Tabela **`importacoes`** (auditoria: arquivo, quem importou, quando, quantos)
- [x] **Assistente de importação em 4 etapas**: arquivo → colunas → conferência → resultado
- [x] Leitura de **.xlsx / .xls / .csv** direto no navegador (o arquivo não sai da máquina)
- [x] **Detecção automática** da linha de cabeçalho (ignora títulos/logos no topo)
- [x] **Mapeamento automático** de colunas por nome, com ajuste manual e troca de aba
- [x] **Validação linha a linha**: CPF com dígito verificador, duplicados no arquivo,
      datas em vários formatos (dd/mm/aaaa, ISO, serial do Excel), nome obrigatório
- [x] **Deduplicação por CPF** (upsert): reimportar a planilha ATUALIZA quem já existe
- [x] Colunas não mapeadas são preservadas em `dados_extras` (nada se perde)
- [x] Tela de Participantes: KPIs, busca (nome/CPF/matrícula/e-mail), filtro por curso,
      exclusão, **exportar CSV** e histórico de importações
- [x] **LGPD:** CPF exibido mascarado na listagem
- [x] SheetJS carregado sob demanda (não pesa no carregamento inicial do app)
- [ ] _Próximos (opcional):_ vincular participante a instituição na importação;
      desfazer uma importação; ficha individual do participante

---

## 📝 Changelog

### v0.8.1 — 27/07/2026
- **Ajustado ao formulário real do CINTESP** (planilha "Dados Gerais e Disponibilidade"):
  novos campos **`endereco`** e **`cep`** (tabela, tela e exportação CSV).
- Auto-mapeamento reconhece os nomes reais das colunas: "Nome completo",
  "CPF (somente digitos)", "WhatsApp para contato (com DDD)", "Endereço Completo", "CEP".
  O "Carimbo de data/hora" corretamente **não** é confundido com data de nascimento.
- **Resposta repetida agora vence a mais recente:** em respostas de formulário é comum a
  pessoa responder 2×. Antes a 2ª linha virava erro; agora a linha ANTERIOR é marcada como
  `duplicado` (com o nº da linha que valeu) e a mais recente é a importada.
- Cartão "Avisos" virou **"Duplicados"** na conferência; avisos aparecem no texto do resumo.
- Novo `docs/supabase-limpar-participantes.sql` para zerar participantes/importações.
- Correção: o limite da 2ª passada do auto-mapeamento subia para 4 letras e deixava "cpf"
  (3 letras) de fora — voltou para 3, mantendo a exigência de palavra inteira.
- Verificado com uma planilha reproduzindo o formulário real (20 respostas, 1 repetida):
  19 importados, 1 duplicado, 0 erros; endereço e CEP gravados.

### v0.8.0 — 27/07/2026
- **Fase 7 — Participantes (alunos) e importação de planilha.**
- Novo SQL `docs/supabase-participantes.sql`: tabelas `participantes` e `importacoes`,
  com RLS no mesmo padrão (todo logado lê, admin escreve) e gatilho de `updated_at`.
  O CPF é uma **constraint `unique`** (e não índice parcial) para o upsert funcionar.
- **Assistente de importação** (`components/participantes/ImportWizard`) em 4 etapas, com
  arrastar-e-soltar, barra de progresso e confirmação explícita antes de gravar.
- Novos helpers: `lib/planilha.ts` (leitura + detecção de cabeçalho + mapeamento automático
  + parse de datas), `lib/cpf.ts` (validação de dígito verificador, máscara) e
  `lib/importacao.ts` (análise linha a linha).
- `data/participantes.ts`: leitura, upsert em lotes de 200 por CPF, registro da importação
  e modo mock em memória (dá para testar tudo sem banco).
- Tela `pages/admin/Participantes.tsx` + aba/menu "Participantes".
- **Verificado ponta a ponta** com planilha de teste (título antes do cabeçalho, CPF
  inválido, CPF repetido, data ilegível, coluna extra): 13 importados, 3 bloqueados com
  motivo, 1 aviso; ao reimportar → 0 novos e 13 atualizados (sem duplicar).
- 2 bugs corrigidos no próprio desenvolvimento: apelido curto "ra" casava dentro de
  "Situação Financei**ra**" (agora exige palavra inteira) e a numeração das linhas ignorava
  linhas em branco (agora bate com a planilha real).
- SheetJS instalado da CDN oficial (0.20.3, sem os CVEs da versão do npm) e carregado via
  `import()` dinâmico — vira um chunk separado, fora do bundle principal.

### v0.7.0 — 23/07/2026
- **Fase 4 concluída — app rodando no banco real do Supabase, pronto para testes.**
- **Início da Fase 4 — Supabase conectado.** `.env` com URL + anon key do projeto real.
- **Autenticação (Supabase Auth):** tela `/login` (entrar + criar conta), `store/auth` com
  sessão persistida e `onAuthStateChange`, `RequireAuth` protegendo as rotas, e **logout** na Topbar
  (mostra o e-mail logado). Em modo mock puro (sem chaves), tudo segue aberto como antes.
- `lib/supabase.ts` refatorado: cliente criado sempre que há chaves (auth real), com `USE_MOCK`
  controlando apenas a fonte de dados das telas. Normaliza a URL (aceita com/sem `/rest/v1/`).
- Novos SQLs: `docs/supabase-seed.sql` (dados de referência) e `docs/supabase-policies.sql`
  (grants + RLS por papel + gatilho que cria o perfil no cadastro; 1º usuário vira Administrador).
- **Login validado** ✅ e **migração de dados iniciada** (`VITE_USE_MOCK=false`):
  - `data/api.ts` = camada de acesso com mapeadores DB→domínio (funções, áreas, instituições,
    usuários com joins, avisos) e `USE_MOCK` decidindo a fonte.
  - Telas já no banco real: **Avisos, Quadro, Pesquisadores, Busca** (via React Query, com loading).
  - `docs/supabase-fix-duplicados.sql`: limpa duplicatas do seed rodado 2× e cria restrições únicas.
- **Conclusão da migração:** Dashboard, Agenda, Relatórios, **Meu Horário** (define a própria
  disponibilidade e salva o horário) e toda a **Administração** (Funções/Áreas/Instituições com
  escrita real via mutations; Usuários lendo do banco). `HorarioEditor` ganhou `onSalvar`.
- **Realtime:** `hooks/useRealtime` assina disponibilidade/avisos/mudanças e atualiza o app ao vivo.
- Verificado ponta a ponta: definir "Disponível" reflete no Quadro/Dashboard; criar/excluir área
  persiste no banco (RLS `is_admin`). Build de produção OK. Versão exibida em Configurações: v0.7.0.

### v0.6.0 — 23/07/2026
- **Fase 6 (front) concluída — app pronto de uso em modo mock.**
- **Relatórios** (`/relatorios`): KPIs, gráfico donut de disponibilidade, barras por área e por
  função, e botão **Exportar CSV** (gera e baixa o arquivo 100% no navegador).
- **Configurações** (`/admin/configuracoes`): aparência (tema claro/escuro persistido),
  preferências de notificação e bloco "Sobre" (versão + fonte de dados atual).
- **PWA:** componente `InstallPrompt` (banner "Instalar app" via `beforeinstallprompt`, dispensa
  lembrada) + meta tags `apple-mobile-web-app` no `index.html`.
- **Deploy pronto para 1 clique:** `vercel.json` e `public/_redirects` (fallback de SPA para as rotas).
- `App.tsx`: rotas `/relatorios` e `/admin/configuracoes` agora usam as telas reais.
- Novos arquivos: `pages/Relatorios.tsx`, `pages/admin/Configuracoes.tsx`, `components/pwa/InstallPrompt.tsx`.
- 🔒 **Versionamento:** repositório git inicializado e publicado (privado) em
  `github.com/devandrew98/cintesp-web`. `.env`/`node_modules`/`dist`/`settings.local.json` fora do repo.
  _A partir daqui, cada versão vira um commit._

### v0.5.0 — 23/07/2026
- **Fase 5 concluída — todas as telas do app prontas** (em modo mock):
  - **Quadro de Disponibilidade:** KPIs + busca + filtros por status, área e função; grade de cards.
  - **Meu Horário:** perfil do usuário logado (`usuarioAtual`) + editor do próprio horário.
  - **Pesquisadores:** diretório com busca/filtros e **modal de detalhe** (contato, áreas, horário da semana).
  - **Agenda do Dia:** linha do tempo das mudanças + "disponíveis agora" ordenados por quem sai mais cedo.
  - **Busca Rápida:** campo em destaque + chips de status, com filtragem ao vivo.
- Novos: `ui/PesquisadorCard`, `pesquisadores/PesquisadorDetailModal`, helper `lib/pesquisadores.ts`
  (função `filtrarUsuarios` compartilhada entre Quadro, Pesquisadores e Busca) e `usuarioAtual` no mock.
- `App.tsx` atualizado: as 5 rotas agora usam as telas reais (não mais o `Placeholder`).
- App **funcionalmente completo**; build de produção OK. Próximo: ligar Supabase (Fase 4) e deploy (Fase 6).

### v0.4.0 — 23/07/2026
- **CRUDs de Administração concluídos** (fecha a Fase 3): telas dedicadas de **Funções**,
  **Áreas de Atuação** e **Instituições**, com criar, editar e excluir.
- Cada item mostra quantos usuários/pesquisadores o utilizam; **exclusão bloqueada**
  enquanto houver vínculos (proteção de integridade referencial).
- **Funções:** editor com catálogo de permissões (checkboxes com descrição).
- **Áreas:** seletor de cor (paleta) com prévia do "chip".
- **Instituições:** nome + sigla, lista com contagem de vínculos.
- Novos: componente reutilizável `ui/ConfirmDialog` e helper `lib/permissoes.ts`.
- Rotas `/admin/funcoes`, `/admin/areas`, `/admin/instituicoes` ativas (substituem os
  placeholders "Em construção"); `App.tsx` atualizado.
- **Correção de dado (mock):** o usuário `u14` apontava para uma área inexistente
  (`A(8)`, fora do intervalo → `undefined`); ajustado para `A(7)` ("Educação em Saúde").
  O bug era latente e só apareceu ao **agregar as áreas de todos os usuários** na nova tela.
- Código todo comentado (mantendo o padrão do projeto).

### v0.3.0 — 22/07/2026
- **Tela de Administração / Usuários completa** (print 2), com barra de abas.
- Lista de usuários com busca, filtro de status e paginação.
- Detalhe do usuário com 5 sub-abas: Informações, Função e Permissões, Horários, Áreas, Histórico.
- **Editor de horários** por dia/turno (manhã/tarde) com modo de edição e "Salvar".
- Modal "Novo Usuário" funcional; áreas e função editáveis.
- Novos arquivos: `lib/horarios.ts` e componentes em `components/admin/*` e `pages/admin/*`.
- Código todo comentado (a pedido).

### v0.2.0 — 22/07/2026
- **Página de Avisos completa** (print 4): KPIs, "Avisos Recentes", "Avisos em Destaque".
- Busca e filtros por tipo; banner de notificação por e-mail.
- **Modal "Novo Aviso"** funcional — cria o aviso e atualiza a lista/KPIs na hora.
- Novos componentes reutilizáveis: `Button`, `Modal`, campos de formulário (`Field`).
- Helper `lib/avisos.ts` (ícones/cores por tipo e status).

### v0.1.0 — 22/07/2026
- Fundação do projeto (Vite + React + TS + Tailwind + PWA).
- Design system CINTESP (verde), tema claro/escuro, layout responsivo.
- Navegação completa de todas as seções (rotas + placeholders por fase).
- **Dashboard completo** com dados de exemplo (prints 1 e 3).
- Camada mock + tipos do domínio + cliente Supabase preparado.
- Documentação: README, ROADMAP (este arquivo) e schema SQL do Supabase.

---

## 🔁 Como retomar o desenvolvimento

Roteiro para voltar ao projeto depois de um tempo parado:

1. Ler **apenas** este `ROADMAP.md` e o `README.md` (não o código todo).
2. Conferir o **STATUS ATUAL** e abrir só os arquivos da fase em andamento.
3. Ao terminar, atualizar o **STATUS ATUAL** e o **Changelog**.

> 💡 Dica: mantenha o **STATUS ATUAL** sempre atualizado. É a "memória" do projeto.
