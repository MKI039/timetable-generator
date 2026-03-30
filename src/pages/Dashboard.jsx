import React from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../store/AppContext';
import './Dashboard.css';

export default function Dashboard() {
  const { faculty, subjects, classes, requirements, timetables } = useApp();

  const totalSessions = requirements.reduce((sum, r) => sum + (r.hoursPerWeek || 0), 0);

  const stats = [
    { label: 'Faculty', value: faculty.length, icon: '👤', to: '/faculty', color: 'blue' },
    { label: 'Subjects', value: subjects.length, icon: '📚', to: '/subjects', color: 'purple' },
    { label: 'Classes', value: classes.length, icon: '🏫', to: '/classes', color: 'teal' },
    { label: 'Requirements', value: requirements.length, icon: '📋', to: '/requirements', color: 'orange' },
    { label: 'Timetables', value: timetables.length, icon: '🗓️', to: '/timetable', color: 'green' },
    { label: 'Weekly Sessions', value: totalSessions, icon: '⏱️', to: '/requirements', color: 'pink' },
  ];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Overview of your department timetable data</p>
        </div>
        <Link to="/timetable" className="btn btn-primary">
          🗓️ Manage Timetables
        </Link>
      </div>

      <div className="dashboard-stats">
        {stats.map((s) => (
          <Link key={s.label} to={s.to} className={`stat-card stat-card--${s.color}`}>
            <div className="stat-icon">{s.icon}</div>
            <div className="stat-info">
              <div className="stat-value">{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          </Link>
        ))}
      </div>

      <div className="dashboard-quick">
        <h2 className="section-title">Quick Actions</h2>
        <div className="quick-grid">
          <Link to="/faculty" className="quick-card">
            <span>👤</span>
            <span>Add Faculty</span>
          </Link>
          <Link to="/subjects" className="quick-card">
            <span>📚</span>
            <span>Add Subject</span>
          </Link>
          <Link to="/classes" className="quick-card">
            <span>🏫</span>
            <span>Add Class</span>
          </Link>
          <Link to="/requirements" className="quick-card">
            <span>📋</span>
            <span>Set Requirements</span>
          </Link>
          <Link to="/timetable" className="quick-card quick-card--accent">
            <span>⚡</span>
            <span>Generate Timetable</span>
          </Link>
          <Link to="/settings" className="quick-card">
            <span>⚙️</span>
            <span>Configure Settings</span>
          </Link>
        </div>
      </div>

      {timetables.length > 0 && (
        <div className="dashboard-recent">
          <h2 className="section-title">Recent Timetables</h2>
          <div className="recent-list">
            {timetables.slice(-4).reverse().map((tt) => (
              <Link key={tt.id} to={`/timetable?id=${tt.id}`} className="recent-card">
                <div className="recent-name">🗓️ {tt.name}</div>
                <div className="recent-meta">
                  Created {new Date(tt.createdAt).toLocaleDateString()}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
