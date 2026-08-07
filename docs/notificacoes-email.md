# Notificações por e-mail

O app dispara e-mail automaticamente em dois eventos:

- **Chamado respondido** — quando alguém diferente de quem abriu o chamado manda uma
  mensagem na conversa (`src/components/chamados/ChamadoDetailModal.tsx`), quem abriu
  recebe um e-mail com o texto da resposta.
- **Aviso publicado** — quando um aviso é criado com status "ativo" (`src/pages/Avisos.tsx`),
  todos os usuários com status "ativo" recebem um e-mail com título e descrição do aviso.

Os dois casos (e um terceiro, "teste", usado pela tela **Administração > Configurações**)
chamam a mesma Edge Function: `supabase/functions/notificar-email`. Ela usa a API do
[Resend](https://resend.com) para o envio de verdade — o app em si nunca fala direto com
um provedor de e-mail (evita expor a chave da API no navegador).

O disparo é **"fire-and-forget"**: se o e-mail falhar (chave errada, função não implantada
etc.), o app só avisa no console — nunca quebra o fluxo principal (enviar mensagem, publicar
aviso). A exceção é o botão de teste em Configurações, que mostra o erro de verdade, porque
é justamente a ferramenta para diagnosticar o envio.

## 1. Criar uma conta no Resend

1. Crie uma conta grátis em https://resend.com (o plano free cobre ~3.000 e-mails/mês).
2. Em **API Keys**, crie uma chave e copie o valor (`re_...`).
3. **Remetente**: enquanto nenhum domínio próprio for verificado, o Resend só permite
   enviar usando `onboarding@resend.dev` — e só entrega para o e-mail com o qual você
   criou a conta Resend. Para o app mandar e-mail pra qualquer pesquisador em produção,
   verifique um domínio em **Domains** e use um remetente desse domínio (ex.:
   `CINTESP.Br <notificacoes@seudominio.com.br>`).

## 2. Configurar os secrets da função

A função lê duas variáveis de ambiente (secrets — **não** são as `VITE_*` do `.env` do
app; são específicas da função):

| Variável          | Obrigatória | Descrição                                                          |
| ------------------ | ----------- | -------------------------------------------------------------------- |
| `RESEND_API_KEY`   | Sim         | Chave da API do Resend.                                              |
| `RESEND_FROM`      | Não         | Remetente. Padrão: `CINTESP.Br <onboarding@resend.dev>` (só teste). |

### Supabase self-hosted (VPS, docker-compose oficial do Supabase)

O Supabase self-hosted já roda um serviço `functions` (Edge Runtime) por padrão,
apontando para `./volumes/functions` dentro do stack oficial do Supabase (o compose
DESTE repo só faz proxy para ele — veja `docker-compose.yml`).

1. Copie a pasta `supabase/functions/notificar-email` deste repo para
   `volumes/functions/notificar-email` no stack do Supabase.
2. No `.env` **do stack do Supabase** (não o deste repo), adicione:
   ```
   RESEND_API_KEY=re_sua_chave_aqui
   RESEND_FROM=CINTESP.Br <onboarding@resend.dev>
   ```
3. Reinicie o serviço `functions`:
   ```bash
   docker compose restart functions
   ```

### Supabase Cloud (se um dia migrar)

```bash
npx supabase login
npx supabase link --project-ref SEU_PROJECT_REF
npx supabase functions deploy notificar-email
npx supabase secrets set RESEND_API_KEY=re_sua_chave_aqui
```

## 3. Testar

Depois de implantar a função e configurar o secret:

1. Abra **Administração > Configurações**.
2. Na seção **Envio de e-mail**, confirme/edite o endereço de destino e clique em
   **Enviar teste**.
3. A tela mostra sucesso (✅) ou o erro exato devolvido pela função — útil pra diagnosticar
   chave errada, domínio não verificado, função não implantada, etc.

## Arquivos envolvidos

- `supabase/functions/notificar-email/index.ts` — a função (Deno), templates de e-mail e
  chamadas ao Resend.
- `src/lib/email.ts` — wrapper client-side (`notificarChamadoRespondido`,
  `notificarAvisoPublicado`, `enviarEmailTeste`) que chama a função via
  `supabase.functions.invoke`.
- `src/components/chamados/ChamadoDetailModal.tsx` — dispara ao responder um chamado.
- `src/pages/Avisos.tsx` — dispara ao publicar um aviso.
- `src/pages/admin/Configuracoes.tsx` — botão de teste.
