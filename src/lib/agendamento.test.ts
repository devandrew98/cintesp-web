import { describe, expect, it } from 'vitest'
import {
  AVALIACOES,
  CONFIG_PADRAO,
  calcularOcupados,
  chaveSlot,
  diaLotado,
  ehDiaUtil,
  linkWhatsapp,
  mensagemConfirmacao,
  mensagemParaPesquisador,
  normalizarTriagem,
  numeroWhatsapp,
  sinaisDeAlerta,
  triagemVazia,
  validarPessoa,
  validarSelecoes,
  validarTriagem,
  type Selecao,
  type Triagem,
} from '@/lib/agendamento'

const HOJE = '2026-11-05'

/** Escolhas válidas: fase 1 em 23 e 24/11, fase 2 em 7, 8 e 9/12 (segunda a quarta). */
const boas = (): Selecao[] => [
  { avaliacaoId: 'antropometrica', data: '2026-11-23', hora: '08:00' },
  { avaliacaoId: 'dinamometria', data: '2026-11-24', hora: '08:00' },
  { avaliacaoId: 'ergoespirometria', data: '2026-12-07', hora: '09:00' },
  { avaliacaoId: 'potencia_anaerobia', data: '2026-12-08', hora: '09:00' },
  { avaliacaoId: 'capacidade_aerobia', data: '2026-12-09', hora: '09:00' },
]

describe('dias úteis', () => {
  it('sábado e domingo não são úteis', () => {
    expect(ehDiaUtil('2026-11-23')).toBe(true) // segunda
    expect(ehDiaUtil('2026-11-28')).toBe(false) // sábado
    expect(ehDiaUtil('2026-11-29')).toBe(false) // domingo
  })
})

describe('ocupação', () => {
  it('avaliação pedida ocupa o bloco; cancelada libera', () => {
    const o = calcularOcupados(
      [
        { data: '2026-11-23', hora: '08:00:00', status: 'pendente' },
        { data: '2026-11-23', hora: '09:00', status: 'cancelado' },
      ],
      [],
    )
    expect(o.has(chaveSlot('2026-11-23', '08:00'))).toBe(true)
    expect(o.has(chaveSlot('2026-11-23', '09:00'))).toBe(false)
  })

  it('compromisso bloqueia só os blocos que ele encosta; dia inteiro bloqueia todos', () => {
    const o = calcularOcupados(
      [],
      [
        { data: '2026-11-23', horaInicio: '09:30', horaFim: '11:00', diaInteiro: false },
        { data: '2026-11-24', diaInteiro: true },
      ],
    )
    expect([...'08:00 09:00 10:00 11:00'.split(' ')].map((h) => o.has(chaveSlot('2026-11-23', h)))).toEqual([false, true, true, false])
    expect(diaLotado('2026-11-24', o)).toBe(true)
    expect(diaLotado('2026-11-23', o)).toBe(false)
  })
})

describe('validarSelecoes', () => {
  it('aceita um conjunto válido', () => {
    expect(validarSelecoes(boas(), CONFIG_PADRAO, new Set(), HOJE)).toBeNull()
  })

  it('exige todas as avaliações', () => {
    expect(validarSelecoes(boas().slice(0, 4), CONFIG_PADRAO, new Set(), HOJE)).toMatch(/capacidade aeróbia/)
  })

  it('recusa fim de semana, data fora do período e horário inexistente', () => {
    const fds = boas()
    fds[0].data = '2026-11-28'
    expect(validarSelecoes(fds, CONFIG_PADRAO, new Set(), HOJE)).toMatch(/dias úteis/)
    const fora = boas()
    fora[0].data = '2026-11-16'
    expect(validarSelecoes(fora, CONFIG_PADRAO, new Set(), HOJE)).toMatch(/entre 23\/11\/2026 e 06\/12\/2026/)
    const hora = boas()
    hora[0].hora = '12:00'
    expect(validarSelecoes(hora, CONFIG_PADRAO, new Set(), HOJE)).toMatch(/horário inválido/)
  })

  it('recusa horário já ocupado (anti-duplicidade)', () => {
    const ocupados = new Set([chaveSlot('2026-11-23', '08:00')])
    expect(validarSelecoes(boas(), CONFIG_PADRAO, ocupados, HOJE)).toMatch(/não está mais disponível/)
  })

  it('mesma fase em dias diferentes e nada no mesmo dia/horário', () => {
    const mesmoDia = boas()
    mesmoDia[1].data = '2026-11-23'
    mesmoDia[1].hora = '10:00'
    expect(validarSelecoes(mesmoDia, CONFIG_PADRAO, new Set(), HOJE)).toMatch(/dia diferente/)
  })

  it('fase 1 antes da fase 2 (períodos que se sobrepõem)', () => {
    const cfg = { ...CONFIG_PADRAO, fase2Inicio: '2026-11-23' }
    const s = boas()
    s[2].data = '2026-11-25'
    s[3].data = '2026-11-26'
    s[4].data = '2026-11-20' // antes do início: barrado pelo período
    expect(validarSelecoes(s, cfg, new Set(), HOJE)).not.toBeNull()
    const s2 = boas()
    s2[0].data = '2026-12-01'
    s2[1].data = '2026-12-02'
    s2[2].data = '2026-12-01' // fase 2 no mesmo dia que a fase 1, mesmo período aberto
    s2[3].data = '2026-12-03'
    s2[4].data = '2026-12-04'
    const aberto = { ...CONFIG_PADRAO, fase2Inicio: '2026-11-23', fase2Fim: '2026-12-20' }
    expect(validarSelecoes(s2, aberto, new Set(), HOJE)).toMatch(/Fase 1 devem acontecer antes/)
  })

  it('recusa data no passado', () => {
    expect(validarSelecoes(boas(), CONFIG_PADRAO, new Set(), '2026-12-01')).toMatch(/já passou/)
  })

  it('cobre as 5 avaliações do formulário', () => {
    expect(AVALIACOES.map((a) => a.fase)).toEqual([1, 1, 2, 2, 2])
  })
})

describe('dados pessoais', () => {
  it('valida CPF, telefone e e-mail', () => {
    const e = validarPessoa({ nome: 'An', cpf: '111.111.111-11', endereco: 'Rua', telefone: '123', email: 'x', perfil: '', deficiencia: '' })
    expect(Object.keys(e).sort()).toEqual(['cpf', 'deficiencia', 'email', 'endereco', 'nome', 'perfil', 'telefone'].sort())
    expect(
      validarPessoa({
        nome: 'Ana Maria Souza',
        cpf: '529.982.247-25',
        endereco: 'Rua A, 10, Centro, Uberlândia',
        telefone: '(34) 99999-9999',
        email: 'ana@exemplo.com',
        perfil: 'Atleta',
        deficiencia: 'Lesão medular',
      }),
    ).toEqual({})
  })
})

describe('triagem condicional', () => {
  const completa = (): Triagem => {
    const t = triagemVazia()
    for (const k of ['cardio', 'sintomasEsforco', 'respiratoria', 'lesaoMedular', 'avc', 'medicamentos', 'ortopedica', 'outrasCondicoes'] as const)
      t[k] = { resposta: 'Não', detalhe: '' }
    t.locomocao = 'Deambula sem auxílio'
    t.autorizacao = 'Sim'
    return t
  }

  it('tudo "Não" e autorizado passa sem detalhe', () => {
    expect(validarTriagem(completa())).toEqual({})
  })

  it('"Sim" nos itens 1, 3, 4, 5, 6, 7 e 9 exige o detalhe; no 2 não', () => {
    for (const k of ['cardio', 'respiratoria', 'lesaoMedular', 'avc', 'medicamentos', 'ortopedica', 'outrasCondicoes'] as const) {
      const t = completa()
      t[k] = { resposta: 'Sim', detalhe: '  ' }
      expect(validarTriagem(t)[k]).toMatch(/Descreva/)
      t[k].detalhe = 'qualquer coisa'
      expect(validarTriagem(t)[k]).toBeUndefined()
    }
    const t2 = completa()
    t2.sintomasEsforco = { resposta: 'Sim', detalhe: '' }
    expect(validarTriagem(t2)).toEqual({})
  })

  it('item 8: "Outro" exige dizer qual', () => {
    const t = completa()
    t.locomocao = 'Outro'
    expect(validarTriagem(t).locomocao).toMatch(/qual/)
    t.locomocaoOutro = 'Prótese'
    expect(validarTriagem(t).locomocao).toBeUndefined()
  })

  it('sem autorização não segue', () => {
    const t = completa()
    t.autorizacao = 'Não'
    expect(validarTriagem(t).autorizacao).toMatch(/autorizar/)
  })

  it('normalizar descarta detalhe de quem mudou para "Não" e o "qual?" quando não é "Outro"', () => {
    const t = completa()
    t.cardio = { resposta: 'Não', detalhe: 'sobrou' }
    t.locomocao = 'Cadeira de rodas manual'
    t.locomocaoOutro = 'sobrou'
    const n = normalizarTriagem(t)
    expect(n.cardio.detalhe).toBe('')
    expect(n.locomocaoOutro).toBe('')
  })

  it('sinais de alerta só para cardio, esforço e respiratória', () => {
    const t = completa()
    t.cardio.resposta = 'Sim'
    t.sintomasEsforco.resposta = 'Sim'
    expect(sinaisDeAlerta(t)).toHaveLength(2)
  })
})

describe('whatsapp', () => {
  it('normaliza o número com 55', () => {
    expect(numeroWhatsapp('(34) 99999-9999')).toBe('5534999999999')
    expect(numeroWhatsapp('+55 34 99999-9999')).toBe('5534999999999')
    expect(numeroWhatsapp('123')).toBeNull()
    expect(linkWhatsapp('', 'oi')).toBeNull()
  })

  it('mensagem do solicitante cita dia, hora e local; a de confirmação cumprimenta pelo primeiro nome', () => {
    const itens = [
      { avaliacaoNome: 'Ergoespirometria', data: '2026-12-07', hora: '09:00' },
      { avaliacaoNome: 'Avaliação antropométrica', data: '2026-11-23', hora: '08:00' },
    ]
    const m1 = mensagemParaPesquisador({ nome: 'Ana Souza', protocolo: 'AG-1', local: 'Arena Sabiazinho', itens })
    expect(m1).toContain('23/11/2026 às 08:00 na Arena Sabiazinho')
    expect(m1.indexOf('23/11/2026')).toBeLessThan(m1.indexOf('07/12/2026'))
    const m2 = mensagemConfirmacao({ nome: 'Ana Souza', local: 'Arena Sabiazinho', itens })
    expect(m2.startsWith('Olá, Ana! Passando para confirmar com você')).toBe(true)
  })
})
