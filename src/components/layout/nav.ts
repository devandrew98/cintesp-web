import {
  LayoutDashboard,
  CalendarClock,
  Clock,
  Users,
  CalendarDays,
  Megaphone,
  Search,
  FileBarChart,
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
}

export const navSections: NavSection[] = [
  {
    items: [
      { label: 'Dashboard', to: '/', icon: LayoutDashboard },
      { label: 'Quadro de Disponibilidade', to: '/quadro', icon: CalendarClock },
      { label: 'Meu Horário', to: '/meu-horario', icon: Clock },
      { label: 'Pesquisadores', to: '/pesquisadores', icon: Users },
      { label: 'Agenda do Dia', to: '/agenda', icon: CalendarDays },
      { label: 'Avisos', to: '/avisos', icon: Megaphone, badge: 3 },
      { label: 'Busca Rápida', to: '/busca', icon: Search },
      { label: 'Relatórios', to: '/relatorios', icon: FileBarChart },
    ],
  },
  {
    title: 'Administração',
    items: [
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
