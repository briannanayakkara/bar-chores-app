import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { VenueProvider } from './context/VenueContext';
import './index.css';
import App from './App';

// Set version in browser tab title
document.title = `Bar Chores v${__APP_VERSION__}`;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <VenueProvider>
          <App />
        </VenueProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
