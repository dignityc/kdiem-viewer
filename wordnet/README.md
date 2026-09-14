# KMTF–MDR WordNet 초안

전체 항목을 상위 개념별로 펼쳐 보고, 선택한 뜻의 정의와 관계를 함께 확인하는 로컬 작업 화면입니다.

- 왼쪽 트리: 원본 항목은 회색 사각형, AI가 추가한 분류는 보라색 마름모로 표시합니다.
- 오른쪽 패널: 원문 기반 정의, AI 추정 정의, AI 작성 정의를 구분합니다.
- 코드 분류: 부대 식별 코드 11개, 출처 구분 코드 2개, 방향 구분 코드 2개를 추가했습니다.
- 기존 코드 상위 관계는 데이터에 보존하고, 화면에서는 새 중간 분류를 거쳐 탐색합니다.
- 원본 항목의 정의와 사용 근거는 보존합니다. Princeton WordNet 공식 데이터나 확정된 표준 사전이 아닙니다.

## 재생성 및 검증

Node.js만 필요하며 외부 패키지 설치는 없습니다. 저장소 루트에서 실행합니다.

```sh
node wordnet/tools/rebuild-reviewed-viewer.mjs
node wordnet/tools/verify-ai-review.mjs
```

`archive/2026-09-08-before-ai`는 AI 검토 전의 재생성 기준 스냅샷입니다. 스크립트는 이를 읽어 `index.html`, `reviewed-fragment.html`, `graph.json`, `semantic-audit.json`과 검토 내역을 생성합니다.

## 화면 열기

```sh
python3 -m http.server 8766 --bind 127.0.0.1 --directory wordnet
```

브라우저에서 `http://127.0.0.1:8766/`을 엽니다. 저장소 루트의 기존 `index.html`은 별도 KDIEM 화면입니다.
