'use strict';

async function check(url) {
  try {
    const response = await fetch(url, { cache: 'no-store' });
    return { ok: response.ok, body: await response.json() };
  } catch {
    return { ok: false, body: null };
  }
}

async function refresh() {
  const [live, ready] = await Promise.all([check('/api/v1/health/live'), check('/api/v1/health/ready')]);
  document.querySelector('#live').textContent = live.ok ? 'Online' : 'Unavailable';
  document.querySelector('#ready').textContent = ready.body?.dependencies
    ? `PG ${ready.body.dependencies.postgres.toUpperCase()} · Mongo ${ready.body.dependencies.mongodb.toUpperCase()}`
    : 'Unavailable';
  const badge = document.querySelector('#overall');
  const okay = live.ok && ready.ok;
  badge.textContent = okay ? 'Ready' : live.ok ? 'API online · DB pending' : 'Offline';
  badge.className = `badge ${okay ? 'ok' : live.ok ? 'pending' : 'bad'}`;
}

refresh();
setInterval(refresh, 10000);
