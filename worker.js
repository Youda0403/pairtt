import Anthropic from '@anthropic-ai/sdk';

// ─────────────────────────────────────────────────────────────────────────────
// 취향껏 고치는 부분은 전부 여기 모여 있음. 아래 코드는 건드릴 일 거의 없음.
// ─────────────────────────────────────────────────────────────────────────────
const CONFIG = {
  // UI 헤더에서 토글할 수 있는 모델 목록. 키 = API 모델 ID.
  MODELS: {
    'claude-sonnet-5': { label: 'Sonnet 5' },
    'claude-opus-5':   { label: 'Opus 5' },
  },
  DEFAULT_MODEL: 'claude-sonnet-5',

  // 기억 노트를 갱신할 때 쓰는 모델. 대화 모델과 별개로 고정.
  // 기억 품질이 이 앱의 핵심이라 너무 싼 모델로 내리지 않는 걸 권함.
  SUMMARY_MODEL: 'claude-sonnet-5',

  // 사고 깊이. 'low' | 'medium' | 'high' | 'xhigh' | 'max'
  // 잡담 상대라면 low가 제일 자연스럽고 빠르고 싸다. 진지한 상담/분석 위주면 medium 이상.
  EFFORT: 'low',

  MAX_TOKENS: 8000,          // 답변 1개의 최대 길이
  MAX_RECENT_MESSAGES: 40,   // 원문 그대로 API에 실어 보낼 메시지 개수 상한
  SUMMARIZE_CHUNK: 20,       // 상한을 넘겼을 때 한 번에 기억 노트로 접을 개수
  MAX_MEMORY_CHARS: 6000,    // 기억 노트 길이 상한 (요약 모델에게 지시로 전달)

  HISTORY_PAGE_SIZE: 60,     // 화면에 처음 불러올 과거 메시지 개수
  SESSION_TTL_SECONDS: 60 * 60 * 24 * 30,  // 로그인 유지 기간 (30일)

  PERSONA: `너는 사용자의 개인 대화 상대다. 어시스턴트가 아니라 오래 알고 지낸 사람에 가깝게 행동해라.

- 한국어로, 사용자가 쓰는 말투 온도에 맞춰서 대화해라. 사용자가 편하게 말하면 너도 편하게.
- "무엇을 도와드릴까요", "죄송합니다만" 같은 고객응대 말투를 쓰지 마라.
- 매 답변을 요약이나 불릿으로 정리하려 들지 마라. 대화는 대화답게.
- 아래 기억 노트는 이전 대화에서 네가 직접 추려둔 것이다. 사용자가 굳이 다시 설명하지 않아도
  이미 아는 것처럼 자연스럽게 활용해라. 다만 "기억 노트에 따르면" 같은 식으로 출처를 밝히진 마라.
- 모르는 건 모른다고 해라. 기억에 없는 걸 있었던 것처럼 지어내지 마라.
- 동의만 하지 마라. 생각이 다르면 다르다고 말하는 쪽이 더 좋은 대화 상대다.`,

  // 기억 노트를 갱신할 때 요약 모델에게 주는 지시.
  SUMMARY_SYSTEM: `너는 개인 대화 챗봇의 장기 기억을 관리한다.
기존 기억 노트와 새로 접힌 대화 조각을 받아서, 하나로 통합된 새 기억 노트를 출력해라.

규칙:
- 사용자에 관한 지속적인 사실을 우선해라: 이름·관계·직업·거주지, 취향과 싫어하는 것,
  진행 중인 일과 고민, 중요한 일정과 약속, 대화에서 정한 규칙이나 호칭.
- 지나가는 잡담, 이미 끝난 일회성 질의응답은 버려라.
- 기존 노트와 충돌하면 최신 정보로 갱신하고, 옛 정보는 지워라.
- 시간이 지나 유효하지 않은 항목(끝난 일정 등)은 정리해라.
- 주제별 소제목이 있는 마크다운 불릿으로 정리해라.
- 노트 전체를 {MAX_CHARS}자 이내로 유지해라. 넘치면 덜 중요한 것부터 버려라.
- 설명이나 머리말 없이, 갱신된 기억 노트 본문만 출력해라.`,
};

const CONVERSATION_ID = 1;   // 단일 스레드. 다중 스레드로 확장할 때 이 상수를 파라미터로 바꾸면 됨.
const COOKIE_NAME = 'sid';
const encoder = new TextEncoder();

// ─────────────────────────────────────────────────────────────────────────────
// 진입점
// ─────────────────────────────────────────────────────────────────────────────
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) {
      // 정적 파일(public/)은 Workers Assets가 처리. 여기까지 온 건 매칭 실패한 경로.
      return env.ASSETS.fetch(request);
    }
    try {
      return await handleApi(request, env, ctx, url);
    } catch (err) {
      console.error('unhandled', err);
      return json({ error: err?.message || '알 수 없는 오류' }, 500);
    }
  },
};

async function handleApi(request, env, ctx, url) {
  const route = `${request.method} ${url.pathname}`;

  // 로그인만 인증 없이 통과
  if (route === 'POST /api/login') return handleLogin(request, env);

  const authed = await verifySession(env, readCookie(request, COOKIE_NAME));
  if (!authed) return json({ error: '로그인이 필요합니다.' }, 401);

  switch (route) {
    case 'POST /api/logout':  return handleLogout();
    case 'GET /api/session':  return json({ ok: true, models: CONFIG.MODELS, defaultModel: CONFIG.DEFAULT_MODEL });
    case 'GET /api/history':  return handleHistory(env, url);
    case 'GET /api/memory':   return handleGetMemory(env);
    case 'PUT /api/memory':   return handlePutMemory(request, env);
    case 'POST /api/chat':    return handleChat(request, env, ctx);
    default:                  return json({ error: 'Not found' }, 404);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 인증 — 비밀번호 1회 입력 → HMAC 서명된 세션 쿠키(HttpOnly)
// ─────────────────────────────────────────────────────────────────────────────
async function handleLogin(request, env) {
  const { password } = await readJson(request);
  if (!env.APP_PASSWORD || !env.SESSION_SECRET) {
    return json({ error: '서버에 APP_PASSWORD / SESSION_SECRET 시크릿이 설정되지 않았습니다.' }, 500);
  }
  if (typeof password !== 'string' || !constantTimeEqual(password, env.APP_PASSWORD)) {
    // 무차별 대입을 살짝 성가시게 만드는 정도의 지연
    await new Promise((r) => setTimeout(r, 400));
    return json({ error: '비밀번호가 틀렸습니다.' }, 401);
  }
  const token = await issueSession(env);
  return json({ ok: true, models: CONFIG.MODELS, defaultModel: CONFIG.DEFAULT_MODEL }, 200, {
    'set-cookie': `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${CONFIG.SESSION_TTL_SECONDS}`,
  });
}

function handleLogout() {
  return json({ ok: true }, 200, {
    'set-cookie': `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`,
  });
}

async function issueSession(env) {
  const exp = Math.floor(Date.now() / 1000) + CONFIG.SESSION_TTL_SECONDS;
  return `${exp}.${await hmac(env.SESSION_SECRET, String(exp))}`;
}

async function verifySession(env, token) {
  if (!token || !env.SESSION_SECRET) return false;
  const dot = token.indexOf('.');
  if (dot < 1) return false;
  const expStr = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp <= Math.floor(Date.now() / 1000)) return false;
  return constantTimeEqual(sig, await hmac(env.SESSION_SECRET, expStr));
}

async function hmac(secret, data) {
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// 길이 차이는 어차피 드러나므로, 같은 길이일 때 내용이 새지 않는 것만 보장하면 충분하다.
function constantTimeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function readCookie(request, name) {
  const header = request.headers.get('cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 히스토리 / 기억 노트
// ─────────────────────────────────────────────────────────────────────────────
async function handleHistory(env, url) {
  const limit = clampInt(url.searchParams.get('limit'), CONFIG.HISTORY_PAGE_SIZE, 1, 300);
  const before = clampInt(url.searchParams.get('before'), 0, 0, Number.MAX_SAFE_INTEGER);

  // 최신 limit개를 역순으로 뽑아서 뒤집는다. before가 있으면 그보다 오래된 것들.
  const sql = before
    ? 'SELECT id, role, content, model, summarized, created_at FROM messages WHERE conversation_id = ? AND id < ? ORDER BY id DESC LIMIT ?'
    : 'SELECT id, role, content, model, summarized, created_at FROM messages WHERE conversation_id = ? ORDER BY id DESC LIMIT ?';
  const bind = before ? [CONVERSATION_ID, before, limit] : [CONVERSATION_ID, limit];

  const [rows, mem] = await Promise.all([
    env.DB.prepare(sql).bind(...bind).all(),
    env.DB.prepare('SELECT notes, updated_at FROM memory WHERE conversation_id = ?').bind(CONVERSATION_ID).first(),
  ]);
  const messages = rows.results.reverse();

  return json({
    messages,
    hasMore: rows.results.length === limit,
    memory: { notes: mem?.notes ?? '', updated_at: mem?.updated_at ?? null },
    models: CONFIG.MODELS,
    defaultModel: CONFIG.DEFAULT_MODEL,
  });
}

async function handleGetMemory(env) {
  const mem = await env.DB.prepare('SELECT notes, updated_at FROM memory WHERE conversation_id = ?')
    .bind(CONVERSATION_ID).first();
  return json({ notes: mem?.notes ?? '', updated_at: mem?.updated_at ?? null });
}

async function handlePutMemory(request, env) {
  const { notes } = await readJson(request);
  if (typeof notes !== 'string') return json({ error: 'notes는 문자열이어야 합니다.' }, 400);
  const now = Date.now();
  await env.DB.prepare(
    'INSERT INTO memory (conversation_id, notes, updated_at) VALUES (?, ?, ?) ' +
    'ON CONFLICT(conversation_id) DO UPDATE SET notes = excluded.notes, updated_at = excluded.updated_at',
  ).bind(CONVERSATION_ID, notes, now).run();
  return json({ ok: true, updated_at: now });
}

// ─────────────────────────────────────────────────────────────────────────────
// 채팅 — SSE 스트리밍
// ─────────────────────────────────────────────────────────────────────────────
async function handleChat(request, env, ctx) {
  const body = await readJson(request);
  const content = typeof body.content === 'string' ? body.content.trim() : '';
  const model = CONFIG.MODELS[body.model] ? body.model : CONFIG.DEFAULT_MODEL;
  if (!content) return json({ error: '내용이 비어 있습니다.' }, 400);
  if (!env.ANTHROPIC_API_KEY) return json({ error: '서버에 ANTHROPIC_API_KEY가 설정되지 않았습니다.' }, 500);

  const now = Date.now();
  const inserted = await env.DB.prepare(
    'INSERT INTO messages (conversation_id, role, content, created_at) VALUES (?, ?, ?, ?)',
  ).bind(CONVERSATION_ID, 'user', content, now).run();
  const userMessageId = inserted.meta.last_row_id;

  const [mem, active] = await Promise.all([
    env.DB.prepare('SELECT notes FROM memory WHERE conversation_id = ?').bind(CONVERSATION_ID).first(),
    env.DB.prepare(
      'SELECT role, content FROM messages WHERE conversation_id = ? AND summarized = 0 ORDER BY id ASC',
    ).bind(CONVERSATION_ID).all(),
  ]);

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const send = (obj) => writer.write(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));

  ctx.waitUntil((async () => {
    let text = '';
    try {
      await send({ type: 'start', userMessageId });

      const stream = client.messages.stream({
        model,
        max_tokens: CONFIG.MAX_TOKENS,
        system: buildSystem(mem?.notes ?? ''),
        messages: buildMessages(active.results),
        thinking: { type: 'adaptive' },
        output_config: { effort: CONFIG.EFFORT },
      });

      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          text += event.delta.text;
          await send({ type: 'delta', text: event.delta.text });
        }
      }

      const final = await stream.finalMessage();

      // Opus 5 계열은 안전 분류기가 요청을 거절하면 200 + stop_reason='refusal'로 돌아온다.
      if (final.stop_reason === 'refusal' && !text) {
        text = '(모델이 이 요청에 대한 응답을 거절했습니다.)';
        await send({ type: 'delta', text });
      }

      const assistantId = text ? await saveAssistant(env, text, model) : null;
      await send({ type: 'done', assistantMessageId: assistantId, usage: final.usage ?? null });

      // 응답은 이미 사용자에게 다 갔다. 요약은 여기서 뒤늦게 돌린다.
      ctx.waitUntil(maybeSummarize(env, client).catch((e) => console.error('summarize', e)));
    } catch (err) {
      console.error('chat', err);
      // 스트림 도중 끊겼어도 여기까지 받은 건 살려둔다.
      if (text) await saveAssistant(env, text, model).catch(() => {});
      await send({ type: 'error', message: describeError(err) }).catch(() => {});
    } finally {
      await writer.close().catch(() => {});
    }
  })());

  return new Response(readable, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
    },
  });
}

async function saveAssistant(env, text, model) {
  const res = await env.DB.prepare(
    'INSERT INTO messages (conversation_id, role, content, model, created_at) VALUES (?, ?, ?, ?, ?)',
  ).bind(CONVERSATION_ID, 'assistant', text, model, Date.now()).run();
  await env.DB.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?')
    .bind(Date.now(), CONVERSATION_ID).run();
  return res.meta.last_row_id;
}

// 시스템 프롬프트: [페르소나][기억 노트] 순서. 마지막 블록에 캐시 브레이크포인트.
// 기억 노트가 갱신되면 이 프리픽스가 깨지면서 대화 캐시까지 무효화되지만,
// 노트 갱신은 20턴에 한 번꼴이라 감수할 만하다.
function buildSystem(notes) {
  return [
    { type: 'text', text: CONFIG.PERSONA },
    {
      type: 'text',
      text: `# 기억 노트 (이전 대화에서 추려둔 것)\n${notes.trim() || '(아직 쌓인 기억이 없다. 이번이 사실상 첫 대화다.)'}`,
      cache_control: { type: 'ephemeral' },
    },
  ];
}

// 대화 기록. 매 턴 재전송되는 토큰의 대부분이 여기라, 캐시가 실제로 돈을 아끼는 지점도 여기다.
// 브레이크포인트를 마지막(n-1)과 직전 턴 경계(n-3)에 두면,
// n-3 위치가 지난 턴에 기록해둔 캐시와 정확히 일치해서 히트가 보장된다.
function buildMessages(rows) {
  // Messages API는 첫 메시지가 user여야 하고, 같은 role이 연달아 오면 안 된다.
  // 응답 실패로 user 메시지만 남거나, 요약이 홀수 지점에서 끊기면 이 조건이 깨질 수 있어
  // 여기서 한 번 정규화해 둔다. (원문 DB는 건드리지 않는다)
  const messages = [];
  for (const r of rows) {
    if (!messages.length && r.role !== 'user') continue;          // 선두 assistant 버림
    const prev = messages[messages.length - 1];
    if (prev && prev.role === r.role) {                            // 연속 동일 role 병합
      prev.content[0].text += `\n\n${r.content}`;
      continue;
    }
    messages.push({ role: r.role, content: [{ type: 'text', text: r.content }] });
  }

  const n = messages.length;
  for (const i of [n - 3, n - 1]) {
    if (i >= 0) messages[i].content[0].cache_control = { type: 'ephemeral' };
  }
  return messages;
}

// ─────────────────────────────────────────────────────────────────────────────
// 기억 압축 — 원문은 지우지 않고 summarized 플래그만 세운다
// ─────────────────────────────────────────────────────────────────────────────
async function maybeSummarize(env, client) {
  const now = Date.now();

  // 조건부 UPDATE 한 방으로 락을 잡는다. changes === 0 이면 다른 실행이 이미 잡고 있는 것.
  const lock = await env.DB.prepare(
    'UPDATE memory SET lock_until = ? WHERE conversation_id = ? AND (lock_until IS NULL OR lock_until < ?)',
  ).bind(now + 120_000, CONVERSATION_ID, now).run();
  if (!lock.meta.changes) return;

  try {
    const { results } = await env.DB.prepare(
      'SELECT id, role, content FROM messages WHERE conversation_id = ? AND summarized = 0 ORDER BY id ASC',
    ).bind(CONVERSATION_ID).all();
    if (results.length <= CONFIG.MAX_RECENT_MESSAGES) return;

    // 접는 구간이 assistant 응답 직전에서 끊기면 남은 대화가 assistant로 시작하게 된다.
    // 짝이 맞도록 한 칸 늘려서 자른다.
    let cut = CONFIG.SUMMARIZE_CHUNK;
    if (results[cut] && results[cut].role === 'assistant') cut += 1;
    const chunk = results.slice(0, cut);

    const mem = await env.DB.prepare('SELECT notes FROM memory WHERE conversation_id = ?')
      .bind(CONVERSATION_ID).first();

    const transcript = chunk
      .map((m) => `${m.role === 'user' ? '사용자' : 'AI'}: ${m.content}`)
      .join('\n\n');

    const res = await client.messages.create({
      model: CONFIG.SUMMARY_MODEL,
      max_tokens: 12000,   // adaptive thinking이 이 예산을 함께 쓰므로 노트 길이보다 넉넉히 잡는다
      system: CONFIG.SUMMARY_SYSTEM.replace('{MAX_CHARS}', String(CONFIG.MAX_MEMORY_CHARS)),
      thinking: { type: 'adaptive' },
      output_config: { effort: 'medium' },
      messages: [{
        role: 'user',
        content: `## 기존 기억 노트\n${mem?.notes?.trim() || '(없음)'}\n\n## 새로 접힌 대화 조각\n${transcript}`,
      }],
    });

    const notes = res.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();

    // 요약이 빈 문자열로 오면 기존 기억을 날려버리게 되므로 그냥 스킵하고 다음 턴에 재시도한다.
    if (!notes) return;

    const ids = chunk.map((m) => m.id);
    await env.DB.batch([
      env.DB.prepare('UPDATE memory SET notes = ?, updated_at = ? WHERE conversation_id = ?')
        .bind(notes.slice(0, CONFIG.MAX_MEMORY_CHARS), Date.now(), CONVERSATION_ID),
      env.DB.prepare(
        `UPDATE messages SET summarized = 1 WHERE id IN (${ids.map(() => '?').join(',')})`,
      ).bind(...ids),
    ]);
  } finally {
    await env.DB.prepare('UPDATE memory SET lock_until = NULL WHERE conversation_id = ?')
      .bind(CONVERSATION_ID).run().catch(() => {});
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 잡다한 것들
// ─────────────────────────────────────────────────────────────────────────────
function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  });
}

async function readJson(request) {
  try {
    return (await request.json()) ?? {};
  } catch {
    return {};
  }
}

function clampInt(raw, fallback, min, max) {
  const n = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

function describeError(err) {
  if (err instanceof Anthropic.RateLimitError) return '요청이 너무 잦습니다. 잠시 뒤에 다시 보내주세요.';
  if (err instanceof Anthropic.AuthenticationError) return 'Anthropic API 키가 거부됐습니다. 시크릿을 확인해주세요.';
  if (err instanceof Anthropic.APIConnectionError) return 'Anthropic API에 연결하지 못했습니다.';
  if (err instanceof Anthropic.APIStatusError) return `Anthropic API 오류 (${err.status}): ${err.message}`;
  return err?.message || '알 수 없는 오류가 발생했습니다.';
}
