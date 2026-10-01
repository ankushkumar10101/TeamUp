import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getRoleBadge } from '../utils/formatters';

const Navbar = ({ isMobileSidebarOpen, onToggleSidebar }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const roleInfo = getRoleBadge(user?.role);
  const userInitial = user?.name ? user.name.charAt(0).toUpperCase() : 'U';

  return (
    <header className="top-navbar d-flex justify-content-between align-items-center">
      <div className="d-flex align-items-center gap-2 gap-sm-3">
        {/* Mobile Hamburger Button */}
        <button
          type="button"
          className="btn btn-outline-secondary btn-sm d-md-none p-1 px-2 border-0 mobile-hamburger-btn"
          onClick={onToggleSidebar}
          aria-label="Toggle navigation menu"
          title={isMobileSidebarOpen ? 'Close Menu' : 'Open Menu'}
        >
          <i className={`bi ${isMobileSidebarOpen ? 'bi-x-lg' : 'bi-list'} fs-5`}></i>
        </button>

        <Link className="d-flex align-items-center gap-2 text-decoration-none" to="/dashboard">
          <div className="navbar-brand-badge">
            <i className="bi bi-diagram-3-fill"></i>
          </div>
          <div className="d-flex align-items-center">
            <span className="fw-bold fs-5 text-dark tracking-tight">TeamUp</span>
          </div>
        </Link>
      </div>

      <div className="d-flex align-items-center gap-2 gap-sm-3">

        {/* User profile widget */}
        {user && (
          <div className="d-flex align-items-center gap-2 ps-1 ps-sm-2 border-start">
            <div className="avatar-circle" title={`${user.name} (${roleInfo.label})`}>
              {userInitial}
            </div>
            <div className="d-none d-md-block text-start lh-sm me-1">
              <div className="fw-bold small text-dark text-truncate" style={{ maxWidth: '120px' }}>
                {user.name}
              </div>
              <div className="mt-1">
                <span className={`badge ${roleInfo.className} rounded-pill px-2 py-0.5 fw-semibold`} style={{ fontSize: '0.68rem', letterSpacing: '0.02em' }}>
                  {roleInfo.label}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="btn btn-outline-danger btn-sm d-flex align-items-center gap-1 py-1 px-2"
          title="Sign out"
        >
          <i className="bi bi-box-arrow-right"></i>
          <span className="d-none d-md-inline">Logout</span>
        </button>
      </div>
    </header>
  );
};

export default Navbar;
