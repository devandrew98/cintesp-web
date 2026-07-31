import { Routes, Route, Outlet, Navigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { RequireAuth } from '@/components/auth/RequireAuth'
import { RequireLiberado } from '@/components/auth/RequireLiberado'
import { LoginPage } from '@/pages/Login'
import { AbrirChamadoPage } from '@/pages/AbrirChamado'
import { ChamadosAdminPage } from '@/pages/admin/ChamadosAdmin'
import { DashboardPage } from '@/pages/Dashboard'
import { QuadroPage } from '@/pages/Quadro'
import { MeuHorarioPage } from '@/pages/MeuHorario'
import { PesquisadoresPage } from '@/pages/Pesquisadores'
import { AgendaPage } from '@/pages/Agenda'
import { BuscaPage } from '@/pages/Busca'
import { RelatoriosPage } from '@/pages/Relatorios'
import { AvisosPage } from '@/pages/Avisos'
import { AdminUsuariosPage } from '@/pages/admin/Usuarios'
import { AdminPesquisadoresPage } from '@/pages/admin/Pesquisadores'
import { AdminHorariosPage } from '@/pages/admin/Horarios'
import { AdminFuncoesPage } from '@/pages/admin/Funcoes'
import { AdminAreasPage } from '@/pages/admin/Areas'
import { AdminInstituicoesPage } from '@/pages/admin/Instituicoes'
import { AdminConfiguracoesPage } from '@/pages/admin/Configuracoes'
import { AdminEmConstrucao } from '@/pages/admin/AdminEmConstrucao'
import { RequireAdmin } from '@/components/auth/RequireAdmin'
import { Placeholder } from '@/pages/Placeholder'

export default function App() {
  return (
    <Routes>
      {/* Rota pública de autenticação */}
      <Route path="/login" element={<LoginPage />} />

      {/* Tudo abaixo exige login (quando o Supabase está configurado) */}
      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        {/* Acessível a QUALQUER usuário logado (inclusive Participante) */}
        <Route path="/abrir-chamado" element={<AbrirChamadoPage />} />

        {/* Plataforma — bloqueada para quem ainda é Participante */}
        <Route
          element={
            <RequireLiberado>
              <Outlet />
            </RequireLiberado>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="/quadro" element={<QuadroPage />} />
          <Route path="/meu-horario" element={<MeuHorarioPage />} />
          <Route path="/pesquisadores" element={<PesquisadoresPage />} />
          <Route path="/agenda" element={<AgendaPage />} />
          <Route path="/avisos" element={<AvisosPage />} />
          <Route path="/busca" element={<BuscaPage />} />
          <Route path="/relatorios" element={<RelatoriosPage />} />
        </Route>

        {/* Administração */}
        <Route path="/admin/chamados" element={<RequireAdmin><ChamadosAdminPage /></RequireAdmin>} />
        <Route path="/admin/pesquisadores" element={<RequireAdmin><AdminPesquisadoresPage /></RequireAdmin>} />
        {/* Rotas antigas, agora unificadas em "Pesquisadores" (mantidas p/ links salvos) */}
        <Route path="/admin/usuarios" element={<RequireAdmin><AdminUsuariosPage /></RequireAdmin>} />
        <Route path="/admin/participantes" element={<Navigate to="/admin/pesquisadores" replace />} />
        <Route path="/admin/funcoes" element={<RequireAdmin><AdminFuncoesPage /></RequireAdmin>} />
        <Route path="/admin/horarios" element={<RequireAdmin><AdminHorariosPage /></RequireAdmin>} />
        <Route path="/admin/areas" element={<RequireAdmin><AdminAreasPage /></RequireAdmin>} />
        <Route path="/admin/instituicoes" element={<RequireAdmin><AdminInstituicoesPage /></RequireAdmin>} />
        <Route path="/admin/configuracoes" element={<RequireAdmin><AdminConfiguracoesPage /></RequireAdmin>} />

        <Route path="*" element={<Placeholder title="Página não encontrada" fase="—" descricao="O endereço acessado não existe." />} />
      </Route>
    </Routes>
  )
}
