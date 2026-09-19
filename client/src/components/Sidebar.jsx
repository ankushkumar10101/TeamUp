import React from 'react';
import { NavLink } from 'react-router-dom';

const Sidebar = ({ isOpen = false, onClose = () => {} }) => {
  const sidebarContent = (
    <>
      <div>
        <div className="d-flex justify-content-between align-items-center mb-3 px-2">
          <span className="text-uppercase text-muted fw-bold" style={{ fontSize: '0.72rem', letterSpacing: '0.08em' }}>
            Menu
          </span>
          {/* Mobile close button inside drawer */}
          <button
            type="button"
            className="btn btn-sm btn-light d-md-none rounded-circle p-1"
            onClick={onClose}
            aria-label="Close sidebar"
            style={{ width: '28px', height: '28px' }}
          >
            <i className="bi bi-x-lg"></i>
          </button>
        </div>

        <ul className="nav flex-column mb-4">
          <li className="nav-item">
            <NavLink
              to="/dashboard"
              onClick={onClose}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              <i className="bi bi-grid-fill"></i>
              <span>Dashboard</span>
            </NavLink>
          </li>
          <li className="nav-item">
            <NavLink
              to="/projects"
              onClick={onClose}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              <i className="bi bi-folder2-open"></i>
              <span>Projects</span>
            </NavLink>
          </li>
        </ul>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="sidebar d-none d-md-flex flex-column justify-content-between py-4 px-3">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Overlay Backdrop */}
      {isOpen && (
        <div
          className="mobile-sidebar-backdrop d-md-none"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Mobile Drawer Sidebar */}
      <aside
        className={`mobile-sidebar-drawer d-md-none ${isOpen ? 'open' : ''}`}
        aria-label="Mobile Navigation"
      >
        <div className="d-flex flex-column justify-content-between h-100 py-4 px-3">
          {sidebarContent}
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
