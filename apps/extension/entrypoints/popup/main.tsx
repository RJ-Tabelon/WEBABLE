import React from 'react';
import ReactDOM from 'react-dom/client';
import './style.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <main className="popup">
      <header className="popup__brand">
        <img src="/icon.svg" alt="" width="32" height="32" />
        <h1>WebAble</h1>
      </header>
      <section className="popup__message" aria-labelledby="popup-message-title">
        <h2 id="popup-message-title">Coming soon</h2>
        <p>Website adaptations are coming soon.</p>
      </section>
    </main>
  </React.StrictMode>,
);
