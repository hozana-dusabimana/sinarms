import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import 'leaflet/dist/leaflet.css';
import App from './App.jsx';
import { SinarmsProvider } from './context/SinarmsContext';
import { LanguageProvider } from './context/LanguageContext';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <LanguageProvider>
      <SinarmsProvider>
        <App />
      </SinarmsProvider>
    </LanguageProvider>
  </StrictMode>,
)
