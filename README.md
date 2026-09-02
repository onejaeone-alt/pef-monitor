# PEF·VC 공시 모니터

DART 최근 공시 중 사모펀드(PEF)·VC·창투사·신기사 관련 건만 걸러서 보여주는 모니터.

## 배포 (기존 LP 트래커와 동일)

```bash
cd pef-monitor
vercel --prod
```

또는 GitHub 리포에 푸시 → Vercel 대시보드에서 Import.

### 필수 환경변수

Vercel 프로젝트의 Settings → Environment Variables에 아래 값을 등록한다.

```text
DART_API_KEY=OpenDART에서 발급받은 40자리 인증키
```

인증키는 공개 저장소 코드에 직접 넣지 않는다. 기존에 코드에 노출된 키는 OpenDART에서 폐기하고 새로 발급받아야 한다.

## 구조

- `index.html` — 프론트. 기간 토글(3/5/7일), PEF/VC 필터 칩, 검색, 5분 자동갱신
- `api/dart.js` — DART list API를 페이지네이션(병렬 10개씩)으로 전량 수집 후 키워드·중요도 필터링
- `vercel.json` — 함수 타임아웃 60초 (7일 조회 시 페이지 수가 많아 필요)

## 키워드 조정

`api/dart.js` 상단 `KEYWORDS` 배열에 추가/삭제. `EXCLUDE_REPORT`에 보고서명 키워드를 넣으면 노이즈 제외 가능 (예: 일반 기업 "사모사채" 발행 공시가 너무 많으면 `"사모사채"` 추가).

## 주의

- DART OpenAPI 일일 호출 한도는 키당 20,000건. 7일 조회 1회에 최대 ~100여 건 호출되므로 자동갱신(5분) 기준으로도 여유 있음.
- 주말·공휴일은 공시가 없어 빈 화면이 정상.
- 응답에 `s-maxage=180` 캐시가 걸려 있어 3분 내 재조회는 Vercel 엣지 캐시로 처리됨(호출 한도 절약).
