import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import 'leaflet/dist/leaflet.css';
import App from './App.jsx';
import { SinarmsProvider } from './context/SinarmsContext';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <SinarmsProvider>
      <App />
    </SinarmsProvider>
  </StrictMode>,
)
