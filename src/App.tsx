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
                <svg className="nav-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <circle cx="12" cy="13" r="6" />
                  <path d="M8 6h8" strokeLinecap="round" />
                </svg>
                Today
              </NavLink>
              <NavLink to="/charts" className={({ isActive }) => (isActive ? 'active' : '')}>
                <svg className="nav-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <path d="M6 17V10M12 17V7M18 17v-4" strokeLinecap="round" />
                </svg>
                Charts
              </NavLink>
              <NavLink to="/saved" className={({ isActive }) => (isActive ? 'active' : '')}>
                <svg className="nav-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <path d="M7 5h10v14l-5-3-5 3V5z" strokeLinejoin="round" />
                </svg>
                Saved
              </NavLink>
              <NavLink to="/settings" className={({ isActive }) => (isActive ? 'active' : '')}>
                <svg className="nav-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12 5v2M12 17v2M5 12h2M17 12h2" strokeLinecap="round" />
                </svg>
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
