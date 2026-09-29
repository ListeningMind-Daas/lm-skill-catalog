---
name: discover-sub-markets
description: |
  시드 키워드 1개의 공동검색 군집(`cluster_finder`)을 하위 시장 후보로 정리하고,
  논브랜드 검색량 · 시드와의 그래프 거리 · 전년 동기 추세로 **«시드에서 떨어져 있지만
  규모가 있는» 숨은 하위 시장**을 가려낸다. 커넥터는 `cluster_finder` + `keyword_info`.

  "숨은 시장 찾아줘" · "니치 세그먼트 발굴해줘" · "이 카테고리 안에 어떤 하위 시장이 있어?" ·
  "캠핑의자 검색 군집 나눠서 보여줘" · "우리가 안 보고 있는 수요 덩어리 있나" ·
  "클러스터 분석으로 틈새 찾아줘" · "hidden sub-market 찾아줘"
  같은 요청이면 반드시 이 스킬을 쓴다.

  사용자가 "군집"이나 "클러스터"라는 말을 쓰지 않아도, **한 카테고리 안의 수요를 덩어리로
  나누고 그중 아직 덜 드러난 덩어리를 찾으려는 요청**이면 켠다.

  경계: 카테고리 전체 키워드 목록(유니버스)을 만드는 일은 `map-your-market`,
  무엇이 커지고 있는지(변화율) 판정은 `spot-trends`로 간다. 이 스킬은 시드 하나 주변의
  공동검색 구조만 본다 — 카테고리 전체 지도가 아니다.
license: MIT
metadata:
  version: "1.2.1"
---

<!-- lm-skill: kind=task; connectors=cluster_finder,keyword_info; flags=monthly,expand,share; traps=T1,T2,T3,T4,T5,T6,T7,T8 -->

# Discover Sub-Markets — 숨은 하위 시장 발견

> **핵심 원칙**: 시장은 하나가 아니다. 함께 검색되는 키워드를 군집으로 묶으면 카테고리 안의
> 하위 시장이 드러난다. 다만 **군집이 곧 시장은 아니다** — 브랜드 모델명 묶음, 표기변형 묶음,
> 한두 키워드짜리 조각을 걸러낸 뒤에 남는 것만 하위 시장 후보다.

## 데이터 계약

이 스킬은 `references/lm-data-contract.md`(정본 사본)를 따른다. 계약은 확장할 수 있지만
뒤집을 수 없다. 이 스킬에 해당하는 함정과 처리 위치:

| 함정 | 처리 위치 | 상태 |
|---|---|---|
| T5 표기변형 canonical 정규화 · 하한/상한 병기 | STEP 4 · STEP 5 (`*_lo`·`*_hi` · `verdict_flip`·`rank_flip`) | ✅ |
| T1 기준월·지연 3종 표기 | STEP 1 (시드 `all`) · STEP 5 (`--seed-all`, 없으면 종료 코드 3) | ✅ |
| T2 마지막 달 완결성 점검 | STEP 6 | ✅ |
| T3 volume_trend 대신 전년 동기 비교 | STEP 6 · STEP 7 | ✅ |
| T4 기저 볼륨 게이트 | STEP 5 (`--size-gate`) · STEP 7 (`--yoy-gate`) | ✅ |
| T6 결측 월 처리 | STEP 6 · STEP 7 (`yoy_uncomputable_n`) | ✅ |
| T7 절단(limit) 검사 — 절단이면 수렴 판정 보류 | STEP 2 · STEP 5 (`truncated` · `star_degenerate`) | ✅ |
| T8 논브랜드 분리 산출 | STEP 3 · STEP 5 (`nonbrand_*` · `brand_dominated` · 브랜드 시드 경고) | ✅ |

> 이 표는 선언이다. 실제 처리는 아래 STEP 본문에 있다.

## 커넥터와 크레딧

| 커넥터 | 용도 | 크레딧 결정식 |
|---|---|---|
| `keyword_info` (`all`) | STEP 1 시드 1개 — 존재 확인 + **데이터 기준월** | `10 × 1` |
| `cluster_finder` | 시드 주변 공동검색 군집(`communities`)과 관계(`rels`) | `150 + 고유 키워드(노드) × 50` |
| `keyword_info` (`ads_metrics`) | 군집 전 키워드의 볼륨 | `1 × 요청 키워드` |
| `keyword_info` (`all`) | 후보 군집 대표 키워드만 — `monthly_volume`으로 전년 동기 추세 | `10 × 키워드` |

`keyword_info`는 **요청한 키워드 수로 과금**한다. 응답에서 빠진 키워드도 과금되고, 요청하지 않은
표기변형이 함께 와도 과금되지 않는다. 응답 표기가 요청과 다를 수 있다(`캠핑의자` → `캠핑 의자`).
빠진 키워드는 «검색량 0»이 아니라 **미반환**이다 — `score`가 `[데이터 공백] 지표 미반환` 목록으로 출력한다.
단가는 배포 환경마다 다를 수 있다(계약 §1) — 고객에게 안내하기 전에 그 환경에서 확인한다.

`cluster_finder`의 과금 단위는 **관계 수가 아니라 고유 키워드 수**다. 관계 수는 노드 수보다
많으므로, 관계 수로 계산하면 예산을 과대 추정한다. `limit`은 반대로 **관계(rels) 수의 상한**이다
— 노드 수 상한이 아니다.

### 예산 (결정식)

```
N = cluster_finder 응답의 고유 키워드 수     (STEP 2가 출력한다)
S = 2단 조회 대상 수                         (STEP 5가 고른다 · 후보 군집 수 × --pick)

총액 = 10                    # STEP 1 시드 확인 + 기준월 (all)
     + 150 + 50 × N          # STEP 2 cluster_finder
     + 1 × N                 # STEP 3 ads_metrics 전량
     + 10 × S                # STEP 6 all — 게이트 통과 가능분만
```

- **호출 전에는 N을 모른다.** `python3 scripts/submarkets.py budget --limit 500`이 두 상한을 함께 낸다:
  - **보수 상한** `N ≤ 2 × limit` — 관계 하나가 새 키워드를 최대 2개 더한다는 데서 나온다. 보장값이다.
    `limit=500`이면 `10 + 150 + 51 × 1,000 = 51,160 + 10 × S`.
  - **관측 상한** `N ≤ limit + 1` `[가정]` — 2026-09-28 관측 4건에서 노드가 모두 limit+1 이하였다
    (limit 50 → 노드 50·44·50). 관계 행이 한 허브에 몰리면 노드 ≈ 관계 수라서다. 보장이 아니므로
    `limit=500`이면 `10 + 150 + 51 × 501 = 25,711 + 10 × S`를 «관측 기준 예상»으로, 보수 상한을 «최대»로 함께 알린다.
- **2단 조회가 핵심 절감 장치다.** `all`(10/kw)을 N 전량에 걸면 `10 × N`이 되지만, 이 스킬이
  추세를 볼 대상은 후보 군집의 대표 키워드뿐이다. S는 `후보 군집 수 × --pick(기본 3)`로 정해진다.
- 계산 예시 [가정]: N = 350, 후보 군집 6개 → S = 18이면
  `10 + (150 + 50 × 350) + 350 + 10 × 18 = 18,190`. 대부분이 `cluster_finder`다.
- 리포트의 «이번 분석 소진»은 각 응답 `cost_detail.total_cost`의 합으로 적는다. 결정식과 다르면
  응답값을 따르고 차이를 적는다.

## 번들 자산

| 파일 | 하는 일 | 쓰는 곳 |
|---|---|---|
| `scripts/submarkets.py` | **이 스킬 고유** — `budget`: 사전 상한 / `nodes`: 고유 키워드·절단·별 모양 검사 / `score`: 군집 집계·하위 시장 판정·2단 대상 선정 | 사전 확인 · STEP 2 · 5 · 7 |
| `scripts/build_universe.py` | 키워드별 지표 결합 + canonical + 브랜드·테마 부여 (공유 스크립트) | STEP 4 |
| `scripts/check_refmonth.py` | 데이터 기준월·지연·마지막 달 완결성 (공유) | STEP 1 · STEP 6 |
| `scripts/trend_yoy.py` | 전년 동기 비교 · 결측 월 안전 (공유) | STEP 6 |
| `scripts/selftest.py` | 공유 스크립트 계약 검증 (공유 사본) | 스킬 수정 후 |
| `scripts/selftest_submarkets.py` | `selftest.py`를 먼저 돌리고 이 문서의 예시 명령 전체를 합성 픽스처로 실행 | 스킬 수정 후 |
| `assets/themes.template.json` | 테마·브랜드 사전 템플릿 — `themes.json`으로 복사해 **카테고리마다 새로 쓴다** | STEP 3 |
| `references/lm-data-contract.md` | 데이터 계약 정본 사본 | 전 구간 |

`themes.json` 스키마는 템플릿의 주석을 따른다. `theme_primary`는 최적 매칭이 아니라
**배열에서 먼저 선언된 테마**로 정해진다 — 하위 시장을 가르는 축(용도·대상·형태)을 위로 올린다.

**이 문서나 스크립트를 고쳤다면 `python3 scripts/selftest_submarkets.py`를 돌린다.**

## 사전 확인

```
1. 분석 시장(gl)이 단일 값인가?        → kr / us / jp 중 하나. 다국가 동시 분석 금지.
2. 시드가 1개로 정해졌는가?             → 카테고리 대표어(예: 캠핑의자 · air fryer). 브랜드명을
                                           시드로 쓰면 군집이 그 브랜드의 모델·부품으로 채워진다
                                           (실측: «헬리녹스 체어원» 342,585건 중 논브랜드 44건).
                                           score가 «⚠️ 브랜드 시드»를 띄우면 대체 시드를 묻는다.
3. 영어 시드는 소문자인가?              → API 호출 전 변환.
4. 조회일을 적었는가?                   → STEP 6에서 기준월과의 지연을 계산한다.
5. 예산 상한을 사용자에게 알렸는가?     → submarkets.py budget --limit … 의 보수·관측 상한 둘 다.
                                           동의 전에는 호출하지 않는다.
```

카테고리 전체를 원하면 이 스킬 한 번으로는 안 된다. 시드 하나의 군집은 **그 시드 주변**만 본다
— 전체 지도가 필요하면 `map-your-market`을 먼저 쓴다.

## 실행 순서

### STEP 1 · 시드 존재 확인 + 데이터 기준월 (`keyword_info` · `all`)

```python
keyword_info(keywords=["캠핑의자"], gl="kr", data_type="all")   # 10 × 1
```

응답을 `seed_all.json`으로 저장하고 기준월을 읽는다:

```bash
python3 scripts/check_refmonth.py seed_all.json --queried-at 2026-09-28
```

- `volume_total`이 비어 있으면 `cluster_finder`를 부르기 전에 시드를 바꾼다(상위 표현으로).
  10크레딧으로 고가 호출의 헛발을 막는다. 응답 표기가 요청과 다를 수 있으니(`캠핑 의자`) 공백을 무시하고 대조한다.
- **기준월은 여기서 확보한다.** 2단 조회 대상이 0개(S = 0)여도 리포트 헤더의 `데이터 기준월 / 조회일 / 지연`이
  비지 않게 하기 위해서다(실측 3건 중 2건이 S = 0이었다 — 여기서 확보하지 않으면 기준월이 빈칸이 된다).
  기준월은 응답의 `monthly_volume` 최신 월에서 읽는다 — 관측 지연은 1개월이었지만 고정값으로 쓰지 않는다.
- 시드의 `monthly_volume`은 시드 코어 군집의 전년 동기 추세로도 쓸 수 있다(STEP 6 `trend_yoy.py`에 함께 넣는다).

### STEP 2 · 군집 호출 + 절단 검사

```python
cluster_finder(keyword="캠핑의자", gl="kr", time_point="curr",
               hop=2, limit=500, orientation="UNDIRECTED", data_type="all")
# 150 + 50 × 고유 키워드 수
```

응답을 `cluster.json`으로 저장하고 바로 돌린다:

```bash
python3 scripts/submarkets.py nodes cluster.json --limit 500 --seed 캠핑의자 -o nodes.json
```

출력: 관계 행 수(무방향 고유 간선 수 · 역방향 중복 쌍 수) · 군집 수 · 고유 키워드 수 N ·
결정식 대조(`cost_detail`과 다르면 경고) · 다음 단계 예상 크레딧. `nodes.json`은 STEP 3의 입력이다.

**역방향 중복.** `rels`에는 같은 쌍이 방향만 바꿔 두 번 들어오는 경우가 있다(실측 3건 중 2건에서 1쌍).
스크립트는 degree·허브·시드 거리를 **무방향 고유 간선**으로 센다. 절단 판정만은 반환 행 수 그대로 쓴다.

**절단 검사 (T7).** 반환된 관계 행 수가 요청 `limit`과 같으면 그래프가 잘린 것이다. `limit`은 관계 행을
반환 순서대로 자르고, **어느 쪽이 잘렸는지는 응답이 알려주지 않는다.** 실측(limit 50)에서는 3건 중 2건이
**50행 전부 허브 한 개의 인접 목록**이었고, 시드의 직접 이웃조차 1개만 남았다 — 잘린 쪽은 먼 주변부가
아니라 허브 밖의 거의 전부였다. 그러니 절단 상태에서 «숨은 하위 시장 없음»이라고 결론 내지 않는다.
스크립트가 `⚠️ 절단`을 띄우면 판정은 «잠정»으로 두고, `limit`을 올려 재호출할지(`budget --limit <새 값>`의
두 상한과 함께) 사용자에게 묻는다. 관계 수가 limit 미만이면 그것이 이 그래프의 실제 크기다.

**별 모양 퇴화.** 한 노드가 고유 간선의 80% 이상 `[가정]`에 닿으면 `⚠️ 별 모양 퇴화`를 띄운다. 이때 군집은
«허브 주변 목록»이지 하위 시장 지도가 아니다. 단일 키워드 군집이 많이 남는 것도 이 상태의 증상일 수 있다
(절단 전 그래프에서 매긴 군집 번호의 잔재로 보인다 `[추정]`). limit 상향 재호출을 권하고 판정은 «잠정»으로 둔다.

**빈 응답.** 관계·군집이 모두 비면 스크립트가 `[데이터 공백]`으로 멈춘다(exit 2). 검색량 0이
아니라 공동검색 네트워크가 임계 아래라는 뜻이다. 시드를 상위 표현으로 바꾼다.

`hop`은 2를 기본으로 둔다. `hop=3`은 인접 시장까지 끌어와 노드(=과금)와 노이즈가 함께 는다.
`orientation`을 `NATURAL`·`REVERSE`로 바꾸면 «시드 다음/이전에 검색된» 방향 그래프가 되는데,
하위 시장 구분에는 무방향이 기본이다.

### STEP 3 · 볼륨 확보 + 브랜드 사전 (`keyword_info` · `ads_metrics` 전량)

```python
keyword_info(keywords=nodes, gl="kr", data_type="ads_metrics")   # 1 × N
```

응답을 `metrics.json`으로 저장한다. 이 응답에는 세 가지 어긋남이 있을 수 있다(계약 §1, 실측):
요청 키워드 일부가 **빠지고**(미반환 — 과금은 됨), **다른 표기로** 오고(`캠핑의자` → `캠핑 의자`),
**요청하지 않은 변형**이 함께 온다(과금 안 됨). 미반환은 `score`가 `[데이터 공백]`으로 목록을 낸다.

그 다음 `assets/themes.template.json`을 `themes.json`으로 복사해 채운다:

- **`brands` — 기억으로 쓰지 말고 `metrics.json`의 상위 볼륨 키워드를 훑어 채운다 (T8).**
  빠진 브랜드는 전부 논브랜드로 집계되어 브랜드 모델명 군집이 «숨은 하위 시장»으로 둔갑한다.
  캠핑의자라면 헬리녹스·코베아·스노우피크·콜맨처럼 상위에 올라온 이름을 넣는다.
- **유통 채널·PB 이름(다이소·쿠팡·코스트코·이마트 등)** — 기본은 `brands`에 **넣는다** `[가정]`.
  «다이소 캠핑의자»는 특정 판매처의 상품을 찾는 검색이라, 제조사가 새로 들어갈 수 있는 논브랜드 수요로
  세면 여지가 부풀려진다. 질문이 «채널 전략»(어느 판매처로 수요가 가는가)이면 빼고 한 번 더 돌려 두 결과를
  함께 적는다. 어느 쪽으로 했는지 리포트 헤더에 적는다.
- `rules.변형치환` — 해당 언어의 표기 흔들림 쌍. 띄어쓰기 차이는 자동으로 흡수된다.
- `themes` — 하위 시장을 가르는 축을 먼저 둔다(예: 형태·용도 → 대상·상황 → 구매·비교).

### STEP 4 · 키워드 표 조립 (표기변형 canonical)

```bash
python3 scripts/build_universe.py --metrics metrics.json --themes themes.json \
    --seeds seeds.json --round "CF=nodes.json" -o universe.csv
```

`seeds.json`은 `["캠핑의자"]` 한 줄이다. 각 키워드에 `canonical`(NFKC·소문자·치환·공백 제거 —
치환은 공백을 지우기 전에 적용한다)·`brand`·`theme_primary`·`dup_of`가 붙는다. `cluster_finder`는 표기변형
(`캠핑의자`/`캠핑 의자`, `릴렉스체어`/`릴렉스 체어`)을 서로 다른 노드로 돌려준다 — 행은 보존하고 그룹키만 단다.

**어순 변형**(`캠핑의자 소형`/`소형 캠핑 의자`)은 canonical이 달라 한 그룹으로 묶이지 않는다. 대신 `dup_of`가
**같은 검색의 중복**을 잡는다 — 시계열이 완전히 같거나, 시계열이 없으면 볼륨·CPC·경쟁도가 모두 같고 토큰이
겹치는 행(계약 T5 ①). 이런 행은 canonical이 달라도 한 번만 센다. 값이 다른 어순 변형은 서로 다른 검색으로
보고 따로 센다 — 한국어 어순 변형은 대조한 사례 대부분에서 서로 다른 검색이었다(계약 T5).

### STEP 5 · 하위 시장 판정 (1차)

```bash
python3 scripts/submarkets.py score cluster.json --universe universe.csv --seed 캠핑의자 --limit 500 \
    --seed-all seed_all.json \
    -o submarkets.csv --keywords-out submarket_keywords.csv --pick-out stage2_keywords.json
```

**입력 거부.** `--seed`가 비었거나 그래프에 없으면(공백·대소문자 무시, canonical 대조) 판정하지 않고
종료 코드 2로 멈춘다. 시드 거리를 잴 수 없으면 모든 군집이 «연결 없음 = 숨은 후보»로 둔갑하기 때문이다.
**기준월.** `--seed-all`(STEP 1 응답)이나 `--trend`가 없으면 산출물은 쓰되 `⚠️ 데이터 기준월 없음`과
함께 종료 코드 3을 낸다. 이 상태로 리포트를 쓰지 않는다.

군집마다 아래를 계산하고, 위에서부터 처음 걸리는 유형 하나를 붙인다.

| 순서 | 유형 | 조건 [가정] |
|---|---|---|
| 1 | 시드 코어 | 시드(또는 시드의 canonical)가 속한 군집 |
| 2 | 지표 부족 | 볼륨이 없는 키워드가 군집의 절반 이상 |
| 3 | 브랜드 지배 | 논브랜드 볼륨 비중 < `--brand-max`(기본 0.5) — **군집 크기와 무관** |
| 4 | 소형·단일 | canonical 그룹 수 < `--min-groups`(기본 3) |
| 5 | 규모 미달 | 논브랜드 볼륨 하한 < `--size-gate`(기본 10,000 · 12개월 합) |
| 6 | 인접 하위 시장 | 통과 + 시드와 직접 연결(`seed_distance` = 1) |
| 7 | **숨은 하위 시장 후보** | 통과 + 시드까지 최단 거리 2 이상, 또는 연결 경로 없음 |

- **브랜드 지배가 소형·단일보다 먼저다.** 순서가 반대면 브랜드 시드 실측(17개 군집 전부 논브랜드 0%)에서
  «브랜드 지배»가 한 번도 붙지 않는다. 유형과 별개로 `brand_dominated` 컬럼이 **모든 군집**(시드 코어 포함)에
  «예»를 단다. 시드가 브랜드 사전에 걸리거나 그래프 전체 논브랜드 비중 하한이 `--brand-max` 미만이면
  `⚠️ 브랜드 시드`를 출력한다 — 결과는 하위 시장 지도가 아니라 그 브랜드의 제품 라인 지도다.
- 볼륨이 0인 군집은 논브랜드 비중을 정의할 수 없어 브랜드 지배로 보지 않는다(소형·단일 또는 규모 미달로 간다).

- **표기변형 (T5) — 하한과 상한을 둘 다 낸다**: canonical 그룹마다 **하한 = 그룹 내 최대
  `volume_total`**(변형이 같은 검색의 중복일 때), **상한 = 그룹 내 합**(서로 다른 검색일 때)을 계산해
  군집 볼륨·논브랜드 볼륨·논브랜드 비중·테마 비중을 모두 `_lo`/`_hi` 쌍으로 낸다 [추정 — 규칙 기반 집계].
  응답만으로는 어느 쪽인지 알 수 없고, 실측 대조에서 두 경우가 모두 관찰됐다(계약 T5).
  그 전에 **같은 검색의 중복**(`dup_of`)은 canonical이 달라도 한 번만 센다 — 군집별 `dup_rows`에 뺀 행 수가 남는다.
  `릴렉스체어` 40,000 + `릴렉스 체어` 39,000이면 그룹 하한 40,000 ~ 상한 79,000이다.
- **판정·순위는 하한 기준, 뒤집히면 표시한다**: 유형 판정(`submarket_type`)과 같은 유형 안의
  논브랜드 순위(`rank_in_type_lo`)는 하한으로 정한다. 상한으로 다시 판정한 유형은 `submarket_type_hi`,
  다르면 `verdict_flip` = «예». 상한 순위(`rank_in_type_hi`)가 다르면 `rank_flip` = «예». 스크립트는
  뒤집힌 군집을 `⚠️ 판정 뒤집힘`·`⚠️ 순위 뒤집힘`으로 출력한다 — 리포트에 그대로 적고, 한쪽을 조용히 고르지 않는다.
- **논브랜드 분리 (T8)**: `nonbrand_volume`·`nonbrand_share`를 따로 낸다. 브랜드 지배 군집은
  «그 브랜드의 제품 라인»이지 진입 가능한 하위 시장이 아니므로 후보에서 뺀다.
- **기저 게이트 (T4)**: `--size-gate` 미만은 «규모 미달»로 남긴다. 작은 군집은 몇 건의 변동만으로
  순위가 뒤집힌다.
- **절단 (T7)**: 절단이면 모든 행의 `truncated`가 «예»가 되고 출력에 «잠정» 경고가 뜬다. 별 모양 퇴화면
  `star_degenerate`도 «예»다.
- **허브**: 군집 안에서 무방향 고유 간선 수(degree)가 가장 많은 키워드. API는 허브를 표시하지 않으므로
  `rels`에서 직접 센다.
- 후보(숨은·인접) 군집마다 **논브랜드 대표 키워드 상위 `--pick`개**를 `stage2_keywords.json`에
  담는다. 이것이 STEP 6의 S다 — 출력 끝줄에 `10 × S` 크레딧이 찍힌다.
- **2단 대상 사전 게이트** `[가정]`: 최신 3개월 합(`volume_avg × 3`)이 `--yoy-gate` 미만인 키워드는 고르지 않는다.
  전년 동기 3개월이 게이트를 넘을지는 호출 전에는 모르지만, 지금 3개월이 게이트 아래면 판정에 쓰일 가능성이
  낮다(실측: air fryer 2단 대상 3개 전부 게이트 미달 → 30크레딧이 판정에 기여 0). 뺀 키워드는 출력에 적힌다.
  단, 이 대리 지표는 **하락한 키워드**(작년엔 컸고 지금은 작은)를 놓칠 수 있다 — 하락 신호가 목적이면 `--yoy-gate`를 낮춘다.

### STEP 6 · 2단 조회 + 데이터 기준월 확인 ⚠️ 생략 금지

```python
keyword_info(keywords=stage2_keywords, gl="kr", data_type="all")   # 10 × S  (S = 0이면 호출하지 않는다)
```

`all`은 `monthly_volume`을 준다. 이 스킬은 `ads_info`를 쓰지 않는다 — 단가가 환경마다 달라(계약 표 10 · 개발 환경 실측 1) 확인 없이 싸다고 볼 수 없고, 시드 조회와 같은 `all`로 통일한다(계약 §1).
응답을 `all.json`으로 저장하고:

```bash
python3 scripts/check_refmonth.py all.json --queried-at 2026-09-28
python3 scripts/trend_yoy.py all.json -o trend.csv --gate 3000
```

- **기준월 (T1)**: 리포트 헤더에 `데이터 기준월 / 조회일 / 지연` 세 값을 적는다. 기준월은 응답에서 읽는다
  (관측 1개월 — 2026-09-28 조회에서 2026-08). STEP 1에서 이미 읽었다면 같은 값인지 확인한다.
  `ads_metrics`의 `volume_total`(12개월 합)도 조회일이 아니라
  이 기준월에서 끝난다 — 군집 규모를 «지난 12개월»이라 쓸 때 기준월을 함께 적는다.
- **마지막 달 (T2)**: `check_refmonth.py`가 최신 월의 MoM을 전년 같은 구간과 대조해 미완결 의심
  건수를 낸다. 군집 추세는 **마지막 달을 뺀 전년 동기 비교**(`yoy_ex_last_month`)로 본다.
- **`volume_trend` 금지 (T3)**: 추세는 `monthly_volume`의 전년 동기 3개월 비교로만 판단한다.
  `volume_trend`는 참고 컬럼으로만 남는다.
- **결측 월 (T6)**: `nv_code: 1`인 달은 `total` 키 자체가 없다. 비교 창에 결측이 있는 키워드는
  0으로 합산하지 않고 «계산 불가»로 남긴다.

### STEP 7 · 추세를 붙여 최종 판정

```bash
python3 scripts/submarkets.py score cluster.json --universe universe.csv --seed 캠핑의자 --limit 500 \
    --seed-all seed_all.json --trend trend.csv -o submarkets.csv --keywords-out submarket_keywords.csv
```

`--trend`가 있으면 2단 대상을 **다시 고르지 않는다** — `stage2_keywords.json`을 덮어쓰지 않고 크레딧도
다시 안내하지 않는다(이미 쓴 호출이다).

군집 추세 `yoy_ex_last_median` = 그 군집의 2단 조회 키워드 중 **전년 동기 3개월 볼륨이
`--yoy-gate`(기본 3,000) 이상**이고 결측이 없는 것들의 `yoy_ex_last_month` 중앙값이다.
게이트 미달 수는 `yoy_gated_n`, 결측 창으로 빠진 수는 `yoy_uncomputable_n`, 마지막 달 의심 수는
`last_month_flag_n`에 남는다. `trend_status`가 군집 추세의 상태를 한 단어로 적는다 —
`판정` · `게이트 미달` · `계산 불가` · `게이트 미달·계산 불가` · `추세 미조회`(2단 조회 대상이 아니었음).
표본이 1~2개인 군집의 추세는 «방향 참고»로만 쓴다.

### STEP 8 · 이름 붙이기와 리포트

군집에 이름을 붙이는 것은 **규칙이 아니라 해석**이다. `theme_top`(볼륨 가중 최다 테마)·
`hub_keyword`·`top_keywords`를 근거로 짧은 이름을 붙이고 `[추정]`으로 표시한다. 근거 키워드를
이름 옆에 함께 적는다 — 이름만 남기면 검증할 수 없다.

리포트에 반드시 들어가는 것:

- 헤더: 시드 · gl · `데이터 기준월 / 조회일 / 지연`(빈칸 금지) · limit과 절단·별 모양 퇴화 여부 · 게이트 값 4종 ·
  유통 채널명을 brands에 넣었는지
- 브랜드 시드 경고가 떴다면 첫 문단에 그 사실과 대체 시드 제안
- 숨은 하위 시장 후보 표: 이름[추정] · 허브 · 대표 키워드 · 논브랜드 볼륨 «하한 X ~ 상한 Y»[추정] · 시드 거리 · 추세(`trend_status`)
- 지표 미반환 키워드 수 `[데이터 공백]`
- 판정·순위 뒤집힘: `verdict_flip`·`rank_flip`이 «예»인 군집과 상한 기준 유형·순위 (없으면 «없음»)
- 걸러진 군집 요약: 유형별 개수와 대표 예 (브랜드 지배 · 규모 미달 · 소형·단일 · 지표 부족)
- 이번 분석 소진 크레딧(`cost_detail` 합) 과 결정식 대조

## 산출물

아래 컬럼 목록은 `submarkets.py`의 실제 출력이다. 스크립트를 고치면 이 목록도 함께 고친다
(`selftest_submarkets.py`가 양방향으로 대조한다).

```
submarkets_{seed}.csv
  community_id, submarket_type, hub_keyword, hub_degree, n_keywords, n_canonical,
  seed_distance, seed_links, volume_lo, volume_hi,
  nonbrand_volume_lo, nonbrand_volume_hi, nonbrand_share_lo, nonbrand_share_hi,
  brand_dominated,
  submarket_type_hi, verdict_flip, rank_in_type_lo, rank_in_type_hi, rank_flip,
  theme_top, theme_top_share_lo, theme_top_share_hi, top_keywords, missing_metrics,
  dup_rows, trend_status,
  yoy_ex_last_median, yoy_n, yoy_gated_n, yoy_uncomputable_n, last_month_flag_n,
  data_ref_month, truncated, star_degenerate

submarket_keywords_{seed}.csv
  keyword, canonical, community_id, degree, volume_total, brand,
  theme_primary, dup_of, is_group_rep, group_volume_lo, group_volume_hi

stage2_keywords.json      2단 조회 대상 키워드 배열 (STEP 5만 쓴다 · STEP 7은 건드리지 않는다)
submarket_report_{seed}.md
  헤더(기준월/조회일/지연 · limit·절단·별 모양 · 게이트 · 볼륨 하한~상한) · 숨은 하위 시장 후보 표 ·
  판정·순위 뒤집힘 ·
  걸러진 군집 요약 · 소진 크레딧 · 라벨 규약
```

파일명의 `{seed}`는 사용자가 저장할 때 붙인다(스크립트 기본 출력명은 `submarkets.csv`·
`submarket_keywords.csv`).

## 4-Label

| 라벨 | 이 스킬에서의 적용 |
|---|---|
| `[실제 데이터]` | `communities` · `rels` · `volume_total` · `monthly_volume`, 그리고 그로부터의 직접 집계(degree · 시드 거리 · 전년 동기 비교) |
| `[추정]` | 군집 이름 · 하위 시장이라는 해석 · 테마 부여(정규식 규칙) · 표기변형 그룹을 거친 볼륨·비중 `*_lo`/`*_hi`와 같은 검색의 중복 판정(규칙 기반 집계 — 하한~상한 범위로만 인용) · 단일 키워드 군집이 절단 잔재라는 해석 |
| `[가정]` | 게이트 4종(`size-gate` · `brand-max` · `min-groups` · `yoy-gate`) · 판정·순위를 하한 기준으로 두는 규칙 · limit 선택 · 별 모양 기준 80% · 관측 상한 `limit + 1` · 2단 대상 사전 게이트(`volume_avg × 3`) · 유통 채널명을 brands에 넣는 기본값 |
| `[데이터 공백]` | 빈 응답 · 지표 미반환 키워드(`missing_metrics`) · 결측 창으로 계산 불가한 추세 · 2단 조회를 하지 않은 군집의 추세 |

## 한계

- **월 그레인 · 기준월은 응답에서 읽는다(관측 1개월).** 군집 규모와 추세는 기준월 시점의 모습이다.
- 군집은 **공동검색 구조**다. 같은 군집이라고 같은 소비자·같은 구매라는 보장은 없다.
  검색은 관심 신호이며 점유·규모는 «검색량 기준 근사»다. 검색량 단위는 건이지 사람 수가 아니다.
- 군집 ID는 호출마다 새로 매겨진다. **다른 시점(`time_point`)이나 다른 limit의 군집 ID를 서로
  대응시키지 않는다.** 과거 시점 구조 비교는 이 스킬 범위 밖이다 — 성장은 STEP 6의 전년 동기로 본다.
- 시드 하나 주변만 본다. 시드가 치우치면 군집도 치우친다.
- `demography`는 이 스킬의 산출물이 아니다. `all` 응답에 들어와도 일부 국가에서만 반환된다
  (계약 §2) — 미반환은 공백이 아니라 사양으로 적고, 성·연령 세분화를 이 스킬로 약속하지 않는다.
- 판정 게이트 값은 카테고리마다 보정이 필요하다. 리포트에 쓴 값을 그대로 적는다.
