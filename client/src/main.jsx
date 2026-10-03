import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Bootstrap styles & icons
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './index.css';

// SPA redirect restoration for static hosting fallbacks
(() => {
  try {
    const redirect = sessionStorage.getItem('teamup_spa_redirect');
    if (redirect) {
      sessionStorage.removeItem('teamup_spa_redirect');
      const url = new URL(redirect);
      window.history.replaceState(null, null, url.pathname + url.search + url.hash);
    }
  } catch (e) {
    // Ignore storage/URL errors
  }
})();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
