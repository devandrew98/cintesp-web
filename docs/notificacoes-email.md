# Notificações por e-mail

O app dispara e-mail automaticamente em dois eventos:

- **Chamado respondido** — quando alguém diferente de quem abriu o chamado manda uma
  mensagem na conversa (`src/components/chamados/ChamadoDetailModal.tsx`), quem abriu
  recebe um e-mail com o texto da resposta.
- **Aviso publicado** — quando um aviso é criado com status "ativo" (`src/pages/Avisos.tsx`),
  todos os usuários com status "ativo" recebem um e-mail com título e descrição do aviso.

Os dois casos (e um terceiro, "teste", usado pela tela **Administração > Configurações**)
chamam a mesma Edge Function: `supabase/functions/notificar-email`. Ela monta o HTML do
e-mail e entrega a lista pronta ao **Google Apps Script**
(`docs/google-apps-script/Codigo.gs`), que faz o envio pelo **Gmail** da conta dona do
script.

```
navegador → Edge Function (modelos) → Apps Script (web app) → Gmail → destinatário
```

O app nunca fala direto com o Apps Script. Dois motivos: o segredo do script ficaria
exposto no bundle do front, e o Apps Script não responde ao preflight CORS de requisições
JSON.

O disparo é **"fire-and-forget"**: se o e-mail falhar, o app só avisa no console — nunca
quebra o fluxo principal (enviar mensagem, publicar aviso). A exceção é o botão de teste
em Configurações, que mostra o erro de verdade, porque é justamente a ferramenta de
diagnóstico.

## Cota diária do Gmail

O limite é da **conta Google**, não do script:

| Tipo de conta      | Destinatários por dia |
| ------------------ | --------------------- |
| `@gmail.com` comum | 100                   |
| Google Workspace   | 1.500                 |

Um aviso publicado para 80 pessoas consome 80 envios de uma vez. Se a conta for gmail
comum e o CINTESP tiver mais de ~100 usuários ativos, um único aviso já estoura a cota do
dia. O script confere a cota **antes** de começar e recusa o lote inteiro em vez de mandar
pela metade.

## 1. Criar o script no Google

Faça com a conta Google que vai **aparecer como remetente** dos e-mails.

1. Acesse https://script.google.com e clique em **Novo projeto**.
2. Dê um nome ao projeto (ex.: `CINTESP - Notificações`).
3. Apague o conteúdo do arquivo `Código.gs` e cole **todo** o conteúdo de
   `docs/google-apps-script/Codigo.gs` deste repositório.
4. Salve (💾).

## 2. Configurar as propriedades do script

No editor: **⚙️ Configurações do projeto** > role até **Propriedades do script** >
**Adicionar propriedade do script**.

| Propriedade       | Obrigatória | Valor                                                          |
| ----------------- | ----------- | -------------------------------------------------------------- |
| `CINTESP_SEGREDO` | Sim         | Uma senha longa e aleatória, inventada por você. Guarde-a.     |
| `REMETENTE_NOME`  | Não         | Nome exibido no e-mail. Padrão: `CINTESP.Br`.                  |

O endereço do web app é público — é o `CINTESP_SEGREDO` que impede terceiros de usarem
o seu Gmail para mandar e-mail. Gere algo realmente aleatório, por exemplo:

```bash
openssl rand -hex 32
```

## 3. Autorizar o script

O Google exige que você autorize o envio de e-mail em seu nome uma única vez.

1. No editor, selecione a função **`testarEnvio`** na barra superior e clique em **Executar**.
2. Vai aparecer **"É necessário autorizar"** > **Revisar permissões** > escolha a conta.
3. A tela **"O Google não verificou este app"** é esperada (o app é seu):
   **Avançado** > **Acessar CINTESP - Notificações (não seguro)** > **Permitir**.
4. Confira sua caixa de entrada: deve chegar um e-mail de teste do próprio script.

## 4. Publicar como web app

1. Botão **Implantar** > **Nova implantação**.
2. Em **Selecionar tipo** (ícone ⚙️), escolha **App da Web**.
3. Preencha:
   - **Executar como**: `Eu (seu@email.com)`
   - **Quem pode acessar**: `Qualquer pessoa`
4. **Implantar** e **copie a URL do app da Web** — termina em `/exec`.

> ⚠️ **Quem pode acessar: Qualquer pessoa** é obrigatório. Com qualquer outra opção o
> Google devolve uma página de login em vez de JSON, e o envio falha. Quem protege o
> endpoint é o `CINTESP_SEGREDO`, não a permissão do Google.

Teste a implantação abrindo a URL `/exec` no navegador. Deve aparecer algo como:

```json
{ "ok": true, "servico": "CINTESP.Br - notificacoes por e-mail", "cotaRestante": 100 }
```

Se aparecer tela de login do Google, a implantação ficou restrita — refaça o passo 3.

> Toda vez que você **editar o código** do script, precisa criar uma **nova versão** da
> implantação (**Implantar > Gerenciar implantações > ✏️ > Versão: Nova versão**), senão
> o web app continua servindo o código antigo. A URL não muda.

## 5. Configurar os secrets da Edge Function

A função lê duas variáveis de ambiente (secrets — **não** são as `VITE_*` do `.env` do
app; são específicas da função):

| Variável      | Obrigatória | Descrição                                                    |
| ------------- | ----------- | ------------------------------------------------------------ |
| `GAS_URL`     | Sim         | A URL `/exec` copiada no passo 4.                            |
| `GAS_SEGREDO` | Sim         | O mesmo valor de `CINTESP_SEGREDO` do Apps Script.           |

### Supabase self-hosted (VPS, docker-compose oficial do Supabase)

O Supabase self-hosted já roda um serviço `functions` (Edge Runtime) por padrão,
apontando para `./volumes/functions` dentro do stack oficial do Supabase (o compose
DESTE repo só faz proxy para ele — veja `docker-compose.yml`).

**Jeito automático (recomendado).** Na VPS, dentro da pasta deste repositório:

```bash
bash docs/instalar-notificacoes.sh ~/supabase/docker
```

O script copia a função, grava as variáveis, cria o `docker-compose.override.yml` que
as repassa ao serviço `functions`, sobe o serviço e roda os testes. É idempotente e faz
backup do `.env` antes de mexer.

**Jeito manual**, se preferir entender cada passo:

1. Copie a pasta `supabase/functions/notificar-email` deste repo para
   `volumes/functions/notificar-email` no stack do Supabase.
2. No `.env` **do stack do Supabase** (não o deste repo), adicione:
   ```
   GAS_URL=https://script.google.com/macros/s/SEU_ID/exec
   GAS_SEGREDO=o_mesmo_segredo_do_apps_script
   ```
3. Repasse as duas ao contêiner. **Só colocar no `.env` não basta**: o serviço
   `functions` do compose oficial só enxerga as variáveis declaradas no bloco
   `environment:`. Crie um `docker-compose.override.yml` ao lado do
   `docker-compose.yml` do Supabase:
   ```yaml
   services:
     functions:
       environment:
         GAS_URL: ${GAS_URL}
         GAS_SEGREDO: ${GAS_SEGREDO}
   ```
4. Recrie o serviço:
   ```bash
   docker compose up -d functions
   ```
   Use `up -d`, não `restart` — `restart` não aplica mudanças de compose.

### Supabase Cloud (se um dia migrar)

```bash
npx supabase login
npx supabase link --project-ref SEU_PROJECT_REF
npx supabase functions deploy notificar-email
npx supabase secrets set GAS_URL=https://script.google.com/macros/s/SEU_ID/exec GAS_SEGREDO=seu_segredo
```

## 6. Testar

1. Entre com uma conta **Administradora** (a tela é protegida por `RequireAdmin`).
2. Abra **Administração > Configurações**.
3. Na seção **Envio de e-mail**, o campo já vem preenchido com o e-mail do admin logado.
   Confirme (ou troque) e clique em **Enviar teste**.
4. A tela mostra sucesso (✅) ou o erro exato devolvido pela função.

### Diagnóstico direto (sem passar pelo app)

**Testar só o Apps Script** (isola o Google do resto):

```bash
curl -L -X POST "https://script.google.com/macros/s/SEU_ID/exec" -H "Content-Type: application/json" -d '{"segredo":"SEU_SEGREDO","emails":[{"para":"admin@exemplo.com","assunto":"Teste direto","html":"<p>Funcionou</p>"}]}'
```

**Testar a cadeia inteira** (`ANON_KEY` = a mesma `VITE_SUPABASE_ANON_KEY` do app):

```bash
curl -i -X POST "https://SEU-DOMINIO-API/functions/v1/notificar-email" -H "Authorization: Bearer ANON_KEY" -H "Content-Type: application/json" -d '{"tipo":"teste","destinatarioEmail":"admin@exemplo.com","destinatarioNome":"Admin"}'
```

| Resposta                                        | O que fazer                                                                        |
| ----------------------------------------------- | ---------------------------------------------------------------------------------- |
| `404` / "Function not found"                     | A pasta não está em `volumes/functions/notificar-email` do stack do Supabase.      |
| `500 GAS_URL e/ou GAS_SEGREDO não configuradas`  | Falta o secret no `.env` do stack do Supabase + `docker compose restart functions`. |
| "O Apps Script não devolveu JSON"                | Implantação restrita. Reimplante com **Quem pode acessar: Qualquer pessoa**.        |
| `Segredo invalido`                               | `GAS_SEGREDO` ≠ `CINTESP_SEGREDO`. Iguale os dois.                                 |
| `CINTESP_SEGREDO nao configurado`                | Faltou criar a propriedade do script (passo 2).                                     |
| `Cota diaria do Gmail insuficiente`              | Estourou o limite da conta Google. Espera o dia virar ou usa conta Workspace.       |
| `401 Invalid JWT`                                | `FUNCTIONS_VERIFY_JWT=true` no stack: mande um token de usuário logado, não a anon.  |
| `{"ok":true,"enviados":1}`                       | Funcionou. Confira a caixa de entrada **e o spam**.                                 |

### Segurança da função (recomendado revisar)

A Edge Function **não confere o papel de quem chamou**: qualquer requisição que chegue
nela dispara e-mail com assunto, corpo e destinatário arbitrários — saindo do seu Gmail e
gastando a sua cota diária. Em Supabase self-hosted o padrão de fábrica é
`FUNCTIONS_VERIFY_JWT=false`, o que deixa o endpoint aberto na internet.

Com a cota do Gmail sendo baixa (100/dia numa conta comum), isso também vira um jeito
fácil de alguém deixar o sistema sem notificação pelo resto do dia. Ligue
`FUNCTIONS_VERIFY_JWT=true` no stack do Supabase e, de preferência, valide dentro da
função que quem chamou tem a permissão `gerenciar_tudo`.

## Arquivos envolvidos

- `docs/google-apps-script/Codigo.gs` — o script que envia pelo Gmail (colar no
  script.google.com; não é usado em build).
- `docs/instalar-notificacoes.sh` — instalador da função no stack do Supabase (VPS).
- `supabase/functions/notificar-email/index.ts` — a função (Deno), modelos de e-mail e a
  entrega ao Apps Script.
- `src/lib/email.ts` — wrapper client-side (`notificarChamadoRespondido`,
  `notificarAvisoPublicado`, `enviarEmailTeste`) que chama a função via
  `supabase.functions.invoke`.
- `src/components/chamados/ChamadoDetailModal.tsx` — dispara ao responder um chamado.
- `src/pages/Avisos.tsx` — dispara ao publicar um aviso.
- `src/pages/admin/Configuracoes.tsx` — botão de teste.
