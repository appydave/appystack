import { useState } from 'react';
import ContactForm from '../components/ContactForm.js';
import SocketDemo from '../components/SocketDemo.js';
import StatusGrid from '../components/StatusGrid.js';
import TechStackDisplay from '../components/TechStackDisplay.js';

const ASCII_BANNER = `     _                      ____  _             _
    / \\   _ __  _ __  _   _/ ___|| |_ __ _  ___| | __
   / _ \\ | '_ \\| '_ \\| | | \\___ \\| __/ _\` |/ __| |/ /
  / ___ \\| |_) | |_) | |_| |___) | || (_| | (__|   <
 /_/   \\_\\ .__/| .__/ \\__, |____/ \\__\\__,_|\\___|_|\\_\\
         |_|   |_|    |___/`;

export default function LandingPage() {
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="min-h-screen">
      {/* Hero zone — retro terminal */}
      <header className="py-16 text-center" style={{ backgroundColor: 'var(--dark-bg)' }}>
        <pre
          className="inline-block text-left text-sm md:text-base leading-tight"
          style={{ color: 'var(--terminal-green)', fontFamily: 'monospace' }}
        >
          {ASCII_BANNER}
        </pre>
        <p
          className="mt-4 text-lg"
          style={{ color: 'var(--terminal-green-dim)', fontFamily: 'monospace' }}
        >
          Production-ready RVETS stack boilerplate
        </p>
      </header>

      {/* Body zone — modern cards */}
      <main className="max-w-5xl mx-auto px-6 py-12 space-y-12">
        <section>
          <h2 className="text-2xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>
            System Status
          </h2>
          <StatusGrid />
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>
            Socket.io
          </h2>
          <SocketDemo />
        </section>

        <section>
          <TechStackDisplay />
        </section>

        <section>
          <button
            onClick={() => setShowForm((prev) => !prev)}
            className="text-sm font-medium px-4 py-2 rounded transition-colors"
            style={{
              backgroundColor: 'var(--card-bg)',
              border: '1px solid var(--card-border)',
              color: 'var(--text-secondary)',
            }}
          >
            {showForm ? 'Hide example form' : 'Show example form'}
          </button>

          {showForm && (
            <div
              className="mt-4 rounded-xl p-6"
              style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
            >
              <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
                React Hook Form + Zod
              </h2>
              <ContactForm />
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
