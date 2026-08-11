// ============================================================
// CINTESP WEB — notificações por e-mail (Supabase Edge Function)
// ------------------------------------------------------------
// Dispara e-mails transacionais quando:
//   • um admin responde um chamado  -> avisa quem abriu
//   • um aviso é publicado          -> avisa todos os usuários ativos
//   • "teste" (usado pela tela Configurações > Notificações)
//
// O ENVIO em si é feito pelo Google Apps Script (docs/google-apps-script/Codigo.gs),
// que manda pelo Gmail da conta dona do script. Esta função continua sendo a
// dona dos MODELOS de e-mail e só entrega ao Apps Script a lista pronta
// (destinatário + assunto + HTML).
//
// Por que passar por aqui e não chamar o Apps Script direto do navegador:
//   • o segredo do Apps Script ficaria exposto no bundle do front;
//   • o Apps Script não responde ao preflight CORS de requisições JSON.
//
// Variáveis de ambiente (secrets da função, NÃO do app):
//   GAS_URL      (obrigatória) — URL do web app publicado (termina em /exec).
//   GAS_SEGREDO  (obrigatória) — mesmo valor da propriedade CINTESP_SEGREDO
//                                configurada no Apps Script.
//
// Deploy (Supabase self-hosted): copie esta pasta para
// volumes/functions/notificar-email dentro do stack do Supabase e reinicie
// o serviço "functions" (edge-runtime). Defina os secrets no .env desse
// stack. Em Supabase Cloud: `supabase functions deploy notificar-email` e
// `supabase secrets set GAS_URL=... GAS_SEGREDO=...`.
// ============================================================

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Deno.env.get() recebe o NOME da variável de ambiente, nunca o valor dela.
// Os valores ficam no .env do stack do Supabase (veja docs/notificacoes-email.md).
const GAS_URL = Deno.env.get('GAS_URL')
const GAS_SEGREDO = Deno.env.get('GAS_SEGREDO')

// Injetadas automaticamente pelo Supabase (Cloud e self-hosted). Servem para
// descobrir QUEM está chamando a função e conferir a permissão dessa pessoa.
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')

/**
 * Quantos e-mails mandamos por requisição ao Apps Script. O teto de execução
 * lá é de 6 minutos e cada envio leva perto de 1 segundo, então 50 deixa
 * margem confortável.
 */
const LOTE = 50

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
      // Quem recebe é decidido AQUI, a partir do público-alvo — o navegador
      // não manda lista de e-mails.
      tipo: 'aviso_publicado'
      publicoAlvo?: string
      avisoTitulo: string
      avisoDescricao: string
      avisoTipo?: string
      autorNome?: string
      appUrl?: string
    }
  | {
      // Idem: os administradores da área são resolvidos no servidor.
      tipo: 'chamado_aberto'
      chamadoTitulo: string
      chamadoDescricao: string
      /** Valor bruto ("ti", "administrativo"...) — é o que casa com as áreas. */
      setor: string
      /** Rótulo legível ("TI", "Administrativo") só para exibir no e-mail. */
      setorRotulo?: string
      prioridade?: string
      categoria?: string
      solicitanteNome?: string
      appUrl?: string
    }
  | {
      tipo: 'teste'
      destinatarioEmail: string
      destinatarioNome?: string
    }
  | { tipo: 'cota' }

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

function templateChamadoAberto(c: Extract<Corpo, { tipo: 'chamado_aberto' }>, nomeDestinatario?: string) {
  const link = c.appUrl ? `${c.appUrl.replace(/\/+$/, '')}/admin/chamados` : undefined
  const linha = (rotulo: string, valor?: string) =>
    valor
      ? `<tr><td style="padding:2px 0;font-size:13px;color:#64748b;width:96px;">${rotulo}</td>
           <td style="padding:2px 0;font-size:13px;color:#0f172a;font-weight:600;">${escaparHtml(valor)}</td></tr>`
      : ''
  const corpo = `
    <p style="margin:0 0 12px;font-size:14px;color:#334155;">Olá${nomeDestinatario ? `, ${escaparHtml(nomeDestinatario)}` : ''}!</p>
    <p style="margin:0 0 12px;font-size:14px;color:#334155;">
      Um novo chamado foi aberto${c.solicitanteNome ? ` por <strong>${escaparHtml(c.solicitanteNome)}</strong>` : ''} e está aguardando atendimento:
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 8px;">
      <tr>
        <td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px;">
          <p style="margin:0 0 10px;font-size:15px;font-weight:700;color:#0f172a;">${escaparHtml(c.chamadoTitulo)}</p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 10px;">
            ${linha('Setor', c.setorRotulo ?? c.setor)}
            ${linha('Categoria', c.categoria)}
            ${linha('Prioridade', c.prioridade)}
          </table>
          <p style="margin:0;font-size:14px;color:#334155;white-space:pre-wrap;">${escaparHtml(c.chamadoDescricao)}</p>
        </td>
      </tr>
    </table>
    ${link ? botao(link, 'Abrir chamado') : ''}
  `
  return { assunto: `Novo chamado: ${c.chamadoTitulo}`, html: layout('Novo chamado aberto', corpo) }
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

// ---------- Envio (Google Apps Script → Gmail) ----------
interface ItemEmail {
  para: string
  assunto: string
  html: string
}

interface RespostaGas {
  ok?: boolean
  erro?: string
  enviados?: number
  falhas?: Array<{ email: string; erro: string }>
  cotaRestante?: number
}

/**
 * Entrega um lote ao Apps Script.
 *
 * Detalhe que engana: um web app do Apps Script responde HTTP 200 mesmo
 * quando recusa a operação, e devolve HTML (tela de login do Google) quando a
 * implantação ficou com acesso restrito. Por isso quem decide o sucesso é o
 * campo `ok` do JSON — nunca o status HTTP.
 */
async function entregarAoAppsScript(itens: ItemEmail[]): Promise<RespostaGas> {
  const r = await fetch(GAS_URL as string, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // O /exec redireciona para script.googleusercontent.com; seguir é esperado.
    redirect: 'follow',
    body: JSON.stringify({ segredo: GAS_SEGREDO, emails: itens }),
  })
  const texto = await r.text()

  let dados: RespostaGas
  try {
    dados = JSON.parse(texto)
  } catch {
    throw new Error(
      `O Apps Script não devolveu JSON (HTTP ${r.status}). Quase sempre significa que o web app foi ` +
        'implantado com acesso restrito — reimplante com "Quem pode acessar: Qualquer pessoa". ' +
        `Início da resposta: ${texto.slice(0, 160)}`,
    )
  }
  if (!dados.ok) throw new Error(dados.erro || 'O Apps Script recusou o envio.')
  return dados
}

/** Envia todos os itens, quebrando em lotes que caibam no tempo de execução. */
async function enviarEmails(itens: ItemEmail[]) {
  let enviados = 0
  const falhas: Array<{ email: string; erro: string }> = []
  let cotaRestante: number | undefined
  for (let i = 0; i < itens.length; i += LOTE) {
    const dados = await entregarAoAppsScript(itens.slice(i, i + LOTE))
    enviados += dados.enviados ?? 0
    if (Array.isArray(dados.falhas)) falhas.push(...dados.falhas)
    cotaRestante = dados.cotaRestante
  }
  return { enviados, falhas, cotaRestante }
}

// ---------- Autorização ----------
/**
 * Confere se quem chamou a função tem permissão para disparar e-mail.
 *
 * Por que a checagem é feita AQUI e não pela plataforma: a verificação de JWT
 * do Supabase roda ANTES da função e derruba o preflight CORS (o OPTIONS do
 * navegador não leva cabeçalho Authorization), o que quebra a chamada com
 * "Failed to send a request to the Edge Function". Desligando a verificação da
 * plataforma o preflight passa — e esta função assume a responsabilidade,
 * conferindo não só se a pessoa está logada, mas se ela é administradora.
 *
 * Devolve `null` quando está tudo certo, ou o erro a responder.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Cliente = any

interface Chamador {
  id: string
  permissoes: string[]
  cliente: Cliente
}

/** Identifica quem chamou. Devolve o erro a responder, ou o chamador. */
async function identificarChamador(
  req: Request,
): Promise<{ erro?: { status: number; mensagem: string }; chamador?: Chamador }> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return { erro: { status: 500, mensagem: 'SUPABASE_URL/SUPABASE_ANON_KEY ausentes no ambiente da função.' } }
  }
  const autorizacao = req.headers.get('Authorization') ?? ''
  if (!autorizacao.toLowerCase().startsWith('bearer ')) {
    return { erro: { status: 401, mensagem: 'Requisição sem cabeçalho Authorization. Faça login novamente.' } }
  }

  // Cliente que age COMO a pessoa que chamou (respeita as políticas RLS).
  const cliente = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: autorizacao } },
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: sessao, error: erroSessao } = await cliente.auth.getUser()
  if (erroSessao || !sessao?.user) {
    return { erro: { status: 401, mensagem: 'Sessão inválida ou expirada. Entre no sistema novamente.' } }
  }

  const { data: perfil, error: erroPerfil } = await cliente
    .from('usuarios')
    .select('funcao:funcoes(permissoes)')
    .eq('id', sessao.user.id)
    .maybeSingle()
  if (erroPerfil) {
    return { erro: { status: 500, mensagem: `Não consegui ler o perfil de quem chamou: ${erroPerfil.message}` } }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const funcao = (perfil as any)?.funcao
  const permissoes: string[] = (Array.isArray(funcao) ? funcao[0]?.permissoes : funcao?.permissoes) ?? []
  return { chamador: { id: sessao.user.id, permissoes, cliente } }
}

// ---------- Lista de pessoas (resolvida no servidor) ----------
interface Pessoa {
  nome?: string
  email: string
  funcaoNome: string
  permissoes: string[]
  areas: string[]
}

/** Tira acentos e caixa, para comparar nomes de área/público sem sustos. */
function normalizar(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

/**
 * O nome de uma área casa com um termo?
 *
 * Termos curtos ("TI", "RH") só valem como palavra inteira — senão "TI" casaria
 * com "Inteligência ArTIficial" e o chamado iria para a pessoa errada.
 */
function combina(areaNome: string, termo: string): boolean {
  const a = normalizar(areaNome)
  const t = normalizar(termo)
  if (!a || !t) return false
  if (t.length <= 3) return a.split(/[^a-z0-9]+/).includes(t)
  return a.includes(t) || t.includes(a)
}

/** Como cada setor de chamado se traduz em nomes de área de atuação. */
const TERMOS_POR_SETOR: Record<string, string[]> = {
  ti: ['ti', 'tecnologia', 'informatica', 'sistemas', 'suporte', 'devops', 'redes'],
  pesquisa: ['pesquisa', 'cientific', 'clinica'],
  administrativo: ['administrativo', 'administracao', 'rh', 'recursos humanos', 'financeiro', 'compras'],
  infraestrutura: ['infraestrutura', 'infra', 'manutencao', 'predial', 'eletrica'],
  outro: [],
}

async function listarPessoasAtivas(cliente: Cliente): Promise<Pessoa[]> {
  const { data, error } = await cliente
    .from('usuarios')
    .select('nome, email, funcao:funcoes(nome, permissoes), areas:usuario_areas(area:areas_atuacao(nome))')
    .eq('status', 'ativo')
  if (error) throw new Error(`Não consegui ler a lista de usuários: ${error.message}`)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[])
    .map((r) => {
      const funcao = Array.isArray(r.funcao) ? r.funcao[0] : r.funcao
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const areas = ((r.areas ?? []) as any[])
        .map((ua) => (Array.isArray(ua.area) ? ua.area[0] : ua.area)?.nome)
        .filter(Boolean) as string[]
      return {
        nome: r.nome ?? undefined,
        email: r.email ?? '',
        funcaoNome: funcao?.nome ?? '',
        permissoes: (funcao?.permissoes ?? []) as string[],
        areas,
      }
    })
    .filter((p) => p.email)
}

const ehAdmin = (p: Pessoa) => p.permissoes.includes('gerenciar_tudo')

/**
 * Quem recebe o aviso, conforme o público-alvo escolhido.
 * Texto livre é testado contra as ÁREAS DE ATUAÇÃO; se nada casar, cai para
 * todos os ativos (melhor avisar demais do que deixar alguém sem o recado).
 */
function destinatariosDoAviso(pessoas: Pessoa[], publicoAlvo?: string): Pessoa[] {
  const p = normalizar(publicoAlvo ?? '')
  if (!p || p === 'todos') return pessoas
  if (p === 'administradores') return pessoas.filter(ehAdmin)
  if (p.startsWith('pesquisador')) return pessoas.filter((u) => normalizar(u.funcaoNome).startsWith('pesquisador'))
  if (p.startsWith('coorden')) return pessoas.filter((u) => normalizar(u.funcaoNome).startsWith('coorden'))
  const porArea = pessoas.filter((u) => u.areas.some((a) => combina(a, publicoAlvo as string)))
  return porArea.length > 0 ? porArea : pessoas
}

/**
 * Quem recebe o chamado novo: os administradores cuja área de atuação combina
 * com o setor. Se nenhum admin cobre aquele setor, todos os admins recebem —
 * assim nenhum chamado fica órfão.
 */
function destinatariosDoChamado(pessoas: Pessoa[], setor: string): Pessoa[] {
  const admins = pessoas.filter(ehAdmin)
  const termos = TERMOS_POR_SETOR[normalizar(setor)] ?? []
  if (termos.length === 0) return admins
  const daArea = admins.filter((u) => u.areas.some((a) => termos.some((t) => combina(a, t))))
  return daArea.length > 0 ? daArea : admins
}

/** Consulta a cota do Gmail sem enviar nada (doGet do Apps Script). */
async function consultarCota(): Promise<number | undefined> {
  const r = await fetch(GAS_URL as string, { method: 'GET', redirect: 'follow' })
  const texto = await r.text()
  try {
    return (JSON.parse(texto) as { cotaRestante?: number }).cotaRestante
  } catch {
    throw new Error(
      `O Apps Script não devolveu JSON (HTTP ${r.status}). Confira se o web app está publicado para "Qualquer pessoa".`,
    )
  }
}

serve(async (req: Request) => {
  // O preflight tem de ser respondido ANTES de qualquer checagem: o navegador
  // não manda Authorization no OPTIONS.
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ erro: 'Método não permitido' }), {
      status: 405,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }
  if (!GAS_URL || !GAS_SEGREDO) {
    return new Response(
      JSON.stringify({ erro: 'GAS_URL e/ou GAS_SEGREDO não configuradas nos secrets da função.' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }

  try {
    const corpo = (await req.json()) as Corpo

    const { erro: erroAuth, chamador } = await identificarChamador(req)
    if (erroAuth || !chamador) {
      return new Response(JSON.stringify({ erro: erroAuth?.mensagem ?? 'Não autorizado.' }), {
        status: erroAuth?.status ?? 401,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    /**
     * Quem pode disparar cada tipo. `chamado_aberto` é o único liberado para
     * qualquer pessoa logada — afinal, qualquer uma pode abrir um chamado — e
     * por isso os destinatários dele são decididos aqui dentro, nunca pelo
     * navegador.
     */
    const permitidas: Record<Corpo['tipo'], string[] | null> = {
      teste: ['gerenciar_tudo'],
      cota: ['gerenciar_tudo'],
      chamado_respondido: ['gerenciar_tudo'],
      aviso_publicado: ['gerenciar_tudo', 'publicar_avisos'],
      chamado_aberto: null, // null = basta estar autenticado
    }
    const exigidas = permitidas[corpo.tipo]
    if (exigidas && !exigidas.some((p) => chamador.permissoes.includes(p))) {
      return new Response(
        JSON.stringify({ erro: 'Sua conta não tem permissão para disparar notificações por e-mail.' }),
        { status: 403, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    if (corpo.tipo === 'cota') {
      return new Response(JSON.stringify({ ok: true, cotaRestante: await consultarCota() }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    if (corpo.tipo === 'teste') {
      if (!corpo.destinatarioEmail) throw new Error('destinatarioEmail é obrigatório')
      const { assunto, html } = templateTeste(corpo.destinatarioNome)
      const r = await enviarEmails([{ para: corpo.destinatarioEmail, assunto, html }])
      return new Response(JSON.stringify({ ok: true, ...r }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    if (corpo.tipo === 'chamado_respondido') {
      if (!corpo.destinatarioEmail) throw new Error('destinatarioEmail é obrigatório')
      const { assunto, html } = templateChamadoRespondido(corpo)
      const r = await enviarEmails([{ para: corpo.destinatarioEmail, assunto, html }])
      return new Response(JSON.stringify({ ok: true, ...r }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    if (corpo.tipo === 'chamado_aberto') {
      const pessoas = await listarPessoasAtivas(chamador.cliente)
      const destinatarios = destinatariosDoChamado(pessoas, corpo.setor)
      if (destinatarios.length === 0) {
        throw new Error('Nenhum administrador ativo com e-mail cadastrado para receber o chamado.')
      }
      const itens = destinatarios.map((d) => {
        const { assunto, html } = templateChamadoAberto(corpo, d.nome)
        return { para: d.email, assunto, html }
      })
      const r = await enviarEmails(itens)
      return new Response(JSON.stringify({ ok: true, ...r }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    if (corpo.tipo === 'aviso_publicado') {
      const pessoas = await listarPessoasAtivas(chamador.cliente)
      const destinatarios = destinatariosDoAviso(pessoas, corpo.publicoAlvo)
      if (destinatarios.length === 0) {
        throw new Error(`Nenhum usuário ativo corresponde ao público-alvo "${corpo.publicoAlvo ?? 'Todos'}".`)
      }
      const itens = destinatarios.map((d) => {
        const { assunto, html } = templateAvisoPublicado(corpo, d.nome)
        return { para: d.email, assunto, html }
      })
      const r = await enviarEmails(itens)
      return new Response(JSON.stringify({ ok: true, ...r }), {
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
