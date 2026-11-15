import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/app/App';
import { makeDomTranslatorSafe } from '@/shared/lib/translatorSafeDom';
import '@/app/styles.css';

// Antes de montar React: evita que el traductor del navegador rompa la app
makeDomTranslatorSafe();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
