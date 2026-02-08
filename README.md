# NexusAI

NexusAI는 여러 AI 모델(GPT/Gemini)을 하나의 대화 흐름에서 사용할 수 있는 멀티 모델 채팅 플랫폼입니다.
Multi-model chat experience with seamless context and email-based auth.

---

## Features (주요 기능)

- **Email Auth with Verification**
  이메일 인증 코드 기반 회원가입/로그인 지원
  Password signup requires email verification
- **Multi-Model Chat (GPT + Gemini)**
  모델 전환 시에도 대화 컨텍스트를 강화해 자연스럽게 이어짐
  Context reinforced across model switches
- **Usage Limit Tracking**
  일일 요청 횟수/문자 수 제한 및 남은 횟수 표시
  Real-time remaining usage in header
- **Supabase 기반 인증/스토리지**
  Auth, profiles, conversations/messages 관리
  Supabase-backed user & conversation management

---

## Tech Stack (기술 스택)

- **Framework**: Next.js 16 (App Router)
- **Auth/DB**: Supabase (RLS, auth.users + profiles)
- **AI**: OpenAI GPT-4o-mini, Google Gemini 2.5 Flash
- **I18n**: next-intl (ko/en)
- **UI**: Tailwind CSS
- **Email**: SMTP (Gmail recommended for MVP)

---

## Getting Started (로컬 실행)

```bash
npm install
npm run dev
```

---

## Environment Variables (환경 변수)

필수/선택 환경 변수를 `.env.local`에 설정하세요.

**Supabase**
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

**AI**
```
OPENAI_API_KEY=
GOOGLE_GEMINI_API_KEY=
```

**SMTP (Gmail recommended for MVP)**
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=your_gmail_address
SMTP_PASS=your_gmail_app_password
SMTP_FROM="NexusAI <your_gmail_address>"
```

**Model Switch Context (optional)**
```
MODEL_SWITCH_CONTEXT_TURNS=3
```
- 모델 전환 시 최근 N턴을 컨텍스트로 강화
- Recommended range: 2-4, Default: 3

---

## Gmail SMTP Setup (Gmail SMTP 설정)

1. Google 계정 → **보안** → **2단계 인증** 활성화
2. **앱 비밀번호** 생성 (메일 앱/기기 이름 지정)
3. 발급된 16자리 비밀번호를 `SMTP_PASS`로 사용

---

## Deployment (Vercel)

- Vercel에 환경 변수 등록 (Production/Preview)
- Supabase Auth redirect URL에 Vercel 도메인 추가
- 배포 후 `/api/auth/email/start` 통해 메일 발송 확인

---

## Notes (주의사항)

- **SUPABASE_SERVICE_ROLE_KEY**는 클라이언트에 노출 금지
- 모델 전환 컨텍스트는 비용/일관성 균형 고려 필요
- SMTP는 MVP에 적합, 운영 전용 서비스로 전환 권장

---

## License

Private MVP (Internal Use)
