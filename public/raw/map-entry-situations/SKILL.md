---
name: map-entry-situations
description: |
  카테고리 키워드 하나를 받아 연관 검색어(`intent_finder`)와 그 키워드 **앞에** 오는 세션 인접 검색
  (`path_finder`, 예산 게이트 안에서)에서 카테고리 진입 상황(CEP — 계기 · 시점 · 장소 · 사람 · 문제 · 목표)을
  **규칙 사전**으로 뽑고, CEP별 검색량 · 전년 동기 추세 · 계절성(`keyword_info` 2단 조회)과 브랜드 연결
  (기준 · 경쟁 브랜드가 그 상황 검색에 함께 나오는 정도, 논브랜드 분리)로 우선순위를 매긴 CEP 지도를 낸다.
  입력: 키워드 · 시장(kr/jp/us) · 선택으로 뜻 고정용 분야 · 기준 브랜드 · 경쟁 브랜드.

  "선크림 카테고리 진입 상황(CEP) 지도 그려줘" · "캠핑 의자는 사람들이 어떤 상황에서 찾기 시작해?" ·
  "우리 브랜드가 잡아야 할 구매 계기가 뭐야" · "CEP 뽑아서 캠페인 상황 우선순위 정해줘" ·
  "어떤 순간에 이 카테고리를 떠올리는지 검색으로 보고 싶어" · "경쟁사가 선점한 상황이랑 비어 있는 상황 나눠줘"
  같은 요청이면 반드시 이 스킬을 쓴다.

  사용자가 "CEP"라는 말을 쓰지 않아도, **마케터 · 브랜드 담당자가 캠페인 상황 · 메시지 · 시즌 배치를 정하려고
  "언제 · 어디서 · 누구를 위해 · 무슨 문제로" 이 카테고리를 찾는지 묻는 요청**이면 켠다. 결과는 검색 행동의
  상황 지도이지 브랜드 연상률 조사가 아니다 — 검색은 구매 · 인식이 아니다.

  경계: 검색 의도 층(정보 · 비교 · 구매)을 나누는 것은 `decode-search-intent`, 기능 · 속성 · 불편 우선순위는
  `find-customer-needs`, 특정 검색 앞뒤 순서 자체가 질문이면 `trace-search-journey`로 보낸다. 군집 구조 ·
  검색결과 화면은 비용 때문에 이 스킬에서 쓰지 않는다.
license: MIT
metadata:
  version: "0.1.2"
---

<!-- lm-skill: kind=task; connectors=intent_finder,path_finder,keyword_info; flags=monthly,expand,share,report; traps=T1,T2,T3,T4,T5,T6,T7,T8 -->

# Map Entry Situations — 검색으로 그리는 카테고리 진입 상황(CEP) 지도

> **핵심 원칙**: 사람들은 카테고리를 진공에서 찾지 않는다. «아기 외출 전» · «골프 라운드 전» · «스키장 가기 전»처럼
> **상황이 검색을 시작하게 한다.** 이 스킬은 그 상황을 **재현 가능한 규칙 사전**으로 모으고, 크기 · 추세 · 계절 ·
> 브랜드 연결을 붙여 «어느 상황부터 잡을지»의 검토 후보를 낸다.
>
> 답하는 것: 상황(CEP)별 카테고리 결속 검색량(논브랜드 분리) · 전년 동기 추세 · 성수기 달 · 기준/경쟁 브랜드 연결 ·
> 시드 앞에 오는 상황 검색(진입 계기 신호).
> 답하지 않는 것: 브랜드 연상률 · 인지도 · 구매 전환 · 개인 여정 · 원인.

## 데이터 계약

이 스킬은 `references/lm-data-contract.md`(정본 사본)를 따른다. 계약은 확장할 수 있지만 뒤집을 수 없다.
이 스킬에 해당하는 **함정 처리 의무**와 처리 위치:

| 함정 | 처리 위치 | 상태 |
|---|---|---|
| T5 표기변형 canonical 정규화 | STEP 3 (풀 canonical · 시드 표기 검사) · STEP 6 (`dup_of` · 그룹 하한/상한 · `flip_under_hi`) | 처리 |
| T1 기준월·지연 3종 표기 | STEP 5.5 · STEP 6 머리 · 리포트 `scope` | 처리 |
| T2 마지막 달 완결성 점검 | STEP 5.5 점검 · STEP 6 창에서 기본 제외 | 처리 |
| T3 volume_trend 대신 전년 동기 비교 | STEP 6 (`monthly_volume` 직접 계산) | 처리 |
| T4 기저 볼륨 게이트 | STEP 5 (2단 대상) · STEP 6 (CEP 순위 게이트 · 추세 게이트) | 처리 |
| T6 결측 월 처리 | STEP 6 (시계열 모집단 고정 · 결측 검색어 수 표기) | 처리 |
| T7 절단(limit) 검사 — 절단이면 수렴 판정 보류 | STEP 1 · 2 원장 · STEP 3 호출 단위 판정 · STEP 4 수렴 판정 | 처리 |
| T8 논브랜드 분리 산출 | STEP 6 (논브랜드 순위 · 브랜드 연결 표) | 처리 |

> 이 표는 선언이다. 실제 처리는 아래 STEP 본문에 있다.

## 커넥터와 크레딧

| 커넥터 | 용도 | 크레딧 결정식 |
|---|---|---|
| `intent_finder` | 키워드 · 상황 탐침어의 연관 검색어 | 호출마다 `30 × 입력 키워드 + 2 × 반환` — 시드 1개씩 부르면 `30 + 2 × 반환`, 상한 `30 + 2 × limit` |
| `path_finder` | 키워드 앞에 오는 세션 인접 검색(진입 계기 신호) · 브랜드 경로 동반 | 호출마다 `50 + 40 × 경로 안 고유 키워드 수` — `limit`은 경로 수 상한이라 이 값을 묶지 못한다 |
| `keyword_info` | 1단 `ads_metrics` 전량 볼륨 → 2단 `all` 선별 시계열 | `ads_metrics` 1 × 키워드 · `all` 10 × 키워드 |

### 예산 결정식

```
총 크레딧 = Σ_i (30 + 2 × 반환_i)          … STEP 1 intent_finder, 시드 S개 (호출 1건 상한 30 + 2 × limit)
          + (50 + 40 × U_p)                 … STEP 2 path_finder 파일럿 1회 (작은 limit)
          + (50 + 40 × U_m)                 … STEP 2 본 호출 — path_gate.py 가 call 일 때만
          + 1 × N                           … STEP 4 후보 풀 전량 ads_metrics (경계 밖 제외)
          + 10 × (B + M_main + M_tail)      … STEP 5 2단 all — 기준선 + 게이트 통과 대표 + CEP별 긴 꼬리
계획값:  U_m ≈ ceil(limit × r),  r = U_p ÷ 파일럿 사용 경로 수
```

- **2단 조회가 기본이다.** 전량에는 `ads_metrics`(1)만 걸고, 추세 · 계절성 판정에 쓸 대표 검색어만 `all`(10)로 산다.
  `10 × M` 항과 `path_finder` 두 항이 총액을 지배한다 — M은 `select_stage2.py` 규칙이, path 항은 `path_gate.py`가 정한다.
  `M_tail` 상한은 `10 × CEP 수 × --tail-per-cep(5)`다.
- `ads_info`도 쓸 수 있다(계약 §1 v1.3) — 시계열만 필요한 조회는 `ads_info`로 받아도 된다. 단가가 환경마다 달라(명세 1 · 관측 10 · 1) 첫 호출 `cost_detail`로 확인하고, 아래 결정식의 `all` 단가 10 자리에 확인한 값을 쓴다(확인 전 상한 10). `intents`·`features`·`demography`를 읽는 조회는 `all`을 쓴다.
- `path_finder`의 `r`은 시드마다 다르고 계획은 과대 · 과소가 모두 관측됐다(trace-search-journey 실측). 멈추는 기준은
  원장의 실측 누적이다. `time_point`는 `curr` 하나만 쓴다 — 시점을 늘리면 본 호출 비용이 시점 수만큼 곱해진다.
- `cluster_finder`(`150 + 고유 키워드 × 50`)와 `serp`(`30 × 키워드`)는 쓰지 않는다 — CEP 분류에 군집 · 검색결과 화면이 필요하지
  않고, 원본 앱이 비용 대부분을 여기서 썼다.

**계산 예 (합성 — `selftest_cep.py` 픽스처와 같은 값)**

| 단계 | 계산 | 크레딧 |
|---|---|---:|
| intent_finder 3호출(반환 12 · 4 · 4) | (30 + 2 × 12) + (30 + 2 × 4) × 2 | 130 |
| path_finder 파일럿 limit 3 → 경로 3 · 고유 7 | 50 + 40 × 7 | 330 |
| 본 호출 계획 limit 10, r = 2.33 | 50 + 40 × ceil(10 × 2.33) = 50 + 40 × 24 | 1,010 계획 · 690 실측 |
| 후보 21개 ads_metrics | 1 × 21 | 21 |
| 2단 13개 all | 10 × 13 | 130 |
| 합계(실측) | 130 + 330 + 690 + 21 + 130 | 1,301 |

실제 카테고리는 intent_finder limit 100~300 · 후보 수백 개라 규모가 크다. 시작 전에 사용자에게 **총 예산**을 받는다.

## 번들 자산

| 파일 | 하는 일 | 쓰는 곳 |
|---|---|---|
| `scripts/ledger.py` | 수집 원장 — 응답 저장 직후 `cost_detail.total_cost` · 반환 수 · 절단 · 데이터 마지막 달을 `ledger.jsonl`에 한 줄씩 · 1,000개 분할 응답 병합(`merge`) · 소진 합계(`total`) (이 스킬 고유) | STEP 1 · 2 · 4 · 5 |
| `scripts/path_gate.py` | path_finder 예산 게이트 — 파일럿 r · 원장 실측 소진 · 뒤 단계 예약으로 본 호출 call/hold · 예산 안 최대 limit (이 스킬 고유) | STEP 2 |
| `scripts/situation_pool.py` | 연관어 + 시드 앞 검색 → 후보 풀 · canonical · 뜻 고정 제외 · 호출 단위 절단 · 시드 표기 변경 검사 (이 스킬 고유) | STEP 3 |
| `scripts/select_stage2.py` | 2단 대상 B + M_main + M_tail 규칙 선정 · 크레딧 `10 × M` (이 스킬 고유) | STEP 5 |
| `scripts/cep_map.py` | CEP 지도 — 분류 · 그룹 하한/상한 · 논브랜드 순위 · 추세 · 계절성 · 브랜드 연결 · 머리 정보 (이 스킬 고유) | STEP 6 |
| `scripts/build_report.py` | `cep_map.json` + `ledger.jsonl` → `report.json` (사실 목록 · `{{ID}}` 문구 · 호출 기록) (이 스킬 고유) | STEP 8 |
| `scripts/cep_lib.py` | 뜻 고정 파일 · 상황 사전 · 분류 · 유니버스 조립 공통 함수 (이 스킬 고유) | 위 스크립트 |
| `scripts/selftest_cep.py` | 합성 픽스처로 STEP 0~8 명령 · 함정 T1~T8 · 문서 컬럼 = 실제 출력 검증 (이 스킬 고유) | 스킬 수정 후 |
| `scripts/coverage_curve.py` · `check_refmonth.py` · `trend_yoy.py` · `series_dedup.py` · `build_universe.py` · `render_report.py` · `selftest.py` · `selftest_render.py` | 공유 정본 사본 — 고치지 않는다 | STEP 4 · 5.5 · 7 · 8 · 전 구간 |
| `assets/themes.json` | 한국어 상황 사전 기본판(6축 · 비상황 · 미분류 · 브랜드) — **카테고리마다 복사해 보강** | STEP 0 · 3 · 6 |
| `assets/sense.template.json` · `sense.sunscreen-kr.example.json` | 뜻 고정 파일 견본 · 선크림 KR 예시 | STEP 0 |
| `assets/report.example.json` | 이 스킬의 리포트 견본(합성 픽스처로 생성) | STEP 8 · selftest |
| `assets/fixtures/` | 합성 응답 — selftest 전용, 실제 시장 값이 아니다 | selftest |
| `references/lm-data-contract.md` · `report-contract.md` · `themes-schema.md` | 계약 · 렌더링 계약 · 사전 스키마 사본 | 전 구간 |

`build_universe.py`는 공유 selftest가 쓰는 사본이라 남겨 두었다 — 이 스킬의 유니버스 조립은 `cep_lib.build_universe`가 한다.
**이 문서나 스크립트를 고쳤다면 `python3 scripts/selftest.py`를 돌린다** — 끝에 `selftest_cep.py`가 함께 돈다.

## 사전 확인

```
1. 시장(gl)이 kr / jp / us 중 하나로 확정되었는가? 없으면 묻는다 — 시장을 섞어 집계하지 않는다
2. 키워드가 하나인가? 여러 카테고리를 한 지도에 섞지 않는다(키워드마다 따로 돌린다)
3. 키워드의 뜻이 여럿일 수 있는가?(마스크 · 패딩 · 크림) → STEP 0 뜻 고정 파일에 분야 · 제외어를 반드시 쓴다
4. 총 예산이 정해졌는가? 없으면 받는다 — path_finder 1회가 수천 크레딧일 수 있다
5. 카테고리가 24개월 이상 검색되어 왔는가? 계절성은 24개월, 전년 12개월 비교는 25개월이 필요하다.
   신생 카테고리는 추세 · 계절 열이 [데이터 공백]으로 남는다고 먼저 알린다
6. jp · us 는 상황 사전을 그 언어로 새로 쓴다 — assets/themes.json 은 한국어판이다
7. 요청에 «연상률 · 인지도 · 전환»이 있으면 착수 전에 «검색 상황 지도까지만 답한다»고 범위를 고지한다
```

## 실행 순서

호출 결과는 모두 `raw/`에 **호출 1건 = 파일 1개**로 저장하고(요청 헤더 · 키는 저장하지 않는다), 저장 직후
`ledger.py add`로 **호출 원장**에 적는다. 리포트의 호출 순서 · 호출 로그 · 비용 보고서는 이 원장에서만 만든다.

### STEP 0 · 뜻 고정 + 상황 사전 준비 (0크레딧 · LLM 호출 없음)

1. `assets/sense.template.json`을 `sense.json`으로 복사해 **에이전트가 초안**을 쓴다:
   `keyword` · `gl` · `domain`(분야) · `anchor_terms`(카테고리어 — 키워드 자신 + 동의어 · 하위 형태) · `seeds`(상황 탐침어 2~4개) ·
   `exclude`(다른 뜻 · 인접 카테고리 canonical 정규식) · `focal_brand` · `competitors`(5개 이내).
2. 초안을 표로 **사용자에게 보여 주고 확인**받는다. «맞아»를 받은 뒤에만 `confirmed_by_user: true`로 바꾼다.
   스크립트는 `true`가 아니면 멈춘다 — 뜻 고정을 LLM 판정으로 대신하지 않는다. 같은 입력에 다른 뜻이 고정되면 지도가 재현되지 않는다.
   - 뜻이 여럿인 키워드 예: `마스크`(분야 «뷰티 · 시트 마스크») → `exclude`: `kf94|kf80|덴탈|비말|방역`
3. `assets/themes.json`을 작업 폴더로 복사해 카테고리에 맞게 보강한다(`references/themes-schema.md`):
   - 테마 이름은 `축:상황` — 축은 **계기 · 시점 · 장소 · 사람 · 문제 · 목표** 6종. `비상황:`(구매 탐색 · 제품 속성)은 CEP가 아니다
   - **주 CEP는 배열 순서**다. 구체 상황(사람 · 장소 · 계기 · 문제 · 목표)을 위에, 넓은 시점을 아래, 비상황을 맨 아래에 둔다
   - 패턴은 canonical(공백 없음 · 소문자 · 변형치환 적용)에 맞춘다 — `아기 외출`이 아니라 `아기외출`
   - **어절 경계 일치(v0.1.1)** — 이 스킬은 `themes-schema.md`를 넓혀 패턴을 **어절 시작에서만** 인정한다. 먼저 카테고리어(키워드 ·
     `anchor_terms`)와 브랜드명을 한 글자 자리표시로 가리고(`직수정수기` → `직수□`), 가린 자리의 앞뒤도 경계로 본다. 끝은 열려 있어
     조사 · 어미 · 합성어(`이사할때` · `아기분유`)는 그대로 걸린다. 낱말 가운데서 시작하는 일치(`미세플라스틱`의 `스틱`,
     `정수 영어로`의 `수영`)는 버린다. 패턴에 카테고리어 · 브랜드명을 적어도 같은 자리표시로 바뀐다
   - 다른 낱말의 앞머리가 되는 짧은 말은 끝을 조인다 — 배포 사전의 `아이(?:들|용|…)?(?![가-힣a-z])`(아이콘 · 아이스 제외) ·
     `스키(?!니…)` · `젤(?!리)`. 새 짧은 패턴은 `selftest_cep.py`의 `COLLISION_WORDS`에 반례를 넣어 검사한다
   - 배포 사전은 예시 카테고리(선크림 · 캠핑 의자)의 테마를 담고 있다. 카테고리와 무관한 테마(화장품 문제 · 캠핑 장소 등)는
     복사본에서 지우거나 바꾼다 — 남겨 두면 그 말이 우연히 든 검색어가 엉뚱한 CEP가 된다
   - `brands`에 기준 · 경쟁 브랜드는 자동으로 더해진다. 그 밖의 브랜드는 STEP 4 뒤 상위 볼륨 검색어에서 보강한다 —
     빠진 브랜드는 논브랜드로 집계돼 «미점유»를 부풀린다(T8)

### STEP 1 · 연관 검색어 (`intent_finder`)

```python
intent_finder(keywords=["선크림"], gl="kr", limit=100, volume_threshold=50, sort="volume_total", order="desc")
# 30 + 2 × 반환 → raw/if_선크림.json ;  sense.seeds 의 탐침어마다 1개씩 같은 방식
```

```bash
python3 scripts/ledger.py add --ledger ledger.jsonl --tool intent_finder --step 확장 \
    --raw raw/if_선크림.json --limit 100 --purpose "카테고리 연관 검색어"
```

- 시드는 1개씩 부른다 — 반환이 어느 시드에서 왔는지와 **호출 단위 절단**을 남기기 위해서다.
- `--limit`을 주면 원장에 `truncated`가 적힌다. 반환 수 = limit이면 **절단**이다 — API가 더 줄 수 있었는데 받지 않았다(T7).
- 상황 탐침어(`여름 선크림` · `아기 선크림`)는 긴 꼬리 상황을 끌어오려는 것이다. 탐침하지 않은 상황이 지도에 없으면
  «그 상황이 없다»가 아니라 «탐침하지 않았다»일 수 있다 — 리포트 `selection`에 탐침어를 적는다.

### STEP 2 · 시드 앞 검색 (`path_finder`) — 파일럿 → 예산 게이트 → 본 호출

```python
path_finder(keyword="선크림", gl="kr", time_point="curr", limit=20)   # 파일럿 → raw/path_pilot.json
```

```bash
python3 scripts/ledger.py add --ledger ledger.jsonl --tool path_finder --step 경로 \
    --raw raw/path_pilot.json --limit 20 --purpose "파일럿 — r 실측"
python3 scripts/path_gate.py --budget 6000 --ledger ledger.jsonl --reserve 1500 \
    --limit 60 --pilot raw/path_pilot.json
```

- `--reserve`는 뒤 단계 예약이다: `1 × N`(후보 수 추정) + `10 × M`(2단 추정). 남은 예산 = 예산 − 원장 실측 소진 − 예약.
- 판정이 `call`이면 같은 키워드 · 같은 `time_point`로 본 호출을 하고(`raw/path_main.json`) 원장에 적는다. `hold`면 출력의
  «남은 예산 안 최대 limit»을 사용자에게 제안하거나, 본 호출 없이 파일럿 경로만 쓴다(반환분 기준이라고 적는다).
- 본 호출 뒤에도 원장 `total`로 실측 누적을 본다. **실측이 예산을 넘으면 STEP 5의 M을 줄인다** — 계획은 추정이다.
- 빈 응답(`data: []`)은 `[데이터 공백]`이다 — 실패로 재시도하지 않는다. 지도는 연관 검색어만으로 계속 만든다.

### STEP 3 · 상황 후보 풀 (0크레딧)

```bash
python3 scripts/situation_pool.py --sense sense.json --themes themes.json \
    --intent raw/if_선크림.json@100 --intent raw/if_여름선크림.json@100 --intent raw/if_아기선크림.json@100 \
    --paths raw/path_main.json@60 -o pool.csv --keywords-out pool_keywords.json --calls-out pool_calls.csv
```

- **시드 앞 검색** — 경로 안에서 시드(canonical 일치)의 첫 위치 앞 `--pre-steps`(기본 3 · [가정])걸음만 후보로 뽑는다.
  방향은 요청 파라미터가 아니라 경로 안 위치다. 시드 뒤 검색은 이 스킬의 질문(진입 상황)이 아니다.
- **시드 표기 변경** — `path_finder`가 시드를 다른 표기로 돌려줄 수 있다(실측: `선크림` 요청 → 경로 전부 `썬크림`).
  시드가 0경로에서 발견되면 **종료 코드 3으로 멈춘다**. `themes.json` `rules.변형치환`에 규칙(`{"썬": "선"}`)을 넣고 다시 돌린다(0크레딧).
- **canonical** — NFKC → 소문자 → 변형치환 → 공백 제거. 대조 · 분류는 모두 canonical로 한다(표기변형이 따로 놀지 않게, T5).
- **뜻 고정 제외** — `sense.exclude`에 걸린 검색어는 `boundary=경계 밖(패턴)`으로 행만 남기고 `pool_keywords.json`(요청 목록)에서 뺀다.
  다른 뜻의 검색어에 크레딧을 쓰지 않는다.
- **절단** — `pool_calls.csv`에 호출마다 `limit` · `returned` · `truncated`를 적는다. 절단 호출이 하나라도 있으면 출력이 «보류»를 알린다.

### STEP 4 · 전량 볼륨 (`keyword_info` · `ads_metrics`) + 수집 범위 판정

```python
keyword_info(keywords=pool_keywords, gl="kr", data_type="ads_metrics")   # 1 × N → raw/metrics_ads.json
```

```bash
python3 scripts/ledger.py add --ledger ledger.jsonl --tool keyword_info --step 볼륨 --raw raw/metrics_ads.json
python3 scripts/coverage_curve.py --metrics raw/metrics_ads.json --rules themes.json --themes themes.json \
    --round "S1=pool_keywords.json" --round "R1=raw/if_선크림.json@100,raw/if_여름선크림.json@100,raw/if_아기선크림.json@100"
```

- 1회 1,000개가 상한이다. 넘으면 나눠 부르고 `python3 scripts/ledger.py merge -o raw/metrics_ads.json raw/ads_1.json raw/ads_2.json`으로
  계약 «응답 병합» 규칙대로 합친다(원장에는 부분 응답마다 `add`).
- 과금은 **요청한 키워드 수**다. 응답 표기가 요청과 다르면(`캠핑의자` → `캠핑 의자`) canonical로 대조하고, 요청했는데 응답에 없는
  검색어는 0이 아니라 «미반환» 행으로 남긴다 `[데이터 공백]`. 요청하지 않은 변형 행은 «응답 변형»으로 남긴다(과금 안 됨).
- `coverage_curve.py` 판정 문구(예: `보류(R1 절단)`)를 STEP 6 `--coverage`로 넘긴다. **절단 호출이 있으면 수렴 판정을 보류**한다 —
  절단은 수렴처럼 보인다. 보류면 limit을 올려 다시 부를지 사용자가 정한다(크레딧 재소모). 보류 상태 그대로면 리포트에 적는다.
- 브랜드 사전 보강: 응답 상위 볼륨 검색어에서 빠진 브랜드를 `themes.json` `brands`에 넣는다(STEP 6 재실행은 0크레딧).

### STEP 5 · 2단 대상 선정 + 시계열 (`keyword_info` · `all`)

```bash
python3 scripts/select_stage2.py --pool pool.csv --metrics raw/metrics_ads.json --sense sense.json \
    --themes themes.json -o stage2_keywords.json
```

```
B      = 기준선(키워드 자신의 그룹 대표) — 게이트와 무관하게 항상
M_main = 상황 CEP 그룹 대표 ∧ 카테고리 결속(anchor_hit=Y) ∧ volume_total ≥ 12,000   [가정 — 월 1,000의 연 환산]
M_tail = 상황 CEP 그룹 대표 ∧ anchor_hit=Y ∧ 1,200 ≤ volume_total < 12,000 중 CEP마다 상위 5개   [가정]
크레딧 = 10 × (B + M_main + M_tail)
```

```python
keyword_info(keywords=stage2_keywords, gl="kr", data_type="all")   # 10 × M → raw/metrics_all.json
```

- **기저 게이트(T4)** — 작은 그룹은 시계열을 사도 그룹 단위 성장률로 쓰지 않는다. CEP 단위로 **합산한 뒤** STEP 6 게이트를 건다.
  `M_tail`은 작은 CEP도 합산 추세를 볼 수 있게 사는 긴 꼬리다.
- 표기변형은 대표 하나만 산다. 같은 검색 중복(`dup_of`) · 경계 밖 · 미반환 · 미분류 · 비상황 · 카테고리어 없는 시드 앞 검색은 사지 않는다.
- 응답을 원장에 적는다: `python3 scripts/ledger.py add --ledger ledger.jsonl --tool keyword_info --step 시계열 --raw raw/metrics_all.json`

### STEP 5.5 · 데이터 기준월 확인 ⚠️ 생략 금지

```bash
python3 scripts/check_refmonth.py raw/metrics_all.json --queried-at 2026-09-28
```

- `monthly_volume`의 `month` 최댓값이 **데이터 기준월**이다 — 응답에서 읽는다(관측 지연 1개월, 고정값으로 쓰지 않는다).
  리포트 머리에 **데이터 기준월 / 조회일 / 지연** 세 값을 적는다(T1). 조회일을 시점으로 읽으면 계절 CEP의 «성수기 직후 하락»과
  «성수기 한복판»이 뒤바뀐다.
- 같은 명령이 **마지막 달 완결성**을 본다 — 최신 월이 실제로 떨어졌고 전년 같은 구간보다 30%p 이상 나쁘면 미완결 의심(T2).
  STEP 6은 추세와 순위에서 마지막 달을 **기본 제외**하므로 의심 건수는 «창에서 뺀 이유»로 적는다.

### STEP 6 · CEP 지도 (0크레딧)

```bash
python3 scripts/cep_map.py --pool pool.csv --metrics raw/metrics_ads.json --monthly raw/metrics_all.json \
    --sense sense.json --themes themes.json --paths raw/path_main.json@60 --calls pool_calls.csv \
    --stage2 stage2_keywords.json --queried-at 2026-09-28 --coverage "보류(R1 절단)" --out-dir out
```

| 처리 | 방법 | 함정 |
|---|---|---|
| 분류 | 상황 사전 정규식 — 카테고리어 · 브랜드명을 가린 뒤 **어절 시작에서만** 일치(STEP 0.3) · 배열 순서가 주 CEP · 여러 개 걸리면 `multi_cep=Y` · 키워드 자신 · 앵커어는 «카테고리 코어» · 테마 없이 브랜드만 → «브랜드·제품명» · 아무것도 안 걸리면 **«미분류» 버킷**(지우지 않고 비중을 보인다) · 같은 canonical의 표기는 그룹 대표의 분류를 따른다 | — |
| 정밀도 신호 | 주 일치가 어절 전체(또는 어절 + 조사)면 `match_scope=어절`, 더 긴 어절의 앞부분이면 `어절 일부`. CEP별 `partial_token_share` = «어절 일부» 그룹 하한 ÷ CEP 하한, 머리 `partial_token_share_lo` — 높으면 그 CEP 검색어를 직접 확인한다(오탐 위험) | — |
| 카테고리 결속 | 앵커어나 브랜드가 든 검색어만 CEP 검색량(`volume_12m_*`)에 넣는다. 시드 앞 검색 중 카테고리어가 없는 것(`바다 여행`)은 상황 자체의 크기라 `situation_only_volume_lo`에 **따로** 둔다 — 다른 모집단이라 합산하지 않는다 | — |
| 같은 검색 중복 | 응답 안 완전 중복 행은 먼저 합치고(`collapse_identical`), 지표 · 시계열이 같은 행은 `dup_of`에 대표를 적고 집계에서 뺀다 | T5 ⓪① |
| 표기변형 | canonical 그룹 볼륨 **하한(그룹 최댓값) · 상한(그룹 합)** 병기. 순위는 하한, 상한 순위와 다르면 `flip_under_hi` | T5 ② |
| 브랜드 분리 | 우선순위 = 게이트 통과 상황 CEP의 **논브랜드 하한** 순. 브랜드 검색량은 `brand_volume_lo`로 따로 | T8 |
| 순위 창 | 순위 · 순위 게이트 볼륨은 **추세와 같은 창**(기본: 기준월 한 달 전에서 끝나는 12개월)의 월 합 `window_*`이다. 2단 시계열이 없는 그룹만 `volume_total`(기준월 포함 12개월)로 대신하고 그 비중을 `window_series_share`(CEP) · `rank_window_series_share`(머리)로 적는다. `volume_12m_*` · `nonbrand_volume_*`(마지막 달 포함)는 옆 열로 남기고, 그 기준 순위 `priority_rank_incl_last`가 다르면 `rank_shift_incl_last`(예: `3→8`)와 머리 `rank_shifts_incl_last`에 적는다 | T2 |
| 브랜드 연결 | 기준 · 경쟁 브랜드마다 «그 CEP 검색어에 브랜드명이 든 그룹의 하한 합 ÷ CEP 하한»(`cep_brand.csv`) + 같은 경로에 브랜드 검색어가 있는 경로 수. 판정 `brand_link_call`: 브랜드 비중 5% 미만 → 미점유 · 기준 ≥ 최상위 경쟁 → 기준 브랜드 우위 · 반대 → 경쟁 브랜드 우위 [가정] | T8 |
| 추세 | CEP 시계열 모집단의 월 합으로 **전년 동기** 12개월 · 3개월 비교를 직접 계산. `volume_trend`는 읽지 않는다. 판정은 12개월(±20% [가정]) — 계절이 상쇄된다. 3개월과 부호가 다르면 `trend_conflict=Y` | T3 |
| 마지막 달 | 추세 · 순위 창이 기준월 **한 달 전**에서 끝난다. `--include-last-month`로 포함하면 머리에 «포함»으로 적힌다 | T2 |
| 결측 월 | 비교 창에 결측(`nv_code`)이 있는 대표 검색어는 0으로 채우지 않고 **CEP 시계열 모집단에서 빼고** `series_excluded_missing`에 수를 적는다. 모든 창에 값이 있는 검색어로 모집단을 고정한다 | T6 |
| 기저 게이트 | CEP 순위 창 하한 `window_volume_lo` < `--gate`(12,000 [가정])면 `gated_out=Y` — 순위 · 헤드라인 문장의 주어로 쓰지 않고 표에만 둔다. 전년 12개월 창 합 < `--trend-gate`면 추세 «게이트 미달», 전년 3개월 합 < `--gate-3m`(3,000)이면 3개월 증감률 빈칸 | T4 |
| 계절성 | 창 끝에서 36개월 · 달력 월 평균 ÷ 전체 월평균 = 계절 지수, 24개월 이상 · 달마다 2회 이상일 때만. 지수 ≥ 1.30 [가정]인 달 = `peak_months`, 최대 ÷ 최소 = `season_strength` | — |
| 머리 | 기준월 · 조회일 · 지연 · 창 · 마지막 달 처리 · 미완결 의심 건수 · 순위 창 · 마지막 달 포함 시 순위 변동 · 어절 일부 비중 · 수집 범위 판정 · 절단 호출 · 분류율 · 논브랜드 비중 · 뒤집힘 수 | T1 · T2 · T7 |

**왜 순위를 마지막 달 없이 매기나.** v0.1.0은 추세 창에서는 마지막 달을 뺐지만 순위는 `volume_total`(기준월 포함)로 매겼다.
실데이터 재생에서 기준월 한 달에 검색량이 몰린 검색어 하나가 그 CEP를 상위권으로 올렸다 —
같은 실행에서 `check_refmonth`가 미완결 의심으로 표시한 그 달이다. 순위는 추세와 같은 창으로 매기고,
마지막 달을 넣은 순위는 옆 열로 보여 «마지막 달 때문에 움직인 CEP»를 드러낸다.

**왜 합성 점수가 없나.** 원본 앱은 «시장성 · 적합성 · 입증가능성»을 가중합했지만 가중치를 정당화할 근거가 없다. 이 스킬은 순위를
논브랜드 검색량 하나로 매기고, 추세 · 계절 · 브랜드 연결은 옆 열로 붙여 사람이 판단하게 한다.

**역위상 계절.** 여름 CEP와 겨울 CEP는 성수기가 반대다. 3개월 창은 조회 시점에 따라 한쪽을 비수기 바닥에서 재므로, 판정은
12개월 전년 동기로만 하고 3개월 값은 «최근 변화» 참고로 둔다. 비수기 3개월 창이 게이트 미만이면 증감률을 내지 않는다.

### STEP 7 · 검토 (0크레딧)

1. **«어절 일부» 비중을 본다** — `partial_token_share`가 높은 CEP는 `cep_keywords.csv`의 `match_term`을 훑어 다른 낱말의
   앞머리를 잡지 않았는지 본다(예: `아이` → `아이콘`). 오탐이면 패턴 끝을 조이고 STEP 6을 다시 돌린다.
   **미분류 비중도 본다** — `cep_summary.md` 끝 «미분류 상위 검색어»가 상황이면 사전에 넣고 STEP 6을 다시 돌린다.
   구매 탐색어(추천 · 순위 · 최저가)는 미분류가 아니라 `비상황:구매 탐색`에 둔다.
2. `multi_cep=Y` 검색어를 훑는다 — 주 CEP가 배열 순서로 정해졌으므로 의도와 다르면 사전 순서를 고친다.
3. **CEP 이름 · 해석은 `[추정]`이다.** 사전의 테마 이름이 CEP 이름이 되며, 에이전트가 «아기 외출 전 자외선 걱정»처럼 다시 쓴 이름 ·
   메시지 해석은 모두 `[추정]`으로 표시한다(LLM이 CEP를 «발견»한 것이 아니다).
4. 상위 CEP 몇 개의 대표 검색어를 `trend_yoy.py`로 다시 계산해 방향이 맞는지 교차확인한다. 마지막 달을 뺀 창과 비교하려면
   `yoy_ex_last_month` 열을 본다:

```bash
python3 scripts/trend_yoy.py raw/metrics_all.json -o trend.csv --gate 3000
```

### STEP 8 · 리포트 (0크레딧)

```bash
python3 scripts/build_report.py --map out/cep_map.json --ledger ledger.jsonl -o report.json --estimate 6000
python3 scripts/render_report.py report.json -o report.html     # 계약 위반이면 렌더하지 않는다
```

- `facts`는 `cep_map.json`의 값으로만 만든다. 문구 숫자는 `{{ID}}`로만 쓴다.
- 에이전트가 쓰는 해석 · 메시지 가설 · 대안 설명은 `--notes notes.json`(`{"D1": {"interpretation": "…"}, "A1": {"hypothesis": "…"}}`)으로
  넣는다. 숫자를 직접 쓰면 렌더러가 멈춘다 — `{{ID}}`만 쓴다. 이 문장들은 `[추정]`이다.
- `provenance.calls`는 `ledger.jsonl` 그대로다. 렌더하면 `report.calls.csv` · `report.cost.json`이 옆에 나온다.

## 산출물

아래 컬럼 목록은 스크립트의 실제 출력이다. 스크립트를 고치면 이 목록도 함께 고친다(`selftest_cep.py`가 이 블록을 읽어 실제 헤더와 대조한다).

```
pool.csv
  keyword, canonical, source, source_seed, path_pre_paths, anchor_hit, boundary, cep_hint, kind_hint, brand

pool_calls.csv
  file, tool, seed, limit, returned, truncated, usable_paths, seed_found_paths

cep_keywords.csv
  keyword, canonical, source, path_pre_paths, anchor_hit, boundary, cep, cep_axis, kind, facets,
  multi_cep, brand, brand_scope, volume_total, group_volume_lo, group_volume_hi, canonical_rep,
  dup_of, returned, stage2, yoy_12m, series_status, match_term, match_scope, window_volume

cep_map.csv
  cep, cep_axis, kind, keywords, canonical_groups, volume_12m_lo, volume_12m_hi, nonbrand_volume_lo,
  nonbrand_volume_hi, brand_volume_lo, share_lo, share_hi, situation_only_volume_lo, path_pre_paths,
  path_pre_rate, rank_window, window_volume_lo, window_nonbrand_lo, window_nonbrand_hi,
  window_series_share, gated_out, priority_rank, priority_rank_hi, flip_under_hi,
  priority_rank_incl_last, rank_shift_incl_last, partial_token_share, series_groups,
  series_excluded_missing, series_coverage, yoy_window, yoy_12m, yoy_3m, yoy_basis_prev_12m,
  trend_status, trend_call, trend_conflict, season_status, season_strength, peak_months, focal_brand,
  focal_share, top_competitor, top_competitor_share, brand_link_call, top_keywords, data_ref_month

cep_brand.csv
  cep, brand, role, cooccur_groups, cooccur_volume_lo, share_of_cep_lo, path_cooccur_paths, cep_paths
```

그 밖의 파일:

- `stage2_keywords.json` — `keywords` · `why`(B · M_main · M_tail) · `credit` · `rule`
- `ledger.jsonl` — 호출마다 `id` · `step` · `at` · `tool` · `params` · `purpose` · `returned` · `cost` · `raw` · `data_through` · `status`
  (+ `limit` · `truncated` · `reused_from`)
- `out/cep_map.json` — `meta`(기준월 · 조회일 · 지연 · 창 · 게이트 · 수집 범위 · 절단 호출 · 분류율 · 제외 · 미반환) ·
  `ceps`(위 행 + 월별 `series` + `season_index`) · `brands` · `unclassified_top`
- `out/cep_summary.md` — 머리 정보 · 상황 CEP 표(순위 · 논브랜드 하한~상한 · 추세 · 성수기 · 브랜드 연결) · 미분류 상위 · 라벨 규약
- `report.json` · `report.html` · `report.calls.csv` · `report.cost.json`

열 읽는 법:

- `kind`: `상황`(CEP) · `코어`(키워드 자신 · 앵커어) · `비상황` · `브랜드·제품명` · `미분류`. `gated_out`은 상황 CEP만 `Y`/빈칸, 나머지 `-`
- `volume_12m_lo` · `_hi`: 카테고리 결속 그룹의 하한 합 · 상한 합(`volume_total` — 기준월 포함 12개월) [추정]. `share_lo` · `share_hi`: 같은 기준 전체 결속 검색량 대비
- `rank_window` · `window_volume_lo` · `window_nonbrand_lo` · `_hi`: 순위 창(추세 창과 같음, 기본 마지막 달 제외) 볼륨 — 순위 · 게이트 기준.
  `window_series_share`: 그중 2단 시계열로 계산한 비중(나머지는 `volume_total`로 대신). `window_volume`(검색어): 시계열로 계산한 대표의 창 합
- `priority_rank_incl_last` · `rank_shift_incl_last`: 마지막 달 포함 12개월(`nonbrand_volume_lo`) 기준 순위 · 순위 창 순위와 다를 때 `포함→창`
- `match_term` · `match_scope`(검색어): 주 테마에 걸린 말 · `어절`/`어절 일부`. `partial_token_share`(CEP): «어절 일부» 그룹 하한 비중 — 오탐 위험 신호
- `path_pre_paths` · `path_pre_rate`: 시드 앞 `--pre-steps`걸음에 이 CEP 검색어가 나온 경로 수 · 시드 발견 경로 대비 비율
- `series_coverage`: 시계열 모집단 대표의 하한 합 ÷ CEP 하한. 0.5 미만이면 `trend_call`에 «(잠정)»
- `yoy_basis_prev_12m`: 전년 12개월 창 합(게이트 판정 기준) · `trend_status`: `계산됨` / `게이트 미달(전년 12개월 N)` / `시계열 없음`
- `series_status`(검색어): `계산됨` · `게이트 미달` · `결측 월` · `시계열 없음` · `미반환` · `경계 밖` · `같은 검색 중복` · `그룹 대표 아님`
- `share_of_cep_lo`(브랜드): 한 그룹에 브랜드가 둘이면 둘 다에 들어가 합이 1을 넘을 수 있다

## 4-Label

| 라벨 | 이 스킬에서의 적용 |
|---|---|
| `[실제 데이터]` | 검색어 · `volume_total` · `monthly_volume` 원본과 대표 검색어의 전년 동기 직접 계산 · 경로 시퀀스와 시드 앞 경로 수 · `cost_detail` · 기준월 |
| `[추정]` | CEP 분류(규칙 사전) · CEP 이름과 에이전트가 쓴 해석 · 메시지 가설 · 그룹 하한/상한과 CEP 합산 · 비중 · 분류율 · 논브랜드 비중 · 브랜드 연결 판정 · 계절 지수 · 마지막 달 미완결 의심 · path 계획 비용 |
| `[가정]` | 게이트 12,000(CEP · 2단) · 1,200(긴 꼬리) · 3,000(3개월 · 검색어) · 추세 임계 ±20% · 브랜드 연결 5% · 성수기 지수 1.30 · 시드 앞 3걸음 · 사전 배열 순서 · 뜻 고정 제외 패턴 · 마지막 달 제외 · 파일럿 없을 때의 r |
| `[데이터 공백]` | 미반환 검색어 · 결측 월 · 시계열 없음 · 게이트 미달 추세 · 빈 path 응답 · 신생 카테고리의 추세 · 성 · 연령(이 스킬은 쓰지 않음) |

수치를 인용하는 문장은 넷 중 하나를 단다. 순위 자체는 `[추정]`이다(분류가 추정이므로).

## 한계

- **세션 인접은 개인 여정이 아니다.** 시드 앞 검색은 같은 세션에서 붙어 나온 검색의 집계다. «이 상황 때문에 검색을 시작했다»는
  인과가 아니라 인접 빈도이며, 며칠에 걸친 계기는 보이지 않는다
- **검색은 구매 · 인식이 아니다.** CEP 검색량은 그 상황에서 카테고리를 찾은 관심 신호이지 상황 발생 빈도 · 구매량 · 브랜드 연상률이
  아니다. 브랜드 연결은 «함께 검색됨»이지 «그 상황에서 그 브랜드를 떠올림»이 아니다. 검색량 단위는 건이며 사람 수가 아니다
- **사전이 지도의 한계다.** 사전에 없는 상황은 «미분류»로 남고, 부정 · 문맥(`안 끈적이는`)을 이해하지 못한다. 미분류 비중을 함께 보고한다.
  CEP 6축 분류는 검색어 표면의 규칙이며, 상황을 말로 검색하지 않는 수요(«그냥 생각나서»)는 잡히지 않는다.
  패턴은 어절 시작에서만 걸리므로 붙여 쓴 합성어의 뒷말(`코크살균`의 `살균`, `포장이사`의 `이사`)은 사전에 합성어로 적어야 잡힌다
- **월 그레인 · 지연** — 기준월은 응답에서 읽는다(관측 1개월). 이번 달 생긴 상황은 아직 데이터에 없고, 다음 성수기는 미관측이다
- 연관어 · 경로 모두 limit 안의 반환분이다. 절단된 호출이 있으면 «전체 상황»이라 하지 않는다
- 원인(왜 그 상황이 커지는가)을 설명하지 않는다. 시즌 · 이슈와의 관계는 상관 · 동향으로만 쓴다
- `demography`(성 · 연령)는 일부 국가만 반환하는 사양이고 이 스킬은 쓰지 않는다 — «20대 여성의 CEP»는 받지 않는다

## 리포트

이 스킬의 HTML 리포트는 `references/report-contract.md`(렌더링 계약 정본 사본)를 따르고,
`scripts/render_report.py`(공통 렌더러)로만 만든다. 스킬은 **무엇을 넣을지**를 `report.json`으로 정하고,
뼈대 순서 · 차트 메타 · 카드 필드 · 숫자 추적 · 호출 기록은 렌더러가 검사한다.
`assets/report.example.json`은 이 스킬의 견본이다 — 합성 픽스처로 `build_report.py`가 만든 모양 그대로다.
렌더하면 `report.html` 옆에 호출 로그(`report.calls.csv`)와 비용 보고서(`report.cost.json`)가 함께 나온다.

첫 화면 경계 문장(`boundary`): «(기준월)까지의 검색에서 본 진입 상황 지도이며, 다음 성수기 · 구매 · 브랜드 연상(인식)은 관측하지 않았다»

| 섹션(`kind`) | 이 스킬이 넣는 것 | 쓰는 지표 · 차트 |
|---|---|---|
| `summary` 분석 요약 | 1순위 CEP 발견 카드 · 경쟁 브랜드 우위 CEP 발견 카드 · 반대 근거(미분류 비중 · 절단 · 마지막 달 의심 · 마지막 달 포함 시 순위 변동 · 어절 일부 비중) · 가능한 결정 | 논브랜드 하한 · CEP 하한 · 전년 12개월 증감률 · 브랜드 비중 |
| `trend` 트렌드 분석 | CEP별 전년 12개월 vs 최근 12개월(기준 · 비교 · 절대 증감 · 증감률 · 판정, 게이트 미달 행은 비고) → 달력 월 계절 지수(역위상 확인) | 표(`base` · `compare` · `abs_change` · `pct_change`) · heatmap(지수 + 월평균 건 `raw`) |
| `structure` 관심 구조 | CEP 지도 표(순위 · 논브랜드 하한/상한(순위 창) · 마지막 달 포함 순위 · 브랜드 검색 · 상황만 · 시드 앞 경로 · 성수기 · 브랜드 연결) · 브랜드 × CEP 연결 표 | 표 · scatter(x 전년 증감률 · y 브랜드 비중 · 면적 논브랜드 하한, 크기 범례) |
| `action` 기회와 실행 | 상위 CEP · 경쟁 우위 CEP 실행 카드 — 상황 메시지 가설 · 결과물 · 담당 · 내부 데이터 · 확대/수정/중단 조건 (`--notes`로 에이전트 문장, [추정]) | 사실 ID 근거 |
| `appendix` 근거 부록 | 계산 정의(순위 · 추세 · 계절 지수 · 게이트) · 한계 · 미분류 상위 검색어 · 소진 크레딧 + 렌더러의 호출 순서 · 로그 · 비용 | 표 · 사실 목록 |

`report.json`의 `facts`(사실 목록)는 **스크립트의 저장 계산 결과**에서 만든다 — 문구의 숫자는 `{{ID}}`로만 쓴다.
`provenance.calls`(호출 순서 · 조건 · 반환 수 · 비용 · 원본 파일)는 **수집 스크립트의 원장**에서 만든다 — 손으로 적지 않는다.

호출 원장을 남기는 단계: STEP 1 · 2 · 4 · 5에서 응답을 `raw/`에 저장한 직후 `ledger.py add`가 `cost_detail.total_cost`와 반환 수 ·
절단 · 데이터 마지막 달을 `ledger.jsonl`에 쓴다. 저장본을 다시 쓰면 `--reused-from C5`로 `cost: 0` 행을 남긴다. STEP 8 `build_report.py`가 이 원장을 그대로 싣는다.

```bash
python3 scripts/render_report.py report.json -o report.html     # 계약 위반이면 렌더하지 않는다
```
