---
name: spot-segment-risers
description: |
  지정한 **성별·연령 세그먼트**(성별 all/f/m × 연령대)에서 검색이 뜨는 대상을 순위로 보여 준다.
  시드 키워드나 카테고리에서 `trend_finder`(issue_list) 급부상 이슈와 `intent_finder` 연관 검색어로 후보를 모으고,
  `keyword_info`(ads_metrics로 거른 뒤 `all`)의 48개월 검색량과 한국 `demography`(성별·연령 비율)로
  세그먼트 **급등**(전년 동기 대비 · 세그먼트 절대 증가 순) · **신규**(과거 창 결측 → 최근 등장) ·
  **과대 지수**(세그먼트 비율 ÷ 후보 풀 전체 비율)를 낸다. 마케터·MD·콘텐츠 기획자가 다음 분기 기회를 찾을 때 쓴다.

  "20대 여성한테 요즘 뜨는 거 뭐야" · "30대 남성 세그먼트에서 급등한 키워드 찾아줘" ·
  "선크림·쿠션에서 20대 여성 비중이 유독 큰 검색어 보여줘" · "MZ 여성 타깃 다음 분기 아이템 후보 뽑아줘" ·
  "40대 이상에서 새로 등장한 검색어 있어?" · "이 카테고리에서 우리 타깃 연령대가 과하게 찾는 게 뭐야"
  같은 요청이면 반드시 이 스킬을 쓴다.

  사용자가 «세그먼트»라는 말을 쓰지 않아도, **특정 성별·연령 집단을 기준으로** 무엇이 뜨는지·누가 유독 찾는지를
  묻는 요청이면 켠다. 경계: 세그먼트 구분 없이 «전체적으로 무엇이 뜨는가»(성장률·가속도·지속성·확산 등급)는
  `spot-trends`다 — 이 스킬의 단위는 신호가 아니라 **세그먼트**(세그먼트 절대 증가 · 과대 지수)다. 시장 규모·유니버스는
  `map-your-market`, 나라끼리 비교는 `compare-markets-across-countries`. 성·연령 비율은 **한국(gl=kr)만** 반환된다 —
  일본·미국 요청이면 세그먼트 없이 전체 순위만 내고 그 사실을 적는다.
license: MIT
metadata:
  version: "0.1.2"
---

<!-- lm-skill: kind=task; connectors=trend_finder,intent_finder,keyword_info; flags=monthly,expand,report; traps=T1,T2,T3,T4,T5,T6,T7 -->

# Spot Segment Risers — 세그먼트 급등 · 신규 · 과대 지수

> **핵심 원칙**: 세그먼트 수치는 **측정값이 아니라 파생값**이다. `demography`는 검색어별 **현재 시점 하나**의
> 성별 비율과 연령 비율(주변 분포)이다 — 월별 분할도, 성별 × 연령 칸도 없다. 그래서 세그먼트 전년비는 전체 전년비와 같고,
> 세그먼트마다 달라지는 것은 **절대 증가량**과 **과대 지수**다. 이 둘은 작은 기저에서 폭발하므로 게이트 없이는 순위를 내지 않는다.

## 데이터 계약

이 스킬은 `references/lm-data-contract.md`(정본 사본)를 따른다. 해당 함정과 처리 위치:

| 함정 | 처리 위치 | 상태 |
|---|---|---|
| T5 표기변형 canonical 정규화 | STEP 3 (후보 병합) · STEP 6 (같은 검색의 중복 · 표기변형 대표 · 대상 하한~상한) | ✅ |
| T1 기준월·지연 3종 표기 | STEP 5.5 · 리포트 머리 | ✅ |
| T2 마지막 달 완결성 점검 | STEP 5.5 (`check_refmonth.py`) · STEP 6 (마지막 달 제외 기본 · `provisional`) | ✅ |
| T3 volume_trend 대신 전년 동기 비교 | STEP 6 (`yoy` = 최근 3개월 창 ÷ 전년 같은 창) | ✅ |
| T4 기저 볼륨 게이트 | STEP 7 (전체 게이트 · 세그먼트 게이트 · 과대 지수 볼륨 게이트 · 대상 헤드라인 게이트) | ✅ |
| T6 결측 월 처리 | STEP 6 (`계산 불가` · 신규 판정만 과거 결측을 «등장 전»으로 읽음) · STEP 8 (대상 모집단 고정) | ✅ |
| T7 절단(limit) 검사 — 절단이면 수렴 판정 보류 | STEP 1 · STEP 2 (`segment_candidates.py`가 issue_list · intent_finder 절단을 원장과 «수집 사실»에 남김) | ✅ |
| §1 `trend_finder` 규칙 — 빈 결과는 실측·0 과금 · 기간 넓혀 재조회 · 검색량 없음 · 요약은 `[추정]` · 구글 기반 · 범위 밖 이슈를 거른 건수로 판단 | 예산 · STEP 1 · STEP 3 (범위 점검 · 범위 미확인 보류) · 한계 | ✅ |

> 이 표는 선언이다. 실제 처리는 아래 STEP 본문에 있다.

## `spot-trends`와의 경계

| | `spot-trends` | `spot-segment-risers` (이 스킬) |
|---|---|---|
| 단위 | 검색어의 **전체** 추세 신호 | **세그먼트**(성별 × 연령) 안의 검색 수요 |
| 순위 기준 | 성장률·가속도·지속성·확산 백분위 등급 | 세그먼트 **절대 증가** · 신규 등장 · **과대 지수** |
| 쓰는 필드 | `monthly_volume` | `monthly_volume` + `demography`(kr만) |
| 후보 | trend_finder 이슈 (+사용자 후보) | trend_finder 이슈 + intent_finder 연관 검색어 + 시드 |

후보 수집 · 넓힘 · 스크린 게이트는 `spot-trends`와 같은 방식이다(이슈 후보 → `ads_metrics` 스크린 `volume_avg × 3 ≥ 3,000` → `all`).
«세그먼트 구분 없이 무엇이 뜨나»가 질문이면 `spot-trends`로 보낸다. 이 스킬은 성장 등급을 매기지 않는다.

## 커넥터와 크레딧

| 커넥터 | 용도 | 크레딧 결정식 |
|---|---|---|
| `trend_finder` | 시드 주변 급부상 이슈로 후보 모으기(issue_list · 검색량 없음) | `50 × 결과가 있는 호출 + 2 × 반환 이슈` — 빈 결과 호출 0 · 호출 전 상한 `50 + 2 × limit` |
| `intent_finder` | 시드의 연관 검색어로 후보 넓히기(문자열만 반환) | `30 × 입력 + 2 × 반환` |
| `keyword_info` | 1단 `ads_metrics` 스크린 → 2단 `all`(48개월 · demography) | `1 × N + 10 × M` |

### 예산 (결정식 · 호출 전에 사용자에게 제시)

```
trend_finder  = 50 × 결과가 있는 호출 + 2 × 반환 이슈      # 빈 결과 호출 0 (계약 §1)
                호출 전 상한 = (50 + 2 × limit) × C          # C = 시드 수 × 조회 기간 수(14일, 비면 90일)
intent_finder = 30 × 시드 수 + 2 × 반환 검색어               # 상한 = 30 × 시드 수 + 2 × limit × 시드 수
keyword_info  = 1 × N (ads_metrics · 후보 전량) + 10 × M (all · 스크린 통과분, --max-all 로 상한)
합계 상한     = (50 + 2 × L_tf) × C + (30 + 2 × L_if) × 시드 수 + N + 10 × M
```

상한 예시(시드 2개 «선크림»·«쿠션» · issue_list limit 30 · 두 시드 모두 90일로 넓힘(C = 4) · intent_finder limit 100 ·
`--max-all 80`): trend_finder (50 + 2 × 30) × 4 = 440 · intent_finder (30 + 2 × 100) × 2 = 460 ·
N ≤ 시드 2 + 이슈 120 + 연관 200 = 322 · all 10 × 80 = 800 → **합계 상한 2,022**.
**2단 대상 수 M이 총액을 지배한다** — 후보를 그대로 `all`에 넣지 않는다(10배). 실소비는 응답 `cost_detail.total_cost` 합이
유일한 기준이고, `segment_candidates.py`가 원장(`ledger.json`)에 호출마다 남긴다. 세그먼트 지표가 필요한 kr 실행은
`demography`가 오는 `all`을 쓴다. 세그먼트가 없는 jp · us 실행은 `ads_info`로 받아도 된다(계약 §1 v1.3 — 단가는 첫 호출 `cost_detail`로 확인). `all` 단가 10은 계약 값이며 배포 환경마다 다를 수 있다 —
첫 `all` 호출의 `cost_detail`로 확인하고 견적을 다시 계산한다.

## 번들 자산

| 파일 | 하는 일 | 쓰는 곳 |
|---|---|---|
| `scripts/segment_candidates.py` | **수집**(issue_list · intent_finder 응답 → 후보 · 출처 CSV · 넓힘 · 절단 · 크레딧 대조) · **스크린**(ads_metrics → all 대상) · **원장**(호출마다 조건 · 반환 · cost_detail · 원본 파일) (이 스킬 고유) | STEP 1~5 |
| `scripts/segment_risers.py` | demography 파서 · 세그먼트 비중 · 급등 · 신규 · 과대 지수 · 게이트 · 대상 묶음 (이 스킬 고유) | STEP 6~8 |
| `scripts/build_report.py` | 저장된 계산 결과 + 원장 → `report.json`(사실 목록 · `{{ID}}` 문구 · provenance) (이 스킬 고유) | STEP 9 |
| `scripts/render_report.py` | 공통 렌더러 — 계약 위반이면 렌더하지 않는다 (공유) | STEP 9 |
| `scripts/check_refmonth.py` | 데이터 기준월 · 지연 · 마지막 달 완결성 (공유) | STEP 5.5 |
| `scripts/series_dedup.py` | 표기 정규화 · 같은 검색의 중복 판정 (공유 — 두 고유 스크립트가 import) | STEP 3 · 6 |
| `scripts/trend_yoy.py` | 개별 검색어 전년 동기 검증 (공유 · 교차확인) | STEP 8 |
| `scripts/build_universe.py` · `scripts/coverage_curve.py` | 공유 사본 — 이 스킬 절차에서는 쓰지 않는다(유니버스 · 수렴 판정은 `map-your-market`) | — |
| `scripts/selftest.py` · `scripts/selftest_render.py` | 공유 스크립트 계약 · 렌더러 회귀 검사 + `selftest_*.py` 실행 | 스킬 수정 후 |
| `scripts/selftest_segments.py` | 이 스킬 고유 회귀 검사(G1~G9 — 빈 결과 넓힘 · 절단 · 스크린 · 기저 폭발 · 신규 · 중복 · 결측 · 잠정 · jp 사양 · 파서 · 리포트 · 컬럼 대조 · 범위 점검(범위 미확인 인명 이슈 보류 · `--include` 승격 · 창 이후 이슈)) | 스킬 수정 후 |
| `assets/entity_rules.json` | 대상(엔티티) 묶음 불용어 · 꼬리말 규칙 — 카테고리마다 복사해 고친다 | STEP 3 · 8 |
| `assets/fixtures/*.json` | 합성 응답(issue_list 빈 결과 · 절단 · intent_finder 절단 · ads_metrics · kr all(기저 폭발 · 신규 · demography 없음 · 결측 · 마지막 달 급락) · jp all) — selftest 전용 | 스킬 수정 후 |
| `assets/report.example.json` | 이 스킬 리포트 견본(합성 픽스처를 STEP 1~9로 돌린 결과) | STEP 9 참고 |
| `assets/themes.template.json` · `references/themes-schema.md` | 공유 사본 — `--rules`에 `themes.json`(rules.변형치환)을 줄 때 견본 | STEP 3 |

## 사전 확인

```
1. 분석 시장(gl)이 단일 값으로 확정되었는가? — 세그먼트는 gl=kr 에서만 계산된다.
   jp·us 요청이면 «세그먼트 없이 전체 순위만 나간다»를 먼저 알린다(demography 미반환은 공백이 아니라 데이터 사양).
2. 세그먼트가 정해졌는가? — 성별 all/f/m × 연령 all · a13(10대) · a20s(20대 = a20+a25) · a20 · a25 · a30 · a40 · a50(50대 이상).
   «MZ»·«2030»처럼 범위가 모호하면 어떤 버킷인지 확인한다(데이터의 연령 버킷은 a0 · a13 · a20 · a25 · a30 · a40 · a50 뿐 — 60대 이상 따로 없음).
   성별과 연령을 둘 다 고르면 비중은 두 비율의 곱(독립 가정)이라 [추정]이다 — 이 사실을 알린다.
3. 시드(카테고리)가 정해졌는가? — issue_list 의 keyword 는 단일 문자열이다. 시드마다 호출한다.
   띄어쓴 시드는 단어 하나만 맞아도 이슈를 가져온다(계약 §1) — 붙여 쓴 형태도 부를지 정한다.
4. 카테고리 경계 — 동음이의 · 다른 업권이 섞일 단어인가? 섞이면 STEP 3 `--exclude` 정규식을 사용자와 정한다.
   사용자에게 물을 수 없어도 진행한다 — STEP 3 범위 점검이 trend_finder 단독 후보를 자동으로 가른다(`--exclude`가 비어도 된다).
   시드 말고 범위를 넓힐 카테고리어(예: 선케어 → «선스틱»)가 있으면 `--scope-terms`로 준다.
5. 예산 — 위 결정식으로 상한을 보여 주고 `--max-all`(M 상한)을 정한다.
```

## 실행 순서

### STEP 0 · 요청 해석

요청에서 gl · 세그먼트(성별 · 연령) · 시드 · 범위 밖 단어를 뽑는다. 사용자가 후보 목록을 주면 STEP 3 `--user-candidates`로 합친다.
`trend_finder`가 없는 환경이면 intent_finder 와 시드만으로 진행하고(STEP 3은 `--intent`만 줘도 돈다) «이슈 후보 없음 — 환경에 커넥터 없음»을 적는다.

### STEP 1 · 이슈 후보 (trend_finder)

```python
trend_finder_issue_list(keyword=seed, gl="kr", period_days=14, limit=30, sort="score", order="desc")
# 시드마다 한 번 · limit 은 항상 지정(기본 1,000이면 호출당 상한 2,050) · 응답을 raw/tf_<seed>_14d.json 으로 저장
```

- **빈 결과는 실측이다**(«그 기간 매칭 없음» · 과금 0). STEP 3 수집이 범위 안 이슈 0건인 시드를 찾아 exit 3으로 멈추면
  `period_days=90`으로 **한 번** 더 조회해 같은 수집 명령에 파일을 더한다. 90일도 0이면 «이슈 없음»으로 결론 낸다 — 이슈를 지어내지 않는다.
- `total` > 반환 수이고 반환이 `limit`에 닿으면 **limit 절단**(T7)이다 — 후보가 전부가 아니라는 뜻이고, 원장 `truncated: true`와
  «수집 사실»에 남는다. 이 스킬은 수렴(«다 모았다»)을 선언하지 않는다.
- 응답 `summary`는 AI 생성 요약이다 — `issue_summary_ai`로 옮기고 `[추정]`으로만 인용한다.
- 이슈는 **검색량이 아니다**. 순위는 STEP 6 이후 `keyword_info` 검색량으로만 매긴다. 인덱스는 구글 기반이라 «국내 이슈 전체»로 단정하지 않는다.

### STEP 2 · 연관 확장 (intent_finder)

```python
intent_finder(keywords=[seed], gl="kr", limit=100)   # 30 × 1 + 2 × 반환 · 응답을 raw/if_<seed>.json 으로 저장
```

intent_finder 는 **문자열만** 준다 — 지표는 STEP 4~5의 keyword_info 가 붙인다. 반환 수 = `limit`이면 절단(T7)으로 기록한다.

### STEP 3 · 후보 수집과 범위 점검 (0크레딧)

```bash
python3 scripts/segment_candidates.py collect --tf raw/tf_선크림_14d.json raw/tf_선크림_90d.json raw/tf_쿠션_14d.json \
    --intent raw/if_선크림.json raw/if_쿠션.json -o candidates.json --sources-out candidate_sources.csv \
    --ledger ledger.json --rules '{"썬":"선"}' [--exclude '광고 모델|모델 누구'] [--entity-rules assets/entity_rules.json] \
    [--scope-terms '선스틱'] [--include '<사람이 확인한 범위 미확인 후보 정규식>']
```

- 후보 = **시드 자체**(맨 앞 · `--no-seed`로 뺀다) + 범위 안 이슈 키워드 + 연관 검색어 + 사용자 후보.
  `series_dedup.canon`(+`--rules` 치환)으로 표기변형을 한 후보로 합친다 `[추정]`(T5) — 같은 canonical 이면 시드 표기가 이름이 된다.
- `--exclude` 정규식에 걸린 후보는 keyword_info 로 보내지 않지만 `candidate_sources.csv`의 `excluded`에 남는다(조용히 사라지지 않는다).
  넓힘 판정은 **범위 안 이슈 수**(범위 밖 제외 · 아래 범위 점검에서 확인 또는 승격)로 한다.
- **범위 점검 ⚠️ 생략 금지(0크레딧 · 스크린 전)** — trend_finder 이슈는 시드의 단어 하나로 매칭돼 인명 · 사건 검색어가 섞인다(계약 §1).
  **trend_finder 에서만 온 후보**는 결정적 규칙 `[가정]`으로 가른다:
  ① 후보(또는 같은 canonical 로 합쳐진 이슈 표기)가 시드 · `--scope-terms` 카테고리어를 포함하면 «확인 — 시드·카테고리어 포함»,
  ② intent_finder 연관어 이웃과 토큰(2자 이상 · `entity_rules` 불용어 제외)을 하나라도 공유하면 «확인 — 연관어 토큰 공유»,
  ③ 둘 다 아니면 **«범위 미확인»**. 시드 · intent_finder · 사용자 출처 후보는 «확인 — 출처»다. 결과는 `candidate_sources.csv`의 `scope`와
  원장 `scope`(규칙 · 기준어 · 확인 수 · `held` · `include` · `promoted`)에 남는다.
- 범위 미확인 후보는 **지우지 않는다** — keyword_info 로 재고 표에는 남지만, STEP 6~9에서 **순위 · 과대 지수 기준 풀 · 대상 헤드라인 ·
  D1 · A1 주어에서 빠진다**. 사람이 범위 안이라고 확인한 것만 `--include '<정규식>'`으로 승격한다(collect 에서, 또는 재수집 없이
  STEP 6 `segment_risers.py --include`로) — 승격은 원장 · summary · 리포트 «범위»에 기록된다. 에이전트는 이슈 요약만 보고 스스로 승격하지 않는다.
- 크레딧 줄: trend_finder 결정식(`50 × 결과 있는 호출 + 2 × 반환`)과 `cost_detail` 합을 대조하고, 다르면 «환경 단가 확인»을 띄운다.
- `ledger.json`(호출 원장)에 호출마다 `step · tool · params · returned · cost(cost_detail) · raw · status · truncated`가 쌓인다 —
  리포트의 호출 순서 · 호출 로그 · 비용 보고서는 여기서만 만든다(손으로 적지 않는다).

### STEP 4 · 스크린 (keyword_info ads_metrics · 1 × N)

```python
keyword_info(keywords=candidates, gl="kr", data_type="ads_metrics")    # 1 × N
```
```bash
python3 scripts/segment_candidates.py screen raw/ads_metrics.json --candidates candidates.json \
    --gate 3000 --window 3 --max-all 80 -o all_candidates.json --ledger ledger.json --rules '{"썬":"선"}'
```

스크린은 `volume_avg × 3 ≥ 3,000` `[가정]`(`volume_avg` = 최신 3개월 평균 · 계약 §2)이다 — `spot-trends`와 같은 1차 거름이지 판정이 아니다.
같은 canonical 응답 행은 `volume_avg`가 가장 큰 표기 하나로, 지표가 모두 같은 행(`series_dedup.dedup_map`)은 «같은 검색 병합»으로 한 번만 보낸다.
`--max-all`을 넘으면 `volume_avg` 큰 순으로 자르되 **범위 미확인 후보를 맨 뒤로** 미루고(원장 `scope.held`) 뺀 수를 적는다. 탈락 · 미반환은 원장 `screen.rows`에 남는다(미반환 = `[데이터 공백]`).
`cost_detail`이 후보 수와 다르면 경고한다(요청 목록이 `candidates.json`과 달랐거나 환경 단가가 다르다).

### STEP 5 · 시계열 · 성·연령 (keyword_info all · 10 × M)

```python
keyword_info(keywords=all_candidates, gl="kr", data_type="all")         # 10 × M — 스크린 통과분만
```
```bash
python3 scripts/segment_candidates.py ledger raw/kw_all.json --ledger ledger.json --step "월별 수집" \
    --purpose "48개월 검색량 · 성 · 연령"
```

1,000개를 넘으면 나눠 부르고 계약 §1 «응답 병합» 규칙대로 한 파일로 합친다. 과금은 요청 키워드 수다 — 응답에서 빠진 키워드도 과금되고,
요청하지 않은 표기변형은 무과금으로 함께 온다(STEP 6이 처리).

### STEP 5.5 · 데이터 기준월 확인 ⚠️ 생략 금지

```bash
python3 scripts/check_refmonth.py raw/kw_all.json --queried-at 2026-10-15 > check_refmonth.txt
```

리포트 머리에 **`데이터 기준월 / 조회일 / 지연`**을 적는다(T1). 기준월은 응답 `monthly_volume`의 `month` 최댓값에서 읽는다 —
조회일을 데이터 시점으로 쓰지 않는다. 같은 명령이 **마지막 달 완결성**(T2)을 점검한다 — 의심 건수를 리포트 «수집 사실»에 적는다.
«다음 분기 기회»를 말할 때 지연만큼 늦게 본다는 사실을 빼지 않는다.

### STEP 6 · 세그먼트 계산

```bash
python3 scripts/segment_risers.py raw/kw_all.json --gl kr --gender f --age a20s --category "KR 선크림·쿠션" \
    --sources candidate_sources.csv --rules '{"썬":"선"}' --requested all_candidates.json -d out/
```

| 지표 | 계산 | 라벨 |
|---|---|---|
| 세그먼트 비중 `segment_share` | 성별 비율 × 연령 비율(한 축만 고르면 그 비율) | 한 축 `[실제 데이터]` · 곱 `[추정]`(독립 가정) |
| 전년비 `yoy` | 최근 3개월 창 합 ÷ 전년 같은 3개월 창 합 − 1 — **`volume_trend`는 쓰지 않는다**(T3 · 부호 불일치 38~75%) | `[실제 데이터]` |
| 세그먼트 검색량 | 창 합 × 현재 비중 — 과거 창에도 현재 비중을 씌운다(그래서 세그먼트 전년비 = 전체 전년비) | `[추정]` |
| 세그먼트 절대 증가 `segment_abs_change` | (최근 창 − 전년 창) × 비중 — **급등 순위 기준** | `[추정]` |
| 과대 지수 `over_index` | 비중 ÷ 후보 풀 기준 비중(대표 검색어 · 최근 창 볼륨 가중 평균) — 시장 평균이 아니라 **이번 풀** 평균 | `[추정]` |
| 신규 `is_newcomer` | 처음 0보다 큰 달이 최근 창 끝에서 12개월 안 · 그 전 달은 결측 또는 0 · 최근 창은 결측 없음 | `[실제 데이터]` 판정 · 세그먼트 규모는 `[추정]` |

- **마지막 달은 기본으로 뺀다**(T2): 창 끝 = 기준월 − 1. 다른 모드(마지막 달 포함)의 전년비를 `yoy_other_mode`에 남기고,
  두 모드에서 급등 기준(전년비 30%)을 넘나들면 `provisional` = «잠정»을 단다. `--include-last-month`로 뒤집으면 리포트에 «마지막 달 포함(잠정)»이 적힌다.
- **결측 월**(T6): 비교 창에 `nv_code` 결측(= `total` 키 없음)이 하나라도 있으면 «계산 불가(비교 창 결측 월)» — 0으로 합산하지 않는다.
  예외는 신규 판정뿐이다: 첫 활성 달 **이전**의 결측은 «아직 검색되지 않던 때»로 읽고, 그 검색어는 전년비 없이 신규 탭으로 간다.
  첫 활성 달이 최근 창 **안**이면 창에 결측이 남아 계산 불가 — 다음 기준월에 다시 본다.
- **표기변형 · 같은 검색**(T5): 완전히 같은 행은 먼저 합치고(`collapse_identical`), 시계열이 같은 행은 `dup_of`로 «같은 검색의 중복»,
  같은 canonical 의 나머지 행은 `variant_of`(최근 창 볼륨이 큰 대표 한 행만 순위)로 뺀다. 행은 보존한다.
- **demography 모양** `[가정]`: 키트 계약에는 필드 모양이 적혀 있지 않다. 스크립트는 평평한 `f_gender_ratio` · `m_gender_ratio` ·
  `a0/a13/a20/a25/a30/a40/a50_ratio`(퍼센트)를 읽고, 합이 1 근처면 0~1 비율로, `gender`/`age` 중첩형이면 펼친다.
  어느 것도 아니면 `demography_status` = «형식 확인 필요»로 순위에서 빼고 알린다 — 값을 지어내지 않는다.
  kr 인데 demography 가 없으면 «미반환 [데이터 공백]», jp·us 는 «사양상 없음(gl=…)»이다.
- gl ≠ kr 이면 세그먼트를 적용하지 않는다: 비중 1.0(«전체(세그먼트 없음)»)으로 급등 · 신규만 내고, 과대 지수는 비우며,
  `segment_summary.notes`에 «요청 세그먼트 대신 전체 검색량 순위만 낸다»가 들어가 리포트 경계 문장까지 옮겨진다.

### STEP 7 · 게이트와 순위 (T4)

세그먼트 지표는 작은 기저에서 폭발한다 — 기저 20건이 50,000건이 되면 `+249,900%`, 월 몇 건짜리 검색어의 여성 비율 100%는 과대 지수 3.8배가 된다.
그래서 **세 순위 모두 게이트를 넘은 행만** 매긴다 `[가정]`:

| 탭 | 순위에 드는 조건 | 순위 기준 |
|---|---|---|
| 급등 | 전체 전년 창 ≥ `--gate` 3,000 · **세그먼트** 전년 창 ≥ `--seg-gate` 1,000 · 전년비 ≥ `--min-growth` 30% | 세그먼트 절대 증가 |
| 신규 | 신규 판정 · 세그먼트 최근 창 ≥ 1,000 | 세그먼트 최근 창 |
| 과대 지수 | 지수 ≥ `--min-index` 1.2 · 전체 최근 창 ≥ 3,000 · 세그먼트 최근 창 ≥ 1,000 · 기준 풀 ≥ `--min-pool` 5개 | 지수(같으면 최근 창) |

- 게이트에 걸린 행은 지우지 않는다 — `gate_status`(«게이트 미달(전년 창 60 < 3,000)» · «세그먼트 기저 미달» 등)와 함께 CSV에 남고,
  전년비가 급등 기준을 넘는 것은 `exploded_out`(전체 기저 미달) · `seg_small_out`(세그먼트 기저 미달), 과대 지수가 큰데 작은 것은
  `small_overindex_out`으로 summary 에 모여 리포트 «반대 근거»와 «순위에서 뺀 급등» 표로 간다.
- 급등 1위가 절대 증가 기준과 전년비 기준에서 다르면 둘 다 적는다(`top_surge_by_yoy` · 렌더링 계약 §3-8).
- 기준 풀이 5개 미만이면 과대 지수를 내지 않는다(기준 비중이 한두 검색어로 정해진다).
- **범위 미확인 행**(STEP 3)은 게이트 판정 · 전년비 · 과대 지수 값은 계산하되 세 순위와 기준 풀에서 뺀다. `tabs`에 «범위 미확인 — 순위 보류(기준 충족: …)»가
  찍히고 summary `scope_held`(`would_tabs` = 넘었을 탭)로 모여 리포트 «범위 미확인으로 순위에서 보류한 후보» 표와 반대 근거로 간다.
  후보 CSV 에 없는 응답 행이 보류 후보의 표기를 품으면(예: «{인명} 나이») 보류를 물려받는다.

### STEP 8 · 대상(엔티티) 묶음과 교차확인

대상은 **결정적 규칙**으로 묶는다(LLM 묶음 없음): canonical 로 표기를 맞춘 뒤 `assets/entity_rules.json`의 불용어 토큰(추천 · 순위 · 후기 · 가격 …)을
지우고, 붙여 쓴 꼬리말(«선크림추천»)을 뗀다. «선크림» · «선크림 추천»은 대상 «선크림»이다. 대상 이름을 에이전트가 다듬으면 `[추정]`으로 적는다.

- 대상 규모는 대표 검색어만 더하고 **하한 ~ 상한**을 병기한다 `[추정]`(T5 ②): 하한 = 표기변형 그룹 최댓값의 합 · 상한 = 같은 검색을 뺀 그룹 합.
- 대상 증가는 **전년 창을 계산할 수 있는 검색어만**으로 낸다(T6 모집단 고정) — 뺀 수를 `note`에 적는다.
- **세그먼트 최근 · 전년 하한이 1,000 미만인 대상은 `headline_ok` = «아니오»** — «가장 크게 늘어난 대상» 같은 순위 문장의 주어로 쓰지 않고
  표에만 둔다(계약 T4 «묶음·그룹 순위도 같다»). 신규 검색어만 든 대상은 증가 순위 없이 최근 규모만 본다.
- `python3 scripts/trend_yoy.py raw/kw_all.json -o trend_check.csv --ref-month <window_end>`로 상위 몇 건의 전년비를 다시 계산해
  `yoy`와 맞는지 본다(`--ref-month`를 summary 의 `window.end`로 줘야 창이 같다).
- 이슈 근거(`candidate_sources.csv`의 `issue_*`)는 원인 **가설**이다 — 인과로 단정하지 않는다. `issue_timing`이
  «창 이후 이슈(첫 인덱스 > 창 끝) — 원인 근거 아님»이면 그 창의 증감 원인으로 쓰지 않는다(시점 역전 · summary `issue_after_window`).

### STEP 9 · 리포트

```bash
python3 scripts/build_report.py --summary out/segment_summary_KR_선크림·쿠션.json --ledger ledger.json \
    --queried-at 2026-10-15 -o report.json
python3 scripts/render_report.py report.json -o report.html     # 계약 위반이면 렌더하지 않는다
```

`build_report.py`는 사실 목록(`facts`)을 summary · CSV 값에서만 만들고 문구 숫자를 `{{ID}}`로 쓴다. `provenance.calls`는 `ledger.json`에서 옮긴다.
원장에 `keyword_info all` 호출(데이터 마지막 달 있음)이 없으면 멈춘다.

## 산출물

아래 목록은 스크립트의 실제 출력이다(`selftest_segments.py`가 대조한다). 스크립트를 고치면 함께 고친다.
`{category}`는 `--category`의 공백 · `/`를 `_`로 바꾼 값이다.

```
candidates.json        (segment_candidates.py collect) — keyword_info 에 보낼 후보 문자열 배열(시드 맨 앞 · 범위 밖 제외)
all_candidates.json    (segment_candidates.py screen)  — all 요청 목록이자 --requested 입력
ledger.json            (segment_candidates.py)         — calls[id, step, at, tool, params, purpose, returned, cost, raw,
                         data_through, status, truncated, …] · notes · need_widen · exclude ·
                         scope{rule, terms, neighbourhood_tokens, confirmed, held, include, promoted} · screen{gate, window, summary, sent, capped, rows}

candidate_sources.csv
  keyword, canonical, entity, sources, seeds, issue_score_max, issue_index_date_first,
  issue_index_date_last, issue_summary_ai, issue_sources, scope, excluded

segment_keywords_{category}.csv
  keyword, canonical, dup_of, variant_of, entity, sources, scope, issue_timing, demography_status,
  gender_share, age_share, segment_share, share_basis,
  volume_window, volume_prev_year_window, missing_in_window, yoy, yoy_other_mode, provisional,
  segment_volume_window, segment_volume_prev_year, segment_abs_change, over_index,
  first_active_month, is_newcomer, gate_status, tabs,
  rank_surge, rank_newcomer, rank_overindex, data_ref_month, window_end

segment_entities_{category}.csv
  entity, n_keywords, keywords, segment_volume_lo, segment_volume_hi, segment_prev_year_lo,
  segment_abs_change_lo, yoy_lo, over_index_wavg, has_newcomer, headline_ok, rank_entity, note

segment_summary_{category}.json
  category, gl, segment, data_ref_month, window, include_last_month, gates, baseline_share, pool_size,
  counts, tabs, top_surge_by_yoy, entities_ranked, entities_small, exploded_out, seg_small_out,
  small_overindex_out, small_newcomer_out, no_demography, scope_held, scope_promoted, include,
  issue_after_window, not_returned, notes, files

report.json · report.html · report.calls.csv · report.cost.json   (build_report.py → render_report.py)
```

컬럼 뜻 — `share_basis` 비중 근거(«성별 × 연령 곱(독립 가정) [추정]» · «성별 비율 [실제 데이터]» · «전체(세그먼트 없음)») ·
`volume_window` · `volume_prev_year_window` 최근 3개월 창 · 전년 같은 창의 **전체** 검색량 합 · `missing_in_window` 두 창의 결측 월 수 ·
`yoy_other_mode` 다른 마지막 달 처리 모드의 전년비 · `gate_status` «판정» · «게이트 미달(…)» · «세그먼트 기저 미달(…)» · «계산 불가(…)» ·
«신규(…)» · «같은 검색의 중복» · «표기변형 — 대표 X» · «세그먼트 계산 불가 — demography …» · `tabs` 든 탭(급등 · 신규 · 과대 지수) ·
`window_end` 계산 창 끝 달(기본 기준월 − 1) · `scope` 범위 점검 결과(«확인 — …» · «범위 미확인 — …» · «승격(--include …)») ·
`issue_timing` 이슈 첫 인덱스와 계산 창의 선후(«창 이후 이슈 — 원인 근거 아님» · «창 안/이전 이슈 — 원인 가설로만 [추정]»).
후보 CSV — `issue_index_date_first` 합쳐진 이슈 중 가장 이른 인덱스 날짜 · `scope` 위와 같다. 대상 CSV — `segment_volume_lo/hi` 세그먼트 최근 창 하한/상한 ·
`segment_prev_year_lo` · `segment_abs_change_lo` · `yoy_lo` 전년 비교 가능한 검색어만의 하한 기준 · `over_index_wavg` 최근 창 볼륨 가중 과대 지수 ·
`headline_ok` 순위 문장의 주어로 써도 되는가(T4) · `rank_entity` 하한 절대 증가 순위.

## 4-Label

| 라벨 | 이 스킬에서의 적용 |
|---|---|
| `[실제 데이터]` | `monthly_volume` 원값과 한 검색어 안의 직접 계산(창 합 · 전년비 · 첫 활성 월 · 신규 판정) · 한 축만 고른 세그먼트의 `demography` 비율 원값 · issue_list 가 돌려준 이슈 키워드 · 점수 · 인덱스 날짜 · 출처 URL · 빈 결과(«그 기간 매칭 없음») · 원장의 반환 수와 `cost_detail` |
| `[추정]` | 세그먼트 검색량 · 세그먼트 절대 증가(현재 비중을 과거 창에 씌운 파생) · 성별 × 연령 곱(독립 가정) · 과대 지수(이번 후보 풀 기준) · 대상 묶음과 이름(불용어 규칙 · 에이전트 명명) · 대상 하한~상한 · 같은 검색의 중복 판정 · canonical 병합 · 이슈 요약(`issue_summary_ai`) · 이슈를 원인 가설로 쓰는 서술 |
| `[가정]` | 범위 점검 규칙(시드·카테고리어 포함 또는 연관어 토큰 공유 — trend_finder 단독 후보) · 스크린(`volume_avg × 3 ≥ 3,000`) · 전체 게이트 3,000 · 세그먼트 게이트 1,000 · 급등 최소 전년비 30% · 과대 지수 최소 1.2 · 기준 풀 최소 5개 · 신규 창 12개월 · 마지막 달 제외 · 넓힘 기간(14 → 90일) · issue_list limit 30 · demography 필드 모양(평평한 `*_ratio` 키 · 퍼센트) · 세그먼트 비중이 과거에도 같았다는 전제 |
| `[데이터 공백]` | kr 인데 demography 미반환 · 요청했지만 응답에 없는 검색어 · 스크린 미반환 · 비교 창 결측 월로 계산 불가한 칸 · 게이트 미달로 순위를 매기지 않은 행. jp·us 의 demography 없음은 공백이 아니라 **데이터 사양**으로 적는다 |

## 한계

- **성·연령 비율은 한국(gl=kr)만**, 그리고 **현재 시점 하나의 주변 분포**다. 월별 세그먼트 추이 · 성별 × 연령 교차 칸은 관측되지 않는다 —
  세그먼트 전년비는 전체 전년비와 같고, 비중이 실제로 바뀐 세그먼트 이동(예: 30대 → 20대로 확산)은 이 데이터로 잡지 못한다.
- `demography`는 모델링된 비율이다(검색 로그 · 패널 추정의 산물로 보이며 산출 방식은 응답에 없다 `[가정]`). 표본이 작은 검색어일수록 흔들린다 — 그래서 볼륨 게이트를 건다.
- demography 필드 모양이 키트 계약에 문서화돼 있지 않다 — 파서는 방어적으로 읽고 모르는 모양은 순위에서 뺀다. 실제 응답으로 한 번 확인해야 한다.
- 과대 지수의 기준은 **이번 후보 풀**이다. 후보가 시드 주변으로 편향되면 기준도 편향된다 — 시장 전체 대비로 말하지 않는다.
- **월 그레인 · 기준월은 응답에서 읽는다**(관측 지연 1개월) · 마지막 달 제외로 한 달 더 늦게 본다. 주간 조기경보로 쓰지 않는다.
- 검색은 구매가 아니라 **관심 신호**다. 검색량 단위는 건이며 사람 수가 아니다. 세그먼트 판단은 내부 판매 · 회원 데이터로 검증한다.
- 이슈는 검색량이 아니다 · 구글 기반 인덱스라 네이버 비중이 큰 한국에서 «국내 이슈 전체»로 단정하지 않는다 · issue_list · intent_finder 절단이면 후보가 전부가 아니다.
- 대상 묶음은 불용어 규칙이라 브랜드 · 제품 단위 묶음과 다를 수 있다 — 규칙을 고치면(`--entity-rules`) 리포트 부록에 남긴다.
- 범위 점검은 문자열 규칙이라 **보수적**이다 — 시드 글자를 품지 않은 범위 안 이슈(예: 브랜드명 단독 · «세면백»)도 «범위 미확인»으로 보류된다.
  보류 표를 사람이 보고 `--include`/`--scope-terms`로 올린다. 반대로 시드 글자를 품은 범위 밖 이슈(예: «{인명} 가방 라방»)는 통과하니 `--exclude`로 뺀다.

## 리포트

이 스킬의 HTML 리포트는 `references/report-contract.md`(렌더링 계약 정본 사본)를 따르고,
`scripts/render_report.py`(공통 렌더러)로만 만든다. 스킬은 **무엇을 넣을지**를 `report.json`으로 정하고,
뼈대 순서 · 차트 메타 · 카드 필드 · 숫자 추적 · 호출 기록은 렌더러가 검사한다.
`assets/report.example.json`은 이 스킬의 견본이다 — 합성 픽스처를 STEP 3~9로 돌린 `build_report.py` 출력이다.
견본 부제 앞의 «합성 픽스처 예시(assets/fixtures) — 실제 시장 값이 아니다»는 `build_report.py --subtitle-note`로 붙인 표시다(실제 실행에서는 주지 않는다).
렌더하면 `report.html` 옆에 호출 로그(`report.calls.csv`)와 비용 보고서(`report.cost.json`)가 함께 나온다.

첫 화면 경계 문장(`boundary`): «{전년 창} 대비 {최근 창} 검색량과 현재 시점 성·연령 비율을 관측했고, 세그먼트별 월 추이 · {기준월} 이후 · 구매는 관측하지 못했다»
— jp·us 는 «전체 검색량만 관측했다 — 성·연령 비율이 없어 세그먼트 순위는 내지 않았다».

| 섹션(`kind`) | 이 스킬이 넣는 것 | 쓰는 지표 · 차트 |
|---|---|---|
| `summary` 분석 요약 | 발견 카드 D1(범위 확인된 세그먼트 절대 증가 1위 · 전년비 1위가 다르면 함께 · 승격 후보면 그 사실) · 반대 근거(세그먼트 전년비 = 전체 전년비 · 순위에서 뺀 기저 폭발 · 작은 과대 지수 · 헤드라인에서 뺀 대상 · 범위 미확인 보류) | 세그먼트 전년/최근 창 · 절대 증가 · 전년비 · 과대 지수 |
| `trend` 트렌드 분석 | 급등 표(기준 · 비교 · 절대 증가 · 전년비) → 절대 증가 막대 → 순위에서 뺀 급등 표(기저 폭발) → 범위 미확인 보류 표 → 신규 표(검색 시작 월) | `bar`(세그먼트 절대 증가 · 건) · 표 |
| `structure` 관심 구조 | 과대 지수 표 · 막대(kr) · 대상별 세그먼트 규모 하한~상한과 증가(헤드라인 가능 여부) | `bar`(과대 지수 · 배) · 표 |
| `action` 기회와 실행 | 실행 카드 A1 — 가설(세그먼트 1위 대상 먼저) · 결과물(콘텐츠 기획안 · 구색 점검표) · 담당(콘텐츠 기획자 · MD) · 내부 데이터(판매량 · 회원 성·연령 구매 비중) · 확대/수정/중단 조건 | 급등 1위 사실 |
| `appendix` 근거 부록 | 기준값 [가정] · 계산 정의 · 수집 사실 표(원장 메모 · 세그먼트 메모) · 검색어 전체 판정 표 + 렌더러의 사실 목록 · 호출 순서 · 호출 로그 · 비용 보고서 | 표 |

`report.json`의 `facts`(사실 목록)는 **스크립트의 저장 계산 결과**에서 만든다 — 문구의 숫자는 `{{ID}}`로만 쓴다.
`provenance.calls`(호출 순서 · 조건 · 반환 수 · 비용 · 원본 파일)는 **수집 스크립트의 원장**에서 만든다 — 손으로 적지 않는다.

호출 원장을 남기는 단계: STEP 3(`collect` — trend_finder · intent_finder 응답과 `cost_detail`) · STEP 4(`screen` — ads_metrics) ·
STEP 5(`ledger` — keyword_info all)에서 `ledger.json`에 쓰고, STEP 9 `build_report.py`가 그대로 `provenance.calls`로 옮긴다.
