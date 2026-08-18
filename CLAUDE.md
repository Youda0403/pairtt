# 프로젝트: 나만의 AI 채팅 (개인용 기억 강화 챗봇)

## 목적
개인 전용 AI 채팅 웹앱. 기존 AI 채팅 구독(월 약 2만원) 대신 API 종량제로 전환하면서,
장기 기억력을 강화한 사람 같은 대화 상대를 만드는 게 목표. 주 사용처는 폰 브라우저이고,
"혹시 모를 사태"(폰 분실/초기화 등)에 대비해 대화 데이터는 서버(D1)에 저장한다.

## 아키텍처

```
[폰 브라우저] ──▶ [Cloudflare Worker] ──▶ [Anthropic API]
                        │  UI + API를 한 오리진에서 서빙
                        └──▶ [Cloudflare D1] messages / memory / conversations
```

Worker 하나가 정적 UI와 API를 전부 맡는다. 별도 정적 호스팅이 없으니 CORS도 없고,
배포는 `wrangler deploy` 한 번이다.

### 파일

- **public/index.html** — 단일 파일 모바일 채팅 UI. 외부 의존성 0(마크다운 렌더러도 자체 구현).
  Workers Assets가 서빙한다. 비밀번호 로그인 화면, 스트리밍 렌더링, 모델 토글,
  기억 노트 편집 모달, 이전 대화 페이지네이션 포함.
- **worker.js** — 백엔드 전부. 라우트:
  - `POST /api/login` / `POST /api/logout` / `GET /api/session` — 인증
  - `GET /api/history?before=&limit=` — 과거 대화 페이지네이션 + 기억 노트
  - `POST /api/chat` — 메시지 전송, **SSE 스트리밍** 응답
  - `GET/PUT /api/memory` — 기억 노트 조회 / 수동 수정
- **schema.sql** — D1 스키마. `conversations`, `messages`, `memory`.
- **wrangler.toml** — 배포 설정. `database_id`는 `REPLACE_AFTER_WRANGLER_D1_CREATE` 상태.
- **README.md** — 배포 순서와 트러블슈팅.

### 인증
비밀번호 1회 입력 → `SESSION_SECRET`으로 HMAC-SHA256 서명한 만료시각 토큰을
HttpOnly·Secure·SameSite=Lax 쿠키로 발급(30일). 비밀번호·서명 비교는 상수 시간.
서버 시크릿 3개: `ANTHROPIC_API_KEY`, `APP_PASSWORD`, `SESSION_SECRET`.

## 핵심 설계: 기억 시스템

- 매 요청에 `summarized = 0`인 메시지를 원문 그대로 전부 포함한다.
- 개수가 `CONFIG.MAX_RECENT_MESSAGES`(40)를 넘으면 가장 오래된
  `CONFIG.SUMMARIZE_CHUNK`(20)개를 별도 API 호출로 요약해 `memory.notes`에 통합하고,
  **원문은 `summarized = 1`로 표시만 한다. 절대 DELETE하지 않는다.**
  ← 서버 저장의 목적이 백업이므로, 백업이 지워지면 목적과 충돌한다.
- 응답은 먼저 사용자에게 스트리밍하고, 요약은 `ctx.waitUntil`로 뒤에서 돈다.
- 요약 실패 시 조용히 스킵하고 다음 턴에 재시도. 빈 요약이 오면 기존 노트를 덮지 않는다.
- 요약 중복 실행은 `memory.lock_until`에 대한 조건부 UPDATE(compare-and-set)로 막는다.
- 접는 구간이 assistant 응답 직전에서 끊기지 않게 경계를 한 칸 보정한다.

### 프롬프트 캐싱
브레이크포인트 3개:
1. 시스템 프롬프트 끝(페르소나 + 기억 노트)
2. `messages[n-3]` — 지난 턴에 기록한 캐시와 정확히 일치하는 위치 (히트 보장)
3. `messages[n-1]` — 이번 턴 분을 기록 (다음 턴에 히트)

매 턴 재전송되는 토큰의 대부분은 시스템이 아니라 **대화 기록**이라, 2·3번이 실제 절감의 핵심이다.
기억 노트가 갱신되면 시스템 프리픽스가 깨져 뒤쪽 캐시까지 무효화되지만, 20턴에 한 번꼴이라 감수한다.

### 메시지 배열 정규화
`buildMessages()`에서 (1) 선두 assistant 제거, (2) 연속 동일 role 병합을 한다.
API 호출이 실패해 user 메시지만 남거나 요약이 홀수 지점에서 끊겨도
"첫 메시지는 user, role은 교대" 제약이 깨지지 않게 하려는 방어 로직. DB 원문은 건드리지 않는다.

## 모델 관련 (2026-08 기준)
- 대화: `claude-sonnet-5`($3/$15) / `claude-opus-5`($5/$25) UI 토글. 둘 다 1M 컨텍스트.
- `thinking: { type: 'adaptive' }` + `output_config: { effort: 'low' }`.
  `budget_tokens`는 이 세대에서 제거됨(400). 잡담에는 low가 제일 자연스럽고 빠르고 싸다.
- assistant prefill은 이 세대에서 제거됨(400). 쓰지 말 것.
- `stop_reason: 'refusal'`을 체크한다(200으로 돌아옴). server-side fallback은 의도적으로 미사용.

## 현재 상태
- 코드 전부 작성 완료. `wrangler dev --local`로 인증/D1/SSE 스트리밍 경로까지 실제 검증함.
  (가짜 API 키로 호출해 401 → 한국어 에러 변환까지 확인)
- **실제 배포는 안 한 상태.** 남은 작업은 README.md의 "배포" 절차 4단계.
- 아직 실기기 테스트 전. 첫 대화에서 에러가 뜨면 `npm run tail`부터 볼 것.

## 코딩 시 반드시 지킬 규칙 (사용자 고정 선호)
1. 요청한 수정사항을 적용한 뒤, 전체 코드에 다른 문제가 없는지 검토하고 나서 답변할 것
2. 어디가 문제였고 어디를 고쳤는지 명확하게 설명할 것
3. 요청받지 않은 다른 부분은 절대 임의로 수정하지 말 것

## 앞으로 확장 여지 (아직 미정, 요청 있을 때만 진행)
- 다중 스레드: 스키마에는 `conversations` 테이블과 `conversation_id` 컬럼이 이미 있고,
  `worker.js`의 `CONVERSATION_ID = 1` 상수만 파라미터로 바꾸면 백엔드는 거의 준비됨. UI가 남았다.
- 대화 검색 (원문을 전부 보관하므로 FTS5 인덱스를 얹으면 됨)
- 기억 노트 버전 히스토리
- 이미지/첨부 입력
- 프롬프트 캐시 1시간 TTL(베타) 적용 검토
