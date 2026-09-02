# PEF·VC 공시 모니터

DART 최근 공시 중 사모펀드(PEF)·VC·창투사·신기사 관련 건만 걸러서 보여주는 모니터.

## 취재 분석 기능

- 공시 제목을 IB·PEF 관점의 사건 유형으로 분류: 경영권 변동, 지분 취득·처분, 합병·분할, 메자닌, 담보·보증, 대량보유 등
- `핵심 / 주시 / 참고` 중요도와 `왜 봐야 하는지` 해설 표시
- 회사별 최근 1년 공시를 조회해 같은 사건 유형의 이전 공시를 타임라인으로 연결
- DART 제출자가 회사와 다를 때 외부 제출자 관계를 표시
- 같은 제출자가 복수 회사에 등장하면 `연결후보`로 표시하되 확인된 지배·투자 관계와 구분
- 회사 대표자·설립일·소재지 등 DART 기업개황 제공

해설은 공시 제목과 제출자 정보에 기반한 1차 취재 신호다. 금액·지분율·상대방·거래 조건은 반드시 DART 원문에서 확인한다.

## 배포 (기존 LP 트래커와 동일)

```bash
cd pef-monitor
vercel --prod
```

또는 GitHub 리포에 푸시 → Vercel 대시보드에서 Import. 기본 목록은 기존 API로 작동하며, 회사별 1년 이력 기능에는 아래 `DART_API_KEY` 환경변수가 필요하다.

## 구조

- `index.html` — 프론트. 기간 토글(3/5/7일), PEF/VC 필터 칩, 검색, 5분 자동갱신
- `api/dart.js` — 기존 DART 목록 API(새 분석 API를 사용할 수 없을 때 자동 폴백)
- `api/enriched.js` — DART 목록 수집, 사건 분류, 회사별 1년 이력과 연결 주체 조회
- `vercel.json` — 함수 타임아웃 60초 (7일 조회 시 페이지 수가 많아 필요)

## Vercel 환경변수

회사별 1년 공시 타임라인을 사용하려면 Vercel 프로젝트에 아래 환경변수를 추가한다.

```text
DART_API_KEY=새로 발급한 OpenDART 인증키
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SECRET_KEY=sb_secret_...
```

`SUPABASE_SECRET_KEY`는 Vercel 서버 함수에서만 읽으며 브라우저와 API 응답에 노출하지 않는다. 새 `sb_secret_` 키는 Supabase REST 요청의 `apikey` 헤더로만 전송한다.

Supabase 초기 테이블은 `supabase/schema.sql`을 SQL Editor에서 실행해 만든다. `/api/enriched`가 공시를 가져올 때 `rcept_no`를 기준으로 `disclosures`에 upsert하므로 같은 공시는 중복되지 않고 분석 결과만 갱신된다. 수집 결과는 `monitor_runs`에 기록한다. Supabase 저장에 실패하더라도 기존 공시 화면은 계속 동작하며 API 응답의 `storage` 필드에서 저장 상태를 확인할 수 있다.

`DART_API_KEY`가 없으면 기존 `/api/dart`로 자동 전환된다. 이 경우 공시 의미와 현재 조회기간 내 연결회사 후보는 브라우저에서 분석하지만, 회사별 1년 이력 버튼은 비활성화된다.

공개 저장소의 과거 커밋에 포함된 기존 인증키는 폐기하고 새 인증키를 발급하는 것이 안전하다.

## 키워드 조정

`api/dart.js` 상단 `KEYWORDS` 배열에 추가/삭제. `EXCLUDE_REPORT`에 보고서명 키워드를 넣으면 노이즈 제외 가능 (예: 일반 기업 "사모사채" 발행 공시가 너무 많으면 `"사모사채"` 추가).

## 주의

- DART OpenAPI 일일 호출 한도는 키당 20,000건. 7일 조회 1회에 최대 ~100여 건 호출되므로 자동갱신(5분) 기준으로도 여유 있음.
- 주말·공휴일은 공시가 없어 빈 화면이 정상.
- 응답에 `s-maxage=180` 캐시가 걸려 있어 3분 내 재조회는 Vercel 엣지 캐시로 처리됨(호출 한도 절약).
