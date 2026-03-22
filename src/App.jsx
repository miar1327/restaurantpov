import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppProvider } from './context/AppContext';
import LoginScreen from './pages/LoginScreen';
import Sidebar from './components/Layout/Sidebar';
import Dashboard from './pages/Dashboard';
import NewOrder from './pages/NewOrder';
import MenuManagement from './pages/MenuManagement';
import Settings from './pages/Settings';
import Receipt from './pages/Receipt';
import Reports from './pages/Reports';
import ManageRestaurants from './pages/ManageRestaurants';
import RoleAccessScreen from './pages/RoleAccessScreen';

function AppShell() {
  const { isLoggedIn, loading, hasRole } = useAuth();

  if (loading) {
    return (
      <div className="splash-loading">
        <div className="splash-spinner" />
      </div>
    );
  }

  if (!isLoggedIn) return <LoginScreen />;
  if (!hasRole) return <RoleAccessScreen />;

  return (
    <AppProvider>
      <div className="app-shell">
        <Routes>
          {/* Full-screen pages (no sidebar) */}
          <Route path="/receipt/:orderId" element={<Receipt />} />

          {/* Main app layout */}
          <Route path="/*" element={
            <>
              <Sidebar />
              <main className="main-content">
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/new-order" element={<NewOrder />} />
                  <Route path="/menu" element={<MenuManagement />} />
                  <Route path="/reports" element={<Reports />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/restaurants" element={<ManageRestaurants />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </main>
            </>
          } />
        </Routes>
      </div>
    </AppProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </BrowserRouter>
  );
}
