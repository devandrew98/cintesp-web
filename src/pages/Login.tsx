import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Loader2, LogIn, UserPlus, CheckCircle2 } from 'lucide-react'
import { BrandLogo } from '@/components/layout/BrandLogo'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/store/auth'

/**
 * Tela de Login / Cadastro (Fase 4 — Supabase Auth).
 * Alterna entre "Entrar" e "Criar conta". Ao autenticar, redireciona para
 * a rota de origem (ou o Dashboard). Sem Supabase configurado, não faz sentido:
 * redireciona direto para a home.
 */
export function LoginPage() {
  const { session, entrar, cadastrar } = useAuth()
  const navigate = useNavigate()
  const location = useLocation() as { state?: { from?: string } }
  const destino = location.state?.from || '/'

  const [modo, setModo] = useState<'entrar' | 'cadastrar'>('entrar')
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  // Sem Supabase (mock puro) ou já logado: não há o que fazer aqui.
  if (!supabase || session) return <Navigate to={destino} replace />

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    setOk(null)
    setEnviando(true)
    try {
      if (modo === 'entrar') {
        const { error } = await entrar(email.trim(), senha)
        if (error) return setErro(traduzErro(error))
        navigate(destino, { replace: true })
      } else {
        const { error } = await cadastrar(email.trim(), senha, nome.trim())
        if (error) return setErro(traduzErro(error))
        // Se a confirmação de e-mail estiver ligada, não há sessão ainda.
        setOk('Conta criada! Se pedir confirmação por e-mail, confirme e depois entre.')
        setModo('entrar')
      }
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <BrandLogo />
        </div>

        <div className="card p-6">
          <h1 className="text-lg font-bold text-slate-900 dark:text-white">
            {modo === 'entrar' ? 'Entrar' : 'Criar conta'}
          </h1>
          <p className="mb-5 text-sm text-slate-500">
            {modo === 'entrar'
              ? 'Acesse o quadro de pesquisadores do CINTESP.'
              : 'Crie seu acesso. O primeiro cadastro vira Administrador.'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {modo === 'cadastrar' && (
              <Field label="Nome completo">
                <Input
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Seu nome"
                />
              </Field>
            )}
            <Field label="E-mail">
              <Input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@cintesp.org.br"
                autoComplete="email"
              />
            </Field>
            <Field label="Senha">
              <Input
                required
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="••••••••"
                autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'}
                minLength={6}
              />
            </Field>

            {erro && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-300">
                {erro}
              </p>
            )}
            {ok && (
              <p className="flex items-start gap-2 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                {ok}
              </p>
            )}

            <Button
              type="submit"
              disabled={enviando}
              icon={enviando ? undefined : modo === 'entrar' ? LogIn : UserPlus}
              className="w-full"
            >
              {enviando ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : modo === 'entrar' ? (
                'Entrar'
              ) : (
                'Criar conta'
              )}
            </Button>
          </form>

          <div className="mt-4 text-center text-sm text-slate-500">
            {modo === 'entrar' ? (
              <>
                Ainda não tem conta?{' '}
                <button
                  onClick={() => {
                    setModo('cadastrar')
                    setErro(null)
                  }}
                  className="font-medium text-brand-600 hover:underline"
                >
                  Criar conta
                </button>
              </>
            ) : (
              <>
                Já tem conta?{' '}
                <button
                  onClick={() => {
                    setModo('entrar')
                    setErro(null)
                  }}
                  className="font-medium text-brand-600 hover:underline"
                >
                  Entrar
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/** Traduz as mensagens de erro mais comuns do Supabase Auth. */
function traduzErro(msg: string): string {
  const m = msg.toLowerCase()
  if (m.includes('invalid login credentials')) return 'E-mail ou senha incorretos.'
  if (m.includes('email not confirmed')) return 'Confirme seu e-mail antes de entrar.'
  if (m.includes('user already registered')) return 'Este e-mail já tem conta. Faça login.'
  if (m.includes('password should be at least')) return 'A senha deve ter ao menos 6 caracteres.'
  return msg
}
