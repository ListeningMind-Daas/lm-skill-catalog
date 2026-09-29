---
name: decode-search-intent
description: |
  시드 키워드를 `intent_finder`로 확장하고 `keyword_info`로 검색량을 붙인 뒤, **규칙 사전**으로
  각 검색어를 의도 5층(L1 니즈 · L2 목표 · L3 해결책 · L4 제품 · L5 브랜드)과 구매 단계
  (탐색 · 비교 · 구매)로 분류해 **볼륨 가중 의도 분포**를 낸다. 단계 분류는 `keyword_info`가
  돌려주는 API 의도 라벨(`intents`)과 교차확인한다.

  "이 키워드 사람들이 왜 검색해?" · "검색 의도 분해해줘" · "러닝화 검색하는 이유가 뭐야" ·
  "니즈부터 브랜드까지 층으로 나눠줘" · "정보 탐색이랑 구매 의도 비중 보고 싶어" ·
  "의도 퍼널 분석" · "사람들이 진짜 원하는 게 뭔지 검색어로 보고 싶어"
  같은 요청이면 반드시 이 스킬을 쓴다.

  사용자가 "의도"라는 말을 쓰지 않아도, **검색어 묶음이 어떤 동기·단계에서 나오는지 비중으로
  판정해야 하는 요청**(콘텐츠를 어느 단계에 둘지, 광고를 구매 직전 검색어에 걸지 등)이면 켠다.

  경계: 시장 전체 키워드 지도·커버리지는 `map-your-market`, 시계열로 뜨는 신호는 `spot-trends`로
  보낸다. 성·연령 세분화는 이 스킬이 하지 않는다. 0~100 «구매 의도 점수»는 만들지 않는다 —
  가중치 근거가 없는 점수라 단계 분류와 API 의도 라벨로 대신한다.
license: MIT
metadata:
  version: "1.2.1"
---

<!-- lm-skill: kind=task; connectors=intent_finder,keyword_info; flags=expand,share; traps=T5,T7,T8 -->

# Decode Search Intent — 검색하는 이유 해독하기

> **핵심 원칙**: 검색어 하나에는 층이 있다 — 불편(니즈) → 원하는 결과(목표) → 해결책 유형 →
> 구체 제품 → 브랜드. 그런데 `intent_finder`는 **볼륨 순으로 잘라서** 돌려주므로, 그대로 세면
> 하류(제품·브랜드) 층이 부풀고 상류(니즈·목표)가 사라진다. 분포는 «표본의 구성»으로 읽는다.

## 데이터 계약

이 스킬은 `references/lm-data-contract.md`(정본 사본)를 따른다. 해당 함정과 처리 위치:

| 함정 | 처리 위치 | 상태 |
|---|---|---|
| T5 같은 검색의 중복 병합 · 표기변형 canonical 정규화 · 하한/상한 병기 | STEP 4 · STEP 5 · STEP 6 | ✅ |
| T7 절단(limit) 검사 — 절단이면 수렴 판정 보류 | STEP 1 · STEP 4 · STEP 6 | ✅ |
| T8 논브랜드 분리 산출 | STEP 3 · STEP 6 · STEP 7 | ✅ |

> 이 표는 선언이다. 실제 처리는 아래 STEP 본문에 있다.

시계열 판정은 하지 않는다(`volume_trend`·YoY를 쓰지 않는다). 다만 `volume_total`은 조회일이
아니라 **데이터 기준월로 끝나는 12개월 합**이므로, 2단 조회 응답의 `monthly_volume`에서 기준월을
읽어 산출물 헤더에 적는다(STEP 6). 지연을 고정값으로 쓰지 않는다 — 기준월은 응답에서 읽는다
(관측 1개월: 2026-09-28 조회에서 기준월 2026-08).

## 커넥터와 크레딧

| 커넥터 | 용도 | 크레딧 결정식 |
|---|---|---|
| `intent_finder` | 시드 → 연관 검색어 확장 (문자열만 반환) | 호출당 `30 × 시드 수 + 2 × 반환 수` — 이 스킬은 시드 1개씩 호출하므로 `30 + 2 × 반환` |
| `keyword_info` | 1단 `ads_metrics`: 검색량 · 2단 `all`: API 의도 라벨 `intents`(0/1 플래그) + 기준월 | 1단 `1 × U` · 2단 `10 × K` — **요청한** 키워드 수 기준(응답에서 빠져도 과금) |

```
총 크레딧 = Σ_호출 (30 + 2 × 반환_i)  +  1 × U  +  10 × K

  반환_i  i번째 intent_finder 호출의 반환 수 (≤ limit)
  U       1단 요청 키워드 수 = 시드 ∪ 전 호출 반환 (문자열 중복 제거)
  K       2단 요청 키워드 수 = `intent_layers.py pick` 출력 수 ≤ top + 6 × per_layer
```

**예산 예시** — 시드 3개 · limit 100 · 전부 절단 · pick 기본값(top 50, per_layer 5):
확장 `3 × (30 + 2 × 100) = 690` + 1단 `1 × 303 = 303`(상한) + 2단 `10 × 80 = 800`(상한) = **상한 1,793**.
(2026-09-28 평가 3케이스 19호출은 이 결정식과 19/19 일치했다.)
STEP 4.5 보강 라운드를 돌리면 보강 시드마다 `30 + 2 × 반환`과 새 키워드 수만큼의 1단 비용이 더해진다.

**2단 조회가 총액을 지배한다.** 1단 전량에 `all`(10)을 걸면 위 예시의 303키워드만으로 3,030이 된다.
`all`은 교차확인에 쓸 K개에만 건다. K는 canonical 그룹마다 대표 표기 1개만 뽑고 같은 검색의 중복 행·
경계 밖 행은 뽑지 않으므로 표기변형에 10크레딧을 두 번 내지 않는다(T5). 성·연령(`demography`)은 `all`에 같이 오지만 이 스킬은 쓰지 않는다
— 일부 국가만 반환되는 사양이라 해외 시장에서는 비어 있다.

> ⚠️ 배포 환경마다 단가가 다를 수 있다(계약 §1). 고객에게 안내하기 전 해당 환경의
> `cost_detail.total_cost`로 확인하고 다시 계산한다. 이번 분석 소진량은 `cost_detail` 합산으로 적는다.

## 번들 자산

| 파일 | 하는 일 | 쓰는 곳 |
|---|---|---|
| `scripts/build_universe.py` | 확장 결과 + 검색량 결합 · canonical 그룹키 · 같은 검색의 중복 표시(`dup_of`) · 사전 기반 층·브랜드 부여 | STEP 4 |
| `scripts/coverage_curve.py` | 호출별 요청 limit vs 반환 수 → 절단 표시(한 라운드에 시드별 호출 여러 건) · 논브랜드 기여 | STEP 4 |
| `scripts/series_dedup.py` | 같은 검색의 중복 판정(시계열·지표 일치) · canonical 정규화 — 위 두 스크립트와 `intent_layers.py`가 쓴다 | STEP 4 · 6 |
| `scripts/intent_layers.py` | **이 스킬 고유** — `upstream`(STEP 4.5 판정) · `pick`(2단 대상 선정) · `report`(경계·중복 제외, 짧은 브랜드 가드, 층·단계 분류, 그룹 하한·상한 집계와 순위 뒤집힘 표시, API 플래그 교차확인, 미반환 표기, 요약 MD) | STEP 4.5 · 5 · 6 |
| `scripts/selftest.py` | 공유 스크립트 계약 검증 (공유 정본 사본) | STEP 3 자가검증 |
| `scripts/selftest_intent.py` | `intent_layers.py`와 이 문서의 예시 명령·컬럼 목록 검증 | STEP 3 자가검증 |
| `assets/intent_dict.example.json` | 의도 사전 예시(러닝화, gl=kr) — 복사해서 카테고리마다 새로 쓴다 | STEP 3 |
| `assets/themes.template.json` | 공유 분류 템플릿 (사전의 `rules`·`themes`·`brands` 형식 참고용) | STEP 3 |

스킬을 고친 뒤에는 스킬 폴더에서 둘 다 돌린다 (API·크레딧 불필요):

```bash
python3 scripts/selftest.py && python3 scripts/selftest_intent.py
```

## 사전 확인

```
1. 분석 시장(gl)이 단일 값으로 확정되었는가? — 사전 패턴이 언어별이므로 시장을 섞지 않는다
2. 카테고리 경계가 한 문장으로 정해졌는가? (예: "러닝화 — 등산화·골프화 제외") — STEP 3에서 사전 `exclude`로 옮긴다
3. 시드가 있는가? 없으면 STEP 0 절차로 만든다. 브랜드명은 시드로 쓰지 않는다
4. 예산 상한을 사용자와 합의했는가? — 위 결정식에 시드 수·limit·top·per_layer를 넣어 먼저 보여준다
5. B2B 산업재처럼 검색량이 작고 전문어가 많은 카테고리면 미분류가 커진다고 미리 알린다
```

## 실행 순서

### STEP 0 · 시드 정하기

같은 발화에 매번 다른 시드가 나오면 분포도 매번 달라진다. 시드는 **층을 하나씩 대표**하게 만든다:

| 시드 | 개수 | 러닝화 예 |
|---|---|---|
| 카테고리 코어(L3 해결책) | 1 | `러닝화` |
| 니즈 표현(L1) | 1~2 | `평발 러닝화`, `무릎 통증 러닝` |
| 목표·상황 표현(L2) | 1 | `마라톤 입문` |

브랜드명을 시드로 넣으면 반환이 L5로 쏠려 논브랜드 분포가 왜곡된다. 사용자가 브랜드를 지목해도
시드가 아니라 STEP 3의 `brands` 사전에 넣는다. 확정한 시드를 `seeds.json`으로 남긴다.

### STEP 1 · intent_finder 확장

```python
for seed in seeds:                     # 시드 1개씩 — 호출별 절단을 따로 보기 위해서다
    intent_finder(keywords=[seed], gl="kr", limit=100,
                  volume_threshold=50, sort="volume_total", order="desc")
    # 크레딧 = 30 + 2 × 반환 수 → 응답을 if_<시드>.json으로 저장
```

**T7 — 요청 limit을 기록한다.** 반환 수가 limit과 같으면 그 호출은 «다 나온» 게 아니라 **잘린** 것이다.
`sort="volume_total"`로 잘리므로 남는 것은 볼륨 상위, 대개 해결책·제품·브랜드 층이고,
잘려 나가는 꼬리에 니즈·목표 층이 몰린다. `volume_threshold`도 같은 방향으로 꼬리를 자른다.

### STEP 2 · 1단 검색량 (ads_metrics)

```python
keyword_info(keywords=seeds + all_returned, gl="kr", data_type="ads_metrics")   # 1 × U
```

`intent_finder`는 키워드 문자열만 준다. 이 결합 없이는 분포를 볼륨으로 가중할 수 없다 —
결합은 선택이 아니라 필수 단계다. 응답을 `ki_metrics.json`으로 저장한다.

### STEP 3 · 의도 사전 작성

```bash
cp assets/intent_dict.example.json intent_dict.json
```

예시는 러닝화용이다. **카테고리마다 새로 쓴다.** 형식은 아래 «의도 사전» 절.

- `themes`에 층 L4 → L3 → L2 → L1 순으로 패턴을 쓴다. 순서가 곧 우선순위다
- `stages`에 구매 → 비교 → 탐색 순으로 수식어 패턴을 쓴다
- **T8 — `brands`는 1단 결과를 보고 채운다.** `ki_metrics.json` 볼륨 상위 50개를 훑어 브랜드·제품
  라인명을 전부 넣는다. 빠진 브랜드는 논브랜드로 집계되어 논브랜드 분포(니즈·목표 비중)가 부풀려진다
- `rules.변형치환`에 같은 수요가 두 표기로 갈리는 쌍만 넣는다(예: `"런닝": "러닝"`). 치환은 **띄어쓰기를
  지우기 전**에 적용된다(단어 경계 보존)
- **경계 필터** — 사전 확인 2의 경계 문장을 `exclude` 패턴으로 옮긴다(예: 러닝화 `"등산화|골프화"`,
  standing desk `"laptopstand|monitorsetup|officecom"`). 걸린 행은 «경계 밖»으로 분포·2단 대상에서 빠지고
  요약에 건수·볼륨이 따로 찍힌다 — 경계 밖 검색어가 L2 목표 같은 층으로 섞여 들어가는 것을 막는다
- **짧은 브랜드** — 한글 1자·영문·숫자 3자 이하 브랜드(`려`·`ts`·`on`)는 검색어의 **단어 전체**와 일치할
  때만 브랜드로 본다(`려`가 `가려움`에 걸리지 않게). 그보다 긴 이름은 canonical 부분일치다. 가드로 막힌 행 수는
  `pick`·`report` 출력에 찍힌다. 2자 한글 이름(`리닝`·`노다`)은 부분일치이므로 1단 상위 목록에서 충돌을 확인한다
- **영어 시장(gl=us)** — 어순·복수형·동의어 변형(`standing desks`/`stand up desk`/`desk standing`)이
  시계열·지표까지 같게 오는 일이 많다(평가 case1: 202행 중 78행). 이것은 `build_universe.py`가 `dup_of`로
  표시하고 `intent_layers.py`가 한 번만 센다 — 사전에 동의어 치환을 억지로 넣지 않는다. 지표가 다른 복수형만
  `"desks": "desk"`처럼 치환한다

### STEP 4 · 유니버스 조립 · 절단 점검

```bash
python3 scripts/build_universe.py --metrics ki_metrics.json --themes intent_dict.json \
    --seeds seeds.json --round "S·시드=seeds.json" \
    --round "R1·러닝화=if_러닝화.json" --round "R1·평발 러닝화=if_평발.json" \
    -o keyword_universe.csv

python3 scripts/coverage_curve.py --metrics ki_metrics.json --rules intent_dict.json \
    --themes intent_dict.json --round "S·시드=seeds.json" \
    --round "R1=if_러닝화.json@100,if_평발.json@100"
```

`coverage_curve.py`의 라운드는 **시간 순서**다. 같은 라운드에 시드별로 부른 호출은 `--round` 하나에
쉼표로 나열한다 — 따로 넘기면 절단된 첫 호출 뒤의 작은 호출이 «마지막 라운드 기여율 1%»가 되어
«커버리지 도달»로 읽힌다(평가 case1·2에서 실제로 났다). 절단 호출이 하나라도 있으면 판정은 «보류»다.
`build_universe.py`의 `--round`는 발견 라벨을 붙이는 용도라 시드마다 따로 둔다.

- **T5** — `build_universe.py`가 행마다 `canonical`(NFKC → 소문자 → 변형치환 → 공백 제거)과 `dup_of`(같은 검색의
  중복이면 대표 키워드)를 붙인다. API가 요청하지 않은 표기변형(`러닝화`/`런닝화`)을 함께 돌려주므로, 행은
  보존하되 집계는 그룹으로 한다.
- **T7** — `coverage_curve.py`의 `@limit`이 절단 호출을 «⚠️ limit»으로 표시한다. 이 스킬은 수렴을
  판정하지 않지만, 절단이 있으면 STEP 6의 분포를 «확정»으로 쓰지 않는다.

### STEP 4.5 · 상류 보강 라운드 (절단 + 니즈·목표 층이 얇을 때)

판정은 스크립트가 한다 — 사람이 표를 보고 세지 않는다:

```bash
python3 scripts/intent_layers.py upstream --universe keyword_universe.csv --dict intent_dict.json \
    --seeds seeds.json --call "R1=if_러닝화.json@100,if_평발.json@100"
```

**발동 조건** = 절단 호출이 1건 이상 **그리고** «시드 밖 L1·L2 논브랜드 그룹»이 10개 미만 [가정].

- «시드 밖 L1·L2 그룹» — 같은 검색의 중복·경계 밖·브랜드·시드 자신을 뺀 canonical 그룹 중,
  `layer_facets_beyond_seed`에 L1 또는 L2가 있는 것. 이 층 판정은 **시드에 들어 있는 사전 표현을 뺀다** —
  시드 `탈모 샴푸`의 `탈모`(L1 패턴)는 모든 반환에 들어가므로, 그것만으로 걸린 L1은 세지 않는다.
  주 층(`layer`)으로 세지 않는 이유: 층 우선순위가 하류 먼저라 시드 토큰(L3)이 주 층을 차지한다
- 발동이면 출력된 **보강 시드 후보 2개**(시드 밖 L1·L2 볼륨 상위)로 STEP 1·2를 한 번 더 돈다(라벨
  `R2·<시드>`). 보강은 1회로 끝낸다 — 돌려도 절단이면 «상류 층 하한» 경고를 유지한 채 진행한다
- 미발동이면 그 사실과 근거 수치(절단 건수·그룹 수)를 리포트에 적는다. `report`도 같은 판정을 요약에 싣는다

### STEP 5 · 2단 조회 (all) 대상 선정

```bash
python3 scripts/intent_layers.py pick --universe keyword_universe.csv --dict intent_dict.json \
    --seeds seeds.json --top 50 --per-layer 5 -o gated.json
```

```python
keyword_info(keywords=gated, gl="kr", data_type="all")   # 10 × K → ki_all.json
```

`pick`은 canonical 그룹마다 **대표 표기 1개**(그룹 내 최대 볼륨)만 뽑는다(T5 — 변형에 10크레딧을
두 번 내지 않는다). 상위 `top` 순위는 그룹 볼륨 하한(최댓값) 기준이며, 상한(그룹 합) 기준이면 상위에 드는데
빠진 그룹이 있으면 `⚠️ 순위 뒤집힘`으로 이름을 출력한다 — 교차확인이 필요하면 `--top`을 늘려 넣는다.
볼륨 상위 `top`에 더해 **층마다 상위 목록 밖에서 `per_layer`개**를 더 넣어, 볼륨이 작은 니즈·목표
층도 API 라벨과 대조되게 한다. 층은 주 층이 아니라 **시드 밖 층**(`layer_facets_beyond_seed`)으로 나눈다 —
주 층으로 나누면 `평발 러닝화 추천`처럼 L1 표현이 든 검색어가 L3에 묶여 L1 표본이 비었다(평가 case0: 2단 대상 중
시드 밖 L1·L2 2개 → 수정 후 9개). 같은 검색의 중복 행과 경계 밖 행은 뽑지 않는다. 출력되는 `10 × K`를 예산표에
옮겨 적는다. 과금은 요청 수 기준이다 — 응답에서 빠진 키워드는 `report --gated`가 미반환으로 적는다.

### STEP 6 · 분류 · 집계 · 교차확인

```bash
python3 scripts/intent_layers.py report --universe keyword_universe.csv --dict intent_dict.json \
    --seeds seeds.json --intents ki_all.json --gated gated.json --requested ki1_request.json \
    --call "R1=if_러닝화.json@100,if_평발.json@100" \
    --queried-at 2026-09-28 --title 러닝화 -o intent_layers.csv --report intent_summary.md
```

- **경계·중복**: 사전 `exclude`에 걸린 행(`boundary_excluded`)과 같은 검색의 중복 행(`dup_of`)은 분포에서 빠진다.
  요약 헤더에 «같은 검색의 중복 N행 병합 · 경계 밖 M행 제외»가 건수·볼륨과 함께 찍힌다.
- **층**: 브랜드(짧은 브랜드 가드 적용)가 걸리면 L5, 아니면 사전 `themes`에서 먼저 선언된 층. 아무 데도 안 걸리면 **«미분류»로
  남긴다** — 억지로 넣지 않는다. 걸린 층 전부는 `layer_facets`에 남아, «평발 러닝화 추천»처럼 주 층은
  L3이어도 L1 니즈 표현이 들어 있음을 «층 포함률» 표로 보인다. 시드 표현을 뺀 층은
  `layer_facets_beyond_seed`에 따로 남고 포함률 표에 «시드 표현 제외» 열로 나온다.
- **단계**: 사전 `stages`에서 먼저 걸린 것. 안 걸리면 «미분류».
- **T5 — ① 같은 검색의 중복은 한 번만**: 시계열이 완전히 같은 행(시계열이 없으면 볼륨·CPC·경쟁도가 모두 같고
  토큰이 겹치는 행)은 canonical이 달라도 같은 검색으로 보고 대표 행만 센다 [추정]. 평가 case1(gl=us)에서 이 처리
  없이 하한 15,226,150 · 상한 17,805,130이던 값이 78행 병합 후 하한 = 상한 6,795,360이 됐다 — 이전 «하한»은
  하한이 아니었다.
- **T5 — ② 그룹 볼륨 하한·상한 병기**: 남은 canonical 그룹마다 **하한 = 그룹 내 최댓값**(변형이 같은 검색의
  중복일 때)과 **상한 = 그룹 내 합**(서로 다른 검색일 때)을 낸다 [추정 — 규칙 기반 집계]. 시계열이 다른 변형은
  응답만으로 어느 쪽인지 알 수 없고 실측에서 두 경우가 모두 관찰됐다(계약 T5). CSV는 행마다 `group_volume_lo`·`group_volume_hi`를, 요약은
  헤더에 «그룹 볼륨 하한 X ~ 상한 Y»를, 분포 표는 구분마다 볼륨 «하한 ~ 상한»과 두 기준의 비중을 적는다.
  **비중 순위와 결론은 하한 기준**이다. 상한 기준에서 순위가 달라지는 구분은 순위 칸에 `i → j ⚠️`로,
  표 아래에 `⚠️ 순위 뒤집힘`으로 적고, «하한·상한 순위 뒤집힘» 절에 요약한다 — 한쪽을 조용히 고르지 않는다.
- **T8 — 논브랜드 분리**: 층·단계 분포를 «전체»와 «논브랜드» 두 열로 낸다. 브랜드 검색은 이미
  존재하는 수요라서, 전체 분포만 보면 구매 단계가 크게 보인다.
- **T7 — 절단 표**: `--call`의 `@limit`과 반환 수를 대조해 절단 호출을 요약 맨 위에 적고, 절단이 있으면
  분포 아래에 «볼륨 상위 표본의 구성 · L1·L2는 하한» 경고를 붙인다.
- **교차확인**: `intents`는 0/1 **플래그**이고 두 개가 동시에 1일 수 있다(평가 3케이스 12그룹). 단계 규칙이
  «탐색·비교·구매»일 때 해당 플래그(`i`·`c`·`t`)가 1이면 일치로 센다 — 최댓값 하나를 고르지 않는다(동률을
  키 순서로 끊으면 i·n 쪽으로 치우친다). `n`만 켜진 그룹과 단계 미분류 그룹은 대조에서 뺀다. 대조 그룹이
  20개 미만이면 요약에 «표본이 작아 일치율을 결론에 쓰지 않는다» 경고가 붙는다 [가정].
- **미반환**: `--gated`(2단 요청)·`--requested`(1단 요청 목록 또는 요청 본문)를 주면 요청했는데 응답에 없는
  키워드를 canonical로 대조해 «미반환 [데이터 공백]»으로 적는다 — 결측 0으로 세지 않는다.
- **기준월**: `ki_all.json`의 `monthly_volume`에서 `total`이 있는 최신 월을 데이터 기준월로 읽어
  헤더에 `데이터 기준월 / 조회일 / 지연`을 적는다. 기준월은 응답에서 읽는다(관측 1개월).

### STEP 7 · 해석과 리포트

요약 MD를 그대로 붙이지 말고 아래 순서로 읽는다.

1. **절단 먼저** — 절단 호출이 있으면 «시장의 의도 구성»이라고 쓰지 않는다. «볼륨 상위 N개 검색어의 구성»이다
2. **미분류 비중** — 층 미분류가 볼륨의 20%를 넘으면 사전을 보강하고 STEP 6을 다시 돌린다(크레딧 불필요).
   단계 미분류는 층과 다르게 읽는다 — 수식어 없는 헤드 검색어(`러닝화`)는 단계 수식어가 없어 미분류가
   정상이고, 볼륨이 커서 단계 미분류 비중이 크게 나온다. 단계 분포는 «수식어가 붙은 검색어의 구성»으로
   쓰고, 헤드 검색어의 단계는 API `intents` 값(`api_i/c/t`)으로 따로 인용한다
3. **일치율** — 대조 그룹이 20개 미만이면 일치율을 결론에 쓰지 않는다. 20개 이상에서 단계-API 일치율이 50% 미만이면 단계 사전이 카테고리 어휘와 안 맞는다. 단계 분포를 결론에
   쓰기 전에 불일치 그룹을 열어 패턴을 고친다. 일치율 자체를 «분류 정확도»로 부르지 않는다 — API 라벨도 정답이 아니다
4. **논브랜드 열로 판단한다** — 콘텐츠·진입 판단은 논브랜드 분포로, 브랜드 방어 판단은 L5로 한다
5. **층 포함률** — 주 층 분포에서 사라진 니즈 표현이 해결책 검색어 안에 얼마나 섞여 있는지 본다.
   상류 니즈를 말할 때는 **«시드 표현 제외» 열**을 근거로 든다 — 시드 토큰이 L1 패턴이면 전체 포함률은
   자명하게 100%에 가깝다(평가 case2 `탈모`)

## 의도 사전 (`intent_dict.json`)

`build_universe.py`(`--themes`)와 `intent_layers.py`(`--dict`)가 **같은 파일**을 읽는다. 공유 분류
스키마(`themes`·`brands`·`rules`·`no_match`)에 `stages`를 더한 형태다.

| 키 | 뜻 |
|---|---|
| `rules.변형치환` | canonical 치환 쌍. NFKC·소문자 다음, **공백 제거 전**에 적용(단어 경계 보존) |
| `exclude` | 카테고리 경계 밖 패턴(canonical 기준 정규식 · 문자열·배열·`{pattern}` 모두 가능). 걸리면 «경계 밖»으로 제외 |
| `themes[]` | 층 `{name, pattern}` — name은 `L4 제품`·`L3 해결책`·`L2 목표`·`L1 니즈`. **배열 순서 = 우선순위** |
| `brands[]` | 브랜드·라인명. canonical 부분일치로 걸리면 층과 무관하게 L5. 한글 1자·영문·숫자 3자 이하는 단어 전체 일치만 |
| `stages[]` | 단계 `{name, pattern}` — name은 `구매`·`비교`·`탐색`(API 라벨 대응에 이 이름을 쓴다). 배열 순서 = 우선순위 |
| `no_match` | `with_brand: "L5 브랜드"`, `without_brand: "미분류"`로 둔다 |

패턴은 **canonical 문자열**(공백 없음·소문자·치환 적용)에 대해 평가된다. 원문 띄어쓰기에 맞춘 패턴
(`"평발 러닝화"`)은 안 걸린다. 층 우선순위를 하류 먼저(L4 → L1)로 두는 것은 «해결책을 말한 검색어는
이미 니즈 단계를 지났다»는 가정이다 — 목적이 니즈 발굴이면 L1을 위로 올려도 된다(리포트에 명시).

## 산출물

아래 컬럼 목록은 `intent_layers.py report`의 실제 출력이다. 스크립트를 고치면 이 목록도 함께 고친다
(`selftest_intent.py`가 집합 일치를 검사한다).

```
intent_layers_{category}.csv
  keyword, canonical, volume_total, dup_of, dup_basis, boundary_excluded,
  group_volume_lo, group_volume_hi, group_n_variants, is_group_representative,
  is_seed, brand, layer, layer_facets, layer_facets_beyond_seed, stage, stage_facets,
  api_intent_flags, api_i, api_n, api_c, api_t, stage_api_agree,
  discovery_round, source_seed, data_ref_month, queried_at,
  label_volume, label_group_volume, label_layer, label_api_intent

intent_summary_{category}.md
  헤더(데이터 기준월/조회일/지연 · 같은 검색의 중복 병합·경계 밖 제외 건수 · 그룹 볼륨 하한 ~ 상한 ·
  브랜드 가드 · 미반환) · 확장 절단 점검 표 · 상류 보강 판정(STEP 4.5) ·
  의도 5층 분포(전체/논브랜드 × 하한·상한 기준 비중 · 순위 하한→상한) ·
  구매 단계 분포(같은 형식) · 층 포함률(하한·상한 기준 · 시드 표현 제외) · 하한·상한 순위 뒤집힘 ·
  API 의도 플래그 일치율(표본 경고) · 라벨 규약
```

- `dup_of`: 같은 검색의 중복이면 대표 키워드(그 행은 세지 않는다) · `dup_basis`: `시계열 일치`/`지표 일치`
- `group_volume_lo/hi`: 중복·경계 밖 행에는 그 행이 합쳐진 대표 그룹의 값(경계 밖이면 빈칸)
- `api_intent_flags`: 켜진 플래그(`c|t`처럼 복수 가능) · `api_i/n/c/t`: 0/1

중간 산출: `seeds.json` · `if_<시드>.json` · `ki1_request.json`(1단 요청 목록) · `ki_metrics.json` · `keyword_universe.csv` · `gated.json` · `ki_all.json`.
분석 소진 크레딧은 각 응답의 `cost_detail.total_cost` 합으로 리포트 끝에 적는다.

## 4-Label

| 라벨 | 이 스킬에서의 적용 |
|---|---|
| `[실제 데이터]` | `volume_total` · 확장 반환 목록 · API `intents` 플래그(`api_i/n/c/t`) · 데이터 기준월 |
| `[추정]` | 층·단계 분류 · canonical 그룹핑 · 같은 검색의 중복 판정 · 단계-API 일치율 · 그룹 볼륨 하한·상한과 그에 기댄 분포 비중·순위(규칙 기반 집계 — «하한 ~ 상한» 범위로만 인용) |
| `[가정]` | 사전 패턴과 선언 순서(하류 우선) · 경계(`exclude`) 패턴 · 짧은 브랜드 가드 길이 · 순위·결론을 하한 기준으로 두는 규칙 · 2단 대상 선정 규칙 · 보강 발동 기준(10) · 일치율 표본 기준(20) |
| `[데이터 공백]` | 미분류 검색어 · 2단 미조회 그룹의 API 라벨 · 미반환 키워드 · 절단으로 잘린 꼬리 · `volume_threshold` 미만 검색어 |

## 한계

- **월 그레인 · 지연은 응답에서 읽는다(관측 1개월)** — `volume_total`은 기준월로 끝나는 12개월 합이다. 이번 달 의도 변화를 말할 수 없다
- 검색은 구매가 아니라 **관심 신호**다. «구매 단계 비중»은 검색량 기준 근사이지 전환율이 아니다
- 검색량 단위는 **건**이다(사람 수 아님)
- 분류는 **규칙 사전**의 산물이다. 사전에 없는 신조어·은어는 미분류로 남는다 — 정확도 수치를 붙이지 않는다
- `intent_finder`는 볼륨 순 절단 표본이다. 꼬리의 니즈·목표 층은 보강 라운드로도 다 오지 않는다
- 한 검색어의 «의도»는 집계 행동의 해석이지 개인의 동기가 아니다. 인과(«이 니즈 때문에 산다»)로 쓰지 않는다
- 성·연령 세분화는 하지 않는다(일부 국가만 반환되는 사양 — 계약 §2)
