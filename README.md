# wooram

Cloudflare Pages로 배포되는 웹사이트 예제입니다.

## 📁 파일 구조

- `index.html` - 메인 HTML 예제 페이지

## 🚀 Cloudflare Pages 연동 방법

1. [Cloudflare Dashboard](https://dash.cloudflare.com/)에 로그인
2. **Workers & Pages** 메뉴로 이동
3. **Create application** > **Pages** > **Connect to Git** 선택
4. GitHub 저장소 권한 부여 후 `wooram-hub/wooram` 저장소 선택
5. 빌드 설정:
   - **Framework preset**: None
   - **Build command**: (비워두기)
   - **Build output directory**: `/` (또는 비워두기)
6. **Save and Deploy** 클릭

배포 완료 후 자동으로 생성된 URL에서 사이트를 확인할 수 있습니다!

## 🎨 기능

- 반응형 디자인
- 실시간 시계
- 인터랙티브 버튼
- 애니메이션 효과
