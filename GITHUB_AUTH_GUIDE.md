# GitHub 브라우저 인증 가이드

## 단계별 방법

### 1단계: GitHub에서 Personal Access Token 생성

1. GitHub 웹사이트에 로그인: https://github.com
2. 오른쪽 상단 프로필 클릭 → **Settings** 선택
3. 왼쪽 메뉴에서 **Developer settings** 클릭
4. **Personal access tokens** → **Tokens (classic)** 선택
5. **Generate new token** → **Generate new token (classic)** 클릭
6. 토큰 이름 입력 (예: "wooram-local-dev")
7. 권한(Scopes) 선택:
   - ✅ **repo** (전체 체크) - 저장소 접근 권한
8. **Generate token** 클릭
9. 생성된 토큰을 복사해두세요 (다시 볼 수 없으므로!)

### 2단계: Git에 인증 정보 저장

터미널에서 다음 명령어를 실행하세요:

```bash
git push -u origin main
```

비밀번호를 물어보면:
- **Username**: GitHub 사용자명 입력
- **Password**: 위에서 생성한 Personal Access Token 입력

### 3단계: 인증 정보 저장 (선택사항)

다음 명령어로 인증 정보를 저장하면 다음부터는 입력하지 않아도 됩니다:

```bash
git config --global credential.helper manager-core
```

또는 Windows Credential Manager를 사용:

```bash
git config --global credential.helper wincred
```

## 참고사항

- Personal Access Token은 일반 비밀번호가 아닙니다
- 토큰은 다시 볼 수 없으니 안전한 곳에 보관하세요
- 토큰이 만료되면 새로 생성해야 합니다

