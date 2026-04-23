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
import './index.css';

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p style={{ color: 'var(--on-surface-variant)' }}>Loading...</p>
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
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
