import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './lib/auth.jsx';
import { Loading } from './components/ui.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';
import SendMoney from './pages/SendMoney.jsx';
import Statement from './pages/Statement.jsx';
import Profile from './pages/Profile.jsx';
import AdminCustomers from './pages/AdminCustomers.jsx';
import AdminActivity from './pages/AdminActivity.jsx';

export default function App() {
  const { user, loading } = useAuth();

  if (loading) return <Loading label="Opening Kosh Bank…" />;

  if (!user) {
    return (
      <Routes>
        <Route path="/register" element={<Register />} />
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  const isAdmin = user.role === 'admin';
  return (
    <Routes>
      <Route element={<Layout />}>
        {isAdmin ? (
          <>
            <Route path="/admin" element={<AdminCustomers />} />
            <Route path="/admin/activity" element={<AdminActivity />} />
            <Route path="/admin/statement/:number" element={<Statement />} />
          </>
        ) : (
          <>
            <Route path="/" element={<Dashboard />} />
            <Route path="/send" element={<SendMoney />} />
            <Route path="/statement" element={<Statement />} />
          </>
        )}
        <Route path="/profile" element={<Profile />} />
        <Route path="*" element={<Navigate to={isAdmin ? '/admin' : '/'} replace />} />
      </Route>
    </Routes>
  );
}
