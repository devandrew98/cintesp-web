# 🚀 Deploy e Rollback — CINTESP Web

Guia de como colocar no ar (Vercel) e, principalmente, **como voltar rápido**
quando alguma versão sair com problema.

---

## 1. Publicar na Vercel (primeira vez)

1. Acesse <https://vercel.com> e entre com a conta do **GitHub**.
2. **Add New… → Project** e escolha o repositório `cintesp-web`.
3. A Vercel detecta Vite sozinha. Confirme:
   | Campo | Valor |
   |---|---|
   | Framework Preset | `Vite` |
   | Build Command | `npm run build` |
   | Output Directory | `dist` |
   | Install Command | `npm install` |
4. Abra **Environment Variables** e cadastre as três (marque *Production*,
   *Preview* e *Development*):
   | Nome | Valor |
   |---|---|
   | `VITE_SUPABASE_URL` | `https://SEU-PROJETO.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY` | a *anon public key* do Supabase |
   | `VITE_USE_MOCK` | `false` |
5. **Deploy**. Em ~1 minuto a URL fica pronta.

> ⚠️ **Só use a chave `anon`.** A `service_role` **nunca** vai para o front —
> ela ignora as políticas de segurança (RLS) e daria acesso total ao banco.

### Depois do primeiro deploy

No Supabase, em **Authentication → URL Configuration**, adicione a URL da Vercel
em *Site URL* e *Redirect URLs*. Sem isso, a confirmação de e-mail e a
recuperação de senha voltam para `localhost`.

---

## 2. Como funciona a partir daí

Todo `git push` na branch `main` gera um **deploy de produção** automático.
Pull requests e outras branches geram *Preview Deployments* (URL separada,
sem afetar quem está usando o sistema).

---

## 3. 🔙 Rollback — voltar uma versão que quebrou

### Opção A — Reverter na Vercel (mais rápido, ~30 segundos)

É o caminho recomendado quando o site está fora do ar.

1. Painel da Vercel → aba **Deployments**.
2. Ache o último deploy que estava funcionando (a lista mostra o commit).
3. Menu **⋯ → Promote to Production** (em versões antigas: *Rollback*).

Pronto: o site volta na hora. **Não mexe no seu código** — o repositório
continua como está, então dá para corrigir com calma.

### Opção B — Voltar pelo Git (quando o problema é o código)

Cada versão tem uma **tag**. Para ver todas:

```bash
git tag -n1
```

**Jeito seguro (recomendado):** cria um commit que desfaz as mudanças ruins,
preservando o histórico:

```bash
git revert --no-commit v1.0.0..v1.1.0 && git commit -m "revert: volta para o comportamento da v1.0.0" && git push origin main
```

**Só para inspecionar** uma versão antiga, sem mexer no `main`:

```bash
git checkout v1.0.0
```

Para voltar ao normal depois: `git checkout main`.

> ❌ **Evite `git reset --hard` + `push --force` no `main`.** Apaga histórico e
> quebra o repositório de quem já tinha baixado. Use `revert` ou a Opção A.

---

## 4. 🏷️ Padrão de versões (SemVer)

`vMAIOR.MENOR.CORREÇÃO` — por exemplo `v1.2.3`:

| Parte | Quando aumenta | Exemplo |
|---|---|---|
| **MAIOR** | mudança que quebra o que existia | trocar o banco de dados |
| **MENOR** | funcionalidade nova, sem quebrar nada | tela de Participantes |
| **CORREÇÃO** | apenas conserto de bug | ajuste no cálculo de horas |

### Publicando uma versão nova

```bash
git tag -a v1.2.0 -m "v1.2.0 — resumo do que mudou" && git push origin main --follow-tags
```

Depois, no GitHub → **Releases → Draft a new release**, escolha a tag e cole o
trecho do changelog do `ROADMAP.md`. Isso deixa o histórico apresentável e dá
um link de download por versão.

---

## 5. ✅ Antes de cada deploy

- [ ] `npm run build` passa sem erro
- [ ] Testado como **administrador** e como **pesquisador**
- [ ] `ROADMAP.md` atualizado (STATUS ATUAL + changelog)
- [ ] Commit feito e **tag criada**
- [ ] Migrações SQL necessárias já rodadas no Supabase

---

## 6. 🆘 Se o site cair

1. **Reverta primeiro** (Opção A) — resolver para o usuário vem antes de
   entender o problema.
2. Veja o erro em **Vercel → Deployments → o deploy quebrado → Build Logs**;
   se o build passou mas a tela está branca, olhe o console do navegador.
3. Corrija no código, teste local, suba de novo e crie a tag de correção.

### Problemas comuns

| Sintoma | Causa provável |
|---|---|
| Tela branca, console com erro de `supabaseUrl` | variáveis de ambiente não cadastradas na Vercel |
| Login não entra / e-mail volta para `localhost` | falta configurar as URLs no Supabase (passo 1) |
| Dados de exemplo aparecendo em produção | `VITE_USE_MOCK` ficou como `true` |
| Erro 404 ao recarregar uma página interna | `vercel.json` ausente (já está no repo) |
| "Acesso restrito" para quem deveria ser admin | a conta não tem a função Administrador — veja `docs/supabase-reset-total.sql`, consulta (D) |

> 💡 Variável de ambiente alterada só vale no **próximo deploy** — depois de
> mexer nelas, use **Redeploy**.
