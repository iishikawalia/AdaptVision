import { stateKey, testKey } from './shared/lesson.js';

async function post(url, body) {
  let res;
  try {
    res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  } catch {
    throw new Error('Could not reach the lesson server. Check the Wi-Fi, or switch to the classroom set.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Server error ${res.status}`);
  return data;
}

// Tier 1: every analysis and test is a real call, made by our server.
export function liveBackend(objectType) {
  return {
    analyze: (ids, state) => post('/api/analyze', { objectType, ids, clean: state.clean }),
    test: (id, state, rule) => post('/api/test', { objectType, id, clean: state.clean, rule }),
  };
}

// Tier 2: same client, but results come from the pre-analyzed pool file.
// No network calls at all after the page has loaded.
export function poolBackend(cache) {
  const pause = () => new Promise((r) => setTimeout(r, 1300)); // give Matty a moment to "think"
  return {
    async analyze(_ids, state) {
      await pause();
      const a = cache.analyses[stateKey(state)];
      if (!a) throw new Error('This step is missing from the classroom set. Re-run `npm run prep`.');
      return a;
    },
    async test(id, state) {
      await pause();
      const t = cache.tests[testKey(state, id)];
      if (!t) throw new Error('This test is missing from the classroom set. Re-run `npm run prep`.');
      return t;
    },
  };
}
