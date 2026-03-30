import React from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './store/AppContext';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Faculty from './pages/Faculty';
import Subjects from './pages/Subjects';
import Classes from './pages/Classes';
import Requirements from './pages/Requirements';
import TimetableViewer from './pages/TimetableViewer';
import Settings from './pages/Settings';
import './App.css';

export default function App() {
  return (
    <AppProvider>
      <HashRouter>
        <div className="app-layout">
          <Sidebar />
          <main className="app-main">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/faculty" element={<Faculty />} />
              <Route path="/subjects" element={<Subjects />} />
              <Route path="/classes" element={<Classes />} />
              <Route path="/requirements" element={<Requirements />} />
              <Route path="/timetable" element={<TimetableViewer />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </main>
        </div>
      </HashRouter>
    </AppProvider>
  );
}
