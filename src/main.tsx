import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { VenueProvider } from './context/VenueContext';
import './index.css';
import App from './App';
import DevBadge from './components/shared/DevBadge';
import { APP_TITLE } from './config/environment';

document.title = `${APP_TITLE} v${__APP_VERSION__}`;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <VenueProvider>
          <DevBadge />
          <App />
        </VenueProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
