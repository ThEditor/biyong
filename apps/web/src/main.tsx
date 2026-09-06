import React from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider } from '@biyong/ui';
import App from './App.js';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider initialMode="dark" initialAccent="default">
      <App />
    </ThemeProvider>
  </React.StrictMode>
);
