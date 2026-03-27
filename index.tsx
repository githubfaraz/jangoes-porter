import React from 'react';
import { createRoot } from 'react-dom/client';
import { APIProvider } from '@vis.gl/react-google-maps';
import App from './App.tsx';

/**
 * Porter Pro Bootstrapper
 * Strictly enforced React 19.0.0 environment
 */

const rootElement = document.getElementById('root');

if (rootElement) {
  try {
    const root = createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <APIProvider apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY} libraries={['places']}>
          <App />
        </APIProvider>
      </React.StrictMode>
    );
  } catch (error) {
    console.error("React Mounting Error:", error);
    // The window.onerror in index.html will catch this if it bubbles up
    throw error;
  }
} else {
  console.error("Target container '#root' not found.");
}
