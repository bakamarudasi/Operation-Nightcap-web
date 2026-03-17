import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './i18n/index.ts';
import App from './App.tsx';
import './styles/main.css';
import './styles/cards.css';
import './styles/battle.css';
import './styles/shop.css';
import './styles/cg.css';
import './styles/gallery.css';
import './styles/enhance.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
