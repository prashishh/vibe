import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import Dashboard from './pages/Dashboard.jsx'
import BuildDetail from './pages/BuildDetail.jsx'
import Framework from './pages/Framework.jsx'
import Guardrails from './pages/Guardrails.jsx'
import Changelog from './pages/Changelog.jsx'
import Commands from './pages/Commands.jsx'
import Settings from './pages/Settings.jsx'

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/build/:version" element={<BuildDetail />} />
        <Route path="/changelog" element={<Changelog />} />
        <Route path="/guards" element={<Guardrails />} />
        <Route path="/commands" element={<Commands />} />
        <Route path="/framework" element={<Framework />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
    </Routes>
  )
}

export default App
