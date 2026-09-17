import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';
import { appliquerAuDocument } from './i18n/index.js';

// Pose lang et dir sur <html> avant le premier rendu : c'est `dir` qui
// retourne la mise en page pour l'hébreu et l'arabe.
appliquerAuDocument();

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
