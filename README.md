# 나만의 AI 채팅

개인 전용 AI 채팅 웹앱. Cloudflare Worker 하나가 UI·API·DB를 전부 맡고,
Anthropic API를 종량제로 호출한다. 폰 브라우저에서 쓰는 걸 전제로 만들었다.

```
[폰 브라우저] ──▶ [Cloudflare Worker] ──▶ [Anthropic API]
                        │  (UI + API 한 오리진)
                        └──▶ [Cloudflare D1] messages / memory
```

## 특징

- **한 번 배포로 끝.** HTML까지 Worker가 서빙해서 CORS도, 별도 정적 호스팅도 없다.
- **비밀번호 로그인.** 30일짜리 HttpOnly 세션 쿠키. 폰에서 한 번 넣으면 계속 유지된다.
- **스트리밍 응답.** 답변이 한 글자씩 흘러나온다.
- **장기 기억.** 오래된 대화는 기억 노트로 압축되지만 **원문은 절대 지우지 않는다.**
- **모델 전환.** 헤더에서 Sonnet 5 / Opus 5 즉시 토글.
- **기억 노트 직접 편집.** 헤더의 책 아이콘.

## 배포

### 0. 준비

```bash
npm install
npx wrangler login
```

### 1. D1 데이터베이스 생성

```bash
npx wrangler d1 create ai-chat
```

출력에 나오는 `database_id`를 `wrangler.toml`의
`REPLACE_AFTER_WRANGLER_D1_CREATE` 자리에 붙여넣는다.

### 2. 테이블 생성

```bash
npm run db:init
```

### 3. 시크릿 3개 등록

```bash
npx wrangler secret put ANTHROPIC_API_KEY   # console.anthropic.com 에서 발급
npx wrangler secret put APP_PASSWORD        # 로그인에 쓸 비밀번호
npx wrangler secret put SESSION_SECRET      # openssl rand -hex 32 결과를 붙여넣기
```

`SESSION_SECRET`을 나중에 바꾸면 기존 로그인 세션이 전부 무효가 된다(=다시 로그인).

### 4. 배포

```bash
npm run deploy
```

출력된 `https://my-ai-chat.<계정>.workers.dev` 를 폰에서 열고 비밀번호를 입력하면 끝.
iOS Safari라면 공유 → "홈 화면에 추가"를 하면 앱처럼 전체 화면으로 뜬다.

### 로컬에서 먼저 돌려보기

```bash
cp .dev.vars.example .dev.vars   # 값 채우기
npm run db:init:local
npm run dev
```

## 문제가 생기면

```bash
npm run tail    # 실시간 Worker 로그
```

- **로그인이 안 됨** → `APP_PASSWORD`, `SESSION_SECRET` 시크릿이 등록됐는지 확인.
- **"API 키가 거부됐습니다"** → `ANTHROPIC_API_KEY` 재등록. 크레딧 잔액도 확인.
- **응답이 안 옴** → `npm run tail` 로그부터. D1 바인딩(`database_id`)이 실제 값인지 확인.

## 설정 바꾸기

`worker.js` 맨 위 `CONFIG` 객체 하나만 보면 된다.

| 항목 | 기본값 | 설명 |
|---|---|---|
| `MODELS` | Sonnet 5 / Opus 5 | UI에 노출할 모델 목록 |
| `DEFAULT_MODEL` | `claude-sonnet-5` | 처음 접속했을 때 선택되는 모델 |
| `SUMMARY_MODEL` | `claude-sonnet-5` | 기억 노트를 갱신하는 모델 |
| `EFFORT` | `low` | 사고 깊이. 잡담은 `low`, 진지한 상담·분석은 `medium` 이상 |
| `MAX_RECENT_MESSAGES` | 40 | 원문 그대로 API에 실어 보낼 메시지 개수 상한 |
| `SUMMARIZE_CHUNK` | 20 | 상한을 넘겼을 때 한 번에 접을 개수 |
| `MAX_MEMORY_CHARS` | 6000 | 기억 노트 길이 상한 |
| `PERSONA` | (한국어 대화 상대) | 시스템 프롬프트. 여기가 성격을 정한다 |

## 기억은 어떻게 동작하나

1. 매 요청에 `summarized = 0`인 메시지를 전부 원문 그대로 보낸다.
2. 그 개수가 `MAX_RECENT_MESSAGES`(40)를 넘으면, 응답을 사용자에게 다 보낸 **뒤에**
   백그라운드(`ctx.waitUntil`)에서 가장 오래된 20개를 기억 노트로 접는다.
3. 접힌 메시지는 `summarized = 1`로 표시될 뿐 **DB에서 지워지지 않는다.**
   앱에서 "이전 대화 더 보기"로 계속 읽을 수 있다.
4. 요약이 실패하면 조용히 넘어가고 다음 턴에 다시 시도한다. 대화는 막히지 않는다.

기억 노트가 마음에 안 들면 책 아이콘을 눌러 직접 고치면 된다. 저장하는 순간부터 반영된다.

## 비용에 대해

프롬프트 캐싱을 시스템 프롬프트와 대화 기록 양쪽에 걸어뒀다. 캐시가 히트하면
그 부분은 입력 단가의 10%만 청구된다. 다만 캐시 수명이 5분이라,

- **몰아서 대화하는 패턴** → 대부분 히트. 구독보다 확실히 싸다.
- **하루 종일 띄엄띄엄** → 대부분 미스. 컨텍스트가 길어질수록 비싸진다.

후자가 본인 패턴이면 `MAX_RECENT_MESSAGES`를 20~30으로 낮추는 게 제일 직접적인 절감책이다.
Anthropic 콘솔의 Usage 탭에서 실제 지출을 며칠 지켜보고 조정하는 걸 권한다.

## 알아둘 것

- 모델 안전 분류기가 요청을 거절하면(`stop_reason: "refusal"`) 그 사실을 그대로 표시한다.
  거절 시 다른 모델로 자동 우회하는 server-side fallback 옵션이 있지만, 개인 대화 앱에서는
  거의 쓸 일이 없고 베타 기능이라 실패 지점만 늘어서 넣지 않았다.
- 프롬프트 캐시 수명을 1시간으로 늘리는 옵션(베타)이 따로 있다. 대화 간격이 길다면 검토해볼 만하다.
- 첨부파일·이미지 입력은 아직 없다.
