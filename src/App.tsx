import { NavLink, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { AuthGate } from './components/AuthGate'
import { AddMealPage } from './pages/AddMealPage'
import { EditMealPage } from './pages/EditMealPage'
import { LoginPage } from './pages/LoginPage'
import { ChartsPage } from './pages/ChartsPage'
import { SavedMealsPage } from './pages/SavedMealsPage'
import { SettingsPage } from './pages/SettingsPage'
import { TodayPage } from './pages/TodayPage'

function Shell() {
  const location = useLocation()
  const hideNav = location.pathname === '/add' || location.pathname.startsWith('/meals/')

  return (
    <>
      <div className={hideNav ? 'app wide' : 'app'}>
        {hideNav ? <Outlet /> : (
          <>
            <Outlet />
            <nav className="nav">
              <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
                Today
              </NavLink>
              <NavLink to="/charts" className={({ isActive }) => (isActive ? 'active' : '')}>
                Charts
              </NavLink>
              <NavLink to="/saved" className={({ isActive }) => (isActive ? 'active' : '')}>
                Saved
              </NavLink>
              <NavLink to="/settings" className={({ isActive }) => (isActive ? 'active' : '')}>
                Settings
              </NavLink>
            </nav>
          </>
        )}
      </div>
    </>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <AuthGate>
            <Shell />
          </AuthGate>
        }
      >
        <Route path="/" element={<TodayPage />} />
        <Route path="/add" element={<AddMealPage />} />
        <Route path="/meals/:id" element={<EditMealPage />} />
        <Route path="/charts" element={<ChartsPage />} />
        <Route path="/saved" element={<SavedMealsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
