import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './globals.css';
import { Providers } from './components/Providers';

if (typeof window !== 'undefined' && (window as any).__TAURI__) {
  document.documentElement.classList.add('tauri');
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Providers>
      <App />
    </Providers>
  </React.StrictMode>
);
