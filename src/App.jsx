import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import UserDashboard from './pages/UserDashboard.jsx';
import HelperDashboard from './pages/HelperDashboard.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import Chat from './pages/Chat.jsx';
import Resources from './pages/Resources.jsx';
import Mood from './pages/Mood.jsx';
import Profile from './pages/Profile.jsx';
import HelperList from './pages/HelperList.jsx';
import AppLayout from './components/AppLayout.jsx';

function Protected({ children, role }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loader">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to={defaultRouteFor(user.role)} replace />;
  return children;
}

function defaultRouteFor(role) {
  if (role === 'admin') return '/admin';
  if (role === 'helper') return '/helper';
  return '/app';
}

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <div className="loader">Loading…</div>;

  return (
    <Routes>
      <Route path="/" element={user ? <Navigate to={defaultRouteFor(user.role)} replace /> : <Landing />} />
      <Route path="/login" element={user ? <Navigate to={defaultRouteFor(user.role)} replace /> : <Login />} />
      <Route path="/register" element={user ? <Navigate to={defaultRouteFor(user.role)} replace /> : <Register />} />

      <Route
        path="/app"
        element={
          <Protected role="user">
            <AppLayout />
          </Protected>
        }
      >
        <Route index element={<UserDashboard />} />
        <Route path="helpers" element={<HelperList />} />
        <Route path="chat" element={<Chat />} />
        <Route path="chat/:chatId" element={<Chat />} />
        <Route path="mood" element={<Mood />} />
        <Route path="resources" element={<Resources />} />
        <Route path="profile" element={<Profile />} />
      </Route>

      <Route
        path="/helper"
        element={
          <Protected role="helper">
            <AppLayout />
          </Protected>
        }
      >
        <Route index element={<HelperDashboard />} />
        <Route path="chat" element={<Chat />} />
        <Route path="chat/:chatId" element={<Chat />} />
        <Route path="resources" element={<Resources />} />
        <Route path="profile" element={<Profile />} />
      </Route>

      <Route
        path="/admin"
        element={
          <Protected role="admin">
            <AppLayout />
          </Protected>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="profile" element={<Profile />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
