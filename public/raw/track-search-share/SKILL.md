---
name: track-search-share
description: |
  카테고리 경계와 브랜드 사전을 입력받아 **브랜드별 검색 점유율(SoV · 검색량 기준 근사)**을 산출한다.
  표기변형 이중 계상을 걷어내고, 카테고리를 특정하지 않는 브랜드 단독 검색을 분모에서 빼고,
  **논브랜드(일반) 검색을 분리**해 «전체 대비 점유»와 «브랜드 간 점유»를 따로 낸다.
  시계열을 더하면 전년 동기 대비 점유 변화까지 판정한다.
  커넥터는 `keyword_info`(2단 조회) + `intent_finder`(브랜드별 표기변형 수집).

  "우리 브랜드 검색 점유율 얼마야?" · "경쟁사 대비 SoV 뽑아줘" · "네스프레소랑 돌체구스토 검색 비중 비교" ·
  "카테고리 안에서 우리 비중이 줄었나?" · "브랜드 동의어 합쳐서 점유율 다시 계산해줘" ·
  "share of search 추적하고 싶어"
  같은 요청이면 반드시 이 스킬을 쓴다.

  사용자가 "점유율"이라는 말을 쓰지 않아도, **브랜드 N개의 검색 수요를 같은 분모 위에서
  비교해야 하는 요청**이면 켠다. "진짜 시장 점유율"·"판매 점유율"을 요청받아도 이 스킬이 내는 것은
  검색량 기준 근사이며, 그렇게 고쳐 말하고 진행한다.

  경계: 카테고리 키워드 지도(무엇이 검색되는가)는 `map-your-market`, 무엇이 커지는가(변화율)는
  `spot-trends`로 보낸다. 이 스킬은 **이미 정한 브랜드들의 몫**만 잰다.
license: MIT
metadata:
  version: "0.3.1"
---

<!-- lm-skill: kind=task; connectors=keyword_info,intent_finder; flags=monthly,expand,share; traps=T1,T2,T3,T4,T5,T6,T7,T8 -->

# Track Search Share — 검색 점유율(SoV) 추적

> **핵심 원칙**: 점유율의 결론은 분자가 아니라 **분모**가 정한다. 같은 수요를 두 번 세거나(표기변형),
> 다른 품목 수요를 끌어오거나(브랜드 단독 검색), 논브랜드를 섞었다 뺐다 하면 숫자는 그럴듯하게
> 나오면서 순위가 바뀐다. 그리고 검색 점유는 **판매 점유가 아니다** — 관심 신호의 몫이다.

## 데이터 계약

이 스킬은 `references/lm-data-contract.md`(정본 사본)를 따른다. 계약은 확장할 수 있지만
뒤집을 수 없다. 이 스킬에 해당하는 함정 처리 의무와 처리 위치:

| 함정 | 처리 위치 | 상태 |
|---|---|---|
| T5 표기변형 canonical 정규화 | STEP 1 (변형치환) · STEP 3 (같은 검색의 중복 제거 → 그룹 하한·상한 병기) | ✅ |
| T1 기준월·지연 3종 표기 | STEP 5 · STEP 7 헤더 | ✅ |
| T2 마지막 달 완결성 점검 | STEP 5 (점검) · STEP 6 (기본 제외) | ✅ |
| T3 volume_trend 대신 전년 동기 비교 | STEP 6 | ✅ |
| T4 기저 볼륨 게이트 | STEP 4 (2단 대상) · STEP 6 (점유 변화) | ✅ |
| T6 결측 월 처리 | STEP 6 | ✅ |
| T7 절단(limit) 검사 — 절단이면 수렴 판정 보류 | STEP 2 · STEP 3 | ✅ |
| T8 논브랜드 분리 산출 | STEP 3 · STEP 7 | ✅ |

> 이 표는 선언이다. 실제 처리는 아래 STEP 본문에 있다.

## 커넥터와 크레딧

| 커넥터 | 용도 | 크레딧 결정식 |
|---|---|---|
| `intent_finder` | 브랜드별·일반 시드별 표기변형·모델명 수집 (1라운드) | 호출당 `30 + 2 × 반환 키워드` |
| `keyword_info` `ads_metrics` | 1단 — 유니버스 + 브랜드 단독·비교 검색 12개월 볼륨 | `1 × (K + N + N(N−1)/2)` |
| `keyword_info` `all` | 2단 — 게이트 통과분만 월 시계열 | `10 × K2` |

**총액 = Σ(30 + 2 × 반환ᵢ) + K + N + N(N−1)/2 + 10 × K2**

- 호출 수 = 브랜드 수 `N` + 일반 시드 수 `G`. 반환은 `limit`을 넘지 않으므로 intent_finder 상한은
  `(N + G) × (30 + 2 × limit)`이다.
- `K` = 라운드 반환 합집합 + 사용자가 준 변형의 **요청 키워드 수**. 과금은 요청한 키워드 수 단위다 —
  응답에 요청하지 않은 변형 행이 섞여 와도 과금되지 않고, 응답에서 빠진 요청 키워드도 과금된다(계약 §1).
- `N + N(N−1)/2` = 브랜드 단독 검색 N개 + 비교 검색 «A vs B» N(N−1)/2개(`--probe-terms`가 목록을 만든다).
  이것을 넣지 않으면 카테고리 밖 버킷과 비교 검색은 **구조상 비어** 있다 — 0이 아니라 «미수집»이다.
- `K2` = STEP 4에서 `sov_calc.py --series-targets`가 쓴 목록의 길이. **1단 결과로 호출 전에 확정된다.**
- `ads_info`는 쓰지 않는다 — 계약 §1대로 시계열이 필요하면 상위집합인 `all`을 쓴다.

**2단 조회가 총액을 지배한다.** 예: 브랜드 4 + 일반 시드 2, `limit=100`, K=450, K2=90이면
`6 × (30 + 2 × 100) + 450 + 4 + 6 + 10 × 90` = 1,380 + 460 + 900 = **최대 2,740**.
같은 450개 전량에 `all`을 걸면 2단만 4,500이다. 점유 변화가 필요 없으면 2단을 생략한다(총액 = 앞의 두 항).

> 단가는 배포 환경마다 다를 수 있다(계약 §1). 고객에게 예산을 안내하기 전에 그 환경의
> `cost_detail.total_cost`로 확인하고 위 식을 다시 계산한다. 소진량 보고는 호출별
> `cost_detail.total_cost` 합산으로 한다 — 계정 누적 사용량이 아니다.

## 번들 자산

| 파일 | 하는 일 | 쓰는 곳 |
|---|---|---|
| `scripts/sov_calc.py` | **점유 계산** (이 스킬 고유) — 분류·그룹 대표값·논브랜드·다중 브랜드 분배·절단 기록·2단 대상·점유 변화 | STEP 3·4·6 |
| `scripts/check_refmonth.py` | 데이터 기준월·지연·마지막 달 완결성 | STEP 5 |
| `scripts/coverage_curve.py` | 라운드 절단·논브랜드 기여 (2차 확장 여부 판단) | STEP 2 |
| `scripts/trend_yoy.py` | 개별 키워드 전년 동기 교차확인 | STEP 6 |
| `scripts/build_universe.py` | 공유 유니버스 조립기 — **점유 계산에 쓰지 않는다**(브랜드 첫 매칭만 해서 다중 브랜드 분배·카테고리 밖 분리가 없다) | 참고 |
| `scripts/selftest.py` | 공유 스크립트 계약 검증 (공유 정본 사본) | 스킬 수정 후 |
| `scripts/selftest_sov.py` | `sov_calc.py` 계약 검증 — 이 문서의 STEP 3·6 예시 명령을 함정 픽스처로 실행 | 스킬 수정 후 |
| `assets/themes.template.json` | 공유 분류 사전 템플릿 | STEP 1 |
| `assets/themes.coffee-machine-kr.example.json` | 이 스킬용 키(`category`·`brand_models`)까지 채운 예시 | STEP 1 |

사전은 킷 공유 스키마(`themes.json` — 변형치환·brands)에 이 스킬용 키 두 개(`category`·`brand_models`)를
더한 것이다. 필요한 규칙은 STEP 1에 전부 적었다.

## 사전 확인

```
1. 시장(gl)이 단일 값으로 확정되었는가? — 나라가 섞이면 분모가 섞인다
2. 카테고리 경계가 포함/제외로 적혀 있는가? — 경계가 곧 분모다 ("커피머신"에 캡슐이 들어가는가?)
3. 비교 브랜드 N개가 확정되었는가? (자사 + 경쟁사)
4. 점유 변화(전년 동기 대비)가 필요한가? — 필요하면 2단 조회 예산을 먼저 안내한다
5. 사용자가 "진짜/실제 시장 점유율"을 말했는가? — 그렇다면 검색량 기준 근사임을 먼저 고지한다
```

하나라도 비면 묻는다. 특히 2는 추측으로 채우지 않는다 — 같은 브랜드 목록으로도 경계에 따라
1위가 바뀐다.

## 실행 순서

### STEP 1 · 브랜드 사전 작성

`assets/themes.template.json`을 `themes.json`으로 복사하고 이 스킬용 키 두 개를 더한다.
완성 예시는 `assets/themes.coffee-machine-kr.example.json`.

| 키 | 필수 | 뜻 |
|---|---|---|
| `brands` | ✅ | 비교 브랜드의 **canonical 표기**(한글 기준 등 하나로) |
| `rules.변형치환` | ✅ | 브랜드 별칭 → 브랜드명(`nespresso`→`네스프레소`), 띄어쓰기 외 표기 흔들림(`커피메이커`→`커피머신`) |
| `category.pattern` | ✅ | 카테고리 안 판정 정규식 — **canonical 문자열**(소문자·변형치환 후 공백 제거)에 대해 평가 |
| `category.exclude` | 권장 | 브랜드와 붙어 나오지만 다른 품목인 수요(소모품·부속). **카테고리 패턴보다 먼저** 평가되므로 머신을 가리키는 검색까지 자르지 않게 좁게 쓴다(`캡슐(호환)`은 `캡슐 호환 커피머신`까지 잘랐다 → `호환캡슐`·`캡슐호환$`) |
| `brand_models` | 권장 | 모델명 → 브랜드 (`버츄오`→`네스프레소`). 모델명은 **브랜드를 정하지만 카테고리를 정하지 않는다** — 카테고리 단어 없이 모델명만 걸린 검색은 `model_only`로 분리된다(STEP 3). `brands`에 없는 브랜드도 여기에만 두면 버킷이 된다 |
| `themes` | — | 이 스킬은 쓰지 않는다. 빈 배열로 둔다 |

별칭을 `변형치환`에 넣는 이유: 공유 스크립트(`coverage_curve.py`)와 `sov_calc.py`가 **같은 canonical로**
브랜드를 판정하게 하기 위해서다(T5 표기변형). 짧은 브랜드명은 다른 단어 안에서 걸린다 —
`일리`는 `데일리`에 걸린다. 그런 이름은 `brands`에서 빼고 `brand_models`에만 둔다(`"일리": "^일리"`) —
그래도 독립 버킷으로 집계된다.

변형치환은 **띄어쓰기를 지우기 전** 문자열에 적용된다(`series_dedup.canon`). 그래서 치환이 단어 경계를
넘지 않는다(`vacuums`→`vacuum` 규칙이 `vacuum sale`을 `vacuumale`로 만들지 않는다).

### STEP 2 · 표기변형 수집 (intent_finder 1라운드)

```python
intent_finder(keyword="네스프레소 커피머신", gl="kr", limit=100)   # 브랜드마다 1회
intent_finder(keyword="커피머신 추천", gl="kr", limit=100)          # 일반 시드 G개
```

브랜드 시드는 **브랜드명 + 카테고리 단어**로 한다. 브랜드명만 넣으면 다른 품목(캡슐·원두) 수요가 쏟아진다.
응답을 `if_<브랜드>.json`으로 저장하고, **라운드마다 요청 `limit`과 반환 수를 기록**한다.

**절단 검사(T7)**: 반환 수가 `limit`에 붙었으면 그 브랜드의 표기변형 목록은 **완결이 아니라 잘린 것**이다.
이 상태로 점유를 내면 그 브랜드가 과소 계상된다. `limit`을 올려 재조회하거나, 잘린 채로 내되
`variant_list_truncated=yes`와 «과소 가능» 문구를 붙인다. 2차 확장 여부는 다음으로 본다:

```bash
python3 scripts/coverage_curve.py --metrics metrics.json --rules themes.json --themes themes.json \
    --round "S1=seeds.json" \
    --round "R1=if_nespresso.json@100,if_dolcegusto.json@100,if_generic.json@100"
```

한 라운드의 시드별 호출은 **쉼표로 나열**하고 호출마다 `@limit`을 붙인다 — 절단은 라운드 합집합 길이가
아니라 **호출 단위**로 검사한다. 어느 라운드든 잘린 호출이 있으면 «보류»이고, 이 판정은 `--round` 순서와
무관하다. `--rules`는 인라인 JSON·치환 파일·`themes.json` 모두 받는다. `seeds.json`은 이번 라운드에 넣은
시드 문자열 배열이다. «보류»면 "표기변형을 다 모았다"고 쓰지 않는다.

### STEP 3 · 1단 조회와 12개월 점유 (ads_metrics)

```bash
python3 scripts/sov_calc.py --themes themes.json --probe-terms probe_terms.json   # 브랜드 단독 N + 비교 N(N−1)/2
```

```python
keyword_info(keywords=universe + probe_terms, gl="kr", data_type="ads_metrics")   # 1 × (K + N + N(N−1)/2)
```

`universe` = 라운드 반환 합집합 + 사용자가 준 변형. 요청 목록을 `universe.json`, 응답을 `metrics.json`으로 저장하고:

```bash
python3 scripts/sov_calc.py --metrics metrics.json --themes themes.json --requested universe.json \
    --round "네스프레소=if_nespresso.json@100" --round "일반=if_generic.json@100,if_generic2.json@100" \
    --series-gate 1000 --series-targets series_targets.json \
    -o sov_keywords.csv --brand-out sov_brands.csv
```

`--round`는 `라벨=파일[@limit][,파일[@limit]…]`. 라벨이 `brands`(또는 `brand_models`)의 이름과 같으면 그 브랜드의
라운드, 아니면 논브랜드 라운드다. 잘린 호출이 있는 라운드는 **그 라운드가 키워드를 공급한 버킷 전부**를
`variant_list_truncated=yes`로 표시하고 `truncated_rounds`에 라운드 이름을 적는다 — 일반 시드 라운드도 브랜드
키워드를 돌려주므로(`stick vacuum` → `dyson v8 stick vacuum`) 그 브랜드도 과소일 수 있다.

**요청↔응답 대조**(`--requested`, 계약 §1): 요청 목록과 응답을 canonical로 대조해 ① 미반환 키워드(«0건»이
아니라 `[데이터 공백]`, 과금은 됨) ② 표기가 바뀌어 반환된 키워드 ③ 요청하지 않은 행(과금 안 됨 · 어순·오탈자
변형 포함 — 분류에 그대로 들어간다)과 과금액(`1 × 요청 수`)을 출력한다. 리포트 «보정 내역»에 옮긴다.

**같은 검색의 중복(T5 ①)을 먼저 뺀다.** 응답에는 요청하지 않은 어순·복수형·동의어 변형이 오고, 그중 일부는
볼륨·CPC·경쟁도(2단에서는 48개월 시계열)까지 **완전히 같다** — 같은 검색이 여러 표기로 돌아온 것이다.
canonical(띄어쓰기 제거)로는 묶이지 않으므로(`shark cordless stick vacuum` = `stick vacuum cordless shark`
= `shark stick vacuum cordless`) `series_dedup.dedup_map`으로 걸러 **한 번만** 센다. 중복 행은 `dup_of`·`dup_basis`에
대표를 적고 어느 합계에도 넣지 않는다. 묶음의 대표는 **카테고리 안 표현**을 우선한다(`dyson v8` = `dyson v8 stick
vacuum`이면 스틱으로 센다) `[가정]`. 실측(미국 스틱청소기, 2026-09-28)에서 이것을 빼지 않으면 카테고리 안 분모가
하한 5.52M → 8.99M으로 63% 부풀고 Dyson 전체 대비 SoV가 28.4% → 32.9%로 바뀌었다 — 하한~상한 범위 밖이다.

`sov_calc.py`가 키워드마다 판정하는 순서 (canonical 기준, 그룹 전체가 같은 판정):

| 판정 | 조건 | 분모 |
|---|---|---|
| `excluded` | `category.exclude`에 걸림 — **가장 먼저** 평가 | 제외 |
| `model_only` | 카테고리 패턴 없이 `brand_models`만 걸림 (예: `버츄오`, `dyson v8 handheld vacuum`) | **제외** — 브랜드별 `model_only_volume_*`로 따로 보고. `--include-model-only`면 포함 `[가정]` |
| `out_of_category` | 카테고리 패턴·모델명 어디에도 안 걸림 (예: `네스프레소` 단독, `dyson vs shark`) | **제외** — 별도 버킷으로 보고 |
| `generic` | 카테고리 안 + 브랜드 없음 (예: `커피머신 추천`) | 포함 — **논브랜드** |
| `brand` | 카테고리 안 + 브랜드 1개 | 포함 |
| `multi_brand` | 카테고리 안 + 브랜드 2개 이상 (비교 검색) | 포함 — 걸린 브랜드 수로 **균등 분배** |

**표기변형 하한·상한(T5)**: 같은 canonical 그룹(`네스프레소 커피머신`/`nespresso 커피머신`)의 변형 행이
같은 검색을 중복 집계한 것인지 서로 다른 검색인지 응답은 알려주지 않는다. 실측 대조에서 두 경우가 모두
관찰됐다(`런닝화` 975,560 vs `러닝화` 801,710 — 다른 값 · `드롱기 커피머신 as` = `드롱기 커피머신as` 6,690 — 같은 값).
그래서 어느 한쪽을 고르지 않고 **둘 다 낸다** `[추정]`(규칙 기반 집계):

- **하한**(`_lo`) = 그룹 내 최댓값 — 변형이 같은 검색의 중복일 때. 대표 행(`group_rep=1`)의 값
- **상한**(`_hi`) = 그룹 내 합 — 변형이 서로 다른 검색일 때
- 점유율은 **각자의 분모**로 계산한다 — `sov_pct_lo` = 하한 볼륨 ÷ 하한 분모, `sov_pct_hi` = 상한 볼륨 ÷ 상한 분모.
  섞지 않는다
- **순위·판정은 하한 기준**(`rank_lo`). 상한 순위(`rank_hi`)와 다르면 `rank_flip=yes`이고 요약에
  «순위 뒤집힘»이 찍힌다 — 이때 리포트에서 순위를 단정하지 않고 두 값을 함께 적는다
- 볼륨은 범위(«하한 69,000 ~ 상한 129,000»)로, **비율은 두 값으로** 쓴다: «네스프레소 SoV 하한 기준 33.5% · 상한 기준 48.5%».
  하한 기준 비율이 상한 기준보다 클 수 있어서(분모가 다르다) «~»로 이으면 범위로 오독된다

**논브랜드 분리(T8)**: 두 점유율을 모두 낸다.

- `sov_pct_lo`·`_hi` = 버킷 ÷ (브랜드 합 + 논브랜드) — **카테고리 전체 검색 중 몫**
- `sov_pct_branded_only_lo`·`_hi` = 브랜드 ÷ 브랜드 합 — **브랜드를 지목한 검색 중 몫**

둘은 크게 다르다(예시 픽스처 하한 기준: 같은 브랜드가 33.5% vs 71.1%). 인용할 때 어느 쪽인지 반드시 적는다.
논브랜드 비중이 크면 "브랜드 간 점유"만 보고하는 것은 시장의 절반을 빼고 말하는 것이다.
브랜드 사전에서 빠진 브랜드는 논브랜드로 들어가 `sov_pct_branded_only_*`를 부풀린다 —
1단 결과의 논브랜드 상위 키워드를 훑어 빠진 브랜드가 있으면 사전에 넣고 다시 돌린다.

**카테고리 밖·비교 검색(P1-1)**: 브랜드 단독(`네스프레소`)과 카테고리 단어 없는 비교(`dyson vs shark`)는 분모 밖이지만
**수집하지 않으면 볼 수 없다** — 브랜드+카테고리 시드로는 돌아오지 않는다. `--probe-terms` 목록을 1단에 넣으면
`brand_only_volume`·`outside_comparison_volume`에 값이 들어가고, 넣지 않았으면 `미수집`(요청했는데 안 왔으면
`미반환`)이 찍힌다. 둘 다 «0건»으로 옮겨 적지 않는다 `[데이터 공백]`.

`volume_total`은 조회일이 아니라 **데이터 기준월에서 끝나는 12개월 합**이다(계약 §2).
1단만으로는 기준월을 알 수 없으므로 헤더에 «기준월 미확인 [데이터 공백]»으로 적는다(`sov_calc.py`가 출력한다).

### STEP 4 · 2단 대상 확정 (기저 게이트)

STEP 3의 `--series-targets`가 **카테고리 안 대표 행 중 `volume_total ≥ --series-gate`**만 목록으로 쓴다.
카테고리 밖·제외·비대표 표기변형 행은 들어가지 않는다(크레딧 절약 — 그룹당 대표 1행만 조회).
출력에 `K2`와 크레딧(`10 × K2`), 그 목록이 카테고리 안 볼륨의 몇 %를 덮는지가 **하한·상한 기준 둘 다** 찍힌다. 이 값을 사용자에게 보여주고 2단 진행을 확인한다.

게이트 값(기본 1,000)은 [가정]이다. 커버율이 낮으면 게이트를 내리고 크레딧을 다시 계산한다.

### STEP 5 · 데이터 기준월 확인 ⚠️ 생략 금지

```python
keyword_info(keywords=series_targets, gl="kr", data_type="all")   # 10 × K2 → series.json
```

```bash
python3 scripts/check_refmonth.py series.json --queried-at YYYY-MM-DD
```

리포트 헤더에 **`데이터 기준월 / 조회일 / 지연`** 세 값을 적는다(T1). 기준월은 응답에서 읽는다(관측 1개월 —
2026-09-28 조회의 기준월이 2026-08). 고정값으로 가정하지 않는다 — 조회일 기준으로 "지난달 점유"라고 쓰면 틀릴 수 있다.

같은 명령이 **마지막 달 완결성**(T2)도 점검한다. 의심 건수를 리포트에 적는다.

### STEP 6 · 전년 동기 대비 점유 변화

```bash
python3 scripts/sov_calc.py --metrics metrics.json --themes themes.json --requested universe.json \
    --series series.json \
    --round "네스프레소=if_nespresso.json@100" --round "일반=if_generic.json@100,if_generic2.json@100" \
    --gate 3000 --queried-at 2026-09-28 -o sov_keywords.csv --brand-out sov_brands.csv
```

2단을 주면 시계열이 완전히 같은 행도 같은 검색의 중복으로 합친다(T5 ①) — 12개월 값이 1단 출력과 조금 다를 수
있다. 리포트에는 2단 실행의 값을 쓴다. 대표 행에 시계열이 없으면 그 중복 행·같은 그룹 행의 시계열을 쓰고,
그래도 없는 2단 대상은 «시계열 응답이 없는 그룹 N개 [데이터 공백]»으로 출력된다.

- **비교 방식(T3)**: 최근 `--window`개월(기본 3) 점유 vs **전년 동기** 같은 창의 점유. 직전 기간 대비로
  재면 계절(연말 선물 수요 등)이 점유 변화로 잡힌다. 응답의 `volume_trend` 필드는 **쓰지 않는다**
  — 계약 §2의 대조에서 재현되는 식이 없었다. 키워드 CSV에 `api_volume_trend_do_not_use`로만 남긴다.
- **마지막 달(T2)**: 창 끝(`window_end`)은 기본적으로 **기준월 − 1**이다. 마지막 달은 집계가 아직 차는 중일
  수 있다. `--include-last-month`로 뒤집을 수 있으나 그러면 리포트에 명시한다. 스크립트는 **반대 모드도 함께
  계산**해 `share_change_pp_other_mode`에 싣고, 두 모드의 부호가 다른 버킷은 `share_change_provisional=잠정`으로
  자동 표시한다 — 리포트에서 그 버킷의 방향을 단정하지 않는다.
- **결측 월(T6)**: 비교 창(최근·전년) 어디든 결측(`nv_code`, `total` 키 없음)이 있는 키워드는 **0으로
  더하지 않고** 양쪽 창에서 모두 뺀다. 빠진 그룹 수를 «계산 불가 N그룹»으로 출력한다.
- **기저 게이트(T4)**: 전년 창 볼륨이 `--gate`(기본 3,000) 미만인 버킷은 점유 변화를 내지 않고
  `share_change_status=기저 미달`로 남긴다. 작은 브랜드의 +200%p 같은 값이 1위로 올라오는 것을 막는다.
- **하한 기준 시계열(T5)**: 2단은 그룹 대표 행만 조회하므로 점유 변화는 **대표 행 시계열 = 하한 기준**으로
  계산한다(`series_basis=대표 행(하한 기준)`). 비대표 표기변형의 월 시계열은 없으므로 상한 기준 점유 변화는
  만들지 않는다 — 리포트에 «점유 변화는 하한 기준» 한 줄을 적는다 `[데이터 공백]`
- 점유 변화의 분모는 **2단 대상 중 계산 가능한 키워드**다 — 12개월 점유(STEP 3)와 분모가 다르므로
  두 값을 섞어 "12개월 점유 33.5%에서 2.7%p 올랐다"처럼 쓰지 않는다. 각각의 기준을 적는다.

상위 변화 몇 건은 `trend_yoy.py`로 키워드 단위 전년 동기 값을 다시 계산해 교차확인한다:

```bash
python3 scripts/trend_yoy.py series.json -o trend.csv --gate 3000
```

### STEP 7 · 보고

`sov_report_{category}.md`에 담는 것:

1. 헤더 — 데이터 기준월 / 조회일 / 지연, 시장(gl), 카테고리 경계(pattern·exclude 원문), 마지막 달 처리 방식
2. 점유 표 — 버킷별 `sov_pct_*`와 `sov_pct_branded_only_*`를 **나란히**, 각각 «하한 기준 X% · 상한 기준 Y%» 두 값으로,
   논브랜드 비중 별도 행. 순위는 하한 기준이며 `rank_flip=yes` 브랜드는 «상한에서 순위 뒤집힘»을 표 아래에 적는다
3. 분모 밖 — 브랜드 단독(`brand_only_volume`)·카테고리 단어 없는 비교(`outside_comparison_volume`)·모델명만
   (`model_only_volume_*`)·제외 볼륨. "왜 빠졌는가" 한 줄. 수집하지 않은 칸은 «미수집», 요청했는데 안 온 칸은 «미반환»
   그대로 옮긴다(0으로 쓰지 않는다)
4. 보정 내역 — 같은 검색의 중복 제외 행·볼륨(그리고 제외하지 않았을 때의 분모), 판정이 갈린 중복 묶음, 표기변형
   하한·상한 차이, 다중 브랜드 분배 볼륨, 절단 표시 버킷과 그 라운드(`truncated_rounds`), 요청↔응답 대조
   (미반환·표기 변경·요청하지 않은 행 · 과금 = 1 × 요청 수)
5. 점유 변화 — 게이트 통과 버킷만, 창·게이트 값 병기, «대표 행(하한 기준)» 표기. 기저 미달·계산 불가·시계열 없음
   건수, `잠정` 버킷과 반대 모드 값
6. 해석 한계 — «검색량 기준 근사이며 판매 점유가 아니다»를 표 바로 아래에 둔다

## 산출물

아래 컬럼 목록은 `sov_calc.py`의 실제 출력이다. 스크립트를 고치면 이 목록과
`scripts/selftest_sov.py`의 `KCOLS`·`BCOLS`를 함께 고친다.

```
sov_keywords_{category}.csv   키워드 1행
  keyword, canonical, dup_of, dup_basis, group_rows, group_rep, volume_total,
  group_volume_lo, group_volume_hi, scope, brands_hit, brand_weight, matched_by,
  series_target, api_volume_trend_do_not_use

sov_brands_{category}.csv     버킷 1행 (브랜드 N[+ brand_models 전용] + 논브랜드(일반) + 카테고리 밖(분모 제외))
  bucket, keywords, volume_12m_lo, volume_12m_hi, sov_pct_lo, sov_pct_hi,
  sov_pct_branded_only_lo, sov_pct_branded_only_hi, rank_lo, rank_hi, rank_flip,
  multi_brand_volume_lo, multi_brand_volume_hi, model_only_volume_lo, model_only_volume_hi,
  brand_only_volume, outside_comparison_volume, variant_list_truncated, truncated_rounds,
  series_keywords, series_basis, window_volume_recent, window_volume_prev_year,
  share_recent_pct, share_prev_year_pct, share_change_pp, share_change_pp_other_mode,
  share_change_provisional, share_change_status, data_ref_month, window_end, label

probe_terms.json              브랜드 단독 N + 비교 «A vs B» N(N−1)/2 (1단에 더할 목록)
series_targets.json           2단(all) 조회 대상 키워드 배열

sov_report_{category}.md      STEP 7 구성
```

- `dup_of`·`dup_basis`: 같은 검색의 중복이면 대표 키워드와 근거(`지표 일치`·`시계열 일치`). 이 행은 어떤 합계에도 없다
- `scope`: `excluded` · `model_only` · `out_of_category` · `generic` · `brand` · `multi_brand`
- `group_rep`: 그룹 대표 행(최댓값 · 하한 기준 · 2단 조회 후보)이면 1
- `_lo`·`_hi`: 표기변형 그룹 하한(최댓값)·상한(합) `[추정]` — 점유율은 각자의 분모로 계산
- `rank_lo`·`rank_hi`·`rank_flip`: 브랜드 간 12개월 볼륨 순위(1=최대). 판정은 `rank_lo`, 다르면 `rank_flip=yes`
- `series_basis`: 2단을 줬을 때 `대표 행(하한 기준)` — 점유 변화 컬럼이 어느 기준인지
- `variant_list_truncated`: `yes`(자기 라운드 또는 키워드를 공급한 라운드에 잘린 호출) · `no` · `미확장`(자기 라운드 없음).
  `truncated_rounds`에 잘린 라운드 이름
- `multi_brand_volume_*`·`brand_only_volume`·`outside_comparison_volume`: 수집하지 않았으면 `미수집`, 요청했는데 미반환이면 `미반환`
- `model_only_volume_*`: 카테고리 단어 없이 모델명만 걸린 볼륨(기본은 점유에 포함하지 않음)
- `share_change_pp_other_mode`·`share_change_provisional`: 마지막 달 반대 모드의 점유 변화 · 부호가 다르면 `잠정`
- `share_change_status`: `ok` · `기저 미달` · `시계열 미조회` · `해당 없음(분모 제외)`
- `label`: 버킷 행 전체가 `추정` — 볼륨은 실제 데이터지만 버킷 배정이 규칙 분류이기 때문이다.
  `_lo`·`_hi` 쌍도 규칙 기반 집계(그룹 최댓값·그룹 합)라 `[추정]`이다

## 4-Label

| 라벨 | 이 스킬에서의 적용 |
|---|---|
| `[실제 데이터]` | 키워드별 `volume_total` · `monthly_volume` 원본과 그 합계 |
| `[추정]` | 버킷 배정(브랜드·논브랜드·모델명만·카테고리 밖)과 그로부터의 점유율 — 사전·정규식 규칙에 의한 분류다. 같은 검색의 중복 판정(지표·시계열 일치). 표기변형 그룹 하한(최댓값)·상한(합)과 각자의 분모로 낸 점유율(규칙 기반 집계) |
| `[가정]` | 카테고리 경계(pattern·exclude) · 다중 브랜드 균등 분배 · 순위·판정을 하한 기준으로 한 것 · 중복 묶음의 대표를 카테고리 안 표현으로 고른 것 · `--include-model-only` · 게이트 값 · 마지막 달 제외 · 창 길이 |
| `[데이터 공백]` | 1단의 기준월 미확인 · 결측 월로 계산 불가한 키워드 · 기저 미달 버킷 · 절단된 표기변형 목록 · 상한 기준 월 시계열(비대표 표기변형 미조회) · «미수집»(브랜드 단독·비교 검색을 넣지 않음) · «미반환»(요청했는데 응답에 없음 — 과금됨) · 시계열 응답이 없는 2단 대상 |

## 한계

- **검색 점유는 판매 점유가 아니다.** 관심의 몫이며 구매·매출로 이어진다는 보장이 없다.
  "진짜 시장 점유율"로 인용하지 않는다. 검색량 단위는 **건**이고 사람 수가 아니다
- **월 그레인 · 1개월 이상 지연**(기준월은 응답에서 읽는다 — 관측 1개월). 캠페인 주간 효과를 재는 데 쓸 수 없다. 갱신은 월 1회면 충분하고,
  그보다 자주 조회하면 같은 달 데이터에 크레딧을 다시 쓴다
- 점유는 **사전의 함수**다. 브랜드·모델·경계를 바꾸면 값이 바뀐다 — 추적할 때는 사전을 고정하고
  바꾼 달에는 이전 값을 새 사전으로 다시 계산해 비교한다
- 같은 검색의 중복 판정은 규칙이다(지표·시계열 완전 일치 + 토큰 겹침). 다른 검색이 우연히 같은 값을 가질 수 있고,
  같은 검색인데 값이 다르게 올 수도 있다 — 근거 범위는 계약 T5(미국 3개 카테고리 실측)만큼이다
- 다중 브랜드 비교 검색의 균등 분배는 규칙일 뿐 관측이 아니다. 분배 볼륨이 큰 카테고리는 결론이 흔들린다
- 성·연령별 점유는 다루지 않는다 — `demography`는 일부 국가에서만 반환되는 사양이고(계약 §2),
  2단을 전량 `all`로 돌려야 해서 비용 구조가 달라진다
- 원인은 설명하지 않는다. 점유가 왜 움직였는지는 SERP·연관 쿼리로 따로 본다
