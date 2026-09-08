# 인증 메일 링크 클릭 처리 · 2026-09-08

사용자가 인증 메일 링크를 눌렀을 때 localhost 연결 거부 화면을 보고했다. 기존 발송 코드에는 redirect_to가 없고, 사이트에는 클릭 후 세션을 처리하는 콜백이 없었다. 링크 복사·붙여넣기만 안내하던 UI는 일반적인 클릭 동작을 처리하지 못했다.

## 코드 변경

- 기존 Supabase Auth 요청을 유지하며 발송에 명시적인 /auth/callback.html 주소와 PKCE S256 challenge를 추가한다.
- 기존 HttpOnly 요청 쿠키의 서명·만료와 서버 비밀키, 요청 호스트에 연결한 verifier로만 코드를 교환한다. 다른 브라우저·다른 사이트 주소에는 새 인증 메일을 요청하도록 안내한다.
- 콜백은 주소창의 코드를 정리한 뒤 같은 출처의 POST로 인증한다. 서버는 다시 사용자 이메일 확인·역할·요청 이메일 일치를 검사한 뒤 기존 Secure HttpOnly 쿠키를 만든다. 성공 시 같은 사이트의 뉴스 홈으로 돌아간다.
- 기존 숫자 인증번호와 링크 수동 입력, 헤더·검색·개인 기록·접근 정책은 유지한다. 다른 사용자 기록이나 취재 메모를 이동하지 않는다.
- 토큰·코드를 localStorage에 보관하거나 응답 JSON·로그에 출력하지 않는다. 기존 방식의 URL fragment 토큰은 가져오지 않고 새 인증 메일을 안내한다.
- 기존 정본·DB·메일 템플릿·SMTP 설정은 변경하지 않는다. 새 유료 서비스나 API를 추가하지 않는다.

## 관리 화면에서 남은 설정

현재 연결 도구에는 Supabase Auth URL Configuration을 읽거나 변경하는 작업이 없다. 따라서 원격 설정을 완료했다고 주장하지 않는다.

Supabase pef-monitor → Authentication → URL Configuration:

Site URL: https://ainobi.news
Redirect URLs: https://ainobi.news/auth/callback.html

다른 기존 서비스 주소에서도 로그인을 지원하려면 해당 호스트의 /auth/callback.html도 정확히 추가한다. 와일드카드로 임의 호스트를 허용하지 않는다. 원칙적으로 ainobi.news에서 메일을 요청하고 같은 브라우저로 연다. 기본 ConfirmationURL 메일 템플릿과 호환되며 번호 입력도 유지한다. 주소 설정 후 이전 메일을 재사용하지 말고 새 인증 메일을 요청한다.

## 검증 범위

로컬 Node에서 신규 26개 검사(보안·서버 모듈·클라이언트 VM)가 통과했다. 실제 기존 계정 핸들러 통합 6개와 전체 기존 회귀 검사는 빌드에서 실행한다. Chromium 기반 외부 URL 모의 탐색은 실행 환경의 브라우저 정책에서 차단되어 완료하지 못했다. 운영 메일 수신→링크 클릭→로그인 전체 검증은 남아 있다. 테스트 계정이나 메일을 실제로 만들지 않았으며 사용자의 인증 링크를 요청하지 않았다.

참고 원문:
https://supabase.com/docs/guides/auth/redirect-urls
https://supabase.com/docs/guides/auth/server-side/advanced-guide
https://supabase.com/docs/guides/auth/auth-email-templates
