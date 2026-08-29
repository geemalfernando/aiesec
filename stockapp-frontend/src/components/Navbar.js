import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Navbar = () => {
  const { currentUser, logout, isAdmin } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (path) => {
    if (path === '/admin') {
      return location.pathname === '/admin' || location.pathname === '/admin/dashboard';
    }
    return location.pathname === path;
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  return (
    <nav className="navbar navbar-expand-lg bg-body-tertiary">
      <div className="container-fluid">
        <Link className="navbar-brand" to="/">StockApp</Link>
        <button
          className="navbar-toggler"
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle navigation"
        >
          <span className="navbar-toggler-icon"></span>
        </button>

        <div className={`collapse navbar-collapse ${mobileMenuOpen ? 'show' : ''}`} id="navbarSupportedContent">
          <ul className="navbar-nav me-auto mb-2 mb-lg-0">
            <li className="nav-item">
              <Link 
                className={`nav-link ${isActive('/') ? 'active' : ''}`} 
                to="/"
                onClick={closeMobileMenu}
              >
                Home
              </Link>
            </li>
            {currentUser && (
              <li className="nav-item">
                <Link 
                  className={`nav-link ${isActive('/dashboard') ? 'active' : ''}`} 
                  to="/dashboard"
                  onClick={closeMobileMenu}
                >
                  Dashboard
                </Link>
              </li>
            )}
            {isAdmin() && (
              <>
                <li className="nav-item">
                  <Link 
                    className={`nav-link ${isActive('/admin') ? 'active' : ''}`} 
                    to="/admin"
                    onClick={closeMobileMenu}
                  >
                    Admin Dashboard
                  </Link>
                </li>
                <li className="nav-item">
                  <Link 
                    className={`nav-link ${location.pathname === '/admin/inventory' ? 'active' : ''}`} 
                    to="/admin/inventory"
                    onClick={closeMobileMenu}
                  >
                    Inventory
                  </Link>
                </li>
                <li className="nav-item">
                  <Link 
                    className={`nav-link ${location.pathname === '/admin/stock-transfer' ? 'active' : ''}`} 
                    to="/admin/stock-transfer"
                    onClick={closeMobileMenu}
                  >
                    Stock Transfer
                  </Link>
                </li>
                <li className="nav-item">
                  <Link 
                    className={`nav-link ${location.pathname === '/admin/sales-entry' ? 'active' : ''}`} 
                    to="/admin/sales-entry"
                    onClick={closeMobileMenu}
                  >
                    Register Sale
                  </Link>
                </li>
                <li className="nav-item">
                  <Link 
                    className={`nav-link ${location.pathname === '/admin/sales-history' ? 'active' : ''}`} 
                    to="/admin/sales-history"
                    onClick={closeMobileMenu}
                  >
                    Sales History
                  </Link>
                </li>
                <li className="nav-item">
                  <Link 
                    className={`nav-link ${location.pathname === '/admin/credit-bills' ? 'active' : ''}`} 
                    to="/admin/credit-bills"
                    onClick={closeMobileMenu}
                  >
                    Credit Bills
                  </Link>
                </li>
                <li className="nav-item">
                  <Link 
                    className={`nav-link ${location.pathname === '/admin/users' ? 'active' : ''}`} 
                    to="/admin/users"
                    onClick={closeMobileMenu}
                  >
                    User Management
                  </Link>
                </li>
              </>
            )}
          </ul>

          <div className="d-flex">
            {currentUser ? (
              <>
                <span className="navbar-text me-3">
                  Welcome, {currentUser.username || currentUser.name}
                  {isAdmin() && <span className="badge bg-warning text-dark ms-2">Admin</span>}
                </span>
                <button 
                  className="btn btn-danger" 
                  onClick={logout}
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link className="btn btn-outline-primary me-2" to="/login" onClick={closeMobileMenu}>
                  Login
                </Link>
                <Link className="btn btn-primary" to="/register" onClick={closeMobileMenu}>
                  Register
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
