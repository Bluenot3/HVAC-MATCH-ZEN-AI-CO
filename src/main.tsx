import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Early interceptor for Google Maps JavaScript API authentication & target blocked errors, plus quota limits
if (typeof window !== 'undefined') {
  (window as any).gm_authFailure = () => {
    console.warn('Google Maps API Auth Error detected (gm_authFailure). Enabling interactive fallback territory map.');
    window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
    window.dispatchEvent(new CustomEvent('google-maps-auth-failure'));
  };

  const origError = console.error;
  console.error = (...args: unknown[]) => {
    origError.apply(console, args);
    const msg = args.map((a) => String(a)).join(' ');
    if (msg.includes('OverQuotaMapError') || msg.includes('QuotaExceededError')) {
      window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
    }
  };

  window.addEventListener('error', (event: ErrorEvent) => {
    const message = event.message || '';
    const filename = event.filename || '';
    if (
      message.includes('ApiTargetBlockedMapError') ||
      message.includes('ApiProjectMapError') ||
      message.includes('RefererNotAllowedMapError') ||
      message.includes('InvalidKeyMapError') ||
      message.includes('Google Maps JavaScript API error') ||
      filename.includes('maps.googleapis.com')
    ) {
      console.warn('Captured Google Maps API loader or script error:', message);
      window.dispatchEvent(new CustomEvent('google-maps-auth-failure'));
      // Prevent uncaught error popup from breaking the UI
      if (typeof event.preventDefault === 'function') {
        event.preventDefault();
      }
    }
  });

  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    const reason = event.reason?.message || String(event.reason || '');
    if (
      reason.includes('ApiTargetBlockedMapError') ||
      reason.includes('Google Maps') ||
      reason.includes('maps.googleapis.com')
    ) {
      console.warn('Captured Google Maps async promise rejection:', reason);
      window.dispatchEvent(new CustomEvent('google-maps-auth-failure'));
      if (typeof event.preventDefault === 'function') {
        event.preventDefault();
      }
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

