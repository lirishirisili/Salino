import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AuthScreen from './screens/AuthScreen';
import HouseholdSetupScreen from './screens/HouseholdSetupScreen';
import ShoppingListScreen from './screens/ShoppingListScreen';
import AddItemScreen from './screens/AddItemScreen';
import EditItemScreen from './screens/EditItemScreen';
import HistoryScreen from './screens/HistoryScreen';
import ActivityFeedScreen from './screens/ActivityFeedScreen';
import SupermarketModeScreen from './screens/SupermarketModeScreen';
import SettingsScreen from './screens/SettingsScreen';
import { useActivityNotifications } from './services/notificationOrchestrator';
import { useI18n } from './i18n';
import './index.css';

function AppRoutes() {
  const { user, loading } = useAuth();
  const { t } = useI18n();
  useActivityNotifications(user, t);

  if (loading) {
    return (
      <div className="loading-screen" role="status" aria-label="Loading">
        <div className="spinner" aria-hidden="true" />
        <p style={{ color: 'var(--on-surface-variant)' }} aria-hidden="true">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<AuthScreen />} />
      </Routes>
    );
  }

  if (!user.activeHouseholdId) {
    return (
      <Routes>
        <Route path="/household-setup" element={<HouseholdSetupScreen />} />
        <Route path="*" element={<Navigate to="/household-setup" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<ShoppingListScreen />} />
      <Route path="/add" element={<AddItemScreen />} />
      <Route path="/edit/:itemId" element={<EditItemScreen />} />
      <Route path="/history" element={<HistoryScreen />} />
      <Route path="/activity" element={<ActivityFeedScreen />} />
      <Route path="/supermarket" element={<SupermarketModeScreen />} />
      <Route path="/settings" element={<SettingsScreen />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <a href="#main-content" className="skip-nav">Skip to main content</a>
        <main id="main-content" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <AppRoutes />
        </main>
      </AuthProvider>
    </BrowserRouter>
  );
}
