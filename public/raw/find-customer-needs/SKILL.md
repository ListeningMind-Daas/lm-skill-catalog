---
name: find-customer-needs
description: |
  제품 카테고리 시드에서 연관 검색어를 모아 **Feature(기능) · Attribute(속성) · Pain(불편)**
  3축 규칙 사전으로 분류하고, 검색량과 전년 동기 추세로 축별 니즈 우선순위 **후보**를 낸다.
  커넥터는 `intent_finder`(확장) + `keyword_info`(지표) 두 개.

  "고객이 진짜 원하는 기능 뭐야" · "검색 데이터로 VOC 분해해줘" · "Feature/Attribute/Pain으로 나눠줘" ·
  "○○ 사용자들이 뭘 불편해하는지 보고 싶어" · "제품 로드맵 우선순위 근거 좀 뽑아줘" ·
  "다음 제품에 어떤 기능 넣어야 할지 데이터로 보자"
  같은 요청이면 반드시 이 스킬을 쓴다.

  사용자가 "VOC"라는 말을 쓰지 않아도, **상품기획·PM이 기능·속성·불편의 상대적 크기를
  검색 행동으로 비교하려는 요청**이면 켠다. 순위는 로드맵 결정이 아니라 검토 후보다 —
  검색은 관심 신호이지 만족도·구매가 아니다.

  경계: 카테고리 키워드 지도 자체가 목적이면 `map-your-market`, 무엇이 커지는지(변화율)가
  목적이면 `spot-trends`로 간다. 리뷰·설문·CS 로그 같은 내부 VOC 분석은 이 스킬의 범위가 아니다.
license: MIT
metadata:
  version: "1.2.1"
---

<!-- lm-skill: kind=task; connectors=keyword_info,intent_finder; flags=monthly,expand,share; traps=T1,T2,T3,T4,T5,T6,T7,T8 -->

# Find Customer Needs — 검색어로 보는 3축 니즈 분해

> **핵심 원칙**: 고객은 "기능 목록"을 검색하지 않는다. 검색어는 **기능 요청(Feature) · 원하는 속성(Attribute)
> · 불편 호소(Pain)** 로 흩어져 나타난다. 이 스킬은 그것을 **재현 가능한 규칙**으로 모아 크기를 비교한다.

## 데이터 계약

이 스킬은 `references/lm-data-contract.md`(정본 사본)를 따른다. 계약은 확장할 수 있지만
뒤집을 수 없다. 이 스킬에 해당하는 함정 처리 의무와 처리 위치:

| 함정 | 처리 위치 | 상태 |
|---|---|---|
| T5 표기변형 canonical 정규화 | STEP 1 (시드 canonical 대조) · STEP 4 (`build_universe.py` · 같은 검색 중복 `dup_of`) · STEP 6 (그룹 볼륨 하한·상한 병기 · 뒤집힘 표시) | ✅ |
| T1 기준월·지연 3종 표기 | STEP 5.5 · STEP 6 md 헤더 | ✅ |
| T2 마지막 달 완결성 점검 | STEP 5.5 점검 · STEP 6 기본 제외 · md에 미완결 의심 건수 | ✅ |
| T3 volume_trend 대신 전년 동기 비교 | STEP 6 (`monthly_volume` 직접 계산) | ✅ |
| T4 기저 볼륨 게이트 | STEP 5 (`select_stage2.py`) · STEP 6 (`--gate` · `--item-gate`) | ✅ |
| T6 결측 월 처리 | STEP 6 («결측 월» 상태로 보존) | ✅ |
| T7 절단(limit) 검사 — 절단이면 수렴 판정 보류 | STEP 2 기록 · STEP 3 판정 · STEP 6 헤더 | ✅ |
| T8 논브랜드 분리 산출 | STEP 3 곡선 · STEP 6 축별 순위 분리 | ✅ |

> 이 표는 선언이다. 실제 처리는 아래 STEP 본문에 있다.

## 커넥터와 크레딧

| 커넥터 | 용도 | 크레딧 결정식 |
|---|---|---|
| `keyword_info` | 시드 존재 검증 · 유니버스 지표 · 선별 대상 시계열 | `ads_metrics` 1 × 키워드 · `all` 10 × 키워드 |
| `intent_finder` | 시드에서 연관 검색어 확장 | 호출당 `30 × 입력 키워드 + 2 × 반환` — 시드 1개씩 호출하면 `30 + 2 × 반환` |

**예산식** (S = 시드 수, 반환ᵢ = i번째 `intent_finder` 호출의 반환 수, N = 유니버스 크기,
M = 2단 대상 수 = B + M_main + M_pain — STEP 5):

```
총 크레딧 = S × 1                      # STEP 1 시드 존재 검증 (ads_metrics) — 요청 수로 과금, 미반환도 과금
          + Σ (30 + 2 × 반환ᵢ)          # STEP 2 확장 — 호출 1건의 상한은 30 + 2 × limit
          + N × 1                      # STEP 4 유니버스 전량 (ads_metrics)
          + 10 × (B + M_main + M_pain) # STEP 5 기준선 + 게이트 통과 대표 + Pain 긴 꼬리 (all)
```

- **2단 조회가 기본이다.** 전량에는 `ads_metrics`(1)만 걸고, 시계열이 필요한 대상만 `all`(10)로 조회한다.
  `M × 10` 항이 총액을 지배하므로 **M을 정하는 규칙이 이 스킬에서 가장 큰 비용 결정**이다.
  Pain 추가분 `M_pain`의 상한은 `10 × Pain 항목 수 × 브랜드 범위(2) × --pain-per-item`이다.
- 계산 예 `[추정]`: 시드 8개 · 라운드 1(limit 100) · 보완 라운드 6호출(limit 100) · N=600 · M=80이면
  상한은 `8 + 8×230 + 6×230 + 600 + 800 = 4,628`. 실제는 반환 수가 limit보다 적은 만큼 줄어든다.
- `ads_info`는 쓰지 않는다 — 계약 §1 — 단가가 환경마다 다르게 관측됐고(10 · 1) `all`이 상위집합이다.
- 배포 환경마다 단가가 다를 수 있다. 응답 `cost_detail.total_cost`를 합산해 «이번 분석 소진»으로 보고한다.

> `cluster_finder`는 쓰지 않는다 — 3축 분류에 군집이 필요하지 않고, 결정식 `150 + 고유 키워드 × 50`이라
> limit 120이면 이 한 호출이 6,150이다. 군집 구조가 목적이면 군집 분석 스킬을 따로 쓴다.

## 번들 자산

| 파일 | 하는 일 | 쓰는 곳 |
|---|---|---|
| `scripts/seed_check.py` | 시드 존재 검증 — **canonical 대조** · 볼륨 0 · 미반환 분리 (이 스킬 고유) | STEP 1 |
| `scripts/coverage_curve.py` | 라운드별 신규 발견 기여 + **호출 단위** 절단 검사 + 논브랜드 곡선 | STEP 3 |
| `scripts/build_universe.py` | 지표 결합 + canonical 정규화 + 같은 검색 중복(`dup_of`) + 축 사전 적용 → 유니버스 CSV | STEP 4 |
| `scripts/series_dedup.py` | canonical · 같은 검색 중복 판정 (공유 자산 사본) | STEP 1·4 |
| `scripts/select_stage2.py` | 2단 대상 M 선정(기준선 + 게이트 통과 + Pain 긴 꼬리) + 크레딧 (이 스킬 고유) | STEP 5 |
| `scripts/check_refmonth.py` | 데이터 기준월·지연·마지막 달 완결성 | STEP 5.5 |
| `scripts/voc_axes.py` | **3축 분해 + 경계 점검 + 기준선 대비 추세 + 니즈 항목 순위 + md 리포트** (이 스킬 고유) | STEP 6 |
| `scripts/trend_yoy.py` | 키워드 단위 전년 동기 재계산 (교차확인) | STEP 7 |
| `scripts/selftest.py` | 공유 스크립트 계약 검증 (공유 자산 사본 — 고치지 않는다) | 스킬 수정 후 |
| `scripts/selftest_voc.py` | 위 selftest + `voc_axes.py`를 **이 문서의 예시 명령 그대로** 실행 검증 | 스킬 수정 후 |
| `assets/themes.template.json` | 분류 사전 템플릿 (공유 자산 사본) | STEP 4 |
| `assets/axes.electric-toothbrush-kr.example.json` | 3축 사전 예시 — **카테고리마다 새로 쓴다** | STEP 4 |
| `references/lm-data-contract.md` | 데이터 계약 정본 사본 | 전 구간 |

축 사전은 `themes` 스키마(`references/themes-schema.md`)를 그대로 쓰고, 테마 이름만
`Pain:` · `Feature:` · `Attribute:` 접두어로 시작한다. `theme_primary`는 **배열 순서**로 정해진다.
이 스킬은 두 키를 더 읽는다 — `exclude`(인접 카테고리 canonical 정규식 · 집계 제외)와
`category_terms`(카테고리어 · 하나도 포함하지 않는 검색어는 «경계 점검»).

**이 문서나 스크립트를 고쳤다면 `python3 scripts/selftest.py`를 돌린다.** 공유 selftest가 끝나면
`selftest_voc.py`가 STEP 1·3·4·5·5.5·6·7의 예시 명령을 **문서에 적힌 그대로** 합성 픽스처로 실행해 컬럼·함정 처리를
검사한다(API·크레딧 불필요).

## 사전 확인

```
1. 분석 시장(gl)이 단일 값으로 확정되었는가? → kr / us / jp 중 하나. 없으면 묻는다(즉시 실행 금지)
2. 카테고리 경계가 명시되었는가? → "전동칫솔"인가 "구강케어 전체"인가. 경계가 축 사전 범위를 정한다
3. 영어 키워드는 모두 소문자인가? → API 호출 전 변환
4. 카테고리가 15개월 이상 검색되어 왔는가? → 전년 동기 비교에 최소 15개월이 필요하다.
   출시 직후 제품·신생 카테고리는 추세 열이 «데이터 공백»으로 남는다는 것을 먼저 알린다
5. B2B·전문 장비처럼 검색량이 작은 카테고리인가? → 게이트를 통과하는 그룹이 적어 순위가 불안정하다.
   인터뷰·CS 로그 같은 정성 자료 보완을 권한다
```

## 실행 순서

### STEP 0 · 경계 + 시드 3축 설계

시드를 사용자에게 떠넘기지 않는다. 아래 3축으로 만든다(각 축 최소 2개 · 합계 6~10).

| 축 | 뽑는 것 | 전동칫솔 KR 예시 |
|---|---|---|
| **카테고리어** | 상위 카테고리어 + 주요 형태 | 전동칫솔 · 음파칫솔 |
| **기능·속성어** | 구동 방식·핵심 속성 | 회전식 전동칫솔 · 휴대용 전동칫솔 |
| **불편 탐침어** | 카테고리어 + 불편 표지어 | 전동칫솔 단점 · 전동칫솔 고장 |

**불편 탐침어를 반드시 넣는다.** 불편 표현은 볼륨이 작은 긴 꼬리에 있을 수 있어, 카테고리어만으로
확장하면 `volume_threshold`에 걸려 Pain 축이 비어 보일 수 있다. Pain이 0건이면 «불편이 없다»가 아니라
«탐침하지 않았다»일 수 있다 — 리포트에 탐침어 목록을 적는다.

### STEP 1 · 시드 존재 검증 (`keyword_info` · `ads_metrics`)

```python
keyword_info(keywords=seeds, gl="kr", data_type="ads_metrics")   # 1 × S  → seed_check.json
```

```bash
python3 scripts/seed_check.py seeds.json seed_check.json --rules axes.json -o seeds_live.json
```

- 응답 키워드는 요청 문자열과 다를 수 있다(`음파칫솔` 요청 → `음파 칫솔` 응답). **문자열이 아니라 canonical로
  대조한다** — 문자열 대조는 살아 있는 시드를 죽었다고 판정한다(계약 §1). `seed_check.py`가 이 대조를 한다.
- 결과는 세 갈래다. **살아 있음**(STEP 2 확장 대상 · 응답 표기가 다르면 함께 적는다) ·
  **볼륨 0**(행은 왔으나 `volume_total` 0) · **미반환**(요청했는데 canonical이 같은 행이 없다 — 0이 아니다).
  볼륨 0과 미반환은 확장하지 않고 **따로** `[데이터 공백]`으로 기록한다. 죽은 시드로 확장하면 호출당 30이 버려진다.
- 과금은 요청한 시드 수다. 미반환 시드도 과금되고, 요청하지 않은 변형 행은 과금되지 않는다(계약 §1).

### STEP 2 · 연관 검색어 확장 (`intent_finder`)

```python
intent_finder(
  keywords=[seed], gl="kr",        # 시드 1개씩 — 반환이 어느 시드에서 왔는지 남기기 위해
  volume_threshold=50,             # 카테고리어·기능·속성어 시드. 소형 카테고리는 10
  limit=100,                       # 반환 1건당 2크레딧 — limit이 호출 상한을 정한다
  sort="volume_total", order="desc",
)   # 크레딧 = 30 + 2 × 반환  → intent_r1_<시드>.json (호출 1건 = 파일 1개)
```

- **불편 탐침어 시드는 `volume_threshold=10`** `[가정]`으로 부른다. 불편 표현은 긴 꼬리라 50에서 잘려
  Pain 축이 비어 보인다. 문턱을 낮춰도 크레딧 상한(`30 + 2 × limit`)은 그대로다.
- 반환은 **키워드 문자열 배열**이다. 볼륨·CPC는 STEP 4에서 붙인다.
- **호출 1건 = 파일 1개**로 저장하고, 호출마다 **`요청 limit`과 `반환 수`**를 기록한다. 반환 수가 limit에
  딱 붙은 호출은 **절단**이다 — API가 더 줄 수 있었는데 받지 않은 것이다. 절단은 라운드 합계가 아니라
  **호출 단위**로 본다(시드 2개 × limit 100이 150개를 돌려줬다면 한쪽이 잘렸을 수 있다). 이 기록이 STEP 3의 입력이다.

### STEP 3 · 수집 범위 판정 (절단 검사 · 논브랜드 곡선)

```bash
python3 scripts/coverage_curve.py --metrics metrics_ads.json --rules axes.json --themes axes.json --round "S1·시드=seeds_live.json" --round "R1·확장1=intent_r1_전동칫솔.json@100,intent_r1_전동칫솔단점.json@100"
```

- `--round`는 `라벨=호출1.json@limit,호출2.json@limit,…` — **호출마다 파일과 limit을 따로** 적는다.
  라운드 파일을 하나로 합쳐 `@limit` 하나를 달면 호출 단위 절단을 못 본다(합집합 길이는 limit을 넘기도, 못 미치기도 한다).
- `--rules axes.json`은 축 사전의 `rules.변형치환`을 읽는다 — STEP 1·4와 같은 canonical을 쓴다.

- 라운드의 신규 발견 기여가 20% 미만이면 수렴, 이상이면 보완 라운드를 한 번 더 돈다.
- **절단된 라운드(`반환 = limit`)가 있으면 수렴 판정을 보류**한다. 절단은 수렴처럼 보인다 — 싸게 돌릴수록
  «더 나올 게 없다»처럼 보인다. 보류면 limit을 올려 재호출하거나, 보류 상태 그대로 리포트 헤더에 적는다.
- `--themes`로 브랜드 사전을 넘기면 **논브랜드 곡선**을 따로 낸다. 브랜드 검색어가 대부분이면 전체 곡선이
  닫혀도 카테고리 일반 니즈 공간은 안 닫혔을 수 있다.
- 판정 문구(예: `수렴(R2 기여 12%)` · `보류(R1 절단)`)를 STEP 6의 `--coverage`로 넘긴다.
- 라운드마다 반환이 오면 `ads_metrics`로 지표를 붙여야 곡선이 계산된다 — 이 조회가 STEP 4의 N × 1이다.

### STEP 4 · 축 사전 작성 + 유니버스 조립

1. `assets/axes.electric-toothbrush-kr.example.json`을 참고해 해당 카테고리의 `axes.json`을 쓴다.
   - 테마 이름은 `Pain:…` · `Feature:…` · `Attribute:…`. 이름 뒤가 **니즈 항목**이 된다
   - **Pain을 배열 맨 위에 둔다.** `충전 안됨`은 Feature `충전`에도 걸리는데, 먼저 선언된 테마가 주 축이 된다.
     여러 축에 걸린 검색어는 산출물 `multi_axis=Y`로 남으니 STEP 7에서 검토한다
   - 패턴은 **canonical 문자열**(NFKC → 소문자 → 공백 제거 → 변형치환)에 맞춘다. `충전 안됨`이 아니라 `충전안됨`
   - `brands`는 STEP 2 반환의 **상위 볼륨 검색어에서 뽑아** 채운다. 빠진 브랜드는 논브랜드로 집계돼
     일반 니즈를 부풀린다
   - **`category_terms`**(카테고리어 목록)와 **`exclude`**(인접 카테고리 canonical 정규식)를 쓴다. `intent_finder`는
     인접 카테고리 검색어도 돌려준다 — 제습기 평가(2026-09-28)에서 `공기청정기 소음` 같은 검색어가 제습기 Pain으로
     집계됐다. `exclude`에 걸린 검색어는 집계·2단 조회에서 빠지고(«경계 밖»), `category_terms`를 하나도 포함하지 않는
     검색어는 STEP 6 md의 «카테고리 경계 점검» 목록에 오른다
2. 유니버스 전량 지표를 붙이고 조립한다.

```python
keyword_info(keywords=universe, gl="kr", data_type="ads_metrics")   # 1 × N  → metrics_ads.json
```

```bash
python3 scripts/build_universe.py --metrics metrics_ads.json --themes axes.json --seeds seeds_live.json --round "S1·시드=seeds_live.json" --round "R1·확장1=intent_r1_전동칫솔.json" --round "R1·확장1=intent_r1_전동칫솔단점.json" -o keyword_universe.csv
```

`build_universe.py`의 `--round`는 파일 하나씩 받는다 — 같은 라운드의 호출 파일은 **같은 라벨로 반복**한다(`@limit` 없이).

API는 요청하지 않은 **표기변형**(`음파칫솔`/`음파 칫솔`, `oral-b`/`오랄비`)을 함께 돌려준다.
`build_universe.py`가 `canonical` 그룹키를 붙이고 행은 보존한다. 합산은 STEP 6에서 그룹 기준으로 한다.
지표까지 같은 행(같은 검색의 중복 · 계약 T5 ①)은 `dup_of`에 대표를 적고 한 번만 센다 — 이 처리가 없으면 중복 행이
상한을 부풀려 **실제로는 없는 «상한 시 순위 뒤집힘»** 경보가 난다.

### STEP 5 · 2단 조회 대상 선정 + 시계열 (`keyword_info` · `all`)

2단 대상 M은 **규칙으로** 정한다 — 손으로 고르면 재현되지 않는다. 그룹 = canonical(`dup_of` 중복·경계 밖 제외),
대표 = 그룹 내 `volume_total` 최댓값 행.

```
B      = 카테고리 기준선 대표 (기본 --category 검색어) — 게이트와 무관하게 항상
M_main = 축 분류 그룹 대표 ∧ volume_total ≥ 12,000        (12개월 합 · 기저 게이트의 연 환산 [가정])
M_pain = Pain 그룹 대표 ∧ 1,200 ≤ volume_total < 12,000   [가정]
         Pain 항목 × 브랜드 범위마다 볼륨 순 상위 5개(--pain-per-item)
크레딧 = 10 × (B + M_main + M_pain)                       (keyword_info · data_type=all)
```

```bash
python3 scripts/select_stage2.py --universe keyword_universe.csv --axes axes.json --category 전동칫솔 -o pool_M.json
```

- **기준선 B가 있어야 Pain 추세를 읽을 수 있다.** 카테고리 전체 검색이 −35%일 때 불편 검색 −36%는 «불편이 줄었다»가
  아니라 «카테고리와 같이 움직였다»다. STEP 6이 항목 추세를 기준선 대비로도 낸다.
- **Pain은 긴 꼬리에 있다.** 12,000 게이트만 쓰면 Pain 항목 대부분이 «시계열 없음»으로 남는다(2026-09-28 제습기 평가).
  `M_pain`으로 작은 Pain 그룹을 사고, STEP 6이 **항목 단위로 합산한 뒤** 게이트(`--item-gate`)를 건다.
  추가분 상한은 `10 × Pain 항목 수 × 2(브랜드 범위) × 5`다 — 실행 전에 `select_stage2.py` 출력의 크레딧을 확인한다.
- 표기변형은 대표 하나만 조회한다 — 같은 수요에 10크레딧을 두 번 내지 않는다.
- 미분류 검색어는 2단 대상에서 뺀다(기준선 제외). 순위에 들어가지 않는 것에 시계열을 사지 않는다.
- M 밖의 그룹은 추세 열이 «시계열 없음»으로 남는다. **기저가 작은 그룹의 성장률은 그룹 단위로 계산하지 않는다**
  — 월 20건이 60건이 되면 +200%로 1위에 올라온다. 리포트에 M의 선정 기준과 제외 규모를 적는다.

```python
keyword_info(keywords=pool_M, gl="kr", data_type="all")   # 10 × M  → metrics_all.json
```

### STEP 5.5 · 데이터 기준월 확인 ⚠️ 생략 금지

```bash
python3 scripts/check_refmonth.py metrics_all.json --queried-at 2026-09-28
```

- `monthly_volume`의 `month` 최댓값이 **데이터 기준월**이다. 기준월은 응답에서 읽는다(관측 1개월 — 계약 §2) — 고정값으로 쓰지 않는다.
  리포트 헤더에 **`데이터 기준월 / 조회일 / 지연`** 세 값을 적는다.
- 같은 명령이 **마지막 달 완결성**을 검사한다 — 최신 월 MoM이 실제로 하락했고 그 낙폭이 전년 같은 구간보다
  30%p 이상 나쁘면 미완결 의심이다. 의심 건수를 리포트에 적는다.
- 계절 카테고리(제습기·선풍기 등)에서 조회일을 시점으로 읽으면 «성수기가 끝나 빠지는 중»과 «성수기 한복판»이
  뒤바뀐다. 이 스킬이 전월 대비가 아니라 **전년 동기**로만 추세를 말하는 이유다.

### STEP 6 · 3축 분해 + 니즈 항목 순위

```bash
python3 scripts/voc_axes.py --universe keyword_universe.csv --monthly metrics_all.json --axes axes.json --category 전동칫솔 --queried-at 2026-09-28 --coverage "수렴(R1 기여 12%)"
```

`voc_axes.py`가 하는 일:

| 처리 | 방법 | 함정 |
|---|---|---|
| 축·니즈 항목 부여 | `theme_primary`의 접두어로 축, 뒤를 니즈 항목으로. 접두어 없으면 `unclassified` | — |
| 같은 검색 중복 | `dup_of`가 있는 행은 행만 남기고 집계에서 뺀다 | T5 ① |
| 카테고리 경계 | `--axes`의 `exclude`에 걸리면 `axis=경계 밖`으로 집계 제외 · `category_terms` 미포함이면 `boundary=경계 점검` | — |
| 표기변형 | canonical 그룹 볼륨을 **하한(그룹 최댓값)과 상한(그룹 합)** 둘 다 낸다. 비중은 각자의 분모로 계산 | T5 |
| 하한/상한 판정 | 순위·판정은 하한 기준. 상한으로 다시 매겨 순위나 `trend_call`이 바뀌면 `flip_under_hi`에 적는다 | T5 |
| 브랜드 분리 | `brand_scope`(브랜드/논브랜드)별로 **따로 집계·따로 순위** | T8 |
| 추세 | `monthly_volume`에서 최근 3개월 합 ÷ 전년 같은 3개월 합 − 1. `volume_trend`는 읽지도 싣지도 않는다 | T3 |
| 마지막 달 | **기본 제외** — 창이 기준월 한 달 전에서 끝난다. `--include-last-month`로 포함하면 md에 명시된다 | T2 |
| 결측 월 | 비교 창에 `nv_code` 결측이 있으면 0으로 채우지 않고 `yoy_status=결측 월`로 남기고 추세 합산에서 뺀다 | T6 |
| 기저 게이트 | 그룹 추세(`group_yoy`)는 전년 창 합이 `--gate`(기본 3,000) 미만이면 `게이트 미달`로 내지 않는다 | T4 |
| 항목 추세 | 시계열이 있고 결측 없는 그룹(`계산됨`·`게이트 미달`)을 **합산한 뒤** 전년 창 합이 `--item-gate`(기본 1,000) 이상일 때만 낸다. 추세가 잡힌 그룹이 항목 볼륨의 50% 미만이면 `잠정` | T4·T6 |
| 카테고리 기준선 | `--baseline`(기본 `--category`) 검색어의 전년 동기 `baseline_yoy`와 기준선 대비 `yoy_rel_baseline = (1+항목)/(1+기준선) − 1` · `trend_call_rel`(±10% [가정]) | — |
| 헤더 | 기준월·조회일·지연 · 비교 창 · 마지막 달 처리 · **미완결 의심 건수** · 게이트 · 기준선 · 수집 범위(`--coverage`) · 분류율 · 경계 밖/점검 | T1·T2·T7 |

**왜 두 값인가.** 응답은 변형 행(`음파칫솔`/`음파 칫솔`)이 같은 검색을 중복 집계한 것인지 서로 다른 검색인지
알려주지 않는다. 실측 대조에서 두 경우가 모두 관찰됐다(`런닝화` 975,560 vs `러닝화` 801,710처럼 값이 다른 쌍,
`드롱기 커피머신 as` = `드롱기 커피머신as` 6,690처럼 같은 쌍). 그래서 한쪽을 기본값으로 고르지 않고 «하한 X ~ 상한 Y»로 적는다.
전년 동기 추세는 그룹 **대표 검색어 한 개**의 시계열로 계산하므로 하한 기준이다 — 상한 시계열은 만들지 않는다
(`yoy_series_basis`).

**순위 = 축 × 브랜드 범위 안에서 12개월 검색량(하한) 순**이다. 가중 합성 점수를 만들지 않는다 — 가중치를
정당화할 근거가 없어서다. 추세는 순위를 바꾸지 않고 옆 열(`trend_call`: 상승/보합/하락/잠정)로 붙인다.

### STEP 7 · 검토와 해석

1. **분류율을 먼저 본다.** 미분류 볼륨이 크면 순위가 사전의 빈칸을 반영한 것이다. md 끝의
   «미분류 상위 검색어»를 보고 사전을 보강한 뒤 STEP 4 조립부터 다시 돌린다(API 재호출 불필요 · 0크레딧).
   구매 탐색어(`추천`·`순위`·`가격 비교`)는 니즈가 아니므로 미분류로 두는 것이 맞다.
2. **카테고리 경계를 점검한다.** md의 «카테고리 경계 점검»에서 ① 경계 밖(exclude)으로 빠진 검색어가 정말 인접 카테고리인지,
   ② 카테고리어가 없는 검색어 중 인접 카테고리(예: 제습기 유니버스의 `공기청정기 …`)가 섞였는지 본다. 섞였으면
   `exclude`에 패턴을 더하고, 이 카테고리 검색어면 `category_terms`를 보강한 뒤 STEP 4부터 다시 돌린다(0크레딧).
   이미 2단 조회한 대상이 경계 밖으로 빠지면 그 크레딧은 회수되지 않으므로, 이 점검은 STEP 5 전에 한 번 먼저 한다.
3. **`multi_axis=Y` 검색어를 훑는다.** 주 축이 배열 순서로 정해졌으므로, 의도와 다르면 사전 순서나 패턴을 고친다.
4. **Pain 추세는 기준선과 함께 읽는다.** `trend_call`이 `하락`이어도 `trend_call_rel`이 `기준선과 같이 움직임`이면
   불편이 줄었다고 쓰지 않는다 — 카테고리 검색 전체가 줄었다. 기준선이 계산 불가면 Pain 추세 문장에 그 사실을 적는다.
5. 상위 항목 몇 개를 `trend_yoy.py`로 키워드 단위 재계산해 추세 방향이 일치하는지 교차확인한다. `voc_axes.py`는
   마지막 달을 뺀 창이 기본이므로 **`yoy_ex_last_month` 열과 비교한다**(`yoy` 열은 마지막 달을 포함한 창이다).

```bash
python3 scripts/trend_yoy.py metrics_all.json -o trend.csv --gate 3000
```

6. 브랜드 범위 표는 **그 브랜드 제품에 대한** 니즈다. 카테고리 일반 니즈로 옮겨 말하지 않는다.
7. 왜 그 불편이 검색되는지(특정 모델 결함·리콜 이슈·계절)는 이 스킬이 답하지 못한다. 상위 Pain은 SERP로 맥락을 따로 확인한다.

## 산출물

아래 컬럼 목록은 `voc_axes.py`의 실제 출력이다. 스크립트를 고치면 이 목록도 함께 고치고
`selftest_voc.py`로 확인한다.

```
voc_decomposition_{category}.csv
  keyword, canonical, axis, need_item, facets, multi_axis, brand, brand_scope,
  volume_total, group_volume_lo, group_volume_hi, cpc, discovery_round, canonical_rep,
  dup_of, boundary, group_yoy, yoy_status, label_axis, label_group_volume

roadmap_priority_{category}.csv
  axis, need_item, brand_scope, keywords, canonical_groups, volume_12m_lo,
  volume_12m_hi, volume_share_in_axis_lo, volume_share_in_axis_hi, axis_rank,
  axis_rank_hi, yoy_window, yoy, yoy_series_basis, yoy_groups, yoy_basis_prev_year,
  yoy_coverage_lo, yoy_coverage_hi, yoy_status, trend_call, trend_call_hi,
  flip_under_hi, baseline_yoy, yoy_rel_baseline, trend_call_rel, top_keywords,
  data_ref_month
```

`roadmap_priority_{category}.md` — 헤더(데이터 기준월/조회일/지연 · 비교 창 · 마지막 달 처리 · 게이트 ·
수집 범위 판정 · 분류율·논브랜드 비중 «하한 기준 X ~ 상한 기준 Y» · 그룹 볼륨 합 하한 ~ 상한 · 뒤집힘 항목 수 ·
추세가 대표 검색어 기준이라는 표기) · 축 × 브랜드 범위별 상위 항목 표(하한 순위 · 검색량 «하한 X ~ 상한 Y» ·
비중 하한/상한 · 상한 시 뒤집힘 · 라벨 병기 · 상한 기준이면 상위에 드는 항목) · 미분류 상위 검색어(하한~상한) · 라벨 규약.

- `voc_decomposition`은 행을 보존한다(표기변형·중복·경계 밖 포함). `dup_of`는 같은 검색 중복의 대표,
  `boundary`는 `경계 밖(패턴)` 또는 `경계 점검`이다. `group_yoy`·`yoy_status`는 그룹 대표 행에만 채운다.
- `volume_12m_lo`는 canonical 그룹 최댓값의 합, `volume_12m_hi`는 그룹 합의 합이다(중복·경계 밖 행 제외) [추정].
  `volume_share_in_axis_lo`·`_hi`는 각각 같은 기준의 축 합을 분모로 한다. `yoy_coverage_lo`·`_hi`도 같다.
- `axis_rank`·`trend_call`은 하한 기준, `axis_rank_hi`·`trend_call_hi`는 상한 기준이다. 둘이 다르면
  `flip_under_hi`에 `순위 2→1` · `판정 잠정→상승`처럼 적는다. `yoy`는 대표 검색어 시계열(하한 기준) 하나뿐이다.
- `yoy`는 시계열 있는 그룹의 합산 추세, `yoy_groups`는 합산에 들어간 그룹 수, `baseline_yoy`·`yoy_rel_baseline`·
  `trend_call_rel`은 카테고리 기준선과 기준선 대비 판정이다(기준선 시계열이 없으면 빈칸).
- `yoy_status`: 키워드 CSV는 그룹 단위로 `계산됨` / `게이트 미달` / `결측 월` / `시계열 없음`(2단 대상 아님).
  항목 CSV는 `계산됨`(합산 게이트 통과) 또는 `계산 불가: 결측 월 1 · 시계열 없음 2 (합산 게이트 미달 · 전년 창 540)`처럼 사유별 그룹 수.

## 4-Label

| 라벨 | 이 스킬에서의 적용 |
|---|---|
| `[실제 데이터]` | 검색어·`volume_total`·`cpc`·`monthly_volume` 원본과 그로부터의 직접 계산(대표 검색어의 전년 동기 추세) |
| `[추정]` | 축·니즈 항목 분류(정규식 사전 규칙) · 브랜드 판정(사전 기반) · 같은 검색 중복 판정 · 표기변형 그룹 볼륨 하한(최댓값)·상한(합)과 항목 합산 · 축 내 비중 · 추세 커버리지 · 분류율·논브랜드 비중 · 기준선 대비 · 마지막 달 미완결 의심 |
| `[가정]` | 게이트 3,000(그룹 창)·1,000(항목 합산 창)·12,000/1,200(2단 연 환산) · 탐침어 `volume_threshold` 10 · 추세 판정 임계 ±20% · 기준선 대비 임계 ±10% · 커버리지 50% 미만 잠정 · 마지막 달 제외 · 사전 배열 순서 · 카테고리 경계 패턴 · 순위·판정을 하한으로 매김 |
| `[데이터 공백]` | 볼륨 0 시드 · 미반환 시드·키워드 · 시계열 없음·결측 월·게이트 미달 그룹 · 기준선 시계열 없음 · 신생 카테고리의 추세 |

수치를 인용하는 문장은 넷 중 하나를 단다. 순위 자체는 `[추정]`이다(분류가 추정이므로).

## 한계

- **월 그레인 · 지연 있음** — 기준월은 응답에서 읽는다(관측 1개월). 이번 달 출시·이슈의 불편은 아직 데이터에 없다
- 검색은 **관심 신호**다. 검색량이 크다는 것이 만족도가 낮다거나 구매가 많다는 뜻이 아니다.
  검색량 단위는 건이며 사람 수가 아니다
- **분류는 사전이 정한다.** 사전에 없는 표현은 미분류로 떨어지고, 부정 표현을 문맥으로 이해하지 않는다
  (`안 시끄러운`이 Pain `시끄`에 걸릴 수 있다 — 패턴을 좁히거나 Attribute 패턴을 먼저 두는 식으로 사전에서 처리)
- 검색으로 표현되지 않는 니즈(말로 설명하기 어려운 불편, 아직 없는 기능)는 잡히지 않는다
- 인구통계로 니즈를 나누지 않는다. `demography`는 일부 국가만 반환하는 사양이며 이 스킬은 쓰지 않는다
- 브랜드 사전의 누락은 논브랜드 비중을 부풀린다 — 사전 품질이 T8 처리의 품질이다
