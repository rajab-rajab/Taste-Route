import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const port = Number(process.env.PORT || 3000);
const qlooCommand = process.env.QLOO_COMMAND || 'qloo';
const demoMatches = [
  { name: 'Late-night jazz bar', type: 'Music venue', reason: 'An intimate, exploratory stop for an eclectic evening.' },
  { name: 'Independent cinema', type: 'Film', reason: 'A discovery-first stop for stories beyond the mainstream.' },
  { name: 'Chef-led small plates', type: 'Dining', reason: 'Creative and shareable so the outing feels like a sequence.' }
];
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };
const sendJson = (res, status, value) => { res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(value)); };

function runQloo(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(qlooCommand, ['api', command, ...args, '--json'], {
      env: process.env,
      windowsHide: true,
      shell: process.platform === 'win32' && /\.(cmd|bat)$/i.test(qlooCommand)
    });
    let stdout = ''; let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; }); child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject); child.on('close', (code) => {
      if (code) return reject(new Error(stderr || `Qloo command exited with ${code}`));
      try { resolve(JSON.parse(stdout)); } catch { reject(new Error('Qloo returned unreadable JSON.')); }
    });
  });
}

function toMatches(payload, seed) {
  const data = Array.isArray(payload) ? payload : Array.isArray(payload?.results) ? payload.results : Array.isArray(payload?.data) ? payload.data : [];
  return data.slice(0, 3).map((item, index) => {
    const rawType = item.type || item.entity_type || item.types?.[0] || '';
    const type = rawType.replace(/^urn:entity:/, '') || (rawType === 'urn:entity' ? 'Qloo cultural place' : 'Qloo cultural signal');
    return {
    name: item.name || item.title || `Cultural match ${index + 1}`,
    type,
    reason: `Qloo surfaced this as a cultural match for “${seed}”. This is an aggregate cultural signal, not a claim about you.`
    };
  });
}

function toTags(entity) {
  return (entity?.tags || []).slice(0, 5).map((tag) => tag.name).filter(Boolean);
}

function buildRecommendationPrompt({ seed, city, mood, goal, tags }) {
  const context = [
    `${goal === 'music' ? 'live music venues' : goal === 'film' ? 'independent cinemas and film experiences' : goal === 'dining' ? 'restaurants and food experiences' : 'culturally relevant places and experiences'}`,
    `for someone drawn to ${seed}`,
    tags.length ? `with signals such as ${tags.join(', ')}` : '',
    mood ? `with a ${mood.toLowerCase()} mood` : '',
    city ? `in ${city}` : ''
  ].filter(Boolean);
  return context.join(', ');
}

async function route(body) {
  const seed = String(body.seed || '').trim();
  const city = String(body.city || '').trim();
  const mood = String(body.mood || '').trim();
  const goal = ['discovery', 'dining', 'music', 'film'].includes(body.goal) ? body.goal : 'discovery';
  if (!seed) throw new Error('Add a public cultural reference.');
  try {
    const resolved = await runQloo('search', ['--query', seed, '--take', '1']);
    const entity = Array.isArray(resolved) ? resolved[0] : resolved?.results?.[0] || resolved?.data?.[0];
    if (!entity) throw new Error('Qloo could not resolve that cultural reference.');
    const tags = toTags(entity);
    const recommendationQuery = buildRecommendationPrompt({ seed, city, mood, goal, tags });
    const tagIds = (entity.tags || []).slice(0, 5).map((tag) => tag.tag_id || tag.id).filter(Boolean);
    const insightArgs = ['--type', 'place', '--take', '3'];
    if (entity.entity_id || entity.id) insightArgs.push('--signal-entities', entity.entity_id || entity.id);
    if (tagIds.length) insightArgs.push('--signal-tags', tagIds.join(','));
    if (city) insightArgs.push('--filter-location', city);
    if (mood) insightArgs.push('--for', mood);
    const recommended = await runQloo('insights', insightArgs);
    const matches = toMatches(recommended, seed);
    if (!matches.length) throw new Error('Qloo returned no usable route recommendations.');
    return {
      mode: 'live',
      matches,
      note: `Live Qloo cultural signals shaped this ${goal} route.`,
      agentSteps: [
        { label: 'Resolved your reference', detail: `${entity.name || seed} is the cultural starting point.` },
        { label: 'Read Qloo taste signals', detail: tags.length ? tags.join(' · ') : 'Qloo entity affinity data' },
        { label: 'Planned the route', detail: recommendationQuery }
      ]
    };
  } catch (error) {
    return {
      mode: 'demo',
      matches: demoMatches.map((match) => ({ ...match, reason: `${match.reason} Your seed: “${seed}”.` })),
      note: `Demo mode: ${error.message} Configure the Qloo harness for live results.`,
      agentSteps: []
    };
  }
}

createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/api/route') { let raw = ''; req.on('data', (chunk) => { raw += chunk; }); req.on('end', async () => { try { sendJson(res, 200, await route(JSON.parse(raw || '{}'))); } catch (error) { sendJson(res, 400, { error: error.message }); } }); return; }
  const pathname = req.url === '/' ? '/index.html' : req.url;
  if (!pathname.startsWith('/') || pathname.includes('..')) { res.writeHead(404); return res.end('Not found'); }
  try { const file = await readFile(join(root, 'public', pathname)); res.writeHead(200, { 'content-type': types[extname(pathname)] || 'application/octet-stream' }); res.end(file); } catch { res.writeHead(404); res.end('Not found'); }
}).listen(port, () => console.log(`TasteRoute running at http://localhost:${port}`));
