import { Routes, Route } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { RequireAuth } from '@/components/auth/RequireAuth'
import { LoginPage } from '@/pages/Login'
import { DashboardPage } from '@/pages/Dashboard'
import { QuadroPage } from '@/pages/Quadro'
import { MeuHorarioPage } from '@/pages/MeuHorario'
import { PesquisadoresPage } from '@/pages/Pesquisadores'
import { AgendaPage } from '@/pages/Agenda'
import { BuscaPage } from '@/pages/Busca'
import { RelatoriosPage } from '@/pages/Relatorios'
import { AvisosPage } from '@/pages/Avisos'
import { AdminUsuariosPage } from '@/pages/admin/Usuarios'
import { AdminParticipantesPage } from '@/pages/admin/Participantes'
import { AdminHorariosPage } from '@/pages/admin/Horarios'
import { AdminFuncoesPage } from '@/pages/admin/Funcoes'
import { AdminAreasPage } from '@/pages/admin/Areas'
import { AdminInstituicoesPage } from '@/pages/admin/Instituicoes'
import { AdminConfiguracoesPage } from '@/pages/admin/Configuracoes'
import { AdminEmConstrucao } from '@/pages/admin/AdminEmConstrucao'
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
        <Route index element={<DashboardPage />} />

        <Route path="/quadro" element={<QuadroPage />} />
        <Route path="/meu-horario" element={<MeuHorarioPage />} />
        <Route path="/pesquisadores" element={<PesquisadoresPage />} />
        <Route path="/agenda" element={<AgendaPage />} />
        <Route path="/avisos" element={<AvisosPage />} />
        <Route path="/busca" element={<BuscaPage />} />
        <Route path="/relatorios" element={<RelatoriosPage />} />

        <Route path="/admin/usuarios" element={<AdminUsuariosPage />} />
        <Route path="/admin/participantes" element={<AdminParticipantesPage />} />
        <Route path="/admin/funcoes" element={<AdminFuncoesPage />} />
        <Route path="/admin/horarios" element={<AdminHorariosPage />} />
        <Route path="/admin/areas" element={<AdminAreasPage />} />
        <Route path="/admin/instituicoes" element={<AdminInstituicoesPage />} />
        <Route path="/admin/configuracoes" element={<AdminConfiguracoesPage />} />

        <Route path="*" element={<Placeholder title="Página não encontrada" fase="—" descricao="O endereço acessado não existe." />} />
      </Route>
    </Routes>
  )
}
