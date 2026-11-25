---
name: read-search-context
description: |
  시드 키워드 하나와 국가를 받아, 그 검색 앞뒤에 붙는 검색어와 갈래별 검색 목적을 경로와 검색 결과 화면 근거로 답한다.
  커넥터는 `path_finder`(세션 인접 경로) + `keyword_info`(`ads_metrics` 검색량 · `monthly_volume` 전년 비교) + `serp`(AI 개요 · 1~3위) 3종이며,
  결과는 리포트 한 장(공통 렌더러)과 눌러 보는 경로 맵 한 장이다.

  "이 키워드 검색하는 사람들은 앞뒤로 뭘 찾고 왜 검색해?" · "캠핑의자 앞뒤로 뭘 검색해?" ·
  "선크림 검색 맥락 분석해줘" · "이 검색어는 무엇을 하려는 검색이야?" · "서치 컨텍스트 봐줘"
  같은 요청이면 반드시 이 스킬을 쓴다.

  사용자가 "맥락"이라는 말을 쓰지 않아도, **시드 하나를 놓고 앞뒤 검색과 검색 목적을 함께 묻는 요청**
  (어떤 글을 낼지, 어떤 광고 키워드와 랜딩 페이지를 둘지, 무엇과 견줘 메시지를 정할지)이면 켠다.

  경계: 여러 시드의 단계 전이 집계는 `trace-search-journey`, 수요 크기와 키워드 전수 수집은 `map-your-market`,
  추이 전수는 `spot-trends`, 점유는 `track-search-share`로 보낸다. «작년과 비교»는 시드와 앞뒤 갈래의 **검색량**만 전년 같은 석 달과 견주고,
  지난 시점의 경로는 견주지 않는다. 구매 · 전환 · 성별 · 연령은 답하지 않는다.
license: MIT
metadata:
  version: "0.3.3"
---

<!-- lm-skill: kind=task; connectors=keyword_info,path_finder,serp; flags=monthly,expand,report; traps=T1,T2,T3,T4,T5,T6,T7 -->

# read-search-context — 시드 하나의 앞뒤 검색과 검색 목적

> **핵심 원칙**: `path_finder`가 주는 것은 같은 세션 안에서 붙어 나온 검색의 순서를 **집계한 것**이다.
> 한 사람의 여정이 아니다. 이 스킬은 «시드 앞뒤에 무엇이 붙는가»를 세고(실제 데이터),
> «무엇을 하려는 검색인가»를 검색 결과 화면 근거로 읽는다(추정). 원인은 말하지 않는다.

답하는 질문 네 가지(리포트 부록에 질문별 상태가 실린다):

| ID | 질문 | 완료 기준 |
|---|---|---|
| Q1 | 시드 바로 앞과 바로 뒤에 무엇을 검색하나 | 앞 · 뒤 상위 검색어를 경로 수 · 줄기 수와 함께 표로 낸다 |
| Q2 | 뒤로 갈수록 어떤 조건이 붙어 갈래가 나뉘나 | 시드 뒤 갈래 최대 다섯 개와 다음 단계를 표와 맵으로 낸다 |
| Q3 | 갈래마다 무엇을 하려는 검색인가 | 대표 경로마다 발견 카드와 근거 번호(`E2-AI` · `E2-1`)가 붙는다 |
| Q4 | 어디에 무엇을 내야 하나 | 실행 카드 3~5개 — 가설 · 결과물 · 담당 · 확대/수정/중단 조건 |
| Q5 | 작년 같은 시기와 비교하면 검색량이 어떻게 달라졌나 | 시드와 앞뒤 갈래의 최근 석 달 · 전년 같은 석 달 · 증감 · 전년비를 기준월 · 지연과 함께 표로 낸다 |

## 데이터 계약

이 스킬은 `references/lm-data-contract.md`(정본 사본)를 따른다. 계약은 확장할 수 있지만 뒤집을 수 없다.

| 함정 | 처리 위치 | 상태 |
|---|---|---|
| T1 기준월 · 지연 | STEP 3.5 (`check_refmonth.py`) | 처리 |
| T2 마지막 달 미완결 | STEP 3.5 (`check_refmonth.py` · `trend_yoy.py`) | 처리 |
| T3 `volume_trend` 대신 전년 동기 | STEP 3.5 (`trend_yoy.py`) | 처리 |
| T4 기저 게이트 | STEP 3.5 · STEP 5 | 처리 |
| T5 표기변형 canonical 정규화 | STEP 3 (`context_paths.py`) · STEP 3.5 | 처리 |
| T6 결측 월 | STEP 3.5 (`trend_yoy.py`) | 처리 |
| T7 절단(limit) 검사 — 절단이면 수렴 판정 보류 | STEP 2 · STEP 3 | 처리 |

- 시계열은 전년 비교 대상(시드 + 앞뒤 갈래 상위, 기본 최대 11개)에만 받는다 — `keyword_info/monthly_volume`(1 × 반환 행). 경로 검색어 전부는 `ads_metrics`(1/kw)다.
- 점유 · 기회 크기를 말하지 않는다. 맥락 파일에 브랜드가 있으면 맵과 표에 표시만 한다.

## 커넥터와 크레딧

| 커넥터 | 용도 | 크레딧 결정식 |
|---|---|---|
| `keyword_info` (`ads_metrics`) | 시드 확인 1회 + 경로에 나온 검색어 전부의 검색량 | `1 × 1` + `1 × U` |
| `path_finder` | 시드를 지나는 세션 인접 경로(현재 시점 · 경로 수 L) | `50 + 40 × U` (U = 경로 안 고유 검색어 수) |
| `keyword_info/monthly_volume` | 전년 비교 대상(시드 + 뒤 갈래 상위 5 + 앞 갈래 상위 5)의 월별 검색량 · 기간 전체(최근 4년) | `1 × R` (R = 반환 행 — 돌아오지 않은 검색어는 0, 요청하지 않은 표기 행도 과금) |
| `serp` | 시드 · 뒤 갈래 상위 · 대표 경로 검색어의 검색 결과 화면 | `30 × S` (저장본 없는 검색어는 0) |

```
총 크레딧 = 1 × 1 + (50 + 40 × U) + 1 × U + 1 × R + 30 × S
계획값:   U ≈ ceil(L × r),  S ≤ 1 + 갈래 5 + 대표 경로 3개의 새 검색어
```

- **U 는 호출 전에 알 수 없다.** `limit`은 경로 수 상한이지 고유 검색어 수 상한이 아니다. 견적은 r = 1.0 [가정]으로 계산하고,
  관측된 r(0.56 · 1.40 — 관측일 뿐 상한이 아니다)로 다시 계산한 값을 함께 보여 준다. `python3 scripts/collect.py quote --limit 100 --serp 18`
- **계산 예**(L = 100 · r = 1.0 · R = 11 · S = 18): 1 + (50 + 40 × 100) + 1 × 100 + 1 × 11 + 30 × 18 = 4,702 [추정].
- **R 은 요청 수보다 클 수 있다** — 요청하지 않은 표기 행이 함께 오면 그 행도 과금된다(계약 §1). 견적은 대상 수로 잡고 실측은 원장에 남는다.
- **S 의 상한**: 기본값에서 S ≤ 18 = 시드 1 + 뒤 갈래 5 + 대표 경로 3개 × 새 검색어 최대 4(네 걸음). 대표 경로끼리 검색어가 겹치거나 갈래가 적으면 더 작다.
- **serp 단가는 환경마다 다를 수 있다.** 계약값은 30 이지만 개발 환경 실행 평가에서는 그보다 낮게 청구됐다.
  견적은 계약값으로 내고(높게 잡힌다), `collect.py serp`가 실측 단가가 다르면 경고한다. 실제 비용은 원장이 정본이다.
- **2단 조회는 하지 않는다.** `keyword_info`는 전량 `ads_metrics`(1/kw)만 쓰고 `all`(10/kw) 대상은 0이다 — 시계열 · 인텐트 필드가 필요 없다.
- **파일럿은 기본으로 돌리지 않는다.** 시드가 하나라 파일럿은 같은 시드를 두 번 부르는 비용이 된다. 예산을 넘으면 안 되는 경우에만
  사용자에게 작은 `limit`으로 먼저 불러 볼지 묻는다(그 호출도 `50 + 40 × U`가 든다).
- **상한 안에 드는 경로 수**: `collect.py quote --limit L --serp 18 --budget B`가 관측된 r 1.40 에서도 시드 확인 · 경로 · 검색량이 B 안에 드는 경로 수를 낸다.
  경로 조회 비용은 호출 뒤에야 확정되므로, 예산 가드는 그 한 번의 초과를 막지 못한다 — 빠듯한 상한이면 이 값 이하를 제안한다.
- **예산 가드**: 사용자가 승인한 상한(`--budget`)이 실행 기록에 남고, `collect.py`는 호출 전에 계획값이 남은 예산을 넘으면 부르지 않는다(종료 코드 4).
  경로 수집 실측이 계획을 넘으면 STEP 4에서 남은 예산만큼만 `serp`를 부르고, 못 부른 검색어는 [데이터 공백]으로 남긴다.

## 번들 자산

| 파일 | 하는 일 | 쓰는 곳 |
|---|---|---|
| `scripts/collect.py` | 수집 층 — 설정(온보딩) · 견적 · 호출 · 원본 저장 · 호출 원장 · 예산 가드 · 커넥터 원본 넣기 (이 스킬 고유) | STEP 0 · 1 · 2 · 3.5 · 4 |
| `scripts/context_paths.py` | 표기 묶기 · 시드 표기 검사 · 앞뒤 이음 · 갈래 구조 · 절단 판정 · 비용 대조 · 대표 경로 · SERP 대상 (이 스킬 고유) | STEP 3 |
| `scripts/serp_evidence.py` | 원본에서 AI 개요(목록 안의 목록 포함) · 1~3위 · 수집일을 뽑는다 (이 스킬 고유) | STEP 4 |
| `scripts/build_report.py` | 사실 목록 · 해석 입력 생성(`brief`), 해석 검사와 `report.json` 조립(`assemble`) (이 스킬 고유) | STEP 5 · 6 |
| `scripts/build_map.py` | 경로 맵 단독 HTML (이 스킬 고유) | STEP 6 |
| `scripts/render_report.py` · `selftest_render.py` | 공통 리포트 렌더러와 회귀 시험 (공유 정본 사본) | STEP 6 |
| `scripts/series_dedup.py` | canonical 정규화 (공유 정본 사본) | STEP 3 · 3.5 |
| `scripts/check_refmonth.py` | 데이터 기준월 · 지연 · 마지막 달 완결성 (공유 정본 사본) | STEP 3.5 |
| `scripts/trend_yoy.py` | 전년 동기 비교 · 결측 월 · 기저 게이트 · 최신 달 제외 전년비 (공유 정본 사본) | STEP 3.5 |
| `scripts/selftest.py` · `selftest_context.py` | 문서의 예시 명령과 컬럼 목록이 스크립트와 맞는지 검증(API 호출 없음) | 스킬 수정 후 |
| `assets/context.starter.json` | 맥락 파일 견본 — 빈 칸과 칸마다의 안내 | STEP 0 |
| `assets/fixtures/` | 합성 응답(캠핑의자 · 한국) — 모의 실행과 selftest 용. 실제 조회 결과가 아니다 | 모의 실행 |
| `assets/report.example.json` | 이 스킬의 리포트 견본(합성 자료로 조립한 것) | STEP 6 |
| `references/onboarding.md` | 처음 한 번 하는 설정 — 공급원 · 서버 주소 · 키 · 기본값 · 맥락 | STEP 0 |
| `references/context-guide.md` | 맥락 파일 채우는 법 | STEP 0 |
| `references/lm-data-contract.md` · `report-contract.md` | 데이터 계약 · 렌더링 계약 정본 사본 | 전체 |

## 사전 확인

```
1. 시드가 하나인가? 여러 시드를 견주는 요청이면 trace-search-journey 로 보낸다
2. 국가(gl)가 kr · us · jp 중 하나로 정해졌는가? 요청에 없으면 한 번 묻는다 — 추측하지 않는다
3. 설정이 있는가? `python3 scripts/collect.py status` 가 2 로 끝나면 온보딩부터 한다(STEP 0)
4. 크레딧 상한이 정해졌는가? 견적을 보여 주고 사용자에게 받는다 — path_finder 1회가 수천 크레딧일 수 있다
5. 요청에 구매 · 전환율 · 이탈률 · 연령/성별이 들어 있는가? 있으면 착수 전에
   "세션 인접 검색과 저장된 검색 결과 화면까지만 답할 수 있다"고 범위를 먼저 알린다
6. 요청에 «작년과 비교»가 있는가? 있으면 "검색량은 전년 같은 석 달과 견주고, 검색 경로는 지금 시점만 본다"고 범위를 먼저 알린다
```

## 실행 순서

명령은 **스킬을 설치한 작업 공간의 루트**에서 돌린다. 설정과 실행 기록은 그 작업 공간의 `work/read-search-context/` 아래에 생긴다.
아래 예시의 `scripts/`는 이 스킬 폴더의 `scripts/`다.

### STEP 0 · 설정 확인 (처음 한 번 온보딩 · 크레딧 0)

```bash
python3 scripts/collect.py status
```

종료 코드 2면 `references/onboarding.md` 순서로 묻고 저장한다: **공급원(api · mcp) → 서버 주소 → 키 → 기본값 → 맥락(선택)**.

```bash
python3 scripts/collect.py setup --source api --base https://api.example.com --gl kr --lang kr --limit 100 --budget 6000
python3 scripts/collect.py setup --source api --base https://api.example.com --override-env   # 환경변수 주소와 다를 때 · 사용자가 확인한 뒤만
```

- **서버 주소는 사용자가 알려 준 값을 넣는다.** 스킬에 주소가 들어 있지 않다. `https` 주소만 받고, 저장한 뒤 호스트를 다시 보여 주며 맞는지 확인받는다 — 키가 그 주소로 전송된다.
- **찾는 순서**: 저장한 값(사용자 설정 폴더)이 먼저, 환경변수(`LM_API_BASE` · `LM_API_KEY`)는 저장한 값이 없을 때만. `status`가 주소 · 키를 어디서 읽었는지 보여 준다.
  저장한 주소와 환경변수 주소의 호스트가 다르면 `status`는 종료 코드 3, 호출 명령은 **부르기 전에 종료 코드 5로 멈춘다** — 두 호스트를 사용자에게 보여 주고 고르게 한다.
  저장한 주소를 쓰기로 하면 `setup … --override-env`(그 환경변수 호스트를 기록 · 바뀌면 다시 멈춘다). 모의 실행에서도 이 검사를 한다.
- 주소와 키를 서로 다른 곳에서 읽으면 `status`가 경고한다. **한 번 묻는다**: "이 키가 <호스트>용 키가 맞나요?" — 맞다고 하면
  `setup … --key-confirmed`로 기록하고 진행한다(다음부터 경고하지 않는다). 아니라고 하면 그 호스트용 키를 사용자 설정 폴더에 넣게 하고 기다린다.
- **키는 사용자가 직접 넣는다**(사용자 설정 폴더의 `api-key` 또는 환경변수 `LM_API_KEY`). 에이전트는 키를 받아 적지 않고, 화면 · 원장 · 원본 파일에 쓰지 않는다.
- 공급원이 `mcp`면 서버 주소와 키를 묻지 않는다. 호출은 에이전트가 커넥터로 하고 원본을 `collect.py ingest`로 넣는다(STEP 2 끝).
- `assets/context.json`이 없으면 범용으로 돈다. 채우려면 `assets/context.starter.json`을 복사해 `references/context-guide.md`대로 채운다.

### STEP 1 · 견적 · 실행 기록 · 시드 확인

```bash
python3 scripts/collect.py quote --limit 100 --serp 18
python3 scripts/collect.py init --seed 캠핑의자 --gl kr --limit 100 --budget 6000 --request "캠핑의자 앞뒤로 뭘 검색해?"
python3 scripts/collect.py seed --run work/read-search-context/<실행 ID>
```

- 견적(`quote`)을 사용자에게 보여 주고 **경로 수와 크레딧 상한을 승인받은 뒤** `init`을 돌린다. `init`은 실행 폴더 경로를 출력하고 `request.json`(요청 원문 · 시드 · 국가 · 경로 수 · 상한 · 공급원 · 조회일)을 남긴다.
- `seed`는 `keyword_info(keywords=[시드], gl, data_type="ads_metrics")` 1회다(1 × 1). 원본은 `raw/seed_metrics.json`, 호출 원장은 `calls.jsonl`에 쓴다.
- 시드가 응답에 없으면 [데이터 공백] — 표기를 바꿀지 진행할지 사용자에게 묻는다.
- 요청하지 않은 표기 행이 함께 오면(`선크림` 요청에 `썬크림` 행) 경고가 나온다. 한 글자만 다른 표기면 STEP 3에서 `--rules '{"썬":"선"}'`로 묶는다.
  규칙은 같은 검색어를 묶는 데만 쓴다 — 치환 결과가 어색한 묶음 키(예: «선크림 썬크림» → `선크림선크림`)를 만들어도 집계에는 영향이 없다. 응답 표기가 요청과 다르면(`캠핑의자` → `캠핑 의자`) 경고가 나온다 — 경로에서도 표기가 바뀔 수 있다(STEP 3이 검사한다).

### STEP 2 · 경로 수집과 절단 기록 · 검색량

```bash
python3 scripts/collect.py paths   --run work/read-search-context/<실행 ID>
python3 scripts/collect.py volumes --run work/read-search-context/<실행 ID>
```

- `paths`는 `path_finder(keyword=시드, gl, time_point="curr", limit=L)` 1회다. 호출 전에 계획값 `50 + 40 × ceil(L × 1.0)`이 남은 예산을 넘으면 부르지 않는다.
- **절단 검사(T7)** — 받은 경로 수가 요청 `limit`과 같으면 절단이다. 이 시드의 경로가 더 있을 수 있으므로 «전체 경로»라고 쓰지 않고 «받은 경로 기준»으로 쓴다.
  `limit`을 올려 다시 부르면 비용을 다시 치르므로 사용자 결정 없이 올리지 않는다.
- 빈 응답(`data: []`)은 [데이터 공백]이다 — 실패로 다시 부르지 않는다.
- `volumes`는 경로에 나온 검색어 전부를 `keyword_info`(`ads_metrics`)로 조회한다(1 × U · 1회 1,000개까지 나눠 부르고 `raw/metrics.json` 한 파일로 합친다).
  응답 행 수는 요청 수와 다를 수 있다 — 요청하지 않은 표기변형 행이 함께 오거나 합쳐져 온다.
- **호출 원장**: 호출할 때마다 원본 응답을 `raw/`에 저장하고(요청 헤더는 저장하지 않는다), `cost_detail.total_cost`와 반환 수 · 조건 · 시각을 `calls.jsonl`에 한 줄씩 쓴다.
  누적 실측과 상한이 호출마다 출력된다.
- 공급원이 `mcp`면 위 두 명령 대신 커넥터로 같은 조건을 부르고, 받은 원본 파일을 그대로 넣는다(요약 · 발췌 금지 · 건수 대조):
  `python3 scripts/collect.py ingest --run <실행 폴더> --tool path_finder --file resp.json --params "seed=캠핑의자 · limit 100" --expect 100`
  응답에 `cost_detail`이 없으면 그 호출의 비용을 `--cost`로 준다. 모르면 사용자에게 묻는다 — 0으로 채우지 않는다.

### STEP 3 · 로컬 집계 (표기변형 정규화 · 절단 판정 포함)

```bash
python3 scripts/context_paths.py --paths work/read-search-context/<실행 ID>/raw/path.json --seed 캠핑의자 \
    --metrics work/read-search-context/<실행 ID>/raw/metrics.json --limit 100 \
    --out-dir work/read-search-context/<실행 ID>/out
```

스크립트가 하는 일:

- **canonical 정규화(T5)** — NFKC → 소문자 → 변형치환(`--rules '{"썬":"선"}'`) → 공백 제거로 묶음 키를 만들고 집계는 묶음 기준으로 한다.
  화면에는 그 묶음에서 가장 많이 나온 표기를 쓰고, 묶인 표기는 `variants`에 남긴다.
- **표기변형 인접 제외** — `캠핑 의자 → 캠핑의자`처럼 같은 묶음끼리 붙은 인접은 앞뒤 검색으로 세지 않는다. 세면 «가장 흔한 다음 검색»이
  자기 자신의 띄어쓰기가 되어 이중 계상된다. 제외 건수를 출력하고 리포트 데이터 범위에 적는다.
- **시드 표기 검사** — 시드가 받은 경로 어디에도 없고 한 글자만 다른 표기가 경로 절반 이상에 있으면 **집계하지 않고 종료 코드 3으로 멈춘다**.
  메시지의 치환 규칙을 `--rules`에 넣고 다시 돌린다(0크레딧). 정말 다른 검색이면 `--allow-seed-variant`.
- **방향** — 방향은 요청 파라미터가 아니다. 경로 안에서 시드의 첫 위치를 찾아 그 앞은 `pre_seed`, 뒤는 `post_seed`로 둔다. 시드가 없는 경로는 세지 않고 수만 적는다.
- **세는 단위** — 이음마다 경로 수(`path_count`)와 서로 다른 줄기 수(`stem_count` · 줄기 = 경로의 앞 `--stem-len`걸음, 기본 3 [가정])를 함께 적는다.
  받은 경로는 앞 몇 걸음을 공유하고 끝만 갈라지는 경우가 있어, 줄기가 1개인 이음은 «한 줄기 아래 갈래 수»에 가깝다.
- **절단 판정(T7)** — `--limit`(없으면 응답의 `request_detail.limit`)과 받은 경로 수를 견줘 `truncated`를 적는다. 모르면 «판정 불가».
- **검색량** — 묶음의 하한(가장 큰 값)과 상한(합)을 함께 둔다. 값이 없는 묶음은 0으로 바꾸지 않고 비운다 [데이터 공백].
  한국(`kr`)은 검색량이 **구글+네이버 합산**이다. 하한 행의 `gg_volume_avg` · `nv_volume_avg`를 `google_avg` · `naver_avg`로, 구글 비중
  (구글 ÷ (구글 + 네이버))을 `google_share`로 함께 적는다. 다른 국가는 이 세 열을 비운다. 한쪽 값이 비어도 합산 표기에 단서를 달지 않는다.
- **대표 경로** — 시드 뒤 상위 갈래 `--rep-paths`개(기본 3)에서 조건이 가장 많이 붙은 경로를 하나씩 고른다 [가정]. 다른 경로를 보려면
  `--pick "캠핑의자 > 접이식 의자 > 다이소 접이식 의자"`로 더한다.
- **SERP 대상** — 시드, 뒤 갈래 상위 `--branches`개(기본 5), 대표 경로의 검색어를 겹치지 않게 `E1…`으로 번호 붙인다.
- **비용 대조** — 실측 `total_cost`와 식 `50 + 40 × U`를 견줘 다르면 경고한다.
- `--context assets/context.json`을 주면 우리 · 경쟁 브랜드가 든 검색어에 `brand` 표시를 한다(빈 칸은 건너뛴다).
- **전년 비교 대상** — 시드, 뒤 갈래 상위 `--trend-branches`개, 앞 갈래 상위 `--trend-branches`개(기본 5 · 5 [가정])를 `T1…`로 `trend_targets.csv`에 적는다.

### STEP 3.5 · 작년 같은 시기와 비교 (월별 검색량)

```bash
python3 scripts/collect.py monthly --run work/read-search-context/<실행 ID> --targets work/read-search-context/<실행 ID>/out/trend_targets.csv
python3 scripts/check_refmonth.py work/read-search-context/<실행 ID>/out/monthly_targets.json --queried-at <조회일> --json > work/read-search-context/<실행 ID>/out/refmonth.json
python3 scripts/trend_yoy.py work/read-search-context/<실행 ID>/out/monthly_targets.json -o work/read-search-context/<실행 ID>/out/trend.csv --gate 3000
```

- `monthly`는 `keyword_info/monthly_volume(keywords=대상, gl)` 1회다(1 × 반환 행). 기간을 주지 않아 제공 범위 전체(최근 4년)가 온다 — 과금은 행 기준이라 기간을 줄여도 싸지지 않는다.
  돌아오지 않은 검색어는 [데이터 공백](과금되지 않는다), 요청하지 않은 표기 행은 과금되지만 집계에서 더하지 않는다(T5).
  `monthly`가 요청한 검색어의 행만 `out/monthly_targets.json`으로 따로 쓴다 — 두 공유 스크립트에는 이 파일을 넘긴다(원본에 넘기면 변형 행이 미완결 건수 · 순위에 섞인다).
- **기본으로 돈다.** 기본 대상 11개 · 약 11크레딧이라 견적에 늘 포함된다. 작년 비교가 요청에 없어도 돌리고, 사용자가 빼라고 하면 건너뛴다.
- **기준월과 지연(T1)** — `check_refmonth.py`가 응답의 최신 월을 데이터 기준월로 읽고 조회일과의 차이(지연)를 낸다. 조회일을 데이터 시점으로 쓰지 않는다.
  리포트 데이터 범위의 «최신 관측 월»과 경계 문장에 기준월이 적힌다.
- **마지막 달 미완결(T2)** — 최신 월이 전월보다 떨어졌는데 그 낙폭이 전년 같은 구간보다 30%p 이상 나쁘면 미완결을 의심한다.
  의심이면 «최신 달 제외 전년비»(`yoy_ex_last_month`)와 교차 확인하고, 최신 달만으로 «줄었다»고 쓰지 않는다.
  공유 규칙에 걸려도 최신 달을 넣은 전년비가 뺀 것보다 **높으면** 최신 달은 오히려 강한 것이다 — 리포트는 «미완결 근거가 약하다»로 따로 적고 미완결 건수(F15)에서 뺀다.
- **전년 동기(T3)** — `volume_trend` 필드는 쓰지 않는다. 최근 석 달 합과 전년 같은 석 달 합을 `monthly_volume`의 `total`로 직접 견준다.
- **기저 게이트(T4)** — 전년 같은 석 달 합이 게이트(기본 3,000건 [가정] · `--gate` · `build_report.py`에도 같은 값)보다 작은 검색어는
  «가장 크게 늘었다» 같은 순위 문장의 주어로 쓰지 않는다. 표에는 남기고 «게이트 미만»으로 표시한다.
- **결측 월(T6)** — 네이버 값이 없는 달(`nv_code: 1`)은 `total` 키가 없다. 0으로 채우지 않고, 비교 창에 결측 월이 있으면 그 검색어는 «계산 불가»로 남긴다.
- **창을 옮기면 방향이 바뀌는 검색어** — 최근 석 달과 «최신 달을 뺀 석 달»의 전년비 부호가 다르면
  계절의 꼭대기 · 바닥이 창 경계에 걸린 것이다. 리포트가 표시하고, 그 검색어는 늘었다 · 줄었다를 단정하지 않는다.
- 비교하는 것은 **검색량뿐**이다. 경로는 현재 시점 하나만 받았으므로 «작년엔 다른 검색으로 이어졌다»고 쓰지 않는다.
- 월별 검색량을 받지 않으면(예산 · 사용자 결정) 이 단계를 건너뛴다. 리포트는 «최신 관측 월: 확인 불가», 질문 Q5는 «조회하지 않음»으로 나온다.

### STEP 4 · 검색 결과 화면 근거

```bash
python3 scripts/collect.py serp --run work/read-search-context/<실행 ID> --targets work/read-search-context/<실행 ID>/out/serp_targets.csv
python3 scripts/serp_evidence.py --targets work/read-search-context/<실행 ID>/out/serp_targets.csv \
    --serp-dir work/read-search-context/<실행 ID>/raw/serp --out work/read-search-context/<실행 ID>/out/evidence.json
```

- `serp(keyword, gl, num=10)`를 대상마다 1회 부른다(30 × S). 남은 예산으로 부를 수 있는 수만 부르고, 못 부른 대상을 출력한다.
- `serp`는 요청 시점의 화면이 아니라 **저장된 화면**이다. 수집일(`collected_at`)을 근거마다 적고, 수집일이 검색어마다 다를 수 있다고 한계에 쓴다.
- 저장본이 없는 검색어는 빈 응답 · 비용 0 으로 온다 — [데이터 공백]이고 원장에는 `no_snapshot`으로 남는다. 다시 부르지 않는다.
- 근거 번호: `E2-AI`(AI 개요) · `E2-1`(1위). AI 개요는 문단과 목록(목록 안의 목록)을 모두 읽는다.

### STEP 5 · 해석 (에이전트가 쓰는 유일한 단계)

```bash
python3 scripts/build_report.py brief --run work/read-search-context/<실행 ID>
```

`out/brief.md`(사실 목록 · 앞뒤 검색 · 대표 경로 · 근거)를 읽고 `out/analysis.template.json` 모양대로 `analysis.json`을 쓴다.

- **숫자는 사실 ID로만** 쓴다(`{{F3}}` · `{{B1N}}` · 갈래 검색량 `{{B1V}}`). 문장에 숫자를 직접 적으면 렌더러가 멈춘다.
  **사실 ID는 단위까지 붙어 나온다**(`{{F3}}` → «100개») — 뒤에 «개» · «건» · «크레딧»을 다시 쓰지 않는다. 쓰면 `assemble`이 멈춘다.
  **조사는 단위에 맞춘다** — «건»으로 끝나면 `{{B1V}}으로` · `{{B1V}}은` · `{{B1V}}을` · `{{B1V}}과`, «개» · «%»는 `로` · `는` · `를` · `와`. 틀리면 `assemble`이 고칠 형태를 알려 주며 멈춘다.
- 작성 틀의 `headings`(섹션 헤딩) · `takeaways`(차트 한 줄 해석)는 선택이다. «(선택)»으로 둔 칸은 쓰지 않은 것으로 본다.
- 숫자가 든 검색어 · 제목은 문장에 옮기지 않고 경로 번호(`P1`)와 근거 번호(`E7-2`)로 가리킨다. 원문은 리포트의 표에 있다.
- 대표 경로마다 관측(`observed`) · 해석(`interpretation` — 무엇을 하려는 검색인가, 지금 검색 결과가 그 목적을 채우는가) · 대안 설명(`alternatives`) · 한계(`limits`)를 쓴다.
  해석은 [추정]이다. 근거 번호가 없는 경로는 한계에 «데이터 공백»을 밝힌다.
- 요약에는 **반대 근거**를 반드시 쓴다 — 절단, 줄기가 1개인 이음, 저장본 없는 검색어.
- "A 다음에 B 를 검색한다"는 집계된 인접 빈도다. «한 사람이 A 를 거쳐 B 로 갔다» · 전환율 · 이탈률 · 구매로 쓰지 않는다. 경로의 끝은 이탈이 아니라 세션 · 데이터의 끝일 수 있다.
- 줄기가 1개인 이음을 «가장 흔한 다음 검색»으로 단정하지 않는다.
- **경로 수와 검색량을 함께 본다.** 경로 수가 큰 갈래도 검색량(`{{B1V}}` …)이 작으면 수요가 작다 — 실행 카드의 우선순위는 둘을 견줘 정하고, 다르면 그 차이를 적는다
  (실행 평가에서 경로 수는 크고 검색량은 훨씬 작은 갈래를 앞에 둔 사례가 있었다).
- **구글 비중**(`{{B1G}}` …)은 결과물을 어디에 둘지(구글 · 유튜브 쪽인지 네이버 쪽인지) 정하는 근거로 쓴다. 검색량은 구글+네이버 합산으로 쓴다.
- **작년 비교 문장**은 증감률만 쓰지 않는다 — 전년 · 최근 합과 증감(`{{T1B}}` · `{{T1C}}` · `{{T1D}}`)을 전년비(`{{T1P}}`)와 함께 쓴다.
  최신 달 미완결 의심이면 «최신 달 제외 전년비»(`{{T1X}}`)로 교차 확인하고, 게이트 미만 검색어를 순위 문장의 주어로 쓰지 않는다. 검색 경로가 작년과 달랐다고 쓰지 않는다.
- AI 개요 · 검색 결과 문구 속 제품 설명 · 효과 · 수치는 옮긴 말이다. 사실처럼 단정하지 않는다(리포트 근거 표 위에 확인하지 않았다는 문장이 붙는다).
- 실행 카드는 3~5개, 담당은 콘텐츠·SEO · 퍼포먼스 마케터 · 브랜드·상품기획 중에서 쓴다. 맥락 파일이 있으면 `internal_metrics`의 지표 이름과 `guardrails`를 따른다.

### STEP 6 · 조립 · 렌더 · 맵

```bash
python3 scripts/build_report.py assemble --run work/read-search-context/<실행 ID> \
    --analysis work/read-search-context/<실행 ID>/analysis.json -o work/read-search-context/<실행 ID>/report.json
python3 scripts/render_report.py work/read-search-context/<실행 ID>/report.json -o work/read-search-context/<실행 ID>/report.html
python3 scripts/build_map.py --run work/read-search-context/<실행 ID> -o work/read-search-context/<실행 ID>/context_map.html
```

- `assemble`은 해석을 검사하고 어긋나면 조립하지 않는다(종료 코드 1): 대표 경로마다 카드가 있는가, 근거 번호가 저장된 근거에 있는가,
  반대 근거가 있는가, 실행 카드가 3~5개이고 조건 세 가지가 찼는가.
- `provenance`(호출 순서 · 조건 · 반환 수 · 비용 · 원본 파일)는 `calls.jsonl`에서 만든다 — 손으로 적지 않는다.
- 렌더러가 계약 위반(뼈대 순서 · 차트 메타 · 카드 필드 · 사실 목록을 거치지 않은 숫자 · 호출 기록 누락)을 막는다. 막히면 `analysis.json`을 고치고 다시 조립한다.
- 끝나면 사용자에게 **이번 실행의 크레딧 실측 합**(리포트 비용 보고서와 같은 값)과 견적 대비, 못 부른 대상, 절단 여부를 알린다.

## 산출물

아래 컬럼 · 키 목록은 스크립트의 실제 출력이다. 스크립트를 고치면 이 목록도 함께 고친다(`selftest_context.py`가 대조한다).

```
context_edges.csv
  position, depth, from_canonical, to_canonical, from_example, to_example,
  path_count, stem_count

context_nodes.csv
  canonical, example, variants, volume_avg, volume_avg_upper, volume_label,
  google_avg, naver_avg, google_share, brand,
  paths_with_keyword, stems_with_keyword, pre_seed_paths, post_seed_paths, min_depth

representative_paths.csv
  path_id, branch, path, length, branch_path_count, branch_stem_count, reason

serp_targets.csv
  code, keyword, canonical, reason

trend_targets.csv
  code, keyword, canonical, reason

evidence.json
  code, keyword, status, collected_at, aio, aio_refs, top

context_summary.json
  seed, seed_canonical, requested_limit, returned_paths, usable_paths, seed_paths,
  off_seed_paths, truncated, unique_keywords, unique_groups, variant_loops, stem_len,
  map_depth, actual_cost, formula_cost, volume_missing, seed_volume, time_point, gl, rules

calls.jsonl
  id, at, step, tool, params, purpose, returned, cost, raw, status, source, monthly_used
```

- `raw/metrics_1.json` …은 1,000개씩 나눠 받은 원본(원장이 가리키는 파일)이고, `raw/metrics.json`은 그것을 합친 파일이다 — 집계는 합친 파일을 읽는다.
- 그 밖에 `request.json` · `raw/`(원본 응답) · `out/context_tree.json`(맵용 갈래 구조) · `out/brief.md` · `out/facts.json` ·
  `report.json` · `report.html` · `report.calls.csv` · `report.cost.json` · `context_map.html`이 실행 폴더에 생긴다.
- `position`: `pre_seed`(시드 앞) / `post_seed`(시드 뒤) · `depth`: 시드에서 몇 걸음인가(네 걸음까지 [가정])
- `stem_count`: 그 이음이 나온 경로들의 서로 다른 줄기 수. `path_count`보다 작으면 같은 줄기의 갈래가 겹쳐 세어진 것이다
- `volume_avg`: 묶음 하한(가장 큰 값) · `volume_avg_upper`: 상한(합) · 값이 없으면 빈 칸 · `volume_label`: 4-Label
- `google_avg` · `naver_avg`: 하한 행의 구글 · 네이버 월 검색량(같은 최신 3개월 평균) · `google_share`: 구글 비중(%) — 한국만, 다른 국가는 빈 칸
- `status`(evidence): `ok` / `no_snapshot`(저장본 없음) / `not_called`(예산으로 부르지 않음) / `error`
- `monthly_used`: 응답의 `used_credits` — **월간 누적 사용량**이지 잔여량이 아니다

## 4-Label

| 라벨 | 이 스킬에서의 적용 |
|---|---|
| `[실제 데이터]` | 경로 원본 · 받은 경로 수 · 이음별 경로 수 · 단일 표기 검색어의 `volume_avg` · `monthly_volume`과 그 석 달 합 · 전년비 · 기준월과 지연 · 검색 결과 화면 원문과 수집일 · `cost_detail` |
| `[추정]` | 표기 묶음과 묶음 검색량(하한 · 상한) · 줄기 수 · 최신 달 미완결 의심 판정 · 대표 경로의 검색 목적 해석 · 실행 카드 · 견적 계획값 |
| `[가정]` | 경로 수(limit) · 네 걸음 · 단계별 상위 세 개 · 갈래 다섯 개 · 대표 경로 선정 규칙 · 줄기 길이 · 견적의 r · 전년 비교 대상 수 · 기저 게이트 · 비교 창 석 달 |
| `[데이터 공백]` | 검색량이 돌아오지 않은 검색어 · 월별 검색량이 돌아오지 않은 검색어 · 비교 창에 결측 월이 있어 계산 불가인 전년비 · 저장본 없는 검색 결과 화면 · 예산으로 부르지 않은 대상 · 시드를 지나지 않는 경로 · 빈 응답 |

수치를 인용하는 문장은 넷 중 하나에 속한다. 리포트의 사실 목록에는 사실마다 라벨이 붙는다.

## 한계

- **세션 인접만 잡는다.** 같은 세션에서 붙어 나온 검색의 집계이며 개인 추적이 아니다. 며칠에 걸친 고려 · 구매는 보이지 않는다
- **경로 수는 사람 수가 아니다.** 서로 다른 경로의 개수이고, 받은 경로(limit) 안에서의 값이다. 절단이면 비중을 «받은 경로 기준»으로만 말한다
- 검색은 관심 신호이지 구매가 아니다. 검색량 단위는 건이며 사람 수가 아니다
- **월 그레인 · 조회일과 데이터 시점이 다르다.** 기준월은 월별 검색량 응답에서 읽는다(STEP 3.5) — 월별 검색량을 받지 않으면 «확인 불가»다.
  주간 변화 감지에 쓸 수 없다. 최신 달은 아직 채워지는 중일 수 있다
- **전년 비교는 검색량만이다.** 경로는 조회 시점의 현재 스냅샷(`curr`)이고 실시간이 아니다. 지난 시점의 경로와 견주지 않는다.
  전년비는 계절 · 일시적 이슈를 구분하지 못한다 — 원인을 말하지 않는다
- **검색 결과 화면은 저장본이다.** 수집일이 검색어마다 다를 수 있고 지금 화면과 다를 수 있다. 저장본이 없는 검색어가 있다
- 검색 목적은 해석이다. 같은 경로를 다르게 읽을 수 있어 대안 설명을 함께 둔다. 원인을 설명하지 않는다
- 인구통계(성 · 연령)는 `path_finder`에 없다 — «20대 여성의 검색 맥락» 같은 요청은 받지 않는다
- 맵은 시드에서 네 걸음까지만 그린다. 그보다 긴 경로의 뒷부분은 원본(`raw/path.json`)에만 있다
- `mcp` 공급원의 호출 비용은 이 계약의 결정식과 다를 수 있다 — 응답에 비용이 없으면 사용자가 준 값을 원장에 적고 그 사실을 알린다

## 리포트

이 스킬의 HTML 리포트는 `references/report-contract.md`(렌더링 계약 정본 사본)를 따르고,
`scripts/render_report.py`(공통 렌더러)로만 만든다. 스킬은 **무엇을 넣을지**를 `report.json`으로 정하고,
뼈대 순서 · 차트 메타 · 카드 필드 · 숫자 추적 · 호출 기록은 렌더러가 검사한다.
`assets/report.example.json`은 이 스킬의 견본이다(합성 자료 `assets/fixtures/`로 조립한 것).
렌더하면 `report.html` 옆에 호출 로그(`report.calls.csv`)와 비용 보고서(`report.cost.json`)가 함께 나온다.

첫 화면 경계 문장(`boundary`): 시드를 지나는 경로 중 받은 경로(현재 시점)와 검색 결과 화면 저장본을 관측했고,
월별 검색량은 기준월까지 받았으며, 받지 않은 경로 · 지난 시점의 경로 · 구매 여부는 관측하지 못했다. 절단이면 «전체 경로가 아니다»가 붙는다.

| 섹션(`kind`) | 이 스킬이 넣는 것 | 쓰는 지표 · 차트 |
|---|---|---|
| `summary` 분석 요약 | 핵심 발견 1~3개 · 지지 근거 · 반대 근거 · 담당별 가능한 결정 | 사실 ID |
| `trend` 트렌드 분석 | 작년 같은 시기와 비교(Q5) — 기준월 · 지연 → 전년 같은 석 달 · 최근 석 달 · 증감 · 전년비 · 최신 달 제외 전년비 → 시드의 월별 계열(최근 12개월 · 그 전 12개월) | 표(`base` · `compare` · `abs_change` · `pct_change`) · 선 차트 한 개 |
| `structure` 관심 구조 | 시드 바로 앞뒤 검색(Q1) · 붙는 조건과 갈래(Q2) · 갈래별 검색 목적(Q3 — 발견 카드와 접어 둔 근거 표) | 경로 수 · 줄기 수 · 검색량 / 막대 차트 한 개 |
| `action` 기회와 실행 | 실행 카드 3~5개 — 가설 · 결과물 · 담당 · 내부 데이터 · 확대/수정/중단 조건(Q4) | 근거 사실 ID |
| `appendix` 근거 부록 | 질문별 상태 · 앞뒤 이음 전체 · 검색어와 검색량 · 계산 정의 + 사실 목록 · 호출 순서 · 비용 | 표 |

`report.json`의 `facts`(사실 목록)는 **스크립트의 저장 계산 결과**에서 만든다 — 문구의 숫자는 `{{ID}}`로만 쓴다.
`provenance.calls`(호출 순서 · 조건 · 반환 수 · 비용 · 원본 파일)는 **수집 스크립트의 원장**에서 만든다 — 손으로 적지 않는다.

호출 원장을 남기는 단계: STEP 1 · 2 · 3.5 · 4 — `collect.py`가 호출마다 원본 응답을 `raw/`에 저장하고 `cost_detail.total_cost`를 `calls.jsonl`에 쓴다.

데이터 범위 표의 «최신 관측 월»은 월별 검색량의 기준월, «비교 기간»은 전년 같은 석 달 · 최근 석 달(경로는 현재 시점 하나)로 적힌다.
STEP 3.5를 건너뛰면 «확인 불가» · «비교 없음»이다.
경로 맵(`context_map.html`)은 렌더링 계약 밖의 보조 파일이다 — 집계 결과만 보여 주고 해석 문장은 싣지 않는다.

```bash
python3 scripts/render_report.py report.json -o report.html     # 계약 위반이면 렌더하지 않는다
```

## 모의 실행 (크레딧 0)

환경변수 `LM_COLLECT_FIXTURES=<스킬 폴더>/assets/fixtures`를 주면 `collect.py`가 네트워크 대신 합성 응답을 읽는다.
위 STEP 1~6을 그대로 따라 리포트와 맵이 나오는지 볼 수 있다. 합성 자료의 숫자는 실제 조회 결과가 아니다.
