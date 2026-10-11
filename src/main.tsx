import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Register offline service worker with automatic update checking
registerSW({
  immediate: true,
  onNeedRefresh() {
    console.log('TrailWhistle new version available.');
  },
  onOfflineReady() {
    console.log('TrailWhistle cached and ready for offline use.');
  },
});

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
