import React from 'react';
import { NavLink } from 'react-router-dom';
import './Sidebar.css';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: '⊞' },
  { to: '/faculty', label: 'Faculty', icon: '👤' },
  { to: '/subjects', label: 'Subjects', icon: '📚' },
  { to: '/classes', label: 'Classes', icon: '🏫' },
  { to: '/requirements', label: 'Requirements', icon: '📋' },
  { to: '/timetable', label: 'Timetable', icon: '🗓️' },
  { to: '/settings', label: 'Settings', icon: '⚙️' },
];

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="sidebar-logo">📅</span>
        <span className="sidebar-title">TimeTable<br /><span className="sidebar-sub">Generator</span></span>
      </div>
      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `sidebar-link${isActive ? ' sidebar-link--active' : ''}`
            }
          >
            <span className="sidebar-icon">{item.icon}</span>
            <span className="sidebar-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-footer">
        <span>Offline · Local Storage</span>
      </div>
    </aside>
  );
}
