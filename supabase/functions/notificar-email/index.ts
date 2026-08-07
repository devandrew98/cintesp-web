// ============================================================
// CINTESP WEB — notificações por e-mail (Supabase Edge Function)
// ------------------------------------------------------------
// Dispara e-mails transacionais via Resend (https://resend.com) quando:
//   • um admin responde um chamado  -> avisa quem abriu
//   • um aviso é publicado          -> avisa todos os usuários ativos
//   • "teste" (usado pela tela Configurações > Notificações)
//
// Variáveis de ambiente (secrets da função, NÃO do app):
//   RESEND_API_KEY  (obrigatória) — chave da API do Resend.
//   RESEND_FROM     (opcional)    — remetente. Padrão usa o domínio de teste
//                                   do Resend, que só entrega para o e-mail
//                                   da própria conta Resend até você
//                                   verificar um domínio próprio.
//
// Deploy (Supabase self-hosted): copie esta pasta para
// volumes/functions/notificar-email dentro do stack do Supabase e reinicie
// o serviço "functions" (edge-runtime). Defina os secrets no .env desse
// stack. Em Supabase Cloud: `supabase functions deploy notificar-email` e
// `supabase secrets set RESEND_API_KEY=...`.
// ============================================================

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const RESEND_FROM = Deno.env.get('RESEND_FROM') || 'CINTESP.Br <onboarding@resend.dev>'
const RESEND_URL = 'https://api.resend.com/emails'
const RESEND_BATCH_URL = 'https://api.resend.com/emails/batch'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface Destinatario {
  nome?: string
  email: string
}

type Corpo =
  | {
      tipo: 'chamado_respondido'
      destinatarioNome?: string
      destinatarioEmail: string
      chamadoId: string
      chamadoTitulo: string
      respondenteNome?: string
      mensagem: string
      appUrl?: string
    }
  | {
      tipo: 'aviso_publicado'
      destinatarios: Destinatario[]
      avisoTitulo: string
      avisoDescricao: string
      avisoTipo?: string
      autorNome?: string
      appUrl?: string
    }
  | {
      tipo: 'teste'
      destinatarioEmail: string
      destinatarioNome?: string
    }

// ---------- Layout base (HTML com CSS inline — exigência dos clientes de e-mail) ----------
function layout(titulo: string, corpoHtml: string): string {
  return `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;max-width:560px;width:100%;">
            <tr>
              <td style="background:#16a34a;padding:20px 28px;">
                <span style="font-size:18px;font-weight:800;color:#ffffff;letter-spacing:-0.02em;">CINTESP<span style="color:#dcfce7;">.Br</span></span>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;">
                <h1 style="margin:0 0 16px;font-size:18px;color:#0f172a;">${titulo}</h1>
                ${corpoHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;">
                <p style="margin:0;font-size:12px;color:#94a3b8;">
                  Você recebeu este e-mail porque é cadastrado(a) no CINTESP.Br — Centro Brasileiro de Referência
                  em Inovação Tecnológica Assistiva. Notificação automática, não é preciso responder este e-mail.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

function botao(href: string, texto: string): string {
  return `<a href="${href}" style="display:inline-block;margin-top:20px;background:#16a34a;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:11px 20px;border-radius:10px;">${texto}</a>`
}

function escaparHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

// ---------- Templates ----------
function templateChamadoRespondido(c: Extract<Corpo, { tipo: 'chamado_respondido' }>) {
  const link = c.appUrl ? `${c.appUrl.replace(/\/+$/, '')}/chamados` : undefined
  const corpo = `
    <p style="margin:0 0 12px;font-size:14px;color:#334155;">Olá${c.destinatarioNome ? `, ${escaparHtml(c.destinatarioNome)}` : ''}!</p>
    <p style="margin:0 0 12px;font-size:14px;color:#334155;">
      Seu chamado <strong>${escaparHtml(c.chamadoTitulo)}</strong> recebeu uma resposta${
        c.respondenteNome ? ` de <strong>${escaparHtml(c.respondenteNome)}</strong>` : ''
      }:
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 8px;">
      <tr>
        <td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px;font-size:14px;color:#334155;white-space:pre-wrap;">${escaparHtml(c.mensagem)}</td>
      </tr>
    </table>
    ${link ? botao(link, 'Ver chamado') : ''}
  `
  return { assunto: `Seu chamado "${c.chamadoTitulo}" recebeu uma resposta`, html: layout('Resposta no seu chamado', corpo) }
}

function templateAvisoPublicado(a: Extract<Corpo, { tipo: 'aviso_publicado' }>, nomeDestinatario?: string) {
  const link = a.appUrl ? `${a.appUrl.replace(/\/+$/, '')}/avisos` : undefined
  const corpo = `
    <p style="margin:0 0 12px;font-size:14px;color:#334155;">Olá${nomeDestinatario ? `, ${escaparHtml(nomeDestinatario)}` : ''}!</p>
    <p style="margin:0 0 12px;font-size:14px;color:#334155;">Um novo aviso foi publicado${a.autorNome ? ` por <strong>${escaparHtml(a.autorNome)}</strong>` : ''}:</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 8px;">
      <tr>
        <td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px;">
          <p style="margin:0 0 6px;font-size:15px;font-weight:700;color:#0f172a;">${escaparHtml(a.avisoTitulo)}</p>
          <p style="margin:0;font-size:14px;color:#334155;white-space:pre-wrap;">${escaparHtml(a.avisoDescricao)}</p>
        </td>
      </tr>
    </table>
    ${link ? botao(link, 'Ver aviso') : ''}
  `
  return { assunto: `Novo aviso: ${a.avisoTitulo}`, html: layout('Novo aviso publicado', corpo) }
}

function templateTeste(nome?: string) {
  const corpo = `
    <p style="margin:0 0 12px;font-size:14px;color:#334155;">Olá${nome ? `, ${escaparHtml(nome)}` : ''}!</p>
    <p style="margin:0;font-size:14px;color:#334155;">
      Este é um e-mail de teste disparado em <strong>Administração &gt; Configurações &gt; Notificações</strong>.
      Se você recebeu esta mensagem, o envio de e-mails do CINTESP Web está funcionando corretamente. ✅
    </p>
  `
  return { assunto: 'CINTESP.Br — e-mail de teste', html: layout('Teste de notificação por e-mail', corpo) }
}

// ---------- Resend ----------
async function enviarResend(payload: { to: string; subject: string; html: string }) {
  const r = await fetch(RESEND_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: RESEND_FROM, to: payload.to, subject: payload.subject, html: payload.html }),
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(data?.message || `Resend respondeu ${r.status}`)
  return data
}

/** Resend aceita até 100 e-mails por chamada de lote; separa em pedaços por segurança. */
async function enviarResendEmLote(itens: Array<{ to: string; subject: string; html: string }>) {
  const LOTE = 100
  const resultados: Array<{ email: string; ok: boolean; erro?: string }> = []
  for (let i = 0; i < itens.length; i += LOTE) {
    const pedaco = itens.slice(i, i + LOTE)
    const r = await fetch(RESEND_BATCH_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(pedaco.map((it) => ({ from: RESEND_FROM, to: it.to, subject: it.subject, html: it.html }))),
    })
    const data = await r.json().catch(() => ({}))
    if (!r.ok) {
      for (const it of pedaco) resultados.push({ email: it.to, ok: false, erro: data?.message || `Resend respondeu ${r.status}` })
      continue
    }
    for (const it of pedaco) resultados.push({ email: it.to, ok: true })
  }
  return resultados
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ erro: 'Método não permitido' }), {
      status: 405,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }
  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ erro: 'RESEND_API_KEY não configurada nos secrets da função.' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  try {
    const corpo = (await req.json()) as Corpo

    if (corpo.tipo === 'teste') {
      if (!corpo.destinatarioEmail) throw new Error('destinatarioEmail é obrigatório')
      const { assunto, html } = templateTeste(corpo.destinatarioNome)
      await enviarResend({ to: corpo.destinatarioEmail, subject: assunto, html })
      return new Response(JSON.stringify({ ok: true, enviados: 1 }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    if (corpo.tipo === 'chamado_respondido') {
      if (!corpo.destinatarioEmail) throw new Error('destinatarioEmail é obrigatório')
      const { assunto, html } = templateChamadoRespondido(corpo)
      await enviarResend({ to: corpo.destinatarioEmail, subject: assunto, html })
      return new Response(JSON.stringify({ ok: true, enviados: 1 }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    if (corpo.tipo === 'aviso_publicado') {
      const destinatarios = (corpo.destinatarios || []).filter((d) => d.email)
      if (destinatarios.length === 0) throw new Error('Nenhum destinatário com e-mail válido.')
      const itens = destinatarios.map((d) => {
        const { assunto, html } = templateAvisoPublicado(corpo, d.nome)
        return { to: d.email, subject: assunto, html }
      })
      const resultados = await enviarResendEmLote(itens)
      const enviados = resultados.filter((r) => r.ok).length
      const falhas = resultados.filter((r) => !r.ok)
      return new Response(JSON.stringify({ ok: true, enviados, falhas }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ erro: 'Campo "tipo" desconhecido.' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const mensagem = err instanceof Error ? err.message : 'Erro desconhecido'
    return new Response(JSON.stringify({ erro: mensagem }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }
})
