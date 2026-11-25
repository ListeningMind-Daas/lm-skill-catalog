---
name: rank-category-brands
description: |
  분야(장르) 하나의 브랜드 사전(브랜드명 · 별칭 · 표기변형 · 모델)을 받아 `keyword_info`로 **분야 안 브랜드
  검색량 순위(Top N)** · **전년 동기 변화** · **3년 흐름(연도 창 합계)**을 내고, 브랜드 검색이 분야 전체 관심에서
  차지하는 몫(검색량 기준 근사)을 **논브랜드 분야 검색과 분리해** 보여준다. 한국(gl=kr)은 `all`의 성·연령으로
  **성별 · 연령대별 순위**를 더한다. 브랜드 · 카테고리 담당자와 리서처가 쓴다. 시장 kr · jp · us.

  "러닝화 브랜드 검색 순위 뽑아줘" · "선크림 분야 탑10 브랜드가 뭐야?" · "이 장르에서 3년 동안 뜬 브랜드 보여줘" ·
  "20대 여성이 많이 찾는 러닝화 브랜드 순위" · "브랜드 검색이 분야 관심에서 얼마나 차지해?" ·
  "작년보다 검색이 많이 는 브랜드는?" · "분야별 브랜드 순위표 만들어줘"
  같은 요청이면 반드시 이 스킬을 쓴다.

  사용자가 "순위"라는 말을 쓰지 않아도, **한 분야의 여러 브랜드(대개 5개 이상)를 같은 기준으로 줄 세우고
  몇 년 사이 누가 오르내렸는지 보는 요청**이면 켠다. 브랜드 목록이 없으면 에이전트가 초안을 쓰고 사용자가 확인한다.

  경계: 이 스킬은 **자사 대 경쟁사 모니터가 아니다.** 관점 브랜드 하나를 두고 경쟁사와 월별 점유 · 메시지(수식어)
  · 갭 경고를 매달 보는 요청은 `benchmark-competitors`, 정해진 몇 개 브랜드의 SoV 한 장과 표기변형 수집(intent_finder)이
  필요하면 `track-search-share`로 보낸다. 이 스킬은 **많은 브랜드를 한 분야에서 줄 세우고 3년 변화와 세그먼트 순위**를 낸다.
  브랜드가 아니라 키워드 지도가 필요하면 `map-your-market`, 뜨는 검색어는 `spot-trends`. 검색 순위는 판매 순위가 아니다 —
  "시장 점유율"을 요청받아도 검색량 기준 근사로 고쳐 말하고 진행한다.
license: MIT
metadata:
  version: "0.1.2"
---

<!-- lm-skill: kind=task; connectors=keyword_info; flags=monthly,share,report; traps=T1,T2,T3,T4,T5,T6,T8 -->

# Rank Category Brands — 분야 브랜드 검색 순위

> **핵심 원칙**: 순위는 **무엇을 세느냐**로 바뀐다. 브랜드명 단독 검색(나이키 = 러닝화 + 의류 + 축구화 …)을 세면
> 종합 브랜드가 이기고, 표기변형을 두 번 세면 변형이 많은 브랜드가 이기고, 결측 월을 0으로 채우면 새로 생긴
> 브랜드가 3년 사이 «폭증»한다. 그래서 이 스킬은 **분야어가 붙은 검색만** 세고, 같은 검색은 한 번만 세고,
> 여러 해를 비교할 때는 **모든 해에 값이 있는 검색어로 모집단을 고정**한다. 검색 순위는 관심의 순위이지 판매 순위가 아니다.

## 데이터 계약

이 스킬은 `references/lm-data-contract.md`(정본 사본)를 따른다. 계약은 확장할 수 있지만
뒤집을 수 없다. 이 스킬의 함정 처리 의무와 처리 위치:

| 함정 | 처리 위치 | 상태 |
|---|---|---|
| T5 표기변형 canonical 정규화 | STEP 1 (변형치환) · STEP 3 (지표 일치 중복은 대표 1행만 2단) · STEP 5 (같은 검색의 중복 한 번 · 하한/상한 · 순위 뒤집힘) | ✅ |
| T1 기준월·지연 3종 표기 | STEP 4.5 · STEP 5 (요약 헤더) · STEP 7 (리포트 부록) | ✅ |
| T2 마지막 달 완결성 점검 | STEP 4.5 (점검) · STEP 5 (기본 제외) | ✅ |
| T3 volume_trend 대신 전년 동기 비교 | STEP 5 (`yoy_12m` · `yoy_3m`) · STEP 6 (교차확인) | ✅ |
| T4 기저 볼륨 게이트 | STEP 3 (2단 진입) · STEP 5 (변화율 · 3년 변화 · 세그먼트 순위 게이트) | ✅ |
| T6 결측 월 처리 | STEP 5 (창별 계산 불가 · 3년 고정 모집단) | ✅ |
| T8 논브랜드 분리 산출 | STEP 1 (`category_terms`) · STEP 5 (`share_brandset_lo` · `share_genre_lo`) | ✅ |

> 이 표는 선언이다. 실제 처리는 아래 STEP 본문에 있다.

## 커넥터와 크레딧

| 커넥터 | 용도 | 크레딧 결정식 |
|---|---|---|
| `keyword_info` · `ads_metrics` | 1단 — 사전에서 만든 요청 목록 전량의 12개월 볼륨 스크리닝 | `1 × K1` (K1 = 1단 요청 키워드 수) |
| `keyword_info` · `all` | 2단 — 게이트 통과분의 48개월 `monthly_volume` + (kr) `demography` | `10 × K2` (K2 = 2단 대상 수) |

**총액 = `1 × K1 + 10 × K2`.** K1은 사전으로 호출 전에 정해진다(`plan_queries.py combos`가 출력):
`K1 = Σ별칭 [(분야어 수 − 그 별칭에 든 분야어 수) + 1] + 모델 수 + 분야어 수 + 일반어 수` — 별칭은 정식명을 포함한다.
`+ 1`은 분야어 없는 별칭이면 브랜드명 단독 조회(`probe_alone: false`면 뺀다), 분야어가 든 별칭(«코지마 안마의자», 정식명
«세스코 정수기» — 분야어가 띄어 쓴 독립 낱말이거나 끝에 붙은 별칭)이면 그 별칭 그대로의 조회다. 별칭에 이미 든 분야어는 다시
붙이지 않는다(«코지마 안마의자 안마의자» 없음 · «코지마 안마의자 렌탈» 있음). «현대렌탈케어»처럼 이름 가운데 든 분야어는
해당하지 않는다. canonical이 같은 조합은 한 번만 센다.
**K2가 총액을 지배한다.** 2단 대상은 1단 응답을 본 뒤 `plan_queries.py stage2`가 정한다 — 순위·점유에 들어가는
행만, 같은 검색의 중복은 대표 1행만, 12개월 `--min-volume` 이상만. 1단 뒤 출력된 `10 × K2`로 확정해 안내한다.

**계산 예** (러닝화 KR 예시 사전 `assets/brands.running-shoes-kr.example.json` — 브랜드 9 · 별칭 10 · 모델 3 · 분야어 1 · 일반어 2):
`combos` → K1 = 44 → 1단 `1 × 44 = 44`. 합성 픽스처 응답에 기본 게이트(600)를 걸면 K2 = 20 → `10 × 20 = 200` →
**총 244** [추정 — 합성 픽스처 기준. 실제 K2는 1단 응답으로 정해진다]. 브랜드 30개 분야면 K1은 대략 150, K2가
80이면 `150 + 800 = 950`이다 — 이때도 2단이 85%다. 예산이 정해져 있으면 `--max-k2`로 상한을 둔다(버킷마다 가장 큰 행을
먼저 넣는다). 빠진 볼륨은 버킷별 2단 커버리지로 출력된다.

- 한 번에 1~1,000개다. K1이 1,000을 넘으면 나눠 호출하고 응답을 한 파일로 합친다(계약 §1 «응답 병합»).
- 과금은 **요청한 키워드 수**다. 요청하지 않은 변형 행이 와도 과금되지 않고, 응답에서 빠진 요청도 과금된다.
- 성·연령 순위를 내는 kr 실행은 2단에 `all`을 쓴다. 성·연령이 필요 없는 실행(jp · us 또는 세그먼트 생략)은 `ads_info`로 받아도 된다(계약 §1 v1.3 — 단가는 첫 호출 `cost_detail`로 확인, 확인 전 상한 10). 성·연령(`demography`)은 `all`에 함께 오며
  **kr만 반환한다** — jp · us에서 없는 것은 공백이 아니라 사양이다.
- 소진량은 응답 `cost_detail.total_cost` 합이다(`log_call.py`가 원장에 적는다). `used_credits`는 월간 누적이라 쓰지 않는다.
- 단가는 배포 환경마다 다를 수 있다. 고객에게 예산을 안내하기 전에 그 환경의 `cost_detail`로 확인한다.

## 번들 자산

| 파일 | 하는 일 | 쓰는 곳 |
|---|---|---|
| `scripts/plan_queries.py` | 1단 요청 목록(`combos`) · 2단 대상 선별과 크레딧 식(`stage2`) — **이 스킬 고유** | STEP 2 · 3 |
| `scripts/log_call.py` | 호출 원장 — 원본 응답의 `cost_detail` · 반환 수 · 데이터 마지막 달을 `ledger.jsonl`에 한 줄씩 | STEP 2 · 3 |
| `scripts/rank_brands.py` | 순위 · 하한/상한 · 전년 동기 · 3년 흐름 · 두 분모 점유 · 성별/연령대 순위 — **이 스킬 고유** | STEP 5 |
| `scripts/build_report.py` | 저장 결과 + 원장 → `report.json`(사실 목록 · `{{ID}}` 문구 · 호출 기록) — **이 스킬 고유** | STEP 7 |
| `scripts/rank_common.py` | 위 셋이 공유하는 사전 읽기 · 키워드 귀속 · 기간 창 규칙 | — |
| `scripts/series_dedup.py` | 같은 검색의 중복 판정 · canonical (공유 사본 — 고치지 않는다) | — |
| `scripts/check_refmonth.py` | 데이터 기준월 · 지연 · 마지막 달 완결성 (공유 사본) | STEP 4.5 |
| `scripts/trend_yoy.py` | 키워드 단위 전년 동기 교차확인 (공유 사본) | STEP 6 |
| `scripts/build_universe.py` | 공유 유니버스 조립기 — 이 스킬의 순위 계산에는 쓰지 않는다(별칭 · 분야어 귀속이 없다) | 참고 |
| `scripts/render_report.py` · `selftest_render.py` | 공통 리포트 렌더러와 그 회귀 시험 (공유 사본) | STEP 7 |
| `scripts/selftest.py` | 공유 스크립트 계약 검증 (공유 사본) — `selftest_*.py`를 함께 돈다 | 스킬 수정 후 |
| `scripts/selftest_rank.py` | 이 문서의 예시 명령 · 컬럼 목록 · 함정 처리 검증 (합성 픽스처) | 스킬 수정 후 |
| `assets/brands.running-shoes-kr.example.json` | 브랜드 사전 예시 (러닝화 KR · 공개 브랜드 · 순위를 뜻하지 않음) | STEP 1 |
| `assets/themes.template.json` | 공유 분류 사전 템플릿 — 브랜드 사전은 이 스키마에 스킬 키를 더한 것 | STEP 1 참고 |
| `assets/fixtures/` | 합성 1단 · 2단 응답 (실측 아님) — selftest 전용 | — |
| `assets/report.example.json` | 이 스킬의 리포트 견본 (합성 픽스처로 `build_report.py`가 만든 것) | STEP 7 참고 |

## 사전 확인

```
1. 분야가 하나로 정해졌는가? — "신발"과 "러닝화"는 다른 분모다. 경계를 한 문장으로 받는다
2. 시장(gl)이 단일 값인가? — kr · jp · us 중 하나. 여러 나라면 나라별로 따로 돌린다(브랜드 표기가 다르다)
3. 브랜드 사전이 있는가? — 없으면 에이전트가 초안(브랜드 10~30 · 별칭 · 모델)을 쓰고 사용자에게 확인받는다.
   확인 전에는 조회하지 않는다 — 사전이 곧 순위의 모집단이다
4. 분야어(genre_terms)와 논브랜드 일반어(category_terms)가 있는가? — 분야어가 없으면 브랜드 검색을 분야로 한정할 수 없고,
   일반어가 없으면 «분야 전체 중 몫»의 분모가 비어 논브랜드 분리가 무너진다
5. 성별 · 연령대 순위를 원하는가? — kr만 가능하다. jp · us면 착수 전에 사양이라고 말한다
6. "시장 점유율 · 판매 순위"를 기대하는가? — 검색량 기준 근사임을 먼저 고지한다
```

## 실행 순서

### STEP 1 · 브랜드 사전 작성 (사용자 입력 또는 에이전트 초안 → 사용자 확인)

`assets/brands.running-shoes-kr.example.json`을 복사해 `brands.json`으로 만든다. 공유 스키마(`themes.template.json`의
`rules` · `themes` · `brands` · `no_match`)에 이 스킬 키를 더한 것이다. `themes`는 이 스킬에서 쓰지 않는다(빈 배열).

| 키 | 뜻 |
|---|---|
| `genre` · `gl` | 분야 이름 · 시장(`kr` · `jp` · `us`). `gl`이 `kr`일 때만 성별 · 연령대 순위가 나온다 |
| `brands` | 순위에 올릴 브랜드 정식 이름 — **이 목록이 순위의 모집단이다**. 목록에 없는 브랜드는 논브랜드로 잡힌다. 정식 이름도 귀속 키다 |
| `brand_aliases` | 브랜드 귀속 토큰(영문 · 줄임말). canonical 부분 일치로 판정. 한 글자 · 흔한 단어는 넣지 않는다(«온» 대신 «온러닝»). 분야어가 든 별칭(«코지마 안마의자»)도 된다 — 단독이 아니라 분야 한정 검색으로 센다 |
| `variants` | 분야어 없이도 분야 수요로 셀 모델 · 라인 검색어(«호카 본디» · «쿠쿠 정수기»). **별칭과 같은 귀속 키다** — 별칭이 안 걸려도 variants가 들어 있으면 그 브랜드의 `model`이다 |
| `genre_terms` | 분야어(«러닝화»). 1단에서 브랜드 · 별칭 **뒤에** 붙고, 응답 행이 분야 안인지 가르는 기준이 된다 |
| `category_terms` | 논브랜드 분야 일반어(«러닝화 추천» · «마라톤화») — **T8 논브랜드 분리의 입력** |
| `exclude` | 분야 밖 검색 정규식(canonical 기준 — 공백 없음 · 소문자). 가장 먼저 평가된다 |
| `probe_alone` | 브랜드명 단독도 1단에 넣을지(기본 `true`). 단독 볼륨은 **순위 · 점유에 넣지 않고** `brand_alone_12m`으로만 보고한다 |
| `rules.변형치환` | 같은 검색이 두 표기로 갈리는 쌍(«런닝화»→«러닝화»). 공백을 지우기 전에 적용된다(`series_dedup.canon`) |

**표기변형(T5)의 입구가 여기다.** 변형치환으로 canonical이 같아진 행은 STEP 5에서 한 묶음이 되어 하한 · 상한으로
병기된다. 치환을 넣지 않으면 «아디다스 런닝화»와 «아디다스 러닝화»가 별개 검색으로 더해져 상한만 남는다.

**귀속 규칙**(결정론적 · `rank_common.classify` · canonical 기준):

«브랜드가 걸린다» = 검색어 canonical 안에 그 브랜드의 **귀속 키**(정식명 · `brand_aliases` · `variants`) 하나가 들어 있다.
다른 브랜드의 더 긴 키 안에 통째로 들어간 일치는 걸린 것으로 보지 않는다(«교원웰스 정수기» 안의 «웰스»).
브랜드가 하나라도 걸리면 그 검색은 **논브랜드가 될 수 없다** — 순서 7은 걸린 브랜드가 0개일 때만이다.

| 순서 | 조건 | 판정 | 순위 · 점유 |
|---|---|---|---|
| 1 | `exclude`에 걸림 | `excluded` | 밖 |
| 2 | 브랜드 2개 이상 걸림 + 분야어 | `_비교(복수 브랜드)` · `compare` | 분모에만 (배분하지 않는다) |
| 3 | 브랜드 1개 · **분야어 없는** 별칭(정식명 포함)과 완전히 같음 | `alone` | 밖 — `brand_alone_12m`으로 따로 |
| 4 | 브랜드 1개 · `variants` 포함 | `model` | 브랜드 |
| 5 | 브랜드 1개 · 분야어 포함 (분야어가 든 별칭 «노비타 비데»와 완전히 같은 검색 포함) | `genre` | 브랜드 |
| 6 | 브랜드 1개 · 분야어 없음 | `off_genre` | 밖 — 다른 품목 수요가 섞인다 |
| 7 | 브랜드 0개 · 분야어 포함 또는 `category_terms`와 같음 | `_논브랜드` · `category` | 분모(분야 전체)에만 |

브랜드명 단독을 순위에서 빼는 이유: 종합 브랜드의 단독 검색에는 다른 품목 수요가 섞여 분야 순위를 그 브랜드
쪽으로 기울인다. 배분 비율로 나누면 근거 없는 가정이 되므로 빼고, 크기만 따로 보인다.

> 사전을 에이전트가 초안으로 썼으면 **사용자가 «맞아»라고 한 뒤에** 조회한다. 별칭이 빠지면 그 브랜드는
> 과소집계되고 논브랜드가 부푼다 — STEP 3 · 5의 «별칭 누락 의심»(`keyword_map`의 `alias_suspect_brand`)을 보고 보강한다.
> 줄임 표기(«쿠쿠» · «lg» · «웰스»)는 다른 품목 검색도 끌어오므로, 분야 안 패밀리 검색만 원하면 별칭 대신 `variants`(«쿠쿠 정수기»)에 넣는다.

### STEP 2 · 1단 요청 목록과 스크리닝 (`ads_metrics`, 1/kw)

```bash
python3 scripts/plan_queries.py combos --config brands.json -o stage1_keywords.json
```

출력된 `1 × K1` 식으로 크레딧을 안내한 뒤 조회하고, 원본 응답을 그대로 저장한다(헤더 · 키는 저장하지 않는다).

```python
keyword_info(keywords=stage1_keywords, gl="kr", data_type="ads_metrics")   # 1 × K1 → stage1_ads_metrics.json
```

**호출 원장** — 원본 응답을 저장할 때마다 `log_call.py`로 한 줄 남긴다. 비용은 응답 `cost_detail.total_cost`
(나눠 받은 응답이면 `parts` 합)에서 읽고, 반환 수 · 호출 조건 · 데이터 마지막 달도 원본에서 읽는다 — 손으로 적지 않는다.
이 원장(`ledger.jsonl`)이 리포트의 호출 순서 · 호출 로그 · 비용 보고서(`provenance.calls`)가 된다.

```bash
python3 scripts/log_call.py --ledger ledger.jsonl --step "1단 스크리닝" --raw stage1_ads_metrics.json --purpose "브랜드×분야어 · 논브랜드 12개월 볼륨"
```

### STEP 3 · 2단 대상 선별 (같은 검색의 중복 · 볼륨 게이트)

```bash
python3 scripts/plan_queries.py stage2 stage1_ads_metrics.json --config brands.json \
    --requested stage1_keywords.json --min-volume 600 -o stage2_keywords.json
```

- **응답 안 완전 중복 행**(같은 keyword · 같은 내용)은 먼저 하나로 합치고 몇 행 합쳤는지 출력한다(T5 ⓪).
- **요청↔응답 대조는 canonical로** — 미반환 키워드는 «0건»이 아니라 `[데이터 공백]`으로 출력된다(과금은 됨).
- **같은 검색의 중복(T5 ①)** — 볼륨 · CPC · 경쟁도가 모두 같고 토큰이 겹치는 행(«나이키 러닝화» = «러닝화 나이키»)은
  `series_dedup.dedup_map`이 한 묶음으로 보고 **대표 1행만** 2단에 넘긴다. 같은 수요에 10크레딧을 두 번 쓰지 않는다.
- **2단 게이트(T4)** — 순위 · 점유에 들어가는 행(`genre` · `model` · `compare` · `category`) 중 12개월 `--min-volume`
  (기본 600 = 월 50건 `[가정]`) 이상만. 버킷마다 가장 큰 행을 먼저 넣고 나머지는 볼륨 순 — `--max-k2`로 상한.
- **버킷별 2단 커버리지**(2단 볼륨 ÷ 1단 볼륨)가 `--min-coverage`(기본 0.9) 미만이면 경고한다 — 게이트를 낮추거나
  과소집계를 리포트에 `[데이터 공백]`으로 적는다. «1단 볼륨 0»인 브랜드는 별칭 · 분야어부터 확인한다.
- **별칭 누락 의심** — `_논브랜드`로 판정된 1단 행 중 12개월 `--min-volume` 이상이고 **분야어 앞부분**(«쿠쿠 정수기» → «쿠쿠»)이
  사전 키(정식명 · 별칭 · variants)와 닮은 행(키 안에 들어 있음 · 키 줄기가 앞부분 안에 있음 · 앞 2글자 이상 같음)을 출력한다.
  나오면 2단을 부르기 전에 사전을 고치고 `stage2`를 다시 돌린다 — 그대로 가면 브랜드 검색이 논브랜드 분모를 부풀린다.
- 출력된 `10 × K2` 식으로 크레딧을 확정해 안내한 뒤 조회하고 원장에 남긴다.

```python
keyword_info(keywords=stage2_keywords, gl="kr", data_type="all")   # 10 × K2 → stage2_all.json
```

```bash
python3 scripts/log_call.py --ledger ledger.jsonl --step "2단 월별·성연령" --raw stage2_all.json --purpose "게이트 통과분 48개월 시계열 · 성·연령"
```

### STEP 4.5 · 데이터 기준월 확인 ⚠️ 생략 금지

```bash
python3 scripts/check_refmonth.py stage2_all.json --queried-at 2026-11-19
```

산출물 헤더에 **`데이터 기준월 / 조회일 / 지연`** 세 값을 적는다(T1). 기준월은 응답 `monthly_volume`의 `month` 최댓값이다
(배열 순서를 가정하지 않는다 · 관측 지연 1개월 — 고정값으로 쓰지 않고 매번 읽는다). 조회일을 데이터 시점으로 쓰면
"이번 달 순위"가 실제로는 지난 달들 값이다.

같은 명령이 **마지막 달 완결성**(T2)도 점검한다 — 최신 월 MoM이 실제 하락이면서 전년 같은 구간보다 30%p 이상 나쁘면 의심.
`rank_brands.py`는 같은 규칙으로 의심 행 수를 요약에 남기고, **마지막 달을 기본 제외**한다.

### STEP 5 · 순위 · 변화 · 점유 · 세그먼트 산출

```bash
python3 scripts/rank_brands.py stage2_all.json --config brands.json --category running-shoes-kr \
    --stage1 stage1_ads_metrics.json --requested stage2_keywords.json --queried-at 2026-11-19 \
    --gate-monthly 1000 --seg-gate 12000 --top 10 --outdir out
```

`rank_brands.py`가 하는 일과 함정 처리:

- **분석 월(T1 · T2)** — `analysis_end_month` = 데이터 기준월 − 1(마지막 달 제외). 모든 창이 이 달로 끝난다:
  최근 12개월(y0) · 전년 12개월(y1) · 2년 전 12개월(y2) · 최근 3개월과 전년 같은 3개월. 끝나지 않은 달력 연도의
  합계는 쓰지 않는다. `--include-last-month`면 기준월까지 쓰고 `last_month_included = yes(잠정)`이 찍힌다.
- **묶음과 하한 · 상한(T5)** `[추정]` — 순위 · 점유에 들어가는 2단 행을 ① 같은 검색의 중복(48개월 시계열이 완전히
  같은 행 — `series_dedup` · canonical이 달라도 적용) ② 같은 canonical(변형치환 후)로 한 묶음에 잇는다. 중복은 한 번만 센다.
  묶음의 **하한 = 대표(최근 12개월이 가장 큰 행)의 값**, **상한 = 중복을 뺀 묶음 행의 합**. 브랜드 합계도 하한 · 상한 둘이다.
  순위는 하한 기준(`rank_lo`)이고 상한 순위(`rank_hi`)와 다르면 `rank_flip = yes` — 순위를 단정하지 말고 두 값을 함께 적는다.
  묶음 안 행이 서로 다른 버킷에 귀속되면(«뉴발 러닝화»가 별칭 없이 논브랜드로) 브랜드 쪽으로 세고 «별칭 누락 의심»을 출력한다.
- **별칭 누락 의심 — 논브랜드 행** `[추정]` — 묶음 상대가 없는 논브랜드 행도 본다. STEP 3과 같은 규칙으로 12개월
  `--suspect-min-volume`(기본 600 `[가정]`) 이상인 `_논브랜드` 행 중 분야어 앞부분이 사전 브랜드와 닮은 행을
  `alias_suspect_nonbrand`(요약) · `alias_suspect_brand`(`keyword_map`)에 적고 요약 md · 리포트에 표로 올린다. 이때 리포트 요약 제목은
  «논브랜드 몫 판정 보류»가 된다 — 브랜드 패밀리 검색이 논브랜드로 새면 «논브랜드가 크다»는 결론이 거꾸로 나온다.
- **결측 월(T6)** — `nv_code` 월(`total` 키 없음)은 0이 아니라 결측이다. 창에 결측이 하나라도 있는 묶음은 그 창의 합에서
  빠진다(`incomplete_groups_12m`). **여러 창을 나란히 보는 비교는 모집단을 고정한다** — 전년 동기는 두 창 모두 값이
  있는 묶음만(`yoy_groups_n`), 3년 흐름은 세 창 모두 값이 있는 묶음만(`groups_fixed_3y`) 더한다. 2024년에 생긴 검색어는
  3년 합에서 빠지고(`groups_excluded_3y`), 브랜드의 모든 묶음이 빠지면 `trend_status = 계산 불가`로 비운다 —
  늦게 생긴 검색어가 과거 창을 0으로 채워 «폭증»처럼 보이는 것을 막는다. 응답 시계열이 36개월 창보다 짧으면 3년 흐름 전체가 계산 불가다.
- **전년 동기(T3)** — `yoy_12m` = 최근 12개월 ÷ 전년 12개월 − 1(같은 묶음 모집단), `yoy_3m` = 최근 3개월 ÷ 전년 같은 3개월 − 1.
  API `volume_trend` 필드는 판정에 쓰지 않는다(계약 §2: 검증 YoY와 부호 불일치 38~75%) — `keyword_map`의
  `api_volume_trend_do_not_use`에 참고로만 남긴다.
- **기저 게이트(T4)** `[가정]` — `--gate-monthly`(기본 1,000건)를 창 길이에 곱한 값(12개월 12,000 · 3개월 3,000)보다 기준 창 합이
  작으면 변화율을 **비운다**(`yoy_gated_out = 1` · `chg_3y_gated_out = 1`). 기준값 · 비교값 · 절대 증감은 남긴다. 증감률 순위(`rank_yoy`)는
  게이트 통과 브랜드끼리만 매긴다 — 월 몇백 건짜리 브랜드의 +500%가 «가장 많이 성장» 헤드라인이 되지 않는다.
- **두 분모(T8)** `[추정]` — `share_brandset_lo`(사전 브랜드 하한 합 대비)와 `share_genre_lo`(브랜드 + `_비교` + `_논브랜드`
  하한 합 대비 — 분야 전체 관심)를 함께 낸다. 논브랜드 행이 따로 찍혀 «브랜드 밖 분야 검색»의 크기가 보인다.
  브랜드끼리의 몫만 보면 분야 일반 수요가 커지는 동안에도 상위 브랜드 몫이 그대로인 것처럼 읽힌다.
- **브랜드명 단독** — 1단의 `alone` 행(중복 제외)을 `brand_alone_12m`(1단 12개월 · 기준월까지)으로만 보인다. 순위 · 점유에 넣지 않는다.
- **성별 · 연령대 순위(kr)** `[추정]` — 브랜드의 성 · 연령 비율 = 대표 검색어 `demography`(`f_gender_ratio` · `m_gender_ratio` ·
  `a…_ratio`)의 **최근 12개월 볼륨 가중 평균**(연령은 행마다 합이 1이 되게 정규화). 세그먼트 검색량 = 브랜드 하한 × 비율.
  성별과 연령대는 **따로** 매긴다(성 × 연령 곱은 독립 가정이 필요해 만들지 않는다). **그룹 순위도 게이트를 지난다(T4)** —
  세그먼트 12개월 `--seg-gate`(기본 12,000) 미만이거나 성 · 연령이 붙은 볼륨 비중이 `--min-demo-coverage`(기본 0.5) 미만인
  브랜드는 순위를 비우고(`seg_gated_out = 1` · `gate_reason`) 표에만 둔다. `index_vs_all` = 세그먼트 안 몫 ÷ 전체 몫 × 100.
  gl이 kr이 아니면 파일은 헤더만 나오고 요약에 «해당 없음(gl 사양)»이 적힌다. 연령 구간 이름은 응답 키(`a13` · `a20` …) 기준
  표시이며 경계는 API 사양 확인 전 `[가정]`이다.

### STEP 6 · 교차확인과 해석

```bash
python3 scripts/trend_yoy.py stage2_all.json -o trend.csv --gate 3000 --ref-month 2026-09
```

`--ref-month`에는 STEP 5의 **분석 월**(`analysis_end_month`)을 넣는다 — 빼면 미완결일 수 있는 마지막 달로 창이 잡혀 STEP 5와 한 달 어긋난다.

- 증감률 상위 · 하위 브랜드의 주요 검색어를 `trend.csv`로 다시 보고, 브랜드 합의 변화가 검색어 하나(신모델명)에서 오는지
  넓게 오는지 가른다.
- 마지막 달을 포함한 결과를 나란히 두고 싶으면 별도 폴더로 한 번 더 돌린다. 두 결과에서 순위가 다른 브랜드는 «잠정»으로 적는다.

```bash
python3 scripts/rank_brands.py stage2_all.json --config brands.json --category running-shoes-kr \
    --queried-at 2026-11-19 --include-last-month --outdir out_incl
```

- 순위 변화의 **원인**(출시 · 광고 · 이슈 · 가격)은 이 스킬이 답하지 않는다. 동향으로 쓰고 인과로 단정하지 않는다.

### STEP 7 · 리포트

```bash
python3 scripts/build_report.py --outdir out --category running-shoes-kr --ledger ledger.jsonl --estimate 244 -o report.json
python3 scripts/render_report.py report.json -o report.html
```

`build_report.py`가 사실 목록(`facts`)을 `out/`의 저장 결과에서만 만들고, 문구 숫자는 `{{F…}}`로만 부른다.
증감률 1위와 절대 증감 1위가 다르면 둘 다 적고, 방향어(늘었다 · 줄었다)는 값의 부호에서 고른다. 게이트 미만 브랜드는
헤드라인 · 순위 문장의 주어로 쓰지 않는다. `provenance.calls`는 `ledger.jsonl`에서 만든다. 렌더러가 계약 위반을 찾으면
렌더하지 않는다 — 고칠 곳은 `build_report.py`나 결과이지 사실 목록에 숫자를 손으로 넣는 것이 아니다.

## 산출물

아래 컬럼 목록은 스크립트 실제 출력이다(`selftest_rank.py`가 헤더와 순서까지 대조한다).
스크립트를 고치면 이 목록도 함께 고친다.

```
brand_rank_{category}.csv — 브랜드 1행 (+ `_비교(복수 브랜드)` · `_논브랜드` 각 1행)
  rank_lo, rank_hi, rank_flip, in_top, brand, bucket_type, groups_n,
  volume_12m_lo, volume_12m_hi, incomplete_groups_12m, share_brandset_lo, share_genre_lo,
  share_genre_hi, yoy_base_12m, yoy_compare_12m, yoy_abs_12m, yoy_12m, yoy_groups_n,
  yoy_3m, yoy_gated_out, rank_yoy, brand_alone_12m, stage2_coverage,
  data_ref_month, analysis_end_month, last_month_included, label

brand_trend_{category}.csv — 브랜드 1행 (3년 흐름 · 고정 모집단)
  brand, bucket_type, groups_fixed_3y, groups_excluded_3y, window_y2, window_y1, window_y0,
  volume_y2, volume_y1, volume_y0, abs_chg_3y, chg_3y, chg_3y_gated_out, trend_status, label

segment_rank_{category}.csv — 세그먼트 × 브랜드 1행 (kr만 · 그 밖은 헤더만)
  segment_type, segment, segment_label, brand, demo_coverage, segment_ratio,
  segment_volume_12m, share_in_segment, index_vs_all, rank_in_segment, seg_gated_out,
  gate_reason, label

keyword_map_{category}.csv — 2단 응답 행 + 1단에만 있는 행 (귀속 · 묶음 · 결측 · 제외 사유 검토용)
  keyword, canonical, bucket, kind, stage, group_id, group_rep, dup_of, dup_basis,
  volume_total_stage1, volume_y0, complete_y0, complete_3y, has_demography,
  excluded_reason, alias_suspect_brand, api_volume_trend_do_not_use
```

- `rank_summary_{category}.json` — 헤더(`data_ref_month` · `queried_at` · `lag_months` · `analysis_end_month` · `last_month_included` ·
  `last_month_suspect`) · 창 · 게이트 · 분모 합계 · 순위 뒤집힘 · 게이트 미만 · 3년 계산 불가 · 별칭 누락 의심
  (`alias_suspect` 묶음 버킷 불일치 · `alias_suspect_nonbrand` 사전 브랜드와 닮은 논브랜드 행 · `alias_suspect_n` 합) · 미반환 · 세그먼트 상태.
  `build_report.py`가 읽는다.
- `rank_{category}.md` — 사람이 읽는 요약. 맨 위에 `데이터 기준월 / 조회일 / 지연`, 순위표(하한 ~ 상한 · 두 분모 · 전년 동기),
  논브랜드 몫, 3년 흐름, 세그먼트 상위, 데이터 공백 · 판정 보류, 해석 한계. 수치 줄에 4-Label이 붙는다.
- `report.html` + `report.calls.csv` + `report.cost.json` — STEP 7.
- 빈 칸 읽는 법: `yoy_12m` · `chg_3y`가 비면 게이트 미만이거나 결측(계산 불가)이다 — 0과 구별한다. `rank_lo`가 비면 2단 검색량 0.
  `_lo` · `_hi`는 표기변형 하한 · 상한 `[추정]`. `stage2_coverage`는 2단에 넘긴 행의 1단 볼륨 ÷ 그 버킷 1단 볼륨.
- `kind`: `genre` · `model` · `compare` · `category`(순위 · 점유 안) · `alone` · `off_genre` · `excluded`(밖). `stage`: 행이 온 응답(1단/2단).
  `alias_suspect_brand`: 이 논브랜드 행이 닮은 사전 브랜드(«별칭 누락 의심») — 비어 있으면 의심 없음.

## 4-Label

| 라벨 | 이 스킬에서의 적용 |
|---|---|
| `[실제 데이터]` | `monthly_volume` · `ads_metrics` 원값과 그 직접 합 — 창별 검색량, 전년 동기 기준값 · 비교값 · 절대 증감 · 증감률, 브랜드명 단독 12개월, 기준월 · 지연, 마지막 달 의심 행 수 |
| `[추정]` | 키워드의 브랜드 귀속 · 표기변형 묶음과 하한 · 상한, 그 순위와 점유(두 분모) · 성별 · 연령대 비율의 볼륨 가중 평균과 세그먼트 검색량 · 세그먼트 순위 · 2단 커버리지 · 순위를 관심의 순서로 읽는 해석 |
| `[가정]` | 분야 경계(`genre_terms` · `exclude`) · 브랜드명 단독 · 분야어 없는 검색을 뺀 것 · 2단 게이트 600 · 변화율 게이트 월 1,000 · 세그먼트 게이트 12,000 · 성연령 커버리지 50% · 마지막 달 제외 · 비교 검색 미배분 · 고정 모집단 규칙 · 하한 기준 순위 · 연령 구간 이름 |
| `[데이터 공백]` | 미반환 키워드 · 결측 월로 빠진 묶음 · 3년 흐름 계산 불가 브랜드 · 게이트 미만 변화율 · 2단 게이트 밖 볼륨(커버리지 미달) · 사전에 없는 브랜드(논브랜드로 잡힘) · kr인데 demography 미반환 |

## 한계

- **월 그레인 · 기준월은 응답에서 읽는다**(관측 1개월 지연 · 마지막 달을 빼면 분석 월은 조회일보다 2개월 전). 실시간 순위가 아니다.
- **검색 ≠ 판매.** 순위와 점유는 검색 관심의 몫이며 **검색량 기준 근사**다. 판매 점유 · 매출 순위로 쓰지 않는다. 단위는 건(사람 수 아님).
- **3년 흐름은 48개월 가용성에 달렸다.** 마지막 달을 빼고 36개월 창 셋이 필요하다 — 응답 시계열이 짧은 시장 · 검색어, 결측 월이
  많은 브랜드는 계산 불가로 남는다. 고정 모집단이라 늦게 생긴 모델 검색어는 3년 합에서 빠진다(최근 성장의 일부를 놓칠 수 있다).
- **사전이 모집단이다.** 사전에 없는 브랜드는 순위에 없고 논브랜드로 잡힌다. 별칭 누락은 그 브랜드를 과소집계한다.
  «별칭 누락 의심»은 사전과 **닮은** 행만 찾는다 — 사전과 전혀 다른 이름의 브랜드(사전 밖 브랜드)는 찾지 못한다.
- 브랜드명 단독 · 분야어 없는 브랜드 검색을 빼므로, 분야어 없이 모델명만 검색하는 수요는 `variants`에 넣지 않으면 빠진다.
- 성별 · 연령대는 **kr만**이다(jp · us는 사양). 비율은 대표 검색어의 값이며 비율이 어느 기간 기준인지는 응답 사양을 따른다.
- 비교 검색(«나이키 아식스 러닝화»)은 어느 브랜드에도 배분하지 않는다 — 분모에만 있다.
- 원인을 설명하지 않는다. 동향으로 쓰고 인과로 단정하지 않는다.

## 리포트

이 스킬의 HTML 리포트는 `references/report-contract.md`(렌더링 계약 정본 사본)를 따르고,
`scripts/render_report.py`(공통 렌더러)로만 만든다. 스킬은 **무엇을 넣을지**를 `report.json`으로 정하고,
뼈대 순서 · 차트 메타 · 카드 필드 · 숫자 추적 · 호출 기록은 렌더러가 검사한다.
`assets/report.example.json`은 이 스킬의 견본이다 — 합성 픽스처를 STEP 2~7대로 돌려 `build_report.py`가 만든 것이다.
견본 부제 앞의 «합성 픽스처 예시(assets/fixtures) — 실제 시장 값이 아니다»는 `build_report.py --subtitle-note`로 붙인 표시다(실제 실행에서는 주지 않는다).
렌더하면 `report.html` 옆에 호출 로그(`report.calls.csv`)와 비용 보고서(`report.cost.json`)가 함께 나온다.

첫 화면 경계 문장(`boundary`): «{분석 월}까지의 {분야} 분야 검색 관심 순위이며, 판매 점유 · 원인 · 기준월 이후 변화는 관측하지 않았다»

| 섹션(`kind`) | 이 스킬이 넣는 것 | 쓰는 지표 · 차트 |
|---|---|---|
| `summary` 분석 요약 | 발견 D1(1위 브랜드 · 두 분모 몫 · 상위 3 몫) · 발견 D2(게이트 통과 증감률 1위 — 절대 증감 1위가 다르면 함께) · 반대 근거(논브랜드 몫 · 3년 계산 불가 · 마지막 달 의심) | `volume_12m_lo` · `share_brandset_lo` · `share_genre_lo` · `yoy_12m` · `yoy_abs_12m` |
| `trend` 트렌드 분석 | 절대 규모(전년 · 최근 12개월) → 최근 변화(증감률 · 최근 3개월) → 과거 방향(3년 연도 창). 계절성은 12개월 창 합이라 다루지 않는다 | 표(base · compare · abs_change · pct_change) · 선(3년 연도 창 합) · 막대(증감률 + 절대 증감) |
| `structure` 관심 구조 | 브랜드끼리 몫 vs 분야 전체 중 몫 · 논브랜드 행 · 순위 뒤집힘 · 성별/연령대 지수와 순위(kr) | 점유 표 · 히트맵(지수 + 세그먼트 검색량 raw) · 세그먼트 1~3위 표 |
| `action` 기회와 실행 | 실행 카드 A1 — 같은 정의로 다음 기준월 재측정 · 결과물 · 담당 · 내부 데이터(판매량 · 유입 수 — 이름만) · 확대/수정/중단 조건 | 1위 · 논브랜드 사실 ID |
| `appendix` 근거 부록 | 기준월/조회일/지연 · 창 정의 · 두 분모 정의 · 제외 규칙 · 게이트 · 데이터 공백 목록 + 렌더러가 붙이는 사실 목록 · 호출 순서 · 로그 · 비용 | 요약 JSON · 원장 |

`report.json`의 `facts`(사실 목록)는 **스크립트의 저장 계산 결과**에서 만든다 — 문구의 숫자는 `{{ID}}`로만 쓴다.
`provenance.calls`(호출 순서 · 조건 · 반환 수 · 비용 · 원본 파일)는 **수집 스크립트의 원장**에서 만든다 — 손으로 적지 않는다.

호출 원장을 남기는 단계: STEP 2(1단 응답 저장 직후)와 STEP 3(2단 응답 저장 직후)에서 `log_call.py`가 원본 응답의
`cost_detail.total_cost` · 반환 수 · 데이터 마지막 달을 `ledger.jsonl`에 쓴다. 저장본을 다시 쓰는 재계산은 `--reused-from C2`로
비용 0을 남긴다. STEP 7의 `build_report.py`가 이 원장으로 `provenance.calls`를 만든다.

```bash
python3 scripts/render_report.py report.json -o report.html     # 계약 위반이면 렌더하지 않는다
```

## 자가검증

```bash
cd skills/rank-category-brands
python3 scripts/selftest.py              # 공유 스크립트 계약 + selftest_rank.py · selftest_render.py
python3 scripts/selftest_rank.py         # 이 문서의 예시 명령 · 컬럼 · 함정 처리
```

`selftest_rank.py`는 이 문서의 `python3 scripts/…` 명령을 **적힌 그대로** 합성 픽스처(`assets/fixtures/`)에서
실행한다. 명령을 고치면 파일명(`brands.json` · `stage1_ads_metrics.json` · `stage2_all.json` · `ledger.jsonl`)을 유지하거나
selftest를 함께 고친다.
