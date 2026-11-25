---
name: find-journey-leaks
description: |
  카테고리 진입 시드(최대 3개)에서 시작하는 `path_finder` 세션 인접 검색 경로를 예산 안에서 표본 수집하고,
  각 노드를 규칙 사전으로 내 브랜드 · 경쟁 브랜드 · 브랜드 비교 · 일반(논브랜드) · 비교 · 커뮤니티 · 채널로 나눠
  «경로가 어느 지점에서 경쟁 브랜드로 넘어가는가(누수 엣지)»와 «내 브랜드가 어디서 잡고 놓치는가(허브 노드 점유)»를
  보여준다. 입력은 시드 · 내 브랜드(이름 · 별칭, 없어도 됨) · 경쟁 브랜드 목록 · 시장(kr/jp/us) · 크레딧 상한.
  브랜드 마케터 · 검색 콘텐츠 담당자가 방어 · 공략 지점을 정할 때 쓴다.

  "런닝화 검색하던 사람들이 어디서 나이키로 넘어가?" · "우리 브랜드가 검색 여정 어디서 경쟁사한테 뺏겨?" ·
  "카테고리 검색 경로에서 경쟁 브랜드로 새는 지점 찾아줘" · "추천 · 순위 검색 다음에 어느 브랜드가 먼저 잡혀?" ·
  "funnel leak 분석해줘" · "검색 여정 방어 지점 · 공략 지점 뽑아줘"
  같은 요청이면 반드시 이 스킬을 쓴다.

  사용자가 "누수"라는 말을 쓰지 않아도, **카테고리 검색 경로 위에서 브랜드 간 주도권(누가 먼저 잡는가 · 어디서
  경쟁사로 넘어가는가)을 묻는 요청**이면 켠다. "전환율 · 이탈률"을 요청받아도 이 스킬로 받되 세션 인접 검색의
  «처음 닿은 브랜드»까지만 답한다 — 구매 · 전환 · 개인 여정은 이 데이터에 없다.

  경계: «이 검색 앞뒤에 무엇을 검색하나(단계 전이 · 다음 검색)»만 묻고 브랜드 간 주도권을 묻지 않으면
  `trace-search-journey`로 보낸다 — 그 스킬은 여정의 모양을, 이 스킬은 여정이 경쟁사로 새는 지점을 본다.
  검색량 기준 브랜드 점유(SoV)는 `track-search-share`, 수요 크기 · 키워드 전수는 `map-your-market`.
  순서가 필요 없는 질문에 이 스킬(최고가 커넥터)을 쓰지 않는다.
license: MIT
metadata:
  version: "0.1.3"
---

<!-- lm-skill: kind=task; connectors=path_finder,keyword_info; flags=expand,share,report; traps=T5,T7,T8 -->

# Find Journey Leaks — 검색 경로가 경쟁 브랜드로 새는 지점

> **핵심 원칙**: `path_finder`가 주는 것은 **같은 세션 안에서 붙어 나온 검색의 순서**다. 이 스킬은 그 순서 위에서
> «시드 다음 처음 닿은 브랜드»와 «바로 다음 검색이 경쟁 브랜드인 인접»을 센다. 한 사람의 구매 여정 · 전환 퍼널이 아니다.
>
> 답하는 것: 처음 닿은 브랜드의 몫(두 분모), 경쟁 브랜드로 넘어가는 인접(누수 엣지), 논브랜드 허브 노드 다음 첫 브랜드(점유 그룹),
> 내 브랜드 검색 바로 뒤의 경쟁 검색(switch).
> 답하지 않는 것: 구매 · 전환율 · 이탈률, 세션 밖(며칠 뒤) 행동, 시점 변화(0.1은 단일 시점), 인구통계, 원인.

## 데이터 계약

이 스킬은 `references/lm-data-contract.md`(정본 사본)를 따른다. 계약은 확장할 수 있지만 뒤집을 수 없다.
이 스킬에 해당하는 **함정 처리 의무**:

| 함정 | 처리 위치 | 상태 |
|---|---|---|
| T5 표기변형 canonical 정규화 | STEP 1(변형치환 · 별칭 canonical) · STEP 4(노드 그룹키 · 표기변형 인접 제외 · 시드 표기 검사) · STEP 5(볼륨 하한/상한) | 처리 |
| T7 절단(limit) 검사 — 절단이면 수렴 판정 보류 | STEP 3(호출마다 요청 limit vs 반환 경로 수를 원장에) · STEP 4 · STEP 6(반환분 기준 · 부재 · 커버 판정 보류) | 처리 |
| T8 논브랜드 분리 산출 | STEP 4(두 분모 · no_brand 행 · 허브는 논브랜드 노드만 · 미등록 브랜드 후보) · STEP 6(점유 · 기회 문장 규칙) | 처리 |

시계열(`monthly_volume`)을 쓰지 않으므로 T1 · T2 · T3 · T4 · T6 의무는 없다 — `volume_trend`도 읽지 않는다.
데이터 시점은 STEP 3에서 `time_point`와 조회일을 따로 적는다.

> 이 표는 선언이다. 실제 처리는 아래 STEP 본문에 있다.

## 커넥터와 크레딧

| 커넥터 | 용도 | 크레딧 결정식 |
|---|---|---|
| `keyword_info` (`ads_metrics`) | ① 시드가 실제 검색인지 확인(STEP 2) ② 허브 · 누수 대상 노드의 볼륨(STEP 5, 선택) | `1 × 요청 키워드 수` — 응답에서 빠지거나 합쳐져도 과금 |
| `path_finder` | 시드별 세션 인접 경로 표본 (파일럿 1 + 본 호출 시드당 1) | `50 + 40 × 경로 안 고유 키워드 수` (호출마다) |

- `path_finder` 과금 단위는 **경로 수가 아니라 반환 경로에 나온 고유 키워드 수(U)**다. `limit`은 **경로 수** 상한이라
  U를 묶지 못한다 — 호출 전에는 비용이 확정되지 않는다. 그래서 파일럿 → 예산 게이트 → 본 호출 순서로만 부르고,
  멈추는 기준은 원장의 누적 실측(`cost_detail.total_cost`)이다.
- `keyword_info`는 **2단 조회 규칙**을 따르되 이 스킬의 2단 대상은 0이다: 1단은 전량 `ads_metrics`(1/kw), 2단 `all`(10/kw)은
  시계열 · 인텐트가 판정에 필요한 키워드에만 거는데 이 스킬은 시계열로 판정하지 않는다. 노드 추세를 보고 싶다는 별도
  요청을 받으면 그때 선별 K개에만 `10 × K`를 건다 — 2단 대상 수 K가 총액을 지배하므로 허브 상위 몇 개로 묶는다.
  시계열이 필요해지면 `ads_info`도 쓸 수 있다(계약 §1 v1.3) — 단가는 첫 호출 `cost_detail`로 확인한다.
- `intent_finder` · `cluster_finder` · `serp`는 쓰지 않는다(원 앱의 SERP · AI 개요 확인은 0.1 범위 밖).

### 예산 결정식

```
총 크레딧 = 1 × N                       … STEP 2 시드 ads_metrics (N ≤ 3)
          + (50 + 40 × U_p)             … STEP 2 파일럿 1회 (작은 limit)
          + Σ_i (50 + 40 × U_i)         … STEP 3 본 호출 시드 i (파일럿 시드 재호출 포함)
          + 1 × M                       … STEP 5 노드 볼륨 (요청 표기 수 M, 선택)
계획값:  U_i ≈ ceil(L × r × s),  r = U_p ÷ 파일럿 반환 경로 수,  s = 안전계수 1.3 [가정]
```

- `r`은 시드마다 다르다. 형제 스킬 `trace-search-journey`의 실측에서 파일럿 `r`은 본 호출 `r`보다 크게도 작게도
  틀렸고, 큰 limit 관측은 몇 건뿐이라 범위를 정할 수 없다. 그래서 `s`를 곱하고, 그래도 계획은 [추정]이다.
- 규모 감: L = 200, r = 0.7, s = 1.3이면 `50 + 40 × ceil(200 × 0.7 × 1.3)` = `50 + 40 × 182` = 7,330 / 시드 [추정]. 시드 3개면 2만을 넘는다.

**계산 예 (합성 — `selftest_leaks.py` 픽스처와 같은 값)**

| 단계 | 계산 | 크레딧 |
|---|---|---:|
| 시드 2개 `ads_metrics` | 1 × 2 | 2 |
| 파일럿 `런닝화` limit 5 → 경로 5 · 고유 10 | 50 + 40 × 10 | 450 |
| 본 호출 계획 limit 12, r = 2.0, s = 1.3 | 50 + 40 × ceil(12 × 2.0 × 1.3) = 50 + 40 × 32 | 1,330 / 시드 |
| 예산 3,000이면 | 452 + 1,330 = 1,782 → 둘째 시드 추가 시 3,119 > 3,000 | 둘째 시드 `hold_budget` |
| 실측 (예산을 늘려 둘 다 부른 픽스처) | 50 + 40 × 20 = 850 · 50 + 40 × 11 = 490 | 1,340 |
| 노드 볼륨 7표기 | 1 × 7 | 7 |

## 번들 자산

| 파일 | 하는 일 | 쓰는 곳 |
|---|---|---|
| `scripts/make_leak_dict.py` | 템플릿 + 실행 입력(시드 · 브랜드 · 카테고리어 · 변형치환) → `leak_dict.json`. 브랜드 시드 거부(종료 코드 4) · 별칭 중복 · 2글자 미만 별칭 거부 · 별칭과 카테고리어 겹침 경고 (이 스킬 고유) | STEP 1 |
| `scripts/record_call.py` | 저장 응답 → 호출 원장 `calls.jsonl` 한 줄. 비용(`cost_detail`) · 요청 limit · 반환 경로 수 · 고유 키워드 · 절단 · 미반환 키워드 수를 응답에서 읽는다 (이 스킬 고유) | STEP 2 · 3 · 5 |
| `scripts/leak_budget.py` | 원장의 파일럿 `r` × 안전계수로 시드별 본 호출 비용 계획 · 누적 · call/hold 판정 · 예산 안 최대 limit (이 스킬 고유) | STEP 2 |
| `scripts/journey_leaks.py` | 원장 + 사전 → 귀속 · 누수 엣지 · 허브 점유 · 노드 분류표 · 미등록 브랜드 후보 · 노드 볼륨 요청 목록 · 결과 JSON · 요약 (이 스킬 고유) | STEP 4 · 5 |
| `scripts/build_leak_report.py` | 결과 JSON → `report.json`(사실 목록 · `{{ID}}` 문구 · 원장에서 만든 호출 기록) (이 스킬 고유) | STEP 6 |
| `scripts/leak_lib.py` | 위 스크립트가 함께 쓰는 분류 · 원장 읽기 모듈 (이 스킬 고유) | — |
| `scripts/series_dedup.py` | canonical 정규화(치환은 공백 제거 전) · 같은 검색의 중복 판정 (공유 정본 사본) | STEP 4 · 5 |
| `scripts/render_report.py` | 공통 리포트 렌더러 — 계약 위반이면 렌더하지 않는다 (공유 정본 사본) | STEP 6 |
| `scripts/selftest.py` · `selftest_render.py` | 공유 스크립트 · 렌더러 계약 검증 (공유 정본 사본) — `selftest.py`가 아래 `selftest_leaks.py`도 돌린다 | 스킬 수정 후 |
| `scripts/selftest_leaks.py` | 이 스킬 스크립트의 예시 명령 · 함정 회귀 · 문서 컬럼 = 실제 출력 대조 (이 스킬 고유) | 스킬 수정 후 |
| `assets/leak-dict.template.json` | 노드 분류 사전 템플릿 — `themes.template.json` 스키마 + 시장별 단계어(채널 · 커뮤니티 · 비교) · 빈 브랜드 슬롯 | STEP 1 |
| `assets/leak-dict.running-shoes-kr.example.json` | 채운 사전 예시(런닝화 KR · 공개 브랜드) — 그대로 쓰지 않는다 | STEP 1 |
| `assets/fixtures/*.json` | 합성 응답(path_finder 파일럿 · 본 호출 · 시드 표기 변경 · keyword_info) — 테스트 전용 | selftest |
| `assets/report.example.json` | 이 스킬 리포트 견본(합성 픽스처로 만든 결과) | selftest · STEP 6 |
| `assets/themes.template.json` · `report.sample.json` | 공유 템플릿 · 공유 렌더 견본 (공유 정본 사본) | 참고 · selftest |
| `references/lm-data-contract.md` · `report-contract.md` · `themes-schema.md` | 데이터 계약 · 렌더링 계약 · 사전 스키마 (공유 정본 사본) | 전체 |

공유 재사용 스크립트 중 `build_universe.py` · `coverage_curve.py`는 키워드 유니버스 확장용이라 싣지 않았다 — 이 스킬의
«확장»은 `path_finder` limit이고 절단 검사는 `record_call.py` · `journey_leaks.py`가 한다.

분류 사전은 `references/themes-schema.md`를 따른다: `rules.변형치환` · `themes`(배열 순서 = 우선순위) · `brands` · `no_match`에
`brand_sets`(내 브랜드 · 경쟁 브랜드와 별칭) · `category_terms` · `stage_terms` · `seeds` · `gl`을 더했다. 패턴은 canonical 문자열에
대해 평가된다.

## 사전 확인

```
1. 시장(gl)이 kr / jp / us 중 하나로 확정되었는가? (시장 섞어 집계 금지 — 시장마다 따로 돌린다)
2. 시드가 1~3개이고 «브랜드 없는 카테고리 진입어»인가? (예: 런닝화 · 러닝화 추천) — 브랜드명 시드는 STEP 1이 막는다
3. 경쟁 브랜드가 하나 이상 있는가? 없으면 누수를 정의할 수 없다. 사용자가 모르면 STEP 4의 미등록 브랜드 후보로
   [추정] 목록을 만들어 보여 주고 확인을 받는다(경로를 한 번 받은 뒤 0크레딧)
4. 내 브랜드가 있는가? 없으면 «경쟁 지형 모드» — 허브 그룹이 brand_reached 로 나오고 «잡는 · 놓치는» 문장은 쓰지 않는다
5. 크레딧 상한이 정해졌는가? 없으면 받는다 — path_finder 1회가 수천 크레딧일 수 있다
6. 요청에 구매 · 전환율 · 이탈률 · 성별 · 연령 · 기간 비교가 있으면 착수 전에 «세션 인접 검색의 처음 닿은 브랜드까지,
   단일 시점»으로 범위를 고지한다
```

## 실행 순서

### STEP 0 · 입력 정리

시드 · 내 브랜드(이름과 별칭 — 한글 · 영문 · 약칭) · 경쟁 브랜드(이름과 별칭) · 시장 · 크레딧 상한을 받는다.
브랜드는 스킬에 박지 않는다 — 매 실행 입력이다. 별칭은 노드 분류의 유일한 근거라 빠뜨리면 그 브랜드 노드가 논브랜드로
들어간다(T8). 런닝화 KR 예: 내 브랜드 `아식스;asics`, 경쟁 `나이키;nike` · `아디다스;adidas` · `뉴발란스;new balance`.

### STEP 1 · 분류 사전 만들기 (0크레딧)

```bash
python3 scripts/make_leak_dict.py --template assets/leak-dict.template.json --gl kr \
    --seeds "런닝화,러닝화 추천" --my "아식스;asics" \
    --competitor "나이키;nike" --competitor "아디다스;adidas" --competitor "뉴발란스;new balance" \
    --category-terms 러닝화,러닝슈즈 --variant 런닝=러닝 -o leak_dict.json
```

- **브랜드 시드 거부** — 시드가 어느 브랜드 별칭에 걸리면 종료 코드 4로 멈춘다(«나이키 런닝화» → «런닝화»로 바꾼다).
  브랜드 시드의 경로는 이미 그 브랜드 안에서 출발해 «카테고리 진입 경로에서 경쟁사로 새는 지점»이 아니다.
  정말 브랜드 출발 표본이 목적이면 `--allow-brand-seed` — 시드 자신의 브랜드는 귀속에서 빼고 리포트 경계 문장에 «브랜드 출발 표본»을 붙인다
- **T5 표기변형** — `--variant 왼쪽=오른쪽`은 canonical(NFKC → 소문자 → 변형치환 → 공백 제거)에 들어간다. 공백 차이(`런닝 화`)는
  규칙이 필요 없고, 철자 흔들림(`런닝`/`러닝`)만 넣는다. 브랜드 별칭도 같은 canonical로 대조한다
- 별칭이 두 브랜드에 겹치거나 2글자 미만이면 종료 코드 2. 별칭이 카테고리어 · 단계어와 겹치면 경고 — 그 말이 든 논브랜드 노드가 브랜드가 된다
- 노드 분류 순서: 시드 → 브랜드(걸린 브랜드 수로 `my_brand` / `competitor` / `brand_vs`) → 채널 → 커뮤니티 → 비교 → 일반(시드 · 카테고리어) → `unmatched`.
  별칭 대조는 공백을 지운 canonical 위에서 하고, 별칭의 **라틴 쪽 끝에서만** 경계를 본다 — 앞(뒤)이 문자열 끝 · 원래 공백 · 한글 등 비라틴이어야 한다.
  그래서 `sk매직`은 `sk 매직 얼음정수기` · `SK 매직`에 걸리고, `hp`는 `hp프린터` · `hp 노트북`에 걸리되 `ship`에는, `on`은 `running`에 걸리지 않는다.
  한글 쪽 끝은 경계를 보지 않는다(`쿠쿠정수기`). STEP 4는 별칭이 글자로 들어 있는데 그 브랜드로 분류되지 않은 노드를
  «별칭 누락 의심» 경고로 낸다(`alias_misses` · 리포트 반대 근거) — 브랜드 검색이면 별칭을 고쳐 0크레딧으로 다시 돌린다. 규칙 분류다 — LLM 분류는 쓰지 않는다(재현되지 않는 분류로 몫을 내면 같은 데이터에서 다른 누수가 나온다)

### STEP 2 · 시드 확인 · 파일럿 · 예산 게이트

시드를 `keyword_info`로 확인한다(검색량이 없는 시드는 경로가 거의 나오지 않는다):

```python
keyword_info(keywords=["런닝화", "러닝화 추천"], gl="kr", data_type="ads_metrics")    # 1 × N
path_finder(keyword="런닝화", gl="kr", time_point="curr", limit=20)                    # 파일럿
```

응답 원본을 `raw/`에 저장하고(요청 헤더 · 키는 저장하지 않는다) **호출 직후** 원장에 적는다:

```bash
python3 scripts/record_call.py --ledger calls.jsonl --tool keyword_info --role seed_volume \
    --raw raw/ki_seeds.json --step "시드 확인" --gl kr
python3 scripts/record_call.py --ledger calls.jsonl --tool path_finder --role pilot --seed 런닝화 \
    --limit 20 --raw raw/pf_pilot_running.json --step 파일럿 --gl kr
python3 scripts/leak_budget.py --ledger calls.jsonl --seeds "런닝화,러닝화 추천" --limit 200 \
    --budget 20000 --volume-nodes 60 -o leak_plan.csv
```

- `decision`: `done`(이미 본 limit으로 부름) · `call` · `recall_pilot`(파일럿 시드를 본 limit으로 다시 — 파일럿 표본은 작아 다른 시드와
  limit이 어긋난다) · `pilot_only`(재호출이 예산 밖 — 파일럿 경로로만 보고 비교에서 뺀다) · `hold_budget`
- `hold_budget`가 있으면 스크립트가 «예산 안 최대 limit»을 낸다 — limit · 시드 축소를 사용자에게 제안할 때 이 값을 쓴다
- 파일럿 없이 돌리면 `--ratio`(가정)가 필요하고 `ratio_source=assumed`로 남는다 — 계획을 «가정 기반»으로 고지한다

### STEP 3 · 본 호출과 호출 원장 (T7)

`call` · `recall_pilot` 시드를 **같은 limit · 같은 time_point로** 부른다. 호출할 때마다:

1. 응답 원본을 시드별 파일로 저장하고 `record_call.py --role main --limit <요청 limit>`으로 원장에 적는다.
   원장 한 줄에 `limit`(요청) · `returned`(반환 경로 수) · `unique_keywords` · `truncated`(반환 ≥ limit) · `cost`(`cost_detail.total_cost`) ·
   `cost_formula`(50 + 40 × U)가 들어간다 — **손으로 적지 않는다.** 이 원장이 리포트의 호출 순서 · 로그 · 비용 보고서가 된다
2. 원장 누적 실측(`cost` 합)이 예산을 넘으면 다음 호출을 멈춘다 — 계획은 추정이고 멈추는 기준은 실측이다
3. **절단** — `truncated=true`면 이 시드의 경로가 limit 밖에 더 있다. 그 시드의 비중은 «반환분 기준»이고,
   «내 브랜드가 닿지 않는다 · 경쟁사로 새지 않는다 · 경로를 다 봤다(수렴 · 커버)»는 판정을 하지 않는다.
   limit을 올리면 비용을 다시 치르므로 사용자 결정 없이 올리지 않는다
4. 빈 응답(`data: []`)은 `status=empty`, `[데이터 공백]` — 실패로 재시도하지 않는다
5. 리포트 헤더에 `time_point`(기본 `curr`)와 조회일을 따로 적는다. `curr`는 월 그레인 스냅샷이지 실시간이 아니다

### STEP 4 · 집계 (0크레딧 · T5 · T7 · T8)

```bash
python3 scripts/journey_leaks.py --ledger calls.jsonl --dict leak_dict.json \
    --category running-shoes-kr --out-dir out --queried-at 2026-11-19
```

원장에서 시드마다 limit이 가장 큰 path_finder 호출 하나를 쓰고(파일럿은 `superseded`), 시드 간 limit이 다르면 경고한다.

- **T5 canonical** — 노드는 canonical 그룹키로 묶고 원문 표기는 `example` · `variants`에 남긴다. 같은 그룹끼리 붙은 인접
  (`런닝화 → 러닝화`, `런닝화 → 런닝 화`)은 엣지로 세지 않고 `variant_loops`로 센다 — 세면 «가장 흔한 다음 검색»이 자기 표기가 된다
- **시드 표기 검사** — 시드가 0경로이고 한 글자 다른 표기가 사용 경로 절반 이상에 있으면 **종료 코드 3으로 멈추고**
  변형치환 규칙(표기 전체 쌍)을 제안한다. 사전에 넣고 다시 돌린다(0크레딧). 일부 경로에만 있으면 경고
- **경로 나누기 · 귀속** — 시드가 처음 나온 자리에서 앞은 유입, 뒤는 진행. 누수는 진행 쪽에서만 센다. 시드가 경로 끝이면
  `seed_terminal`, 시드가 없으면 `off_seed` — 둘 다 분모에서 빼고 수를 적는다. 진행 경로마다 시드 다음 처음 닿은 브랜드로 귀속:
  `my_brand` / `competitor` / `brand_vs`(두 브랜드 이상이 한 검색에 — 어느 쪽에도 귀속하지 않음) / `no_brand`
- **누수 엣지** — 진행 쪽 인접 a → b: b가 경쟁 브랜드이고 a가 논브랜드 · 시드면 `leak`, a가 내 브랜드면 `switch`.
  반대 방향 `capture` · `win_back`, 브랜드 비교 검색으로 가면 `vs`. 경로마다 한 번만 센다
- **허브 노드 점유** — 논브랜드 노드 A를 지난 진행 경로가 A 다음 처음 닿은 브랜드. 그룹 [가정]: 경로 < `--min-paths`(3)면 `low_evidence`,
  (내 브랜드 + 경쟁) ÷ 경로 < 0.1이면 `uncaptured`, 브랜드 도달 경로 중 내 브랜드 ≥ 0.7이면 `winning`, 경쟁 ≥ 0.7이면 `leaking`,
  그 사이 `contested`. 내 브랜드가 없으면 `brand_reached`. 내 브랜드 노드는 `my_node`로 두고 그 뒤 경쟁 브랜드로 간 경로를 센다
- **T7 판정 보류** — 절단된 시드가 지나는 허브는 `verdict_note`에 «반환분 기준(절단)», 내 브랜드 0 · `uncaptured`이면 ««내 브랜드 미도달» 판정 보류»가 붙는다.
  점유 표의 0경로 행도 «반환분에 없음 — 판정 보류». 요약 맨 위에 절단 경고가 붙는다
- **T8 논브랜드 분리** — 점유는 늘 두 분모로 낸다: `share_all_paths`(진행 경로 전체 — no_brand 포함)와 `share_branded_paths`(브랜드 도달 경로).
  `no_brand` 행을 따로 적는다. 허브 표는 논브랜드 노드만 «기회 지점»으로 올리고(경쟁 · 비교 브랜드 노드는 목적지라 빼고), 내 브랜드 노드는 `my_node`로 구분한다.
  **미등록 브랜드 후보** — 논브랜드 노드에서 2노드 이상 반복되고 한 번 이상 맨 앞에 오는 말(`brand_candidates`). 빠진 브랜드는 `no_brand`와 허브의
  «브랜드 없음»을 부풀리고 경쟁 몫을 줄인다. 후보를 사용자에게 보여 주고 브랜드면 STEP 1에 `--competitor`로 넣어 다시 돌린다(0크레딧).
  후보 판정 자체는 [추정]이다 — 사람이 확인한다
- **공통 줄기** — 진행 앞 `--stem-len`(3) 걸음이 같은 경로가 끝만 갈라지는 경우가 있다. `stem_count` · `stems_through`가 `path_count`보다 작으면
  «세션 수»가 아니라 «한 줄기 아래 갈래 수»로 읽는다

`unmatched`(미분류) 비중이 크면 `--category-terms`를 보강해 다시 돌린다(0크레딧). `unmatched`는 «카테고리 밖» 판정이 아니다 — 사전이 모자랄 수 있다.

### STEP 5 · 노드 볼륨 (선택 · `1 × M`)

STEP 4가 `volume_request_{category}.json`(허브 · 누수 대상 노드의 모든 표기, 상한 `--volume-top`)을 쓴다. 허브 우선순위를 볼륨으로도 보고 싶을 때만:

```python
keyword_info(keywords=<volume_request의 keywords>, gl="kr", data_type="ads_metrics")    # 1 × M
```

`record_call.py --tool keyword_info --role node_volume`으로 원장에 적고 STEP 4를 다시 돌린다. 볼륨(`volume_avg` — 최신 3개월 평균)은
**T5대로** 같은 keyword의 완전 중복 행을 먼저 합치고(`collapse_identical`), 같은 검색의 중복(지표 일치)은 한 번만 센 뒤,
canonical 그룹마다 하한(`volume_lo` = 그룹 최댓값)과 상한(`volume_hi` = 합)을 병기한다 — 둘 다 [추정]. 허브 순위는 경로 수 기준이며 볼륨은
보조 정렬이다. 요청했는데 돌아오지 않은 표기는 `volume_status=not_returned`([데이터 공백]) — 0으로 치지 않는다.

### STEP 6 · 리포트와 서술

```bash
python3 scripts/build_leak_report.py out/leak_result_running-shoes-kr.json -o report.json --estimate 1789
python3 scripts/render_report.py report.json -o report.html     # 계약 위반이면 렌더하지 않는다
```

- 사실 목록(`facts`)은 결과 JSON에서 만들고 문구 숫자는 `{{ID}}`로만 쓴다. 모델 번호가 든 검색어(`뉴발란스 1080`)도 사실로 등록해 부른다
- 호출 기록(`provenance.calls`)은 결과 JSON에 실린 원장(STEP 2 · 3 · 5의 `record_call.py`)에서 만든다
- 해석을 덧붙이려면 `--notes notes.json`(`{"D1.interpretation": "[추정] …"}`) — «[추정]»으로 시작하지 않으면 거부한다. 원 앱의 LLM 해설 ·
  경쟁사 제안은 이 스킬에서 규칙 템플릿 + [추정] 메모 + 미등록 브랜드 후보로 바뀌었다
- **점유 · 기회 문장 규칙(T8)** — «경쟁 몫»을 말할 때 두 분모를 함께 쓰고 `no_brand` 몫을 같은 문장에 둔다. «기회 지점»은 논브랜드 허브에서만 말한다
- **절단 문장 규칙(T7)** — 절단 호출이 있으면 «반환분 기준»을 붙이고 «새지 않는다 · 닿지 않는다 · 다 봤다»를 쓰지 않는다
- "A 다음 B"는 집계된 인접 빈도다. «사람들이 A를 거쳐 경쟁사 제품을 산다»로 쓰지 않는다. 경로의 끝은 이탈이 아니라 반환 경로의 끝이다 — 이탈률을 계산하지 않는다

## 산출물

아래 컬럼 목록은 스크립트의 실제 출력이다. 스크립트를 고치면 이 목록도 함께 고친다
(`selftest_leaks.py`가 이 목록을 읽어 실제 헤더와 대조한다).

```
leak_plan.csv
  seed, limit, ratio, ratio_source, safety, planned_unique_keywords, planned_cost,
  cumulative_planned_cost, within_budget, decision, note

leak_calls_{category}.csv
  id, step, tool, role, seed, requested, requested_unit, returned, used_paths,
  unique_keywords, missing, truncated, cost_actual, cost_formula, used_in_analysis, raw, status

leak_share_{category}.csv
  seed, outcome, brand, paths, share_all_paths, share_branded_paths, base_paths,
  branded_paths, limit, truncated, verdict_note

leak_edges_{category}.csv
  edge_type, from_canonical, to_canonical, from_example, to_example, from_class, to_class,
  to_brand, path_count, stem_count, seeds

leak_hubs_{category}.csv
  canonical, example, node_class, brand, paths_through, stems_through, seeds, my_paths,
  competitor_paths, vs_paths, no_brand_paths, my_share_all, competitor_share_all, no_brand_share,
  my_share_branded, competitor_share_branded, top_competitor, top_competitor_paths, group,
  verdict_note, volume_lo, volume_hi, volume_status

leak_nodes_{category}.csv
  canonical, example, variants, node_class, brand, facets, outbound_paths, inbound_paths,
  volume_lo, volume_hi, volume_rows, volume_status

brand_candidates_{category}.csv
  token, nodes, leading_nodes, examples
```

그 밖의 파일:

- `leak_dict.json` — STEP 1 사전 · `calls.jsonl` — 호출 원장(한 줄에 호출 하나 · `record_call.py`)
- `volume_request_{category}.json` — STEP 5 요청 목록(`keywords` · `nodes` · `planned_cost`)
- `leak_result_{category}.json` — 리포트 재료(합계 · 점유 · 엣지 · 허브 · 후보 · 별칭 누락 의심 `alias_misses` · 원장 · 경고)
- `leak_summary_{category}.md` — 헤더(조회일 · time_point · 세션 인접 한계) · 호출과 크레딧 표(요청 limit · 반환 · 절단 · 실측 · 식) ·
  절단 경고 · 경고(별칭 누락 의심 포함) · 경로 귀속 표(두 분모) · 누수 엣지 상위 · 허브 점유 · 미등록 브랜드 후보 · 분류 분포 · 라벨 규약
- `report.json` → `report.html` · `report.calls.csv` · `report.cost.json`

값의 뜻:

- `share_all_paths` = paths ÷ 진행 경로(no_brand 포함) · `share_branded_paths` = paths ÷ 브랜드 도달 경로(no_brand 행은 비움)
- `truncated` = 반환 경로 ≥ 요청 limit (`yes` · `no` · 전체 행은 `mixed`) · `used_in_analysis` = `yes` · `superseded`(같은 시드의 더 큰 limit 호출에 대체)
- `group` = `leaking` · `contested` · `winning` · `uncaptured` · `brand_reached` · `my_node` · `low_evidence`
- `*_share_*` 값은 0~1 비율(리포트에서 %로 바꾼다) · `volume_lo`/`volume_hi`는 그룹 하한/상한

## 4-Label

| 라벨 | 이 스킬에서의 적용 |
|---|---|
| `[실제 데이터]` | 경로 시퀀스 원본 · 인접 쌍의 경로 수 · 요청 limit과 반환 경로 수 · 고유 키워드 수 · `cost_detail` · `volume_avg` 원값 · 줄기 수 |
| `[추정]` | 노드 분류(규칙) · 경로 귀속과 점유 몫 · 허브 그룹 · 미등록 브랜드 후보 · 볼륨 하한/상한 · 계획 비용 · `--notes` 해석 |
| `[가정]` | 분류 사전(별칭 · 카테고리어 · 단계어 · 변형치환) · 최소 경로 3 · 그룹 임계 0.1 · 0.7 · 안전계수 1.3 · 줄기 길이 3 · 파일럿 없을 때의 r |
| `[데이터 공백]` | 빈 응답 · off_seed · seed_terminal · 응답에 없는 볼륨(`not_returned`) · 절단으로 보지 못한 limit 밖 경로 |

## 한계

- **세션 인접만 잡는다.** 같은 세션에서 붙어 나온 검색의 집계이며 개인 추적이 아니다. 며칠에 걸친 고려 · 구매는 보이지 않는다.
  «처음 닿은 브랜드»는 검색 순서이지 선택 · 구매가 아니다. 검색량 단위는 건이며 사람 수가 아니다
- **표본이다.** limit 안의 반환 경로이며, 절단이면 limit 밖은 미관측이다. 경로 수가 적은 허브의 비율은 크게 흔들린다(최소 경로 기준 [가정])
- **월 그레인 · 단일 시점.** `time_point=curr` 스냅샷이며 조회일과 데이터 시점이 다르다. 시점 비교(3·6·12개월 전)는 0.1 범위 밖 —
  하려면 시점 수만큼 본 호출 비용이 곱해지고 limit을 고정해야 한다
- **규칙 분류의 품질만큼만 맞다.** 별칭이 빠진 브랜드는 논브랜드가 되고, 별칭이 일반어와 겹치면 논브랜드가 브랜드가 된다. 모델명만 있는
  검색(브랜드명 없이 `페가수스`)은 별칭에 넣지 않으면 브랜드로 잡히지 않는다. 별칭이 글자로 든 노드가 그 브랜드로 분류되지 않으면
  «별칭 누락 의심»으로 따로 내놓는다 — 그 목록이 비어 있지 않으면 경쟁 몫과 허브 «미확보» 판정을 그대로 믿지 않는다
- 인구통계(성 · 연령)는 `path_finder`에 없다. 원인을 설명하지 않는다 — 무엇이 먼저 붙는지만 말한다

## 리포트

이 스킬의 HTML 리포트는 `references/report-contract.md`(렌더링 계약 정본 사본)를 따르고,
`scripts/render_report.py`(공통 렌더러)로만 만든다. 스킬은 **무엇을 넣을지**를 `report.json`으로 정하고,
뼈대 순서 · 차트 메타 · 카드 필드 · 숫자 추적 · 호출 기록은 렌더러가 검사한다.
`assets/report.example.json`은 이 스킬의 견본이다 — 합성 픽스처로 `build_leak_report.py`가 만든 결과다.
렌더하면 `report.html` 옆에 호출 로그(`report.calls.csv`)와 비용 보고서(`report.cost.json`)가 함께 나온다.

첫 화면 경계 문장(`boundary`): «시드 진입 검색 뒤 세션 인접 경로 N개(반환분)에서 처음 닿은 브랜드를 셌다 — 개인 여정 · 구매 · 며칠 뒤 행동 ·
limit 밖 경로 · 시점 변화는 미관측»(브랜드 출발 표본이면 그 사실을 덧붙인다)

| 섹션(`kind`) | 이 스킬이 넣는 것 | 쓰는 지표 · 차트 |
|---|---|---|
| `summary` 분석 요약 | D1 처음 닿은 브랜드(두 분모 + no_brand) · D2 가장 많이 새는 논브랜드 허브 · D3 내 브랜드 뒤 switch · 반대 근거(절단 · no_brand · 미분류 · 미등록 후보 · brand_vs) | `share_all_paths` · `share_branded_paths` · 허브 `competitor_share_all` · `stems_through` |
| `trend` 트렌드 분석 | 해당 없음 — 시계열을 쓰지 않는다(단일 시점) | — |
| `structure` 관심 구조 | 처음 닿은 브랜드 막대 · 누수 엣지 표 · 허브 점유 표 | 막대(진행 경로 대비 %, 이름에 경로 수) · `leak_edges` · `leak_hubs` |
| `action` 기회와 실행 | A1 최다 누수 허브의 비교 · 선택 콘텐츠 가설 · A2 switch 방어(내 브랜드 쪽 비교 정보) — 확대/수정/중단 조건은 같은 limit 재수집 기준 | 허브 경쟁 몫 · switch 인접 수 |
| `appendix` 근거 부록 | 정의(진행 · 귀속 · 분모 제외) · 그룹 임계 [가정] · 분류 분포 · 미등록 브랜드 후보 · 비용 + 렌더러가 붙이는 사실 목록 · 호출 순서 · 호출 로그 · 비용 보고서 | 원장 `cost` 합 · `class_distribution` |

`report.json`의 `facts`(사실 목록)는 **스크립트의 저장 계산 결과**에서 만든다 — 문구의 숫자는 `{{ID}}`로만 쓴다.
`provenance.calls`(호출 순서 · 조건 · 반환 수 · 비용 · 원본 파일)는 **수집 스크립트의 원장**에서 만든다 — 손으로 적지 않는다.

호출 원장을 남기는 단계: STEP 2(시드 `keyword_info` · 파일럿) · STEP 3(본 호출) · STEP 5(노드 볼륨)에서 응답 원본을 `raw/`에 저장한 직후
`record_call.py`가 `calls.jsonl`에 `cost_detail.total_cost` · 요청 limit · 반환 수를 쓴다. `journey_leaks.py`가 이 원장을 결과 JSON에 싣고
`build_leak_report.py`가 `provenance.calls`로 옮긴다.

```bash
python3 scripts/render_report.py report.json -o report.html     # 계약 위반이면 렌더하지 않는다
```
