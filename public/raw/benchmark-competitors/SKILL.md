---
name: benchmark-competitors
description: |
  자사·경쟁 브랜드 키워드 마스터를 받아 브랜드별 **월간 검색량 · 검색 점유율(검색량 기준 근사) ·
  메시지(수식어) 구성**을 월 단위로 비교하고, 전월·전년 동월 대비 갭 변화를 경고로 낸다.
  커넥터는 `keyword_info` 단독(2단 조회). 첫 실행에서 최장 48개월 과거 비교가 바로 나온다.

  "경쟁사 벤치마크 해줘" · "월간 SoV 변화 추적해줘" · "매달 경쟁사 검색 점유 점검표 만들어줘" ·
  "경쟁사 검색량 추이 비교" · "포지셔닝 갭 찾아줘" · "경쟁사가 어떤 메시지로 검색되는지 보고 싶어" ·
  "나이키 vs 호카 러닝화 검색 점유" 같은 요청이면 반드시 이 스킬을 쓴다.

  사용자가 "벤치마크"라는 말을 쓰지 않아도, **이름이 정해진 브랜드 여러 개를 같은 카테고리
  안에서 월별로 나란히 놓고 비교하는 요청**이면 켠다. 월간 정례 점검(매달 새 기준월 반영)도 여기다.

  경계: 이 스킬은 **실시간·주간 모니터링이 아니다** — 데이터가 월 그레인이고 기준월이 조회일보다
  늦다. 주간 경보를 원하면 그렇게 말하고 월간 구조 비교로 범위를 조정한다. 브랜드가 정해지지 않은
  카테고리 지도는 `map-your-market`, "무엇이 뜨는가"는 `spot-trends`로 보낸다. 한 시점의 점유율
  한 장이나 브랜드 동의어 수집부터 필요한 요청은 `track-search-share`로 보내고, 이 스킬은 그 결과
  (브랜드 사전)를 받아 **월별 패널 · 메시지 수식어 구성 · 갭 경고**를 낸다.
license: MIT
metadata:
  version: "1.2.1"
---

<!-- lm-skill: kind=task; connectors=keyword_info; flags=monthly,share; traps=T1,T2,T3,T4,T5,T6,T8 -->

# Benchmark Competitors — 월간 경쟁 브랜드 벤치마크

> **핵심 원칙**: 점유율은 **분모가 무엇이냐**로 결론이 바뀐다. 브랜드끼리의 점유(브랜드 합 대비)와
> 카테고리 안의 점유(논브랜드 포함)를 항상 함께 낸다. 그리고 월 데이터는 **월 단위로만** 말한다 —
> "라이브"도 "주간"도 아니다.

## 데이터 계약

이 스킬은 `references/lm-data-contract.md`(정본 사본)를 따른다. 계약은 확장할 수 있지만
뒤집을 수 없다. 이 스킬의 함정 처리 의무:

| 함정 | 처리 위치 | 상태 |
|---|---|---|
| T5 표기변형 canonical 정규화 · 같은 검색 중복 | STEP 3 (중복 묶음 대표 1행 · 하한/상한 커버리지) · STEP 5 (12개월 하한·상한 · 순위 뒤집힘) | ✅ |
| T1 기준월·지연 3종 표기 | STEP 4 · 산출물 헤더 | ✅ |
| T2 마지막 달 완결성 점검 | STEP 4 (점검) · STEP 5 (기본 제외) | ✅ |
| T3 volume_trend 대신 전년 동기 비교 | STEP 5 (`yoy_3m`) · STEP 6 | ✅ |
| T4 기저 볼륨 게이트 | STEP 3 (2단 진입) · STEP 5 (`--gate`) | ✅ |
| T6 결측 월 처리 | STEP 5 (계산 불가) | ✅ |
| T8 논브랜드 분리 산출 | STEP 1 (`category_terms`) · STEP 5 (`sov_category`) | ✅ |

> 이 표는 선언이다. 실제 처리는 아래 STEP 본문에 있다.

## 커넥터와 크레딧

| 커넥터 | 용도 | 크레딧 결정식 |
|---|---|---|
| `keyword_info` · `ads_metrics` | 1단 — 요청 목록 전량의 12개월 볼륨 스크리닝 | `1 × K1` (K1 = 1단 요청 키워드 수) |
| `keyword_info` · `all` | 2단 — 게이트 통과 대표 키워드의 `monthly_volume` | `10 × K2` (K2 = 2단 대상 수) |

**첫 실행 총액 = `1 × K1 + 10 × K2`** · **월간 갱신 = `10 × K2`** (브랜드 마스터를 다시
스크리닝하면 `+ 1 × K1`).

**총액은 K2가 지배한다.** 그래서 2단에 넘기기 전에 `plan_queries.py stage2`가 줄인다 —
중복 묶음(같은 검색의 중복 · 표기변형 · 구글 지표 공유)마다 대표 1행만 넘기고(같은 수요에 두 번 과금하지 않는다),
12개월 볼륨이 `--min-volume` 미만인 꼬리는 뺀다. 예산이 정해져 있으면 `--max-k2`로 대상 수 상한을 둔다
(버킷 대표 → 테마 예약 → 볼륨 순으로 채운다). 뺀 볼륨은 버킷·테마 커버리지로 보고한다.

**계산 예** (러닝화 KR 예시 설정 — `assets/benchmark.running-shoes-kr.example.json`, 2026-09-28 실측 응답 기준):
브랜드 5 × (브랜드명 1 + 별칭 + 모델 변형 + 수식어 6) + 카테고리어 1 × (1 + 수식어 6) →
`plan_queries.py combos`가 **K1 = 61**을 낸다 → 1단 `1 × 61 = 61` [실제 데이터 — 과금 61].
1단 응답(70행)에 기본 게이트(120)를 걸면 K2 = 61 → `10 × 61 = 610` → **첫 실행 671** · 이후 매달 610
[추정 — 저장 응답으로 재계산].
`--max-k2 30`이면 `10 × 30 = 300` → 첫 실행 361이지만 모델 변형이 빠져 버킷 커버리지가 78~93%로 떨어진다 —
상한은 버킷 커버리지와 테마 커버리지를 맞바꾼다. 둘 다 출력되니 리포트에 적는다.
K2는 1단 응답을 보기 전에는 정해지지 않으므로 **1단 뒤 `stage2`가 출력한 식으로 확정해서 안내한다.**

> 요청하지 않은 표기변형이 응답에 함께 올 수 있다. 과금은 응답의 `cost_detail.total_cost` 합으로
> 확인하고, 계정 누적 사용량(`used_credits`, 월간 누적)으로 이번 분석 소진량을 계산하지 않는다.

**`ads_metrics`에는 시계열이 없다.** 월별 비교에는 `all`이 필요하므로 2단은 반드시 `all`이다.
`all`이 돌려주는 `demography`(성·연령)는 이 스킬에서 쓰지 않는다 — 일부 국가(gl=kr)만 반환하는
사양이라 브랜드 간 비교 축으로 일관되게 쓸 수 없다.

## 번들 자산

| 파일 | 하는 일 | 쓰는 곳 |
|---|---|---|
| `scripts/plan_queries.py` | 1단 요청 목록 생성(`combos`) · 2단 대상 선별과 크레딧 식(`stage2`) · 점검표 사전(`review-config`) — **이 스킬 고유** | STEP 2·3 |
| `scripts/brand_benchmark.py` | 월별 점유율·메시지 구성·갭 경고 산출 — **이 스킬 고유** | STEP 5 |
| `scripts/bench_common.py` | 위 둘이 공유하는 정규화·브랜드 귀속·테마 판정·중복 묶음 규칙 | — |
| `scripts/series_dedup.py` | 같은 검색의 중복 판정 · canonical (공유 사본 — 고치지 않는다) | — |
| `scripts/check_refmonth.py` | 데이터 기준월·지연·마지막 달 완결성 (공유 사본) | STEP 4 |
| `scripts/trend_yoy.py` | 키워드 단위 전년 동기 교차확인 (공유 사본) | STEP 6 |
| `scripts/build_universe.py` | 1단 키워드 점검표 — 브랜드 귀속 검토용, 선택 (공유 사본) | STEP 3 |
| `scripts/selftest.py` | 공유 스크립트 계약 검증 (공유 사본) | 스킬 수정 후 |
| `scripts/selftest_benchmark.py` | 이 문서의 예시 명령·컬럼 목록·함정 처리 검증 | 스킬 수정 후 |
| `assets/benchmark.running-shoes-kr.example.json` | 설정 예시 (러닝화 KR) | STEP 1 |
| `assets/themes.template.json` | 분류 사전 템플릿 (공유 사본) | STEP 1 참고 |

## 사전 확인

```
1. 분석 시장(gl)이 단일 값인가? — 여러 나라면 나라별로 따로 돌린다 (브랜드 표기가 다르다)
2. 비교 브랜드가 이름으로 정해졌는가? (관점 브랜드 1 + 경쟁 2개 이상) — 없으면 되묻는다
3. 카테고리 경계가 정해졌는가? — 브랜드명 단독 검색에는 다른 카테고리 수요가 섞인다
   (나이키 = 러닝화 + 의류 + 축구화 …). 경계 밖을 exclude로 뺄지, 브랜드명 단독을 뺄지 정한다
4. 카테고리 일반어(category_terms)가 있는가? — 없으면 논브랜드 버킷이 비어 카테고리 점유율이 안 나온다
5. 사용자가 "실시간/주간"을 기대하는가? — 그렇다면 착수 전에 월 그레인·기준월 지연을 말하고 합의한다
```

## 실행 순서

### STEP 1 · 벤치마크 설정 작성

`assets/benchmark.running-shoes-kr.example.json`을 복사해 `benchmark.json`으로 만든다.
`rules`·`themes`·`brands`·`no_match`는 themes 스키마와 같고(그래서 `build_universe.py`도 읽는다),
나머지는 이 스킬 전용 키다.

| 키 | 뜻 |
|---|---|
| `brands` | 비교 브랜드 정식 이름 (필수) |
| `focal_brand` | 관점 브랜드 — 메시지 공백 경고의 기준. `brands` 안에 있어야 한다 |
| `brand_aliases` | 브랜드 귀속 매칭 토큰 (영문·줄임말). canonical 문자열에 부분 일치로 판정. 브랜드명·별칭 **단독** 검색은 `brand_alone`으로 따로 센다 |
| `variants` | 1단에 넣을 모델·라인 검색어 |
| `exclude` | 카테고리 밖 검색 정규식 (canonical 기준 — 공백 없음·소문자) |
| `category_terms` | 논브랜드 카테고리 일반어 — **T8 논브랜드 분리의 입력** |
| `probe_modifiers` | 1단에서 브랜드·카테고리어와 조합할 수식어 |
| `themes` | 메시지(수식어) 분류 정규식 — **배열 순서가 우선순위**다. 여러 개에 걸리면 먼저 선언된 것. **띄어쓰기를 유지한 문자열**에서 브랜드·별칭 토큰을 가린 뒤, 전체 · 토큰 · 이웃 두 토큰 붙임에 건다(«호카 본디»가 «카본»에 걸리지 않는다 · «무기 자차»는 «무기자차»로 잡힌다) |

브랜드 귀속 규칙(결정론적): 브랜드 토큰이 **1개** 걸리면 그 브랜드, **2개 이상**(`나이키 vs 호카`)이면
`_비교(복수 브랜드)` 버킷, **0개**면 `_논브랜드` 버킷. 비교 검색을 절반씩 나누는 식의 배분은 하지 않는다
— 배분 비율은 근거가 없는 가정이 되므로, 별도 버킷으로 두고 크기만 보고한다.

> **브랜드·별칭을 기억으로만 채우지 않는다.** 빠진 별칭의 검색량은 논브랜드로 새서 그 브랜드
> 점유율이 과소집계된다. STEP 3의 점검표에서 상위 볼륨 키워드를 훑어 보강한다.
> 오타 변형(`아디도스`·`acisc`)을 별칭으로 넣어도 부풀지 않는다 — 구글 지표가 같은 행은 중복 묶음으로 한 번만 센다.
> 구글 지표가 같은데 버킷이 다른 행(`dr.g` 닥터지 · `dr g` 논브랜드)은 합치지 않고 «별칭 누락 의심»으로 출력한다.

### STEP 2 · 1단 요청 목록과 스크리닝 (`ads_metrics`, 1/kw)

```bash
python3 scripts/plan_queries.py combos --config benchmark.json -o stage1_keywords.json
```

브랜드명·별칭·모델 변형·브랜드×수식어·카테고리어×수식어를 만들고 canonical 기준으로 중복을 뺀다.
출력된 `1 × K1` 식으로 크레딧을 안내한 뒤 조회한다.

```python
keyword_info(keywords=stage1_keywords, gl="kr", data_type="ads_metrics")   # 1 × K1 → stage1_ads_metrics.json
```

### STEP 3 · 2단 대상 선별 (표기변형 대표 1행 · 볼륨 게이트)

```bash
python3 scripts/plan_queries.py stage2 stage1_ads_metrics.json --config benchmark.json \
    --requested stage1_keywords.json --min-volume 120 --min-coverage 0.95 -o stage2_keywords.json
```

- **요청↔응답 대조는 canonical로** 한다. 응답 표기가 요청과 달라도(`음파칫솔` → `음파 칫솔`) 같은 검색이다.
  요청했는데 응답에 없는 키워드는 «미반환» 목록으로 출력된다 `[데이터 공백]` — 0으로 적지 않는다. 과금은 요청 수다.
- **중복 묶음** `[추정]`(규칙 기반, `bench_common.components`): canonical(NFKC → 소문자 → `rules.변형치환`(공백 유지 상태) →
  공백 제거)이 같은 행 + `series_dedup.py`가 같은 검색의 중복으로 판정한 행(시계열·지표 일치) + **같은 버킷 안에서
  구글 지표(`gg_volume_total`·`cpc`·`competition_index`)가 모두 같은 행**을 한 묶음으로 잇는다. 구글은 근접 변형을
  합쳐 같은 값을 돌려준다 — 2026-09-28 실측에서 `nike`·`nikep`·`nikes`·`nikeir`(구글 532,600), `아디다스`·`아디도스`
  (1,370,000), `asics`·`acisc`, `선크림`·`썬크림`(219,000)이 canonical이 달라도 구글 값이 같았다(2개 카테고리 · 일반화 전 재확인 필요).
  묶음마다 12개월 볼륨이 가장 큰 행(동률이면 사전순) 하나만 2단으로 넘긴다.
- **하한·상한 병기** `[추정]`: 버킷 합계를 하한(묶음 최댓값의 합)과 상한(구글 공유 1회 + 네이버 합)으로 함께 찍는다.
  커버리지 판정은 하한 기준이고, 상한 기준으로 미달이 되는 버킷은 «판정 뒤집힘»으로 따로 표시한다.
- **2단 선별 순서** — ① 버킷마다 가장 큰 묶음 ② **테마 예약**: 수식어 테마 × 버킷 칸마다 가장 큰 묶음
  (`--theme-reserve`개, 12개월 `--theme-min-volume` 이상 · 기본 100) ③ 12개월 `--min-volume`(기본 120) 이상을 볼륨 순.
  `--max-k2`가 있으면 이 순서로 그 수까지만 넣는다. 볼륨만 보고 자르면 수식어 검색이 전부 빠져 메시지 분석이
  조용히 무너진다(실측: 2단 30행 중 테마 배정 2행인데 버킷 커버리지는 96.7~99.7%로 통과 표시).
- **버킷 커버리지**(2단 볼륨 ÷ 1단 전체)가 `--min-coverage` 미만이면, **테마 커버리지**가 `--min-theme-coverage`(기본 0.5)
  미만이면 경고한다 — 게이트를 낮추거나 과소집계·메시지 공백을 리포트에 `[데이터 공백]`으로 적는다.
- 출력된 `10 × K2` 식으로 크레딧을 확정해 안내한다.

브랜드 귀속을 사람이 검토하려면 키워드 점검표를 만든다(선택). `build_universe.py`는 공유 스크립트라
`brand_aliases`를 모른다 — `review-config`로 별칭을 brands에 풀어 넣은 사전을 먼저 만든다:

```bash
python3 scripts/plan_queries.py review-config --config benchmark.json -o review_themes.json
python3 scripts/build_universe.py --metrics stage1_ads_metrics.json --themes review_themes.json -o keyword_review.csv
```

그다음 2단을 조회한다.

```python
keyword_info(keywords=stage2_keywords, gl="kr", data_type="all")   # 10 × K2 → stage2_all.json
```

### STEP 4 · 데이터 기준월 확인 ⚠️ 생략 금지

```bash
python3 scripts/check_refmonth.py stage2_all.json --queried-at 2026-09-28
```

산출물 헤더에 **`데이터 기준월 / 조회일 / 지연`** 세 값을 적는다. 기준월은 응답에서 읽는다(관측 1개월 —
2026-09-28 조회에서 2026-08). 마지막 달을 빼면 분석 월은 한 달 더 이르다. 조회일을 데이터 시점으로 쓰면
"이번 달 점유율"이 실제로는 지난 달들 값인데 이번 달 캠페인 성과처럼 읽힌다.

같은 명령이 **마지막 달 완결성**도 점검한다(최신 월 MoM을 전년 같은 구간과 대조, 실제 하락이면서
30%p 이상 나쁘면 의심). 의심 건수를 리포트에 적는다. 월간 갱신은 **기준월이 한 달 넘어간 뒤**에
돌린다 — 기준월이 그대로면 새 달이 없으므로 재조회는 마지막 달 정정 확인 용도로만 쓴다.

### STEP 5 · 월간 벤치마크 산출

```bash
python3 scripts/brand_benchmark.py stage2_all.json --config benchmark.json --category running-shoes-kr \
    --stage1 stage1_ads_metrics.json --queried-at 2026-09-28 --gate 3000 --sov-pp 2.0 --yoy-pct 0.20 --months 24 --outdir out
```

`brand_benchmark.py`가 하는 일과 함정 처리:

- **12개월 하한·상한(T5)** `[추정]` — `--stage1`(1단 응답)과 2단 응답의 모든 행으로 중복 묶음(STEP 3)마다
  하한(묶음 최댓값)과 상한(구글 공유 1회 + 네이버 합)을 내고, 버킷별 12개월 검색량·점유율을 둘 다 `bounds_{category}.csv`에
  쓴다. 점유율은 **하한·상한 각자의 분모**로 계산한다. 브랜드 순위는 하한 기준(`rank_lo`)이고, 상한 순위
  (`rank_hi`)와 다르면 `rank_flip=yes`와 «순위 뒤집힘» 경고가 난다 — 순위를 단정하지 말고 두 값을 함께 적는다.
  `--stage1`이 없으면 2단 응답에 있는 행만으로 계산하고 `bounds_source`에 그렇게 적힌다.
- **월 패널은 하한 기준** — 월별 점유율·`yoy_3m`·경고는 STEP 3과 같은 규칙(`bench_common.py`)으로 묶음당
  대표 1행 시계열만 더한다(`series_basis=대표 행(하한 기준)`). 비대표 변형(오타·구글 공유 행)은 월 패널에 넣지 않으므로
  결측 이력이 있는 오타 변형 하나(`acisc` 결측 19개월)가 브랜드 전체 `yoy_3m`을 지우지 않는다. 남은 결측 원인 키워드는
  gap_alert «데이터 공백»에 나온다. `monthly_volume`은 `month`로 정렬한 뒤 쓴다(배열 순서를 가정하지 않는다). 2단은 대표 행만 조회하므로 상한 기준 월
  시계열은 **없다** — 만들어내지 않고 `gap_alert`에 «월 패널은 하한 기준 · 상한 기준 월 시계열 없음
  [데이터 공백]»을 적는다. `keyword_map`의 `representative`·`group_volume_lo`·`group_volume_hi`로
  그룹별 차이를 확인한다.
- **마지막 달 기본 제외** — 분석 월(`analysis_end_month`)은 데이터 기준월의 한 달 전이다. 마지막 달은
  집계가 아직 차는 중일 수 있고, 네이버·구글 채움 속도가 브랜드마다 달라 **점유율이 왜곡**될 수 있다.
  포함하려면 `--include-last-month`를 쓰고, 산출물에 «잠정»이 표기된다.
- **결측 월** — `nv_code` 월(`total` 키 없음)은 0이 아니라 결측이다. 한 버킷이라도 결측이면 그 달은
  분모가 틀리므로 **모든 브랜드의 점유율을 «계산 불가»로 비운다**(`month_complete = 0`).
  원인 키워드 수는 `missing_keywords`에 남는다. 키워드 이력 시작 이전 달(신제품 출시 전)도 기본은
  결측이다. 0으로 보려면 `--pre-history-zero`를 쓰고 `[가정]`으로 표기한다.
- **두 분모** — `sov_brandset`(비교 브랜드 합 대비)과 `sov_category`(논브랜드·비교 버킷 포함
  카테고리 합 대비)를 함께 낸다. 논브랜드 분리 없이 브랜드 합 대비만 보면, 카테고리 일반 수요가
  커지는 동안에도 "우리 점유율이 올랐다"처럼 읽힌다.
- **전년 동기 비교** — `yoy_3m` = 최근 3개월 합 ÷ 전년 같은 3개월 합 − 1. API `volume_trend` 필드는
  쓰지 않는다(계약 §2: 검증 YoY와 부호 불일치 38~75%). 기저 게이트 `--gate`(전년 같은 3개월 합,
  기본 3,000건) 미만 브랜드는 `yoy_3m`을 비우고 `yoy_gated_out = 1` — 기저 0 근처의 +수백% 같은
  숫자가 경고로 올라오는 것을 막는다.
- **점유율 변화** — 전월 대비(`…_prev_month_pp`)와 전년 동월 대비(`…_prev_year_pp`)를 함께 낸다.
  브랜드마다 계절 곡선이 다르므로(예: 트레일 러닝 라인 비중이 큰 브랜드) **판정은 전년 동월 대비를
  우선**하고 전월 대비는 참고로 본다.
- **메시지 구성** — `themes` 정규식으로 키워드를 수식어 테마에 배정해 `share_within_theme`(그 수식어
  검색 안에서 브랜드 점유)과 `share_within_brand`(그 브랜드 검색 중 수식어 비중)를 낸다. 분류는
  규칙 기반이라 재현되지만, 수식어의 의미 해석은 `[추정]`이다.
- **브랜드명 단독 비중** — `brand_alone_share`(월)·`brand_alone_share_lo`(12개월)는 브랜드명·별칭만 검색한 비중이다.
  50% 이상이면 gap_alert가 경고한다 `[가정]`: 그 브랜드의 점유율은 카테고리 점유가 아니라 브랜드명 검색(인지도·다른
  카테고리 수요 포함) 점유에 가깝다(러닝화 실측 82~98%). 카테고리 안의 경쟁은 수식어·모델 검색으로 본다.
- **테마 커버리지와 메시지 칸 상태** — `theme_coverage_{category}.csv`가 테마 × 버킷마다 1단·2단 12개월 하한과
  `cell_status`를 낸다: `2단 조회됨` · `게이트 밖(1단 12개월 N건 · 2단 미조회) [데이터 공백]` · `실제 0(1단 12개월 0건)
  [실제 데이터]` · `1단 응답 없음(미요청·미반환) [데이터 공백]` · `미확인(--stage1 없음)`. 2단에 없는 칸을 0건으로
  단정하지 않는다(실측: «라운드랩 톤업» 1단 258건이 2단 게이트로 빠졌는데 «0건 [실제 데이터]»로 경고됐다).

**경고 규칙** (`gap_alert_{category}.md`, 임계는 전부 `[가정]`):

| 경고 | 조건 |
|---|---|
| 점유율 변화 | `sov_brandset`의 전년 동월 대비 또는 전월 대비 변화가 `±--sov-pp`(%p) 이상 |
| 수요 변화 | `yoy_3m`이 `±--yoy-pct` 이상 (게이트 통과 브랜드만) |
| 메시지 공백 | 경쟁 브랜드는 그 수식어 검색이 있는데 관점 브랜드 칸이 **2단에 있고 분석 월 0건**이거나 **1단에서 12개월 0건**. 게이트 밖·미수집 칸은 «판정 보류»로만 적는다 |
| 메시지 이동 | 경쟁 브랜드의 테마 내 점유가 전년 동월 대비 `±--sov-pp` 이상 변함. 테마 커버리지가 `--min-theme-coverage` 미만이면 «판정 보류» |
| 순위 뒤집힘 | 12개월 검색량 브랜드 순위가 하한과 상한에서 다름 (`rank_flip=yes`) |

점유율·수요·메시지 경고는 월 패널(대표 행 · 하한 기준)에서 판정한다. 상한 기준 월 시계열이 없으므로
이 경고들이 상한에서 뒤집히는지는 판정할 수 없다 — 경고 절 머리에 그렇게 적힌다.

### STEP 6 · 교차확인과 해석

```bash
python3 scripts/trend_yoy.py stage2_all.json -o trend.csv --gate 3000
```

- 경고가 난 브랜드의 주요 키워드를 `trend_yoy.py`로 다시 계산해 방향이 맞는지 본다.
  브랜드 합계의 변화가 키워드 하나(예: 신모델명)에서 오는지, 넓게 오는지를 가른다.
- 마지막 달을 포함해 보고 싶으면 별도 폴더로 한 번 더 돌려 **두 결과를 나란히** 둔다.
  두 모드에서 경고가 달라지는 브랜드는 «잠정»으로 표시한다.

```bash
python3 scripts/brand_benchmark.py stage2_all.json --config benchmark.json --category running-shoes-kr \
    --queried-at 2026-09-28 --include-last-month --outdir out_incl
```

- 점유율 변화의 **원인**(광고·출시·이슈·가격)은 이 스킬이 답하지 않는다. 경고는 "무엇이 변했는가"
  까지이고, 원인은 SERP·연관 검색어로 따로 확인한다. 인과로 단정하지 않는다.

## 산출물

아래 컬럼 목록은 스크립트 실제 출력이다(`selftest_benchmark.py`가 헤더와 순서까지 대조한다).
스크립트를 고치면 이 목록도 함께 고친다.

```
benchmark_{category}.csv — 월 × 버킷(브랜드들 + `_비교(복수 브랜드)` + `_논브랜드`) 1행
  month, brand, bucket_type, is_focal, keywords_n, volume, missing_keywords,
  month_complete, series_basis, sov_brandset, sov_category, sov_brandset_delta_prev_month_pp,
  sov_brandset_delta_prev_year_pp, yoy_3m, yoy_gated_out, brand_alone_share,
  data_ref_month, analysis_end_month, last_month_included

message_share_{category}.csv — 월 × 수식어 테마 × 버킷 1행
  month, theme, brand, volume, share_within_theme, share_within_brand,
  data_ref_month

keyword_map_{category}.csv — 1단·2단 응답 키워드 1행 (브랜드 귀속·대표 행·중복 묶음·제외 여부 검토용)
  keyword, canonical, bucket, theme_primary, stage, representative, component_rep,
  dup_basis, brand_alone, volume_total, group_rows, group_volume_lo, group_volume_hi,
  excluded, api_volume_trend_do_not_use

bounds_{category}.csv — 버킷 1행 (12개월 검색량·점유율의 표기변형 하한·상한 · 순위 뒤집힘)
  brand, bucket_type, is_focal, groups_n, rows_n, volume_12m_lo, volume_12m_hi,
  sov_brandset_12m_lo, sov_brandset_12m_hi, sov_category_12m_lo, sov_category_12m_hi,
  brand_alone_12m_lo, brand_alone_share_lo,
  rank_lo, rank_hi, rank_flip, bounds_source, label

theme_coverage_{category}.csv — 수식어 테마 × 버킷 1행 (메시지 분석 범위 · 칸 상태)
  theme, brand, stage1_groups, stage1_volume_12m_lo, stage2_groups, stage2_volume_12m_lo,
  theme_coverage, cell_status, label
```

`gap_alert_{category}.md` — 헤더(데이터 기준월/조회일/지연 · 마지막 달 처리 · 게이트 · 임계 ·
이력 이전 달 처리) · 분석 월 브랜드 점유율 표(두 분모 · 전월/전년 동월 %p · 전년 동기 3개월 · 하한 기준 명시) ·
논브랜드 비중 · 브랜드명 단독 비중 경고 · 12개월 검색량 «하한 X ~ 상한 Y»와 점유율 «하한 기준 X / 상한 기준 Y»(각자의 분모라 범위가 아니다) · 순위 하한/상한 ·
테마 커버리지 표(관점 브랜드 칸 상태) · 경고 목록 · 판정 보류 · 데이터 공백(계산 불가 월 수 · 결측 원인 키워드 · 별칭 누락 의심 · 비교 버킷 크기 · 게이트 미달 브랜드 · 테마 커버리지 미달) ·
해석 한계. 모든 수치 줄에 4-Label이 붙는다.

- `volume`이 비어 있으면 결측, `sov_*`가 비어 있으면 그 달은 계산 불가다. 0과 구별한다.
- `api_volume_trend_do_not_use`는 참고로만 보존한다. 판정·경고에 쓰지 않는다.
- `_lo`·`_hi`: 중복 묶음 하한(최댓값)·상한(구글 공유 1회 + 네이버 합) `[추정]`(규칙 기반 집계). `label`은 `추정`
- `stage`: 행이 온 응답(1단/2단) · `representative`: 월 패널 대표 행 · `component_rep`: 묶음 대표 ·
  `dup_basis`: 묶음에 들어온 근거(`시계열 일치`·`지표 일치`·`표기변형(canonical)`·`구글 지표 공유`·`묶음 연결`, 대표는 빈칸)
- `series_basis`: 월 패널이 대표 행 시계열(하한 기준)이라는 표시
- `bounds_source`: `1단 ads_metrics + 2단 all`(권장) 또는 `2단 all 응답의 행만`

## 4-Label

| 라벨 | 이 스킬에서의 적용 |
|---|---|
| `[실제 데이터]` | `monthly_volume` 원본과 그 직접 계산 — 브랜드별 월 검색량, 두 분모의 점유율, %p 변화, `yoy_3m` |
| `[추정]` | 수식어 테마 분류의 의미 해석 · 브랜드 별칭 매칭이 실제 그 브랜드 수요라는 판단 · 중복 묶음 판정(시계열·지표·구글 지표 공유)과 하한·상한, 그 점유율·순위 · 브랜드명 단독 비중 · 테마 커버리지 |
| `[가정]` | 카테고리 경계(`exclude`) · 경고 임계(±2.0%p · ±20%) · 기저 게이트 3,000건 · 2단 진입 120건 · 테마 예약 100건 · 테마 커버리지 50% · 브랜드명 단독 경고 50% · 구글 공유 판정 최소 1,000건 · 마지막 달 제외 · 비교 검색 미배분 · `--pre-history-zero` · 순위·판정을 하한 기준으로 한 것 |
| `[데이터 공백]` | 결측 월로 계산 불가한 달 · 게이트 미달 브랜드 · 2단 커버리지 미달분 · 게이트 밖 메시지 칸 · 미반환 키워드 · 1단 볼륨 0인 브랜드 · 상한 기준 월 시계열(비대표 표기변형 미조회) |

## 한계

- **월 그레인 · 기준월은 응답에서 읽는다(관측 1개월 지연, 마지막 달을 빼면 분석 월은 2개월 전).** 실시간·주간 모니터링이 아니다. "라이브"라고
  부르지 않는다. 월중 이벤트(출시·캠페인)는 다음 기준월 이후에야 보인다
- 검색 점유율은 **검색량 기준 근사**이지 판매 점유율이 아니다. 검색량 단위는 건이며 사람 수가 아니다
- 브랜드명 단독 검색에는 카테고리 밖 수요가 섞인다. `exclude`로 뺄 수 있는 것은 수식어가 붙은
  검색뿐이다 — 브랜드명 단독이 지배적인 브랜드는 `sov_*`를 브랜드 인지도 쪽으로 읽는다
- 비교 검색(`나이키 vs 호카`)은 어느 브랜드에도 배분하지 않으므로 브랜드 점유율에서 빠진다
- 메시지 분석은 **검색어에 나타난 수식어**만 본다. 광고·콘텐츠에서 브랜드가 실제로 무엇을 말하는지가
  아니다
- 성·연령 비교는 하지 않는다 — `demography`는 일부 국가(gl=kr)만 반환한다
- 원인을 설명하지 않는다. 동향으로만 서술하고 인과로 단정하지 않는다

## 자가검증

```bash
cd skills/benchmark-competitors
python3 scripts/selftest.py              # 공유 스크립트 계약
python3 scripts/selftest_benchmark.py    # 이 문서의 예시 명령·컬럼·함정 처리
```

`selftest_benchmark.py`는 이 문서의 `python3 scripts/…` 명령을 **적힌 그대로** 합성 픽스처에서
실행한다. 명령을 고치면 픽스처 파일명(`benchmark.json` · `stage1_ads_metrics.json` · `stage2_all.json`)을
유지하거나 selftest를 함께 고친다.
