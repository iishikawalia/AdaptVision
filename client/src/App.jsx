import { useEffect, useState } from 'react';
import { OBJECTS } from './shared/lesson.js';
import { liveBackend, poolBackend } from './backend.js';
import Matty from './components/Matty.jsx';
import Lesson from './Lesson.jsx';

async function getJSON(url) {
  try {
    const r = await fetch(url, { cache: 'no-store' });
    return r.ok ? await r.json() : null;
  } catch { return null; }
}

export default function App() {
  const [health, setHealth] = useState(undefined); // undefined = loading, null = server unreachable
  const [manifest, setManifest] = useState(undefined);
  const [pool, setPool] = useState(undefined);
  const [objectType, setObjectType] = useState('pen');
  const [session, setSession] = useState(null); // { tier, key }

  useEffect(() => {
    getJSON('/api/health').then(setHealth);
    getJSON('/photos/manifest.json').then(setManifest);
    getJSON('/photos/analysis.json').then(setPool);
  }, []);

  const loading = health === undefined || manifest === undefined || pool === undefined;
  const liveReady = !!manifest && (health?.mode === 'live' || health?.mode === 'mock');
  const poolReady = !!manifest && !!pool;
  const mockBanner = session
    ? (session.tier === 'tier1' ? health?.mode === 'mock' : pool?.mock)
    : health?.mode === 'mock' || pool?.mock;

  if (session) {
    const backend = session.tier === 'tier1' ? liveBackend(objectType) : poolBackend(pool);
    return (
      <div className="page">
        {mockBanner && <Banner />}
        <header className="top">
          <button className="link" onClick={() => setSession(null)}>Leave lesson</button>
          <span className="mode">{session.tier === 'tier1' ? 'Live' : 'Classroom set'}</span>
        </header>
        <Lesson key={session.key} tier={session.tier} manifest={manifest} backend={backend}
          objectType={objectType} onRestart={() => setSession({ ...session, key: Date.now() })} />
      </div>
    );
  }

  return (
    <div className="page home">
      {mockBanner && <Banner />}
      <section className="hero">
        <Matty mood="happy" size={132} />
        <div>
          <h1>Meet Matty</h1>
          <p className="lede">Teach a computer what a pen is. Then catch it taking a shortcut.</p>
        </div>
      </section>

      <section className="sheet">
        <h2>What should Matty learn?</h2>
        <div className="chips" role="radiogroup" aria-label="Object">
          {Object.values(OBJECTS).map((o) => (
            <button key={o.id} role="radio" aria-checked={objectType === o.id} disabled={!o.ready}
              className={`chip ${objectType === o.id ? 'on' : ''}`} onClick={() => setObjectType(o.id)}>
              {o.label}{!o.ready && <small> later</small>}
            </button>
          ))}
        </div>

        <h2>How is your class running it?</h2>
        {loading ? <p className="muted">Getting the photos ready…</p> : (
          <div className="modes">
            <ModeOption title="Live" disabled={!liveReady}
              text="Pick pen photos with your partner. Matty studies them live."
              why={!manifest ? 'Photos are not prepared yet. Run npm start on the presenter laptop.'
                : health === null ? 'Cannot reach the lesson server. Use the classroom set.'
                : health?.mode === 'no-key' ? 'The server has no API key yet. Use the classroom set.' : null}
              onStart={() => setSession({ tier: 'tier1', key: Date.now() })} />
            <ModeOption title="Classroom set" disabled={!poolReady}
              text="A ready-made set of pens Matty has already studied. Works when the Wi-Fi is struggling."
              why={!poolReady ? 'The classroom set has not been prepared. Run npm run prep.' : null}
              onStart={() => setSession({ tier: 'tier2', key: Date.now() })} />
          </div>
        )}
      </section>

      <footer className="facilitator">
        {health?.joinUrls?.length > 0 && (
          <p>Other devices join at <strong>{health.joinUrls[0]}</strong>{health.joinUrls.length > 1 && <span className="muted"> (or {health.joinUrls.slice(1).join(', ')})</span>}</p>
        )}
        {manifest?.placeholders && <p className="warn">These are placeholder pen pictures. Put your real photos in photos-source/ and run npm run prep.</p>}
        <p className="muted">No printer or devices? The unplugged version is in docs/tier3-unplugged.</p>
      </footer>
    </div>
  );
}

function ModeOption({ title, text, why, disabled, onStart }) {
  return (
    <div className={`mode-option ${disabled ? 'off' : ''}`}>
      <div>
        <h3>{title}</h3>
        <p>{text}</p>
        {why && <p className="why">{why}</p>}
      </div>
      <button className="btn" disabled={disabled} onClick={onStart}>Start</button>
    </div>
  );
}

function Banner() {
  return <div className="banner" role="status">Rehearsal mode: Matty's answers are simulated, not a real analysis of the photos.</div>;
}
