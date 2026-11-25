---
name: forecast-season-demand
description: |
  카테고리 시드 키워드(최대 5개)의 연관 검색어를 `intent_finder`로 모으고, 세그먼트 사전(themes.json)의
  규칙으로 세그먼트로 묶은 뒤, `keyword_info` 48개월 월별 검색량으로 세그먼트별 **다음 3 또는 6개월 수요
  (전년 같은 달 대비)**와 **준비·출시·캠페인·정점 월**을 낸다. 예측은 결정적 규칙(전년 같은 달 × 최근 전년비)이고
  일정은 과거 3년 계절 지수에서 규칙으로 뽑는다 — 모델이 숫자를 지어내지 않는다. 상품기획·MD·캠페인 담당자가
  시즌 일정과 물량을 정할 때 쓴다. 시장 kr · jp · us.

  "선크림 다음 시즌 수요 예측해줘" · "제습기 언제부터 준비해야 돼?" · "패딩 캠페인 몇 월에 시작하는 게 맞아?" ·
  "앞으로 6개월 ○○ 검색 수요 전년보다 늘어?" · "시즌 캘린더 뽑아줘" · "출시 타이밍 잡아줘" ·
  "세그먼트별로 언제 피크인지 보고 싶어" · "겨울 상품이랑 여름 상품 일정 따로 봐야 해?"
  같은 요청이면 이 스킬을 쓴다.

  사용자가 "예측"이라는 말을 쓰지 않아도, **언제 준비하고 언제 팔지(시점)나 다음 몇 달의 규모를 검색량의
  계절 반복으로 답해야 하는 요청**이면 켠다 — 시즌 기획전 일정, 재고 선매입 시점, 계절 콘텐츠 발행 달.

  경계: «지금 막 뜨기 시작한 검색어·이슈»(급부상 신호 · 가속도)는 `spot-trends` — 이 스킬은 반복되는 계절과
  최근 전년비를 앞으로 옮길 뿐, 새로 뜨는 것을 찾지 않는다. «카테고리 검색어를 빠짐없이 모으기»(유니버스 확장 ·
  커버리지 판정)는 `map-your-market` — 이 스킬의 풀은 시드별 연관 검색어 상위 표본이고 수렴을 판정하지 않는다.
  세그먼트 간 점유·브랜드 경쟁은 다루지 않는다.
license: MIT
metadata:
  version: "0.1.1"
---

<!-- lm-skill: kind=task; connectors=intent_finder,keyword_info; flags=monthly,expand,report; traps=T1,T2,T3,T4,T5,T6,T7 -->

# Forecast Season Demand — 시즌 수요 예측과 일정

> **핵심 원칙**: 계절 카테고리의 다음 몇 달은 «작년 같은 달»이 가장 강한 근거다. 그 위에 **최근 전년비 하나**만
> 얹고, 그 가정이 틀릴 때의 범위와 과거에 같은 규칙이 얼마나 빗나갔는지를 함께 적는다.
> 그리고 카테고리 합계의 일정은 **정점이 다른 세그먼트**(여름 선크림 ↔ 겨울 스키 선크림)를 가린다 — 일정은 세그먼트별로 낸다.
>
> 이 스킬이 답하는 것: "다음 3·6개월 이 카테고리(와 세그먼트) 검색 수요는 전년보다 얼마나, 언제 준비해서 언제 정점인가."
> 답하지 않는 것: 판매량 · 시장 규모 · 새로 뜨는 검색어 · 브랜드 점유.

## 데이터 계약

이 스킬은 `references/lm-data-contract.md`(정본 사본)를 따른다. 해당 함정과 처리 위치:

| 함정 | 처리 위치 | 상태 |
|---|---|---|
| T5 표기변형 canonical 정규화 | STEP 3 (풀 묶음) · STEP 4 (같은 검색 병합) · STEP 6 (하한·상한) | ✅ |
| T1 기준월·지연 3종 표기 | STEP 5.5 · STEP 6 (결과 머리 · 리포트 경계 문장) | ✅ |
| T2 마지막 달 완결성 점검 | STEP 5.5 (`check_refmonth.py`) · STEP 7 (기본 제외 · 두 모드 «잠정») | ✅ |
| T3 volume_trend 대신 전년 동기 비교 | STEP 7 (비율 · 예측 전부 `monthly_volume` 전년 같은 달) | ✅ |
| T4 기저 볼륨 게이트 | STEP 4 (스크린) · STEP 7 (세그먼트 비율 `--gate` · 순위 제외) | ✅ |
| T6 결측 월 처리 | STEP 6 (계산 창 37개월 모집단 고정) | ✅ |
| T7 절단(limit) 검사 — 절단이면 수렴 판정 보류 | STEP 2 · STEP 3 (`collect_pool.py` 절단 판정 → 범위 · 한계) | ✅ |

> 이 표는 선언이다. 실제 처리는 아래 STEP 본문에 있다.

## 커넥터와 크레딧

| 커넥터 | 용도 | 크레딧 결정식 |
|---|---|---|
| `intent_finder` | 시드마다 연관 검색어 풀 (STEP 2) | `30 × 1 + 2 × 반환` (시드마다 한 호출) |
| `keyword_info` (`ads_metrics`) | 풀 전량 볼륨 스크린 (STEP 4) | `1 × N` |
| `keyword_info` (`all`) | 스크린 통과분 48개월 월별 검색량 (STEP 5) | `10 × K` |

`ads_info`도 쓸 수 있다(계약 §1 v1.3) — 시계열만 필요한 조회는 `ads_info`로 받아도 된다. 단가가 환경마다 달라(명세 1 · 관측 10 · 1) 첫 호출 `cost_detail`로 확인하고, 아래 결정식의 `all` 단가 10 자리에 확인한 값을 쓴다(확인 전 상한 10). `intents`·`features`·`demography`를 읽는 조회는 `all`을 쓴다. 이 스킬은 시계열만 읽으므로 `ads_info` 단가가 1로 확인된 환경에서는 `--max-k` 상한을 비용 때문에 좁힐 필요가 없다.

### 예산 (결정식 · 호출 전에 사용자에게 제시)

```
총 크레딧 = 30 × S + 2 × R + 1 × N + 10 × K

S = 시드 수 (1~5)              R = intent_finder 반환 합 (≤ S × limit)
N = 풀 크기 — canonical 묶음 · 범위 밖 제외 뒤 (≤ S + R)
K = all 조회 수 — 스크린 통과분 (≤ max-k + S · 시드는 게이트와 무관하게 넣는다)

호출 전 상한 = 30 × S + 2 × S × L + 1 × S × (L + 1) + 10 × (K_max + S)
```

기본값(`limit` L = 100 · `--max-k` K_max = 80 `[가정]`)의 상한: 시드 1개 30 + 200 + 101 + 810 = **1,141** ·
시드 2개 60 + 400 + 202 + 820 = **1,482** · 시드 5개 150 + 1,000 + 505 + 850 = **2,505**.

**2단 조회가 총액을 지배한다.** 풀 전량에 `all`을 걸면 시드 2개 기준 `10 × 202 = 2,020`이다. 스크린으로 82개만 사면
`202 + 820 = 1,022` — 차액 998은 이 분석 상한의 67%다. 예산이 빠듯하면 `--max-k`를 먼저 줄인다(예측에 들어가는
검색량 비중 `screened_share`가 함께 줄어드는 것을 확인한다). `limit`을 줄이는 것은 그 다음이다.

실소비는 응답 `cost_detail.total_cost` 합이 유일한 기준이다. 각 스크립트가 결정식과 cost_detail을 대조하고 다르면
«환경 단가 확인»을 띄운다. 합성 픽스처 실행 예: 시드 2 · 반환 27 · 풀 21 · `all` 18 → `60 + 54 + 21 + 180 = 315`.
계정 사용량 API는 다른 세션 소비가 섞이므로 이 분석의 소진량으로 쓰지 않는다. 풀이 1,000개를 넘으면 `keyword_info`를
나눠 부르고 계약 §1 «응답 병합»대로 한 파일로 합쳐 넘긴다(과금은 같다).

## 번들 자산

| 파일 | 하는 일 | 쓰는 곳 |
|---|---|---|
| `scripts/collect_pool.py` | **intent_finder 응답 → 풀 · 절단 판정 · canonical 묶음 · 범위 밖 제외 · 원장 기록** (이 스킬 고유) | STEP 2~3 |
| `scripts/screen_volume.py` | **ads_metrics 스크린 → all 요청 목록 · 미반환 · 같은 검색 병합 · 예측 포함 비중 · 원장 기록** (이 스킬 고유) | STEP 4 |
| `scripts/forecast_segments.py` | **세그먼트 묶기 · 모집단 고정 · 예측 · 범위 · 점검 · 계절 지수 · 일정 · 역위상 · 원장 기록** (이 스킬 고유) | STEP 6~8 |
| `scripts/forecast_core.py` | 예측 · 계절 · 일정 규칙(순수 함수 · 임계 상수) — 위 스크립트와 selftest가 import (이 스킬 고유) | STEP 7~8 |
| `scripts/ledger.py` | 수집 원장(`ledger.json`) 읽기 · 쓰기 — 호출 한 줄 = 원본 파일 하나 (이 스킬 고유) | STEP 2·4·5 |
| `scripts/build_report.py` | 결과 + 원장 → `report.json`(사실 목록 · 섹션 · 카드 · `provenance.calls`) (이 스킬 고유) | STEP 10 |
| `scripts/render_report.py` | 공통 렌더러 — 계약 위반이면 렌더하지 않는다 (공유) | STEP 10 |
| `scripts/check_refmonth.py` | 데이터 기준월 · 지연 · 마지막 달 완결성 (공유) | STEP 5.5 |
| `scripts/series_dedup.py` | canonical · 완전 중복 행 · 같은 검색의 중복 판정 (공유 — 위 스크립트가 import) | STEP 3~6 |
| `scripts/trend_yoy.py` | 검색어 단위 전년 동기 교차확인 (공유 · 선택) | STEP 9 |
| `scripts/build_universe.py` · `coverage_curve.py` | 공유 사본 — 이 스킬 절차에서는 쓰지 않는다(유니버스 · 커버리지는 `map-your-market`) | — |
| `scripts/selftest.py` · `selftest_render.py` | 공유 스크립트 · 렌더러 계약 검증 + `selftest_*.py` 실행 | 스킬 수정 후 |
| `scripts/selftest_forecast.py` | 이 스킬 고유 회귀 검사(T1~T7 · 역위상 · 컬럼 대조 · 리포트) | 스킬 수정 후 |
| `assets/themes.json` | 세그먼트 사전 작성 예(선크림 · kr) — 카테고리마다 복사해 새로 쓴다 | STEP 3 |
| `assets/themes.template.json` · `references/themes-schema.md` | 사전 견본 · 스키마(공유) | STEP 3 |
| `assets/fixtures/*.json` | 합성 응답(선크림 모양 · 기준월 2026-10) — selftest 전용 | 스킬 수정 후 |
| `assets/report.example.json` | 이 스킬 리포트 견본 — 픽스처로 `build_report.py`가 만든 것 | selftest |

## 사전 확인

시작 전에 넷을 확정한다. 하나라도 비면 `intent_finder`를 부르지 않는다 — 확장이 크레딧의 첫 덩어리이고, 시드가 바뀌면 풀 전체가 바뀐다.

1. **gl 단일 확정** — `kr` · `jp` · `us` 중 하나. 국가마다 계절이 다르다(남반구 시장은 이 키트 범위 밖). 여러 국가면 국가별로 따로 돈다.
2. **카테고리 경계 한 문장** — 예: "선크림 = 얼굴·바디 자외선 차단 제품. 태닝·애프터선은 밖." 이 문장이 STEP 3의 `exclude` 패턴이 된다.
3. **시드 1~5개** — 사용자가 주면 그대로 쓴다. 안 주면 STEP 1 절차로 만들고 확인받는다. 6개 이상이면 줄인다(스크립트가 거부한다).
4. **예측 기간 3 또는 6개월** — 말이 없으면 6. 6개월 안에 정점이 없는 카테고리도 일정(다음 정점)은 낸다.

## 실행 순서

### STEP 0 · 요청 해석

카테고리 · gl · 기간 · 쓰임(물량 · 출시 · 캠페인 · 콘텐츠)을 확인한다. 쓰임은 리포트 실행 카드의 초점을 바꾼다.
«요즘 뭐가 뜨나»면 `spot-trends`, «검색어 전부 뽑아줘»면 `map-your-market`으로 보낸다. 시드 없이 «건강식품 언제 팔아?»처럼
경계가 넓은 발화는 바로 돌리지 않고 경계와 시드를 먼저 정한다.

### STEP 1 · 시드 확정 — 결과를 결정하는 입력이므로 절차를 남긴다

시드가 없으면 다음 순서로 **최대 5개**를 만든다. 축이 다른 수요(계절이 다른 사용 상황)를 하나는 넣는다 — 그래야 역위상 세그먼트가 풀에 들어온다.

| 축 | 뜻 | 예 (선크림 / kr) | 예 (제습기 / kr) |
|---|---|---|---|
| 코어 | 카테고리 지칭 그 자체 | 선크림 | 제습기 |
| 제형·형태 | 대표 하위 제품 | 선스틱 | 미니 제습기 |
| 다른 시즌 상황 | 주 시즌 밖의 쓰임 | 스키 선크림 | 겨울 결로 |

`seeds.json`(문자열 배열)으로 저장하고 산출물에 동봉한다. 시드를 지어낸 근거(축)를 리포트 범위의 «검색어 선정»에 적는다.

### STEP 2 · 연관 검색어 수집 (intent_finder)

```python
intent_finder(keyword=seed, gl="kr", limit=100, sort="volume_avg", order="desc")
# 시드마다 한 호출 · 30 × 1 + 2 × 반환 · 응답을 raw/if_<시드>.json 으로 저장한다
# 저장할 때 "_saved_at": "YYYY-MM-DD HH:MM" 을 붙이면 원장 시각으로 쓴다(없으면 파일 수정 시각)
```

`limit`은 `[가정]` 100이다. 응답 `request_detail`에 limit이 없으면 명령에서 `파일@limit`로 붙인다.

### STEP 3 · 풀 만들기 · 범위 밖 제외 · 표기변형 묶기

먼저 `assets/themes.json`을 복사해 이 카테고리의 사전을 쓴다(스키마 `references/themes-schema.md` + 이 스킬이 더한 `exclude`).
반환 검색어를 훑어 **카테고리 경계 밖 패턴**을 `exclude.pattern`에, 세그먼트 축을 `themes`에 쓰고 사용자에게 보여 확인받는다.
모델이 검색어를 하나씩 «관련 있음/없음»으로 판정하지 않는다 — 규칙(정규식)으로만 뺀다. 그래야 다시 돌려도 같은 풀이 나온다.

```bash
python3 scripts/collect_pool.py --seeds seeds.json --gl kr \
    --intent raw/if_선크림.json@100 --intent raw/if_선스틱.json@100 \
    --themes themes.json -o pool.json --csv pool.csv --ledger ledger.json
```

- **T7 절단**: 호출마다 `반환 수 ≥ limit`이면 «절단»이다. 그 시드의 연관 검색어는 상위 limit개에서 잘렸고, 풀은 **표본**이다.
  이 스킬은 수렴(«카테고리 검색어를 다 모았다»)을 판정하지 않는다 — 절단이 있으면 리포트 범위와 반대 근거에 «잘린 시드»를 적고,
  수요 합계를 «수집된 검색어 기준»으로만 쓴다. limit을 모르면 «미상 [데이터 공백]»으로 남는다. 다 모아야 하는 질문이면 `map-your-market`.
- **T5 표기변형**: `series_dedup.canon`(NFKC · 소문자 · `rules.변형치환` · 공백 제거)으로 같은 canonical을 한 줄로 묶는다.
  대표는 먼저 나온 표기(시드 우선)이고, 묶인 표기는 `pool.csv`에 «표기변형 → 대표»로 남아 `keyword_info`에 따로 보내지 않는다(1크레딧씩 아낀다).
- `exclude.pattern`에 걸린 검색어는 «범위 밖»으로 남는다. 패턴을 고치면 이 명령만 다시 돌린다(0크레딧 · 원장은 같은 원본이면 덮어쓴다).
- **수집 원장**: 이 단계에서 `ledger.json`에 intent_finder 호출마다 한 줄(조건 · 반환 수 · `cost_detail.total_cost` · 원본 파일 · 시각)이 쓰인다.

**세그먼트 사전 쓰는 법** — `themes[].pattern`은 canonical에 대한 정규식이고 **배열 순서로** 세그먼트가 정해진다(처음 걸린 테마).
계절이 다른 수요(겨울·레저)를 맨 위에 둔다 — 아래쪽 테마(제형)가 먼저 잡으면 «스키 선스틱»이 여름 세그먼트에 묻혀 역위상이 안 보인다.
세그먼트는 6개 이내 `[가정]`로 둔다 — 많으면 세그먼트마다 기저가 작아져 STEP 7 게이트에 걸린다. 아무 테마에도 안 걸리면
브랜드 유무로 `no_match.with_brand` / `without_brand` 세그먼트가 된다.

### STEP 4 · 볼륨 스크린 (keyword_info `ads_metrics`)

```python
keyword_info(keywords=pool, gl="kr", data_type="ads_metrics")   # 1 × N · raw/ads_metrics.json
```
```bash
python3 scripts/screen_volume.py raw/ads_metrics.json --pool pool.json --seeds seeds.json \
    --min-total 1200 --max-k 80 --themes themes.json -o all_request.json --csv screen.csv --ledger ledger.json
```

- 통과 = `volume_total`(최신 12개월 합, 계약 §2) ≥ `--min-total` 1,200 `[가정]`을 큰 순서로 `--max-k` 80개까지 `[가정]` + 시드 전부.
  스크린은 비용을 줄이는 1차 거름(T4의 1단)이고, 판정 게이트는 STEP 7에서 세그먼트 비율에 다시 걸린다.
- 응답 키워드는 요청 문자열과 다를 수 있어 canonical로 대조한다. 요청했는데 응답에 없으면 «미반환» `[데이터 공백]`으로 남긴다(0으로 두지 않는다).
- 응답 안의 완전 중복 행은 먼저 합치고(`collapse_identical`), volume_total · CPC · 경쟁도가 모두 같고 토큰이 겹치는 검색어는 같은 검색으로 보고
  «같은 검색 병합 → X»로 한 번만 보낸다(T5 ① · 10크레딧씩 아낀다).
- `screened_share`(통과분 ÷ 측정된 풀, volume_total 기준)를 출력한다. 예측에 들어가는 검색량이 풀의 몇 %인지다 `[추정]` —
  낮으면(예: 70% 미만) `--max-k`를 늘릴지 사용자와 정한다.
- 원장에 ads_metrics 호출 한 줄이 더해진다.

### STEP 5 · 48개월 조회 (keyword_info `all`)

```python
keyword_info(keywords=all_request, gl="kr", data_type="all")   # 10 × K · raw/kw_all.json
```

`all`은 `monthly_volume`(최장 48개월)을 준다. `ads_metrics`(1/kw)에는 시계열이 없다. 과금은 요청 키워드 수다 —
응답에서 빠진 키워드도 과금되고, 요청하지 않은 표기변형은 무과금으로 함께 온다(STEP 6에서 처리).

### STEP 5.5 · 데이터 기준월 확인 ⚠️ 생략 금지

```bash
python3 scripts/check_refmonth.py raw/kw_all.json --queried-at 2026-11-19 --json > refmonth.json
```

- **T1**: 기준월 = `monthly_volume`의 `month` 최댓값(배열 순서를 가정하지 않는다). 리포트 머리에 **`데이터 기준월 / 조회일 / 지연`**을 적는다.
  예측의 첫 달은 조회월이 아니라 **기준월 + 1**이다 — 지연이 1개월이면 6개월 예측의 첫 달은 조회일에 이미 진행 중이다.
  `forecast_segments.py`가 그 달 수(`horizon_elapsed_at_query`)를 세고, 리포트 경계 문장에 «그중 N개월은 이미 지났거나 진행 중»으로 넣는다.
  조회일을 데이터 시점으로 쓰면 «다음 6개월»이 실제로는 «5개월 + 지난 1개월»이 된다.
- **T2**: 같은 명령이 최신 월 MoM을 전년 같은 구간과 대조해 «미완결 의심» 행을 센다(하락 + 전년보다 30%p 이상 나쁨).
  이 출력(`refmonth.json`)을 STEP 6에 넘긴다 — 넘기지 않으면 `forecast_segments.py`가 멈춘다. 점검 없이 가려면 `--no-refmonth-check`
  (리포트에 «미점검 [데이터 공백]»). 기준월이 섞여 있으면(`mixed_ref_months`) 같은 날 다시 조회한다.

### STEP 6 · 세그먼트 묶기와 모집단 고정

```bash
python3 scripts/forecast_segments.py raw/kw_all.json --themes themes.json --horizon 6 \
    --queried-at 2026-11-19 --requested all_request.json --refmonth-check refmonth.json \
    --ledger ledger.json [--gate 3000] [--window 3] [--include-last-month] -o out/
```

검색어마다 `keywords.csv`의 `status`가 하나 붙는다. **«사용»만 합계에 들어간다.**

| `status` | 뜻 | 처리 |
|---|---|---|
| `사용` | 계산 창 전 달에 값이 있다 | 세그먼트 하한 · 상한에 들어간다 |
| `표기변형 — 상한에만 (하한 대표 X)` | 같은 canonical의 다른 표기 — 같은 검색인지 응답이 알려주지 않는다 | 상한(`next_total_upper`)에만 (T5 ②) |
| `같은 검색의 중복` | 시계열이 완전히 같다(어순 · 표기가 달라도) — `dup_of` | 한 번만 센다 (T5 ①) |
| `결측 월 — 계산 불가` | 계산 창 안에 `nv_code` 결측(= `total` 키 없음)이 있다 | 모든 합계에서 뺀다 (T6) |
| `이력 부족 — …` | 계산 창의 달이 응답에 없다(신생 검색어) | 모든 합계에서 뺀다 (T6) |
| `요청 외 반환` | 요청하지 않았고 canonical도 요청 목록에 없다 | 뺀다 — 범위가 새지 않게 |
| `미반환` | 요청했는데 응답에 없다 `[데이터 공백]` | 행만 남긴다 |
| `범위 밖` | `exclude.pattern` | 뺀다 |
| `시계열 없음` | `monthly_volume`이 없다(`ads_metrics`만 받음) | 뺀다 |

- **T6 모집단 고정**: 계산 창은 기준월로 끝나는 **37개월**(계절 프로파일 36개월 + 기준월)이다. 비율 · 범위 · 점검 · 계절 지수가 모두 이 창 안에서 계산되므로,
  창에 결측이 하나라도 있는 검색어는 **모든** 합계에서 뺀다 — 창마다 모집단이 달라지면 연도 간 비교가 틀린다(계약 T6). 결측을 0으로 채우지 않는다.
  뺀 검색어는 결과 `excluded_missing`과 리포트 범위 «누락»에 수와 함께 적힌다.
- **T5**: 같은 canonical 묶음 안에서 최근 12개월 평균이 가장 큰 표기 하나가 하한 대표다. 세그먼트 예측 · 순위는 **하한 기준**이고 상한은
  `next_total_upper`에 병기한다 `[추정]`. 상한과 하한의 순위가 뒤집히면 리포트에 그 사실을 적는다.
- 세그먼트 = themes 패턴의 첫 매칭(배열 순서). 걸린 테마 전부는 `facets`에 남는다.

### STEP 7 · 예측 (결정적 규칙)

세그먼트마다 하한 시계열(월별 합)에 같은 규칙을 적용한다. 카테고리 예측은 **세그먼트 예측의 합**(아래에서 위로)이다 — 세그먼트가 더해서 카테고리가 된다.

```
예측(기준월 + k) = 전년 같은 달 실측 × r                       k = 1..H (H = 3 또는 6)
r = 최근 W개월 합 ÷ 전년 같은 W개월 합                         W = 3 [가정] · 창 끝 = 기준월 − 1 (마지막 달 제외 · 기본)
범위 = 전년 같은 달 × [min, max]{ r, 다른 모드 r(마지막 달 포함), 12개월 r }
예측 전년비 = 예측 합 ÷ 전년 같은 달 합 − 1  (세그먼트에서는 정의상 r − 1 이다 — 최근 전년비가 이어진다는 가정 그 자체)
```

- **T3**: 비율 · 예측 · 범위 · 점검이 모두 `monthly_volume`의 **전년 같은 달**과 비교한다. `volume_trend`는 `keywords.csv`의 `volume_trend_ref`
  참고 컬럼으로만 옮기고 어떤 계산에도 쓰지 않는다(30개 집계 창 어디와도 일치하지 않았다 — 계약 §2). selftest가 이 필드를 바꿔도 결과가 같은지 본다.
- **T4 기저 게이트**: 세그먼트 r의 전년 W개월 합이 `--gate` 3,000 `[가정]` 미만이면 r을 쓰지 않고 **r = 1(전년 그대로)**로 두며
  `gated` = 예, `r_note` = «기저 게이트 미달». 이런 세그먼트는 표에만 두고 «가장 크게 오른다» 같은 **순위 문장의 주어로 쓰지 않는다**
  (`rank_pct` · `rank_abs` 빈칸 · 리포트 D2가 제외 목록을 적는다). 12개월 r의 게이트는 `gate × 12 ÷ W`다. 전년 합이 0이면 «계산 불가 — r=1».
- **비율 상·하한**: r은 [0.5, 2.0] `[가정]`으로 자른다(`r_note` = «비율 상·하한 적용(원래 r=…)»). 신생 검색어 몇 개가 세그먼트 r을 수 배로 부풀리는 것을 막는다.
- **T2 마지막 달**: 기본은 기준월(마지막 달)을 비율 창 · 계절 프로파일에서 뺀다 — 집계가 아직 차는 중일 수 있다(계약 T2: 하루 사이에 크게 정정된 사례가 있다).
  다른 모드(포함)의 r도 계산해 `r_other_mode`에 두고, 두 r의 방향(1보다 큰가 작은가)이 갈리면 `provisional` = «잠정»이다.
  리포트 «반대 근거»에 잠정 세그먼트가 자동으로 적힌다. `--include-last-month`로 주 모드를 뒤집을 수 있다 — 그때는 리포트에 명시한다.
  **트레이드오프**: 한 달 늦은 흐름을 쓰는 대신 방향이 뒤집히지 않는다.
- **점검(1회 홀드아웃)**: 비율 창 끝에서 H개월 앞당긴 시점을 기준으로 같은 규칙을 적용해, 그 뒤 H개월 실측 합과 비교한다.
  `backtest_err` = 예측 합 ÷ 실측 합 − 1, `backtest_naive_err`는 r = 1(순수 «작년 같은 달»)의 오차다. |오차| > 25% `[가정]`이면 `quality` = «참고».
  한 번의 점검이라 오차 분포가 아니다 — «이 규칙이 작년에 이 정도 빗나갔다»는 크기 감각으로만 쓴다 `[추정]`.

### STEP 8 · 계절 지수 · 일정 · 역위상

계절 프로파일은 비율 창 끝에서 거꾸로 자른 **12개월 블록 3개**(달력 해가 아니다)로 만든다.

```
지수(달) = 블록마다 (그 달 값 ÷ 블록 월평균)의 평균                     [실제 데이터에서 직접 계산]
정점 = 지수 최대 달 · 정점 반복 = 블록 정점이 ±1개월 안에 든 블록 수(peak_consistency x/3)
유형 = 계절형(정점 지수 ≥ 1.3 이고 반복 ≥ 2/3) · 불규칙(≥ 1.3 이지만 반복 < 2/3) · 상시형(< 1.3)   [가정]
상승 시작 = 정점에서 거꾸로 지수 ≥ 1.0 이 이어지는 첫 달 (정점 혼자면 정점 − 1)                [가정]
준비 = 상승 − 2개월 · 출시 = 상승 − 1개월 · 캠페인 시작 = 상승 · 시즌 끝 = 정점 뒤 처음 지수 < 1.0 인 달   [가정]
```

- 날짜는 **조회월 이후 처음 오는 정점**을 기준으로 단다. 조회월과 비교해 `status`가 붙는다: «준비 가능»(조회월 ≤ 준비) · «준비 촉박»(≤ 출시) ·
  «캠페인 시작 시점 (출시 시점 지남)»(≤ 상승) · «시즌 진행 중». `peak_in_horizon` = 정점이 예측 기간 안에 드는가.
  리드타임(준비 2개월 · 출시 1개월)은 업종마다 다르다 — 사용자가 주면 그 값으로 읽어 고쳐 말한다(숫자는 리포트 표의 날짜에서 옮긴다).
- 상시형은 일정을 내지 않는다(«일정 없음 — 상시형»). 불규칙은 일정을 «참고»로 낸다.
- **역위상**: 계절형 세그먼트의 정점이 카테고리 정점과 **3개월 이상** `[가정]` 떨어지면 `anti_phase` = 예. 카테고리 합계 일정으로는 그 세그먼트의 시즌을 놓친다.
  계절형 세그먼트들의 정점이 갈리는데 카테고리 합계가 상시형으로 나오면 «합계가 계절을 상쇄했다» 경고가 붙는다(제습기 ↔ 가습기를 한 카테고리로 묶은 경우).

### STEP 9 · 교차확인과 해석

- 상위 세그먼트의 대표 검색어 몇 개를 `trend_yoy.py raw/kw_all.json`으로 다시 계산해, 검색어 단위 전년비가 세그먼트 r과 같은 방향인지 본다.
  한 검색어가 세그먼트 r을 끌고 가면(세그먼트 최근 합의 절반 이상) 그 사실을 적는다.
- 예측이 왜 그렇게 나왔는지(원인)는 검색량이 답하지 못한다. 이슈 · 신제품 같은 설명은 `[추정]` 가설로만 쓰고, 급부상 여부가 궁금하면 `spot-trends`를 권한다.
- 수치를 고쳐 쓰지 않는다. 사용자가 다른 가정(예: 올해는 전년 그대로)을 원하면 `--window`나 r의 근거를 바꿔 다시 돌린다(0크레딧).

### STEP 10 · 리포트

```bash
python3 scripts/build_report.py out/forecast_result.json --ledger ledger.json --category 선크림 \
    --estimate 1482 -o report.json
python3 scripts/render_report.py report.json -o report.html     # 계약 위반이면 렌더하지 않는다
```

`--estimate`에는 호출 전에 제시한 상한(위 결정식)을 준다. 해석 문장은 `build_report.py`가 규칙으로 고른 틀 문장이고 `[추정]`이 붙어 있다.
에이전트가 문장을 다듬을 때도 숫자는 `{{ID}}`로만 쓰고 라벨을 지우지 않는다 — 새 숫자가 필요하면 사실을 결과 파일에서 만들어 `facts`에 넣는다.

## 산출물

아래 컬럼 목록은 스크립트의 실제 출력이다(`selftest_forecast.py`가 이 목록과 실제 헤더를 대조한다). 스크립트를 고치면 이 목록도 함께 고친다.

```
pool.csv   (collect_pool.py)
  keyword, canonical, rep, origin_seeds, first_rank, status, exclude_match
pool.json   — ads_metrics 요청 목록(status = 포함인 대표 표기)

screen.csv   (screen_volume.py)
  keyword, canonical, response_keyword, volume_total, volume_avg, screen, dup_of, rank
all_request.json   — all 요청 목록이자 forecast_segments.py --requested 입력

keywords.csv   (forecast_segments.py)
  keyword, canonical, dup_of, segment, facets, brand, status, avg_12m, yoy_12m,
  missing_in_window, first_active_month, volume_trend_ref

segment_forecast.csv   (세그먼트 행 + 마지막 행 «카테고리 합계»)
  segment, n_keywords, n_variants_upper, avg_12m, ratio_window, recent_sum, prior_sum,
  r_used, r_note, r_other_mode, r_12m, next_total, next_total_last_year, next_yoy,
  next_abs_change, next_lo, next_hi, next_total_upper, backtest_err, backtest_naive_err,
  quality, gated, provisional, rank_pct, rank_abs

forecast_monthly.csv
  segment, month, last_year_month, last_year, forecast, forecast_lo, forecast_hi

season_calendar.csv
  segment, season_type, peak_month, peak_consistency, peak_index, amplitude, ramp_month,
  prep, launch, campaign_from, peak, end, status, peak_in_horizon, anti_phase

forecast_result.json   — meta(기준월 · 조회일 · 지연 · 예측 달 · 이미 지난 달 수 · 마지막 달 모드 · 창 · 게이트 · 규칙 상수 ·
                         refmonth 점검 · 상태별 검색어 수 · 미반환 · 결측 제외) · segments[] · category · warnings · ledger_steps
ledger.json   — 수집 원장: calls[](id · step · at · tool · params · purpose · returned · cost · cost_source · formula · raw ·
                data_through · status) · steps.collect(절단 · 범위 밖 · 결정식 대조) · steps.screen(스크린 건수 · screened_share)
report.json → report.html · report.calls.csv · report.cost.json   (build_report.py → render_report.py)
```

컬럼 뜻 — `origin_seeds` 그 검색어를 돌려준 시드(« / ») · `first_rank` 처음 나온 응답 순위(시드는 0) · `rank`(screen) volume_total 순위 ·
`yoy_12m` 최근 12개월 ÷ 그 전 12개월 − 1(전 12개월 합 < 게이트면 빈칸) · `missing_in_window` 계산 창의 결측 · 없는 달 수 ·
`ratio_window` r의 최근 창 vs 전년 창 · `recent_sum`/`prior_sum` 그 두 창의 하한 합 · `next_lo`/`next_hi` 범위 ·
`next_total_upper` 표기변형 상한 시계열에 같은 r을 곱한 합 · `rank_pct`/`rank_abs` 게이트 통과 세그먼트 안의 증감률 · 절대 증감 순위 ·
`peak_index` 정점 달 지수 · `amplitude` 최대 ÷ 최소 지수 · `ramp_month` 상승 시작 달(달력 월).
날짜 칸(`prep` · `launch` · `campaign_from` · `peak` · `end`)은 `YYYY-MM`이다.

## 4-Label

| 라벨 | 이 스킬에서의 적용 |
|---|---|
| `[실제 데이터]` | `monthly_volume` 월별 값 · 전년 같은 달 합(`next_total_last_year` · `last_year`) · 최근/전년 창 합 · 계절 지수와 블록 값(직접 계산) · intent_finder 반환 검색어 · `volume_total` · 기준월 |
| `[추정]` | 예측값 · 예측 전년비 · 범위(`next_lo`~`next_hi`) · 표기변형 하한~상한 · 같은 검색의 중복 · 같은 검색 병합 · 점검 오차의 해석 · 예측 포함 비중(`screened_share`) · 카테고리 = 세그먼트 합 · 리포트의 해석 · 가설 문장(틀 문장 포함) |
| `[가정]` | r 창 W = 3 · 마지막 달 제외 · 기저 게이트 3,000 · 비율 상·하한 0.5~2.0 · 스크린 `--min-total` 1,200 · `--max-k` 80 · intent_finder limit 100 · 계절형 기준(정점 지수 1.3 · 반복 2/3) · 상승 지수 1.0 · 준비 2개월 · 출시 1개월 리드 · 점검 «참고» 25% · 역위상 3개월 · 세그먼트 사전의 패턴 · 순서 · `exclude` |
| `[데이터 공백]` | 미반환 검색어 · 결측 월 · 이력 부족으로 뺀 검색어 · limit 미상 호출의 절단 여부 · 마지막 달 미점검 · 예측 기간의 실측(아직 없음) · 스크린 탈락분 검색어의 월별 값 |

## 한계

- **월 그레인 · 기준월은 응답에서 읽는다(관측 지연 1개월).** 예측의 첫 달은 기준월 + 1이고, 조회일에는 이미 진행 중일 수 있다. 주 단위 일정에는 쓸 수 없다
- **검색 ≠ 구매.** 예측은 검색 관심의 규모와 시점이다. 판매량 · 재고로 바꾸려면 내부 판매 데이터와 대조해야 한다. 단위는 건(사람 수 아님)
- **예측은 «최근 전년비가 이어진다»는 가정 하나다.** 추세 전환 · 신제품 · 날씨 · 이슈 같은 충격은 반영되지 않는다. 범위와 점검 오차가 그 불확실성의 크기 감각일 뿐 확률 구간이 아니다
- **풀은 표본이다.** 시드별 연관 검색어 상위 limit개(절단되면 더 좁다) · 스크린 통과분만 예측에 들어간다(`screened_share`). 합계를 «시장 규모»로 쓰지 않는다
- 계산 창 37개월이 안 되는 신생 검색어는 예측에서 빠진다 — 새로 뜨는 수요는 `spot-trends`로 본다
- 세그먼트는 사전(정규식)으로 나뉜다. 패턴이 다른 수요를 섞으면 계절 지수가 뭉개진다 — 역위상이 안 보이면 사전 순서부터 의심한다
- 계절 지수 · 일정은 과거 3년 블록 평균이다. 정점이 해마다 움직이는 카테고리(«불규칙»)는 일정을 참고로만 쓴다
- `intent_finder`는 검색어 문자열만 준다 — 관계 · 순서는 없다. jp · us는 성별 · 연령을 다루지 않는다(이 스킬은 쓰지 않는다)
- 남반구 계절 · 음력 명절처럼 해마다 달이 바뀌는 시즌은 달력 월 지수가 흐려진다 — 한계에 적고 정점 월을 단정하지 않는다

## 리포트

이 스킬의 HTML 리포트는 `references/report-contract.md`(렌더링 계약 정본 사본)를 따르고,
`scripts/render_report.py`(공통 렌더러)로만 만든다. 스킬은 **무엇을 넣을지**를 `report.json`으로 정하고,
뼈대 순서 · 차트 메타 · 카드 필드 · 숫자 추적 · 호출 기록은 렌더러가 검사한다.
`assets/report.example.json`은 이 스킬의 견본이다 — 합성 픽스처(선크림 · 기준월 2026-10)로 `build_report.py`가 만든 그대로다.
견본 부제 앞의 «합성 픽스처 예시(assets/fixtures) — 실제 시장 값이 아니다»는 `build_report.py --subtitle-note`로 붙인 표시다(실제 실행에서는 주지 않는다).
렌더하면 `report.html` 옆에 호출 로그(`report.calls.csv`)와 비용 보고서(`report.cost.json`)가 함께 나온다.

첫 화면 경계 문장(`boundary`): «{기준월}까지 관측한 월별 검색량과 과거 3년 계절 패턴으로 계산한 {예측 기간} 예측이며, 이 기간의 실제 검색량은
아직 관측되지 않았다 (조회일 기준 그중 N개월은 이미 지났거나 진행 중)» — `build_report.py`가 결과 파일에서 채운다.

| 섹션(`kind`) | 이 스킬이 넣는 것 | 쓰는 지표 · 차트 |
|---|---|---|
| `summary` 분석 요약 | D1 카테고리 전망(예측 합 · 전년 같은 달 합 · 전년비 · 범위 · 점검 오차) · D2 증가 1위 세그먼트(증감률 1위와 절대 증감 1위가 다르면 둘 다 · 게이트 미달 제외 명시) · D3 역위상 세그먼트(있을 때) · **반대 근거**(잠정 · 게이트 미달 · 점검 «참고» · 절단 시드) · 가능한 결정 | 사실 목록(`{{ID}}`) |
| `trend` 트렌드 분석 | 절대 규모(최근 24개월 실측) → 예측과 전년 같은 달 → 세그먼트 표(전년 · 예측 · 절대 증감 · 증감률 · 범위 · 표기변형 상한 · 점검) → 반복 계절성 | line(실측 · 예측 · 전년 같은 달) · table(base/compare/abs_change/pct_change) · heatmap(블록 × 월 지수 + 원수치 `raw`) |
| `structure` 관심 구조 | 세그먼트별 시즌 유형 · 정점 월 · 정점 반복 · 준비/출시/캠페인/정점/끝 · 조회일 기준 상태 · 역위상 · 경고 | table(시즌 일정) · bar(세그먼트 예측 전년비 + 절대 증감 `abs`) |
| `action` 기회와 실행 | A1 카테고리 일정 · A2 증가 1위 세그먼트 물량 · 콘텐츠 · A3 역위상 세그먼트 별도 일정 — 가설 `[추정]` · 결과물 · 담당(상품기획 · MD · 캠페인) · 내부 데이터 이름 · 확대/수정/중단 조건(실측이 범위 위 · 안 · 아래) | 사실 ID 근거 |
| `appendix` 근거 부록 | 계산 정의(예측식 · r · 게이트 · 범위 · 계절 지수 · volume_trend 미사용) · 예측 포함 비중 · 검색어 처리 결과(상태별 수) + 렌더러가 붙이는 사실 목록 · 호출 순서 · 호출 로그 · 비용 보고서 | table |

`report.json`의 `facts`(사실 목록)는 **`forecast_result.json`(저장 계산 결과)**에서 `build_report.py`가 만든다 — 문구의 숫자는 `{{ID}}`로만 쓴다.
사실의 `source`는 `all` 호출 ID(예: `C4`)라 부록 호출 로그로 이어진다.

호출 원장을 남기는 단계: **STEP 3**(`collect_pool.py` — intent_finder 호출마다) · **STEP 4**(`screen_volume.py` — ads_metrics) ·
**STEP 6**(`forecast_segments.py` — all, `data_through` = 기준월)이 저장한 원본 응답의 `cost_detail.total_cost` · 조건 · 반환 수 · 원본 파일 경로를
`ledger.json`에 쓰고(cost_detail이 없으면 결정식 값 · `cost_source` = 결정식), STEP 10 `build_report.py`가 그 줄을 그대로 `provenance.calls`로 옮긴다.
같은 원본 파일로 스크립트를 다시 돌리면 원장의 그 줄을 바꿔 쓰므로 호출이 두 번 세지지 않는다(사전 · 게이트를 고쳐 다시 계산해도 0크레딧).
