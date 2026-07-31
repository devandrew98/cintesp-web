import {
  LayoutDashboard,
  CalendarClock,
  Clock,
  Users,
  CalendarDays,
  Megaphone,
  Search,
  FileBarChart,
  LifeBuoy,
  Headphones,
  UserCog,
  GraduationCap,
  Shield,
  MapPin,
  Building2,
  Settings,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  label: string
  to: string
  icon: LucideIcon
  badge?: number
}

export interface NavSection {
  title?: string
  items: NavItem[]
  /** Seção visível apenas para administradores (permissão `gerenciar_tudo`). */
  somenteAdmin?: boolean
  /** Seção visível só para contas liberadas (esconde de quem é Participante). */
  somenteLiberado?: boolean
}

export const navSections: NavSection[] = [
  {
    // Plataforma: some para quem ainda é Participante (aguardando liberação).
    somenteLiberado: true,
    items: [
      { label: 'Dashboard', to: '/', icon: LayoutDashboard },
      { label: 'Quadro de Disponibilidade', to: '/quadro', icon: CalendarClock },
      { label: 'Meu Horário', to: '/meu-horario', icon: Clock },
      { label: 'Pesquisadores', to: '/pesquisadores', icon: Users },
      { label: 'Agenda do Dia', to: '/agenda', icon: CalendarDays },
      { label: 'Avisos', to: '/avisos', icon: Megaphone },
      { label: 'Busca Rápida', to: '/busca', icon: Search },
      { label: 'Relatórios', to: '/relatorios', icon: FileBarChart },
    ],
  },
  {
    // Disponível para TODOS os usuários logados (inclusive Participante).
    items: [{ label: 'Abrir Chamado', to: '/abrir-chamado', icon: LifeBuoy }],
  },
  {
    title: 'Administração',
    // Todo este bloco some do menu para quem não é administrador.
    somenteAdmin: true,
    items: [
      { label: 'Chamados', to: '/admin/chamados', icon: Headphones },
      { label: 'Usuários', to: '/admin/usuarios', icon: UserCog },
      { label: 'Participantes', to: '/admin/participantes', icon: GraduationCap },
      { label: 'Funções', to: '/admin/funcoes', icon: Shield },
      { label: 'Horários', to: '/admin/horarios', icon: Clock },
      { label: 'Áreas de Atuação', to: '/admin/areas', icon: MapPin },
      { label: 'Instituições', to: '/admin/instituicoes', icon: Building2 },
      { label: 'Configurações', to: '/admin/configuracoes', icon: Settings },
    ],
  },
]
