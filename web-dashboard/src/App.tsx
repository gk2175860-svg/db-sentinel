import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import { AuthProvider, useAuth } from "./context/AuthContext"
import { Layout } from "./components/layout/Layout"
import { LoginPage } from "./pages/LoginPage"
import { OverviewPage } from "./pages/OverviewPage"
import { DatabasesPage } from "./pages/DatabasesPage"
import { InvestigationPage } from "./pages/InvestigationPage"
import { IncidentsPage } from "./pages/IncidentsPage"
import { AgentRunsPage } from "./pages/AgentRunsPage"
import { ResearchPage } from "./pages/ResearchPage"
import { AuditPage } from "./pages/AuditPage"
import { SettingsPage } from "./pages/SettingsPage"
import { UsersManagementPage } from "./pages/UsersManagementPage"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
})

function ProtectedRoutes() {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/overview" replace />} />
        <Route path="/overview" element={<OverviewPage />} />
        <Route path="/databases" element={<DatabasesPage />} />
        <Route path="/investigation" element={<InvestigationPage />} />
        <Route path="/incidents" element={<IncidentsPage />} />
        <Route path="/agent-runs" element={<AgentRunsPage />} />
        <Route path="/research" element={<ResearchPage />} />
        <Route path="/audit" element={<AuditPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/users" element={<UsersManagementPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/overview" replace />} />
    </Routes>
  )
}

function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/*" element={<ProtectedRoutes />} />
      </Routes>
      <ReactQueryDevtools initialIsOpen={false} />
    </BrowserRouter>
  )
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </QueryClientProvider>
  )
}