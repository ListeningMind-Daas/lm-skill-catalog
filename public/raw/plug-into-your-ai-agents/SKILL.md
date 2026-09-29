---
name: plug-into-your-ai-agents
description: |
  ListeningMind DaaS API의 **운영 명세(openapi.json)에 있는 엔드포인트 전부**(현재 9개)를
  사용자의 AI 에이전트에 **도구 정의(function calling)**로 꽂고,
  호출 전 **예산 가드**와 `cost_detail` 기반 **크레딧 원장**을 붙인 뒤, 모의 응답 **dry-run을 통과**시킨다.
  도구 목록·인자·단가는 손으로 적지 않고 **명세에서 만든다** — `sync`가 운영 명세 변경(새 엔드포인트·
  인자·단가)을 잡아 잠금 파일에 반영하고, 새 엔드포인트는 도구로 자동 추가된다.
  산출물은 분석 리포트가 아니라 연결 한 벌이다 — 도구 정의 JSON · 디스패처 · 원장 · 사용량 요약.

  "우리 에이전트에 리스닝마인드 API 붙이고 싶어" · "LangGraph에 키워드 조회를 툴로 등록해줘" ·
  "Claude tool use로 cluster_finder 호출하게 해줘" · "OpenAI function calling 스키마 만들어줘" ·
  "에이전트가 크레딧 얼마나 쓰는지 추적하고 싶어" · "API 예산 넘지 않게 막아줘" ·
  "에이전트 워크플로우에 LM 데이터 연동" · "API에 새 엔드포인트 생겼는데 에이전트 도구 갱신해줘" ·
  "SERP·트렌드파인더도 에이전트가 부르게 해줘" 같은 요청이면 반드시 이 스킬을 쓴다.

  사용자가 "도구"·"스킬"이라는 말을 쓰지 않아도, **LM 커넥터를 사람이 아니라 에이전트가
  반복 호출하게 만드는 것**이 목적이면 켠다 — 사내 챗봇 연동, 자동 리서치 파이프라인,
  크레딧 모니터링 대시보드가 모두 여기다.

  경계: 한 번의 시장 질문에 답하는 것이 목적이면 이 스킬이 아니다 — 시장 지도는
  `map-your-market`, 라이징 신호는 `spot-trends`로 보낸다. 이 스킬은 **연결과 비용 통제**를
  만들지, 분석 결론을 내지 않는다.
license: MIT
metadata:
  version: "0.3.1"
---

<!-- lm-skill: kind=task; connectors=keyword_info,intent_finder,cluster_finder,path_finder,serp,trend_finder; flags=monthly,expand; traps=T1,T2,T3,T4,T5,T6,T7 -->

# Plug into Your AI Agents — 에이전트 도구 연결 · 예산 가드 · 크레딧 원장

> **핵심 원칙**: 에이전트는 호출 비용도, 응답의 함정도 모른다. 그래서 커넥터를 에이전트에
> 직접 주지 않고 **런타임 한 겹**을 거치게 한다 — 호출 전 결정식으로 막고, 응답에 해석 주석을
> 붙이고, 호출마다 원장에 한 줄을 남긴다. **dry-run이 통과하기 전에는 실제 키를 연결하지 않는다.**
> 그리고 API는 바뀐다 — 도구 목록·인자·단가는 **운영 명세에서 만들고**, 명세가 바뀌면 `sync`가 알린다.

## 이 스킬이 태스크 스킬인 이유

잡이 «질문에 답하기»가 아니라 «연결을 만들고 검증하기»다. 입력(프레임워크 · 커넥터 · 시장 ·
예산)이 정해지면 산출물(도구 정의 · 원장 · 요약)과 합격 기준(dry-run 통과)이 결정된다.
데이터 함정은 **에이전트가 받을 응답**에서 생기므로, 함정 처리는 런타임의 응답 주석으로 구현한다
— 에이전트가 무엇을 하든 주석은 붙는다. 논브랜드 분리(T8)는 점유를 논하는 분석 스킬의 몫이라
이 스킬의 의무가 아니다.

## 데이터 계약

이 스킬은 `references/lm-data-contract.md`(정본 사본)를 따른다. 해당 함정과 처리 위치:

| 함정 | 처리 위치 | 상태 |
|---|---|---|
| T5 ① 같은 검색의 중복(시계열 일치 · 지표 일치+토큰 겹침) 한 번만 · ② 표기변형 그룹 볼륨 하한/상한 병기 | STEP 3 응답 주석 (`dup_of`·`dup_basis` · `canonical` · `variant_groups`의 `volume_lo`·`volume_hi`·`duplicates`) · 치환 규칙 `--rules` | ⚠️ 부분 — 아래 |
| T1 기준월·지연 3종 표기 | STEP 4.5 (`lm_meta.data_ref_month`·`lag_months`) | ✅ |
| T2 마지막 달 완결성 점검 | STEP 4.5 (`last_month_suspect` · 마지막 달 뺀 창) | ✅ |
| T3 volume_trend 대신 전년 동기 비교 | STEP 3 (`volume_trend_do_not_use` · `yoy_ex_last_month`) | ✅ |
| T4 기저 볼륨 게이트 | STEP 3 (`below_base_gate`, `--base-gate`) | ✅ |
| T6 결측 월 처리 | STEP 3 (`missing_months` · 계산 불가) | ✅ |
| T7 절단(limit) 검사 — 절단이면 수렴 판정 보류 | STEP 3 (`truncated`) · STEP 5 요약 | ✅ |

> 이 표는 선언이다. 실제 처리는 아래 STEP 본문과 `scripts/lm_tools.py`에 있다.
>
> **T5가 «부분»인 이유** (2026-09-28 실측 `keyword_info` 응답 4건 재생): 한국어 응답에 함께 온 변형은
> `선크림`/`썬크림` 같은 **철자 변형**이었고, 공백 제거 canonical로는 하나도 묶이지 않았다
> (`variant_groups` 전 호출 `{}`). 시계열·지표 일치 중복도 이 4건에서는 0쌍이었다(네이버 볼륨이 달랐다).
> 그래서 철자 변형은 사용자가 준 **치환 규칙**(`{"썬": "선"}` — `--rules` · `Runtime(variant_rules=…)`)이
> 있어야 묶인다. 규칙을 주면 같은 응답에서 3그룹(선크림·톤업·무기자차)이 하한·상한으로 묶였다.
> 규칙이 없는 철자 변형은 여전히 따로 센다 — 에이전트 답에 «표기변형 미통합 가능»을 적게 한다.
> 이 5쌍은 구글 볼륨(`gg_volume_total`)이 서로 같았다 — 상한(합)은 구글분을 두 번 셀 수 있다 `[추정]`.

## 명세 → 도구 (두 층)

도구는 두 파일을 합쳐 만든다. 인자 스키마와 단가를 코드에 적지 않는다.

| 파일 | 누가 쓰나 | 담는 것 |
|---|---|---|
| `assets/api/api-lock.json` | `sync --write`(기계) | 운영 명세(`openapi.json`)를 정규화한 잠금 파일 — 경로 · 메서드 · 인자(열거값·기본값·최댓값) · 필수 인자 · 단가(응답 `*Cost` 스키마의 `input_cost`·`output_cost` 기본값) · 명세 버전 |
| `assets/api/tool-policy.json` | 사람(검토) | 명세만으로 정할 수 없는 판단 — 도구 이름 · 호출 전 출력 상한 · 결정식의 출력 세는 법 · 절단 규칙 · 응답 주석 · 에이전트용 사용 규칙 · 안전 기본값 · 숨길 인자 |

- **판단 파일에 있는 경로** → 검토된 도구. 기본으로 켜진다
- **명세에만 있는 경로**(새 엔드포인트) → **도구로 자동 추가된다.** 단 «검토 전»이라 기본으로 꺼지고,
  이름을 지정해야 열린다(`--tools`·`Runtime(tools=…)`). 호출 전 추정은 명세의 limit 최댓값으로 잡고(최악 기준),
  출력 과금이 있는데 limit 인자가 없으면 추정할 수 없어 막는다(`no_estimate`). 응답 해석 규칙이 없으므로
  도구 설명과 `lm_meta.review`가 «수치를 판정에 쓰기 전에 사람이 확인»을 요구한다. 검토한 뒤 판단 파일에
  항목을 넣으면 기본으로 켜진다
- **판단 파일에만 있는 경로**(명세에서 사라짐) → 도구를 만들지 않고 `sync`·`list`가 알린다
- 숨긴 인자: `user_query`(에이전트 대화 원문을 API로 보내는 선택 인자 —
  사람이 결정해 `Runtime(pass_params=["user_query"])`로 연다)

## 도구와 크레딧 (운영 명세 v0.0.60 · 2026-09-29 동기화)

결정식은 전부 **입력 단가 × 입력 수 + 출력 단가 × 출력 수**다. 단가는 잠금 파일에서 오므로 아래 숫자는
이 판의 잠금 파일 값이다 — 명세가 바뀌면 `sync --write` 뒤 `list`로 다시 본다. 도구 설명에도 명세 버전과
단가가 자동으로 들어간다.

| 엔드포인트 → 도구 | 용도 | 크레딧 결정식 | 단가 근거 |
|---|---|---|---|
| `keyword_info` → `lm_keyword_info` | 볼륨·광고지표(`ads_metrics`) / 시계열·의도(`all`) | `ads_metrics` **1 × 키워드** · `all` **10 × 키워드** | 명세 = 실측 |
| `intent_finder/keyword_list` → `lm_intent_finder` | 연관 검색어 확장 (문자열만) | **30 × 입력 + 2 × 반환 키워드** | 명세 = 실측 |
| `cluster_finder` → `lm_cluster_finder` | 군집·관계 | **150 + 50 × 고유 키워드(노드)** | 명세 = 실측 |
| `cluster_finder/keyword_list` → `lm_cluster_keyword_list` | 같은 그래프의 키워드 목록만 | **30 + 2 × 반환 키워드** | 명세값 · **실측 대조 전** `[가정]` |
| `path_finder` → `lm_path_finder` | 세션 인접 경로 | **50 + 40 × 경로 안 고유 키워드** | 명세 = 실측 |
| `path_finder/keyword_list` → `lm_path_keyword_list` | 경로에 나온 키워드 목록만 | **30 + 2 × 반환 키워드** | 명세값 · **실측 대조 전** `[가정]` |
| `serp` → `lm_serp` | 저장된 SERP 스냅샷 블록 | **30 × 키워드** (출력 무과금) | 명세 = 실측(계약 §1) |
| `trend_finder/issue_list` → `lm_trend_finder` | 시드 주변 급부상 이슈 | **50 + 2 × 반환 이슈** · 빈 결과는 0 | 명세 + 빈 결과 0은 실측 1건(계약 §1) |
| `usage/summary` → `lm_usage_summary` | 계정 기간 사용량 집계 | 명세에 단가 없음 → 추정 0 · 원장에 `[데이터 공백]` | — |

`ads_info`는 도구에 노출하지 않는다 — 계약 §1상 `all`이 상위집합이라 쓰지 않는다(판단 파일 `enum_only`).
키워드 목록 도구 두 개는 **싼 대안**이다 — 구조(군집·관계·경로 순서)가 필요 없고 키워드만 필요하면 본 도구의
수십 분의 1 비용이다. 도구 설명이 에이전트에게 이 선택을 알려준다.

**2단 조회를 런타임이 강제한다.** `lm_keyword_info`의 `all`은 같은 세션에서 `ads_metrics`로
먼저 확인한 키워드에만 허용된다(아니면 `two_stage`로 차단). 후보 전량에 `all`을 걸면 10배가
되므로, 총액을 지배하는 것은 **게이트를 통과해 `all`로 가는 키워드 수**다.

**호출 전 추정은 결정식에 상한을 대입한다** — 반환 수는 호출 전에 모르기 때문이다.

| 도구 | 호출 전 추정 (예산 가드가 쓰는 값) | 라벨 |
|---|---|---|
| `lm_keyword_info` · `lm_serp` | 단가 × 요청 키워드 수 — 정확 | 결정식 |
| `lm_intent_finder` · `lm_trend_finder` | 입력 단가 × 입력 + 출력 단가 × `limit` | `[추정]` 반환 ≤ limit |
| `lm_cluster_finder` · `lm_cluster_keyword_list` | 입력 단가 + 출력 단가 × (`limit` + 1) — 보수 옵션 `--cluster-bound structural`: × 2·`limit` | `[가정]` 노드 ≤ limit+1 |
| `lm_path_finder` · `lm_path_keyword_list` | 입력 단가 + 출력 단가 × ⌈`limit` × `--path-kw-mult`(기본 3)⌉ | `[가정]` 경로 키워드 ≤ limit × 3 |
| `lm_usage_summary` | 0 | `[데이터 공백]` 명세에 단가 없음 |
| 검토 전(자동 추가) 도구 | 입력 단가 × 입력 + 출력 단가 × 명세 최대 limit | `[가정]` 최악 기준 |

생략된 `limit`은 **판단 파일의 안전 기본값**으로 채워 보낸다 — cluster 100 · path 20 · trend 50 (API 기본값은
cluster 500 · path 300 · trend 1,000이라 비워 보내면 추정을 넘는다). trend는 limit 1,000이면 추정 2,050이다.

상한의 근거(관측 — 결정식이 아니다):

- **cluster** — `limit`은 **관계 행 수** 상한이다(노드 수가 아님). 저장된 실측 응답 39건(limit 10~500)에서
  노드는 모두 limit+1 이하였다(limit 10 → 11 · limit 500 → 501 등). 관계 행 1개는 끝점이 2개라 구조상
  노드 ≤ 2 × limit이다 — 관측 밖 응답이 걱정되면 `structural`을 쓴다(추정이 약 2배). 키워드 목록 도구도
  같은 그래프이므로 같은 상한을 쓴다 `[가정]`
- **path** — `limit`은 **경로 수** 상한이고 과금 단위(고유 키워드)는 묶지 못한다. 관측 6건에서
  고유 키워드/limit은 최대 2.33(limit 3 → 7)이었고 limit 20 → 25 · 30 → 36 · 35 → 45였다. 경로 길이는
  3~8이 관측됐다. 기본 배수 3은 이 6건을 모두 덮는다

호출 뒤에는 응답으로 결정식을 **다시 계산**(`formula_cost`)해 `cost_detail.total_cost`와 대조한다.
어긋나면 원장의 `formula_match=false`로 남고 요약이 `sync`로 명세를 확인하라고 경고한다 — 단가가 바뀌었거나
응답 구조를 잘못 센 것이다. 실제 비용이 가정 상한을 넘어 누적이 예산을 넘으면 **이후 호출을 전부 멈춘다**
(`halted_after_overrun`).

**번들 시나리오의 예산 실례** (선크림 · kr · 예산 1,500 · cluster·path는 실측 응답 원문, 나머지는 합성):
스크리닝 5키워드 `1×5=5` → intent `30×1+2×10=50` → `all` 4키워드 `10×4=40` → cluster(limit 10, 추정
`150+50×11=700`) 노드 11 `150+50×11=700` → path(limit 3, 추정 `50+40×9=410`) 경로 키워드 7 `50+40×7=330`
→ cluster 키워드 목록(limit 10, 추정 `30+2×11=52`) 11개 `30+2×11=52` → path 키워드 목록(limit 3, 추정
`30+2×9=48`) 7개 `30+2×7=44` → serp `30×1=30` → trend(limit 20, 추정 `50+2×20=90`) 이슈 7건 `50+2×7=64`
→ usage 0 = **1,315**. 이어진 cluster(limit 20) 추정 `150+50×21=1,200`은 남은 185를 넘어 차단된다.

## 번들 자산

| 파일 | 하는 일 | 쓰는 곳 |
|---|---|---|
| `scripts/lm_tools.py` | 명세 추적(`sync`·`list`) · 도구 정의 · 예산 가드 · 응답 주석 · 원장 · 요약 (**이 스킬 고유**) | STEP 0~5 |
| `assets/api/api-lock.json` | 운영 명세 잠금 파일 — `sync --write`만 고친다 | STEP 0·1 |
| `assets/api/tool-policy.json` | 도구별 판단(사람이 검토) — 새 엔드포인트를 검토한 뒤 항목을 넣는다 | STEP 0·1 |
| `scripts/check_refmonth.py` | 저장한 `all` 응답의 기준월·마지막 달 교차확인 | STEP 4.5 |
| `scripts/trend_yoy.py` | 저장한 `all` 응답의 전년 동기 비교 교차확인 | STEP 4.5 |
| `scripts/selftest.py` | 공유 스크립트 계약 검증 (공유 사본) | 스킬 수정 후 |
| `scripts/selftest_tools.py` | `lm_tools.py` 계약 검증 — 문서 예시 명령·명세 추적(자동 추가·단가 변경·삭제)을 그대로 실행 | 스킬 수정 후 |
| `scripts/series_dedup.py` | 같은 검색의 중복 판정·치환 규칙 (공유 사본 — `lm_tools.py`가 가져다 쓴다) | STEP 3 |
| `assets/dryrun/scenario.sunscreen-kr.json` | dry-run 시나리오 13단계 (기대 결과 포함 · 도구 9종 전부) | STEP 4 |
| `assets/dryrun/fixtures/*.json` | 도구별 모의 응답 — cluster·path는 실측 응답 원문, keyword_info·intent는 합성(429·마지막 달 급락·결측 월·저기저·절단), serp는 실측 구조에 합성 문장, keyword_list 2종은 같은 요청의 실측 응답에서 옮긴 합성, trend는 spot-trends 합성 픽스처, usage는 명세 모양의 합성 | STEP 4 |
| `assets/dryrun/real-shapes/*.json` | 실측 응답 원문 4건(cluster 기본·`all` 두 모양 · path · keyword_info 변형 동반) — 응답 파싱 회귀용 | 스킬 수정 후 |
| `references/agent-wiring.md` | 에이전트 루프에 디스패처 끼우는 법 · 사용자 시나리오 픽스처 쓰는 법 · 명세 갱신 절차 | STEP 0·3·4 |

## 사전 확인

```
1. 에이전트 프레임워크 — Claude tool use / OpenAI function calling / 파이썬 함수를 받는 프레임워크
2. 쓸 도구 — 검토된 9종 전부가 기본이지만 줄이는 것이 좋다. path_finder는 여정이 판단에 필요할 때만,
   구조가 필요 없으면 keyword_list 도구로. 검토 전(자동 추가) 도구는 사람이 응답을 본 뒤에만 연다
3. 시장(gl) — 세션당 단일 값으로 확정 (명세상 kr · us · jp)
4. 세션 예산(크레딧) — 숫자 하나. 없으면 묻는다. 모르면 dry-run 합계를 보고 정한다
5. 기저 게이트(--base-gate, 기본 3,000) · 경로 키워드 배수(--path-kw-mult, 기본 3) · cluster 노드 상한
   (--cluster-bound, 기본 observed) — 모두 [가정]
6. 표기 치환 규칙(--rules) — 시장에 철자 변형이 있으면(예: 한국어 선/썬) 받는다. 없으면 공백 규칙만 쓴다
7. 환경변수 LM_API_BASE · LM_API_KEY — sync(명세만 · 키 불필요)와 실연결 단계(STEP 6)에서만 필요
```

API 주소는 코드에 넣지 않는다. 저장소 README가 링크한 공개 API 문서에서 주소를 확인해
`LM_API_BASE`에 넣는다. **운영 명세가 정본이다** — 이 스킬은 운영(`LM_API_BASE`의 `/openapi.json`)만
따라간다. 운영 명세에 올라온 엔드포인트만 `sync`로 들어온다.

## 실행 순서

### STEP 0 · 명세 동기화 (크레딧 0)

```bash
python3 scripts/lm_tools.py sync                       # $LM_API_BASE/openapi.json과 잠금 파일 대조
python3 scripts/lm_tools.py sync --write               # 반영 — 새 엔드포인트는 도구로 자동 추가
python3 scripts/lm_tools.py list                       # 도구 · 메서드 · 경로 · 검토 상태 · 단가
```

`sync`는 명세 문서만 읽는다(데이터 엔드포인트를 부르지 않는다 — 크레딧 0 · 키 불필요). `--spec`으로 파일이나
다른 주소를 줄 수 있다. 종료 코드: **0 같음 · 2 모양 변경**(엔드포인트 추가·삭제, 인자·기본값·열거값 변경) ·
**3 단가 변경**. `--write`는 잠금 파일을 고치고 0을 낸다. 보고의 기호: `＋` 추가(자동 추가된 도구 이름과
검토 상태) · `－` 삭제 · `＄` 단가 · `～` 인자 · `！` 판단 파일에만 있는 경로.

단가가 바뀌면(3) 도구 설명·호출 전 추정·결정식이 새 단가를 쓴다. 번들 픽스처의 `cost_detail`은 옛 단가라
dry-run이 `formula_match` 불일치로 멈춘다 — 픽스처를 새 단가로 다시 만들고, 실연결이면 작은 호출 1회로
`formula_match`를 다시 확인한다. 새 엔드포인트가 들어오면(2) 응답을 사람이 본 뒤 `tool-policy.json`에 항목
(이름 · 추정 방식 · 출력 세는 법 · 주석 · 사용 규칙)을 넣어 검토된 도구로 올린다 — 절차는
`references/agent-wiring.md` «명세가 바뀌었을 때».

### STEP 1 · 도구 정의 생성

```bash
python3 scripts/lm_tools.py schema --format claude -o tools.claude.json
python3 scripts/lm_tools.py schema --format openai -o tools.openai.json \
    --tools lm_keyword_info,lm_intent_finder      # 쓸 도구만
```

도구 설명(description)에 **사용 규칙 · 기본 응답 모양 · 명세 버전과 단가가 들어 있다** — 에이전트가 도구를
고를 때 읽는 유일한 문장이기 때문이다. 인자 스키마는 명세에서 온다(열거값 · 기본값 · 최댓값 포함). 쓰지 않을
도구는 `--tools`로 빼고, **같은 목록을 런타임에도 준다**(`Runtime(tools=…)` 또는
`tools_from_definitions("tools.claude.json")`) — JSON에서만 빼면 에이전트가 이름을 추측해 부를 때 런타임이
그대로 보낸다. 목록 밖 도구는 `tool_not_enabled`로 막힌다. 스키마 밖 인자·열거값 밖 값은 `invalid_args`로
보내기 전에 막는다(예: `lm_serp`의 `num`은 10 · 20뿐).

### STEP 2 · 시스템 규칙 주입

```bash
python3 scripts/lm_tools.py rules
```

출력(10줄 규칙)을 에이전트 시스템 프롬프트에 붙인다 — 4-Label, 기준월 표기, `volume_trend`
금지, `canonical` 그룹 볼륨 하한·상한 병기, 절단 시 «더 없다» 금지, 예산 차단 시 우회 금지, 검색량 단위 «건»,
SERP는 스냅샷(수집 시각 병기), 트렌드 이슈는 검색량이 아님, 검토 전 도구의 수치는 판정에 쓰지 않음.

### STEP 3 · 디스패처 연결과 응답 주석

에이전트의 도구 호출을 전부 `Runtime.dispatch(name, args)`로 보낸다(연결 코드:
`references/agent-wiring.md`). 디스패처가 하는 일:

1. **예산 가드** — 켜지 않은 도구면 `tool_not_enabled`, 스키마 밖 인자·열거값 밖 값이면 `invalid_args`,
   추정할 수 없으면(검토 전 도구에 limit이 없음) `no_estimate`, 호출 전 추정이 남은 예산을 넘으면
   `budget_guard`, 2단 조회 위반이면 `two_stage`로 막고, 에이전트에게 `remaining`을 돌려준다. 막힌
   호출도 원장에 남는다. 생략된 `limit`·`data_type` 등은 **스키마 기본값으로 채워 보낸다** — 비우고
   보내면 API 기본값(cluster 500 · trend 1,000 등)이 적용돼 추정을 넘는다. 2단 허용 집합에는 스크리닝 요청 키워드와
   **그 응답에 함께 온 변형 행**이 들어간다(치환 규칙을 적용한 canonical 기준)
2. **재시도** — 429는 1→2→4초… 최대 60초 간격으로 최대 5회, 5xx는 3회. 그 밖의 오류는
   재시도하지 않고 응답 사유를 그대로 돌려준다. 오류 호출의 비용은 `[데이터 공백]`(null)
3. **응답 주석** — 에이전트가 받는 응답에 다음을 붙인다:
   - `lm_keyword_info`: 행마다 `canonical`(NFKC·소문자·**치환 규칙**·공백 제거 그룹키 — 치환은
     공백을 지우기 전에 적용한다)과 `dup_of`·`dup_basis`(`series_dedup.dedup_map`). 요청했는데 응답에
     없는 키워드는 `lm_meta.not_returned`, 요청하지 않았는데 온 행은 `unrequested`
   - **같은 검색의 중복은 한 번만 센다(T5 ①)** — 월별 시계열이 완전히 같은 행, 시계열이 없으면
     볼륨·CPC·경쟁도가 모두 같고 토큰이 겹치는 행은 canonical이 달라도(어순·동의어) `dup_of`=대표 행,
     `dup_basis`=`시계열 일치`|`지표 일치`로 표시하고 그 대표와 한 그룹에 넣는다 `[추정]`
   - **그룹 볼륨은 두 값으로 준다(T5 ②)** — `variant_groups`(canonical이 같거나 `dup_of`로 이어진 행)의
     그룹마다 `volume_lo`(`volume_avg` 최댓값 = 같은 검색일 경우)와 `volume_hi`(중복 행을 뺀 합 =
     서로 다른 검색일 경우)를 붙인다 `[추정]`. 응답은 어느 쪽인지 알려주지 않는다 — 그래서 한쪽을
     고르지 않고 에이전트에게 둘 다 넘기고, `variant_bounds_note`로 «합산하거나 하나만 고르지 말 것 ·
     순위·판정은 하한, 상한으로 뒤집히면 적을 것»을 함께 준다. 볼륨이 없는 변형은 0으로 치지 않고
     `volume_missing`에 적는다. `lm_intent_finder`의 `variant_groups`는 볼륨이 없어 표기 목록만 준다
     (`variant_groups_note`)
   - `volume_trend`는 `volume_trend_do_not_use`로 이름을 바꾼다 — 계약 §2에서 일치하는 식이
     없는 필드다. 추세는 `yoy_ex_last_month`: **마지막 달을 뺀 3개월 창의 전년 동기 비교**
   - **결측 월**(`nv_code`로 `total` 키가 없는 달)은 0으로 합산하지 않고 `missing_months`로 센다.
     비교 창에 결측이 있으면 `yoy_status="계산 불가(결측 월)"`, 기저가 0이면 `계산 불가(기저 0)`
   - **기저 게이트**: 전년 동기 3개월 합(`yoy_base_3m`)이 `--base-gate` 미만이면
     `below_base_gate=true` — 성장률이 커도 랭킹에서 뺀다(기저 0 폭발 차단)
   - `lm_intent_finder` · `lm_cluster_finder` · `lm_path_finder`: `lm_meta.requested_limit` ·
     `returned` · `truncated`. **반환 수가 limit에 닿으면 절단**이다 — 그 라운드로 «연관어가 더
     없다»·«수렴했다»고 판정하지 않고 `convergence="보류 — limit에 닿음"`으로 둔다.
     path는 경로 수를 limit과 비교한다. cluster는 `limit`이 관계 행 상한이므로 **관계 행 ≥ limit
     또는 노드 > limit**이면 절단이다. 노드(`returned`)는 `communities` 구성원과 `rels` 쌍 양끝의
     합집합으로 세며 `cost_detail.output_count`와 같은 단위다. 기본 응답(`communities`만)은 관계 행이
     안 보여 노드 ≤ limit이면 `truncated=null`(판정 불가 — `convergence="보류 — 절단 판정 불가"`)이다.
     판정이 필요하면 `data_type=all`로 받는다(과금 동일)
   - `lm_cluster_keyword_list`: 키워드 수 > limit이면 절단, 그 밖은 관계 행이 안 보여 `truncated=null`.
     `lm_path_keyword_list`: limit은 경로 수인데 경로가 없어 항상 `truncated=null` — 둘 다 «더 없다» 금지
   - `lm_serp`: `lm_meta.collected_at`(수집 시각) · `blocks` · `block_types` · `snapshot_note`(실시간 아님).
     수집 시각이 없으면 `[데이터 공백]`
   - `lm_trend_finder`: `matched_total`(`total`) · `period_days`. 반환 수가 limit에 닿거나 `total` > 반환 수면
     절단. 빈 결과는 `empty_note`(«그 기간 매칭 없음» 실측 — 기간을 넓혀 재조회)이고 결정식은 0이다
     (빈 결과 무과금 — 실측 1건 · 환경마다 확인). `evidence_note` — 이슈는 검색량이 아니고 `summary`는 `[추정]`
   - `lm_usage_summary`: `scope_note` — 계정 전체 집계라 세션 소진이 아니고 `total_credits`는 잔여가 아니다
   - 검토 전 도구: `lm_meta.review`(해석 규칙 없음) · `returned` · `truncated`(limit 비교만)
4. **원장** — 호출 1건 = 1행(JSONL). 응답 본문은 `--raw-dir`에 저장하되 **요청 헤더는 저장하지
   않는다**(키가 들어 있다)

### STEP 4 · dry-run (합격 기준)

```bash
python3 scripts/lm_tools.py dry-run --scenario assets/dryrun/scenario.sunscreen-kr.json \
    --fixtures assets/dryrun/fixtures --budget 1500 --ledger ledger.jsonl \
    --raw-dir raw --queried-at 2026-09-28
```

사용자 시나리오는 에이전트에 준 도구 정의와 치환 규칙을 함께 넘긴다:

```bash
python3 scripts/lm_tools.py dry-run --scenario my-scenario.json --fixtures my-fixtures \
    --budget 50000 --ledger ledger.jsonl --queried-at 2026-09-28 \
    --tools-json tools.claude.json --rules '{"썬": "선"}'
```

모의 전송만 쓴다(네트워크 없음 · 크레딧 0). 시나리오의 각 단계가 기대 결과(`expect` ·
`expect_reason`)대로 나오고, 원장 행 수 = 호출 수, 결정식 불일치 0, 예산 초과 시 정지까지
확인되면 `dry-run 통과`를 출력한다. 번들 시나리오가 밟는 것: `two_stage` 차단 → 스크리닝 →
절단된 intent → 429 뒤 재시도한 `all` → cluster → path → cluster·path 키워드 목록 → serp → 절단된 trend →
usage → 열거값 밖 serp `num`(`invalid_args`) → `budget_guard` 차단.

**사용자 연결의 합격 기준**: 번들 시나리오 통과 + 사용자 에이전트가 실제로 낼 호출 순서로
시나리오를 하나 더 써서 통과. 두 번째 시나리오의 합계가 곧 실연결 1회의 예산 근거다.
시나리오·픽스처 쓰는 법은 `references/agent-wiring.md` «사용자 시나리오 픽스처». 요점: 픽스처 항목에
`match`(요청 인자 부분집합)를 달면 호출 순서와 무관하게 골라지고, 응답에 `request_detail`을 넣으면
결정식 대조가 그 요청 기준으로 된다 — 번들 픽스처를 다른 순서·키워드 수로 불러도 `formula_match`가
깨지지 않는다. 가장 좋은 픽스처는 **저장해 둔 실측 응답 원문**이다.

### STEP 4.5 · 데이터 기준월 확인 ⚠️ 생략 금지

`all` 응답의 `lm_meta`에 `data_ref_month`(데이터 기준월) · `queried_at`(조회일) · `lag_months`
(지연)가 붙는다. 지연은 고정값이 아니다 — **기준월은 응답에서 읽는다(관측 1개월: 2026-09-28 조회 → 2026-08)**. 에이전트는 답의 머리에 **`데이터 기준월 / 조회일 / 지연`** 세 값을 적는다 —
조회일을 데이터 시점으로 말하면 계절 카테고리에서 해석이 뒤집힌다.

같은 주석이 **마지막 달 완결성**을 본다: 최신 월 MoM이 하락이고 전년 같은 구간보다 30%p
이상 나쁘면 `last_month_suspect` 목록에 올린다. 그래서 추세 기본값은 마지막 달을 뺀 창이다.

저장한 응답으로 교차확인한다 — 런타임 주석과 공유 스크립트가 같은 값을 내야 한다:

```bash
python3 scripts/check_refmonth.py raw/c0004_lm_keyword_info.json --queried-at 2026-09-28
python3 scripts/trend_yoy.py raw/c0004_lm_keyword_info.json -o trend.csv
```

### STEP 5 · 원장 요약

```bash
python3 scripts/lm_tools.py summary ledger.jsonl -o usage_2026-09.md --period 2026-09
```

**이번 세션 소진 = 성공 호출의 `cost_detail.total_cost` 합산**이다. 응답의 `used_credits`는
**월간 누적 사용량**이라 잔여량도, 이번 세션 소진도 아니다(다른 세션·파이프라인 소비가 섞인다)
— 요약은 두 값을 따로 적는다. 결정식 불일치 · `cost_detail` 없는 호출 · 절단 호출 · 차단 사유를
점검 목록으로 낸다.

### STEP 6 · 실연결 전환 (크레딧 소모 — 사용자 확인 후)

dry-run이 통과한 뒤에만 한다.

```python
from lm_tools import make_runtime_from_env     # LM_API_BASE · LM_API_KEY 환경변수 필요
rt = make_runtime_from_env(budget=1500, ledger_path="ledger.jsonl", raw_dir="raw")
```

그 전에 `sync`로 잠금 파일이 운영 명세와 같은지 본다(종료 코드 0). 첫 실호출은 `lm_keyword_info`
`ads_metrics` 1키워드(**1크레딧**)로 키·주소를 확인한다. keyword_list 도구 두 개의 단가는 명세값이고 실측
대조 전이다 — 쓸 거면 작은 limit 1회로 `formula_match`를 먼저 본다.
원장의 `formula_match`가 `true`인지 본 뒤에 예산을 연다. cluster·path를 쓸 거면 작은 limit 1회씩
(예: cluster limit 10 → 약 700, path limit 3 → 약 330)으로 응답 모양과 `formula_match`를 먼저 본다. 불일치면 해당 환경의 단가를 다시
확인하고 결정식을 고친다(계약 §1: 배포 환경마다 단가가 다를 수 있다).

## 산출물

아래 필드 목록은 `lm_tools.py`의 실제 출력이다. 스크립트를 고치면 이 목록도 함께 고친다
(`selftest_tools.py`가 원장 필드를 대조한다).

```
tools.claude.json / tools.openai.json
  검토된 도구 9종(또는 --tools로 고른 것) — name, description(명세 버전·단가 포함),
  input_schema(Claude) 또는 function.parameters(OpenAI)

ledger.jsonl
  call_id, ts, tool, endpoint, spec_version, gl, data_type, n_inputs, requested_limit,
  estimate, estimate_basis, status, block_reason, http_status, attempts,
  returned, truncated, formula_cost, actual_cost, formula_match,
  spent_after, budget, monthly_used_credits_seen

raw/<call_id>_<tool>.json
  응답 본문 + lm_meta (요청 헤더 없음)

usage_{period}.md
  호출 수(성공·차단·오류) · 세션 소진(cost_detail 합산) · 사전 추정 합 · 예산 ·
  used_credits(월간 누적) · 도구별 표 · 결정식 불일치 · 절단 · 차단 사유 · 라벨 규약
```

`lm_keyword_info` 응답 행에 붙는 주석 필드:

```
  canonical, dup_of, dup_basis, volume_trend_do_not_use, missing_months, yoy_base_3m,
  yoy_ex_last_month, yoy_status, below_base_gate, last_month_suspect
```

`lm_meta`(응답 단위): `data_ref_month` · `queried_at` · `lag_months` · `last_month_suspect` ·
`yoy_window` · `last_month_policy` · `rows` · `canonical_groups` · `variant_groups` · `variant_bounds_note` ·
`variant_rules` · `not_returned` · `unrequested` · `base_gate` · `labels`(키워드 도구) /
`requested_limit` · `returned` · `truncated`(true·false·null) · `convergence` · `unit` +
`variant_groups` · `variant_groups_note`(intent) · `rel_rows` · `truncation_rule`(cluster) ·
`unique_keywords`(path) · `matched_total` · `period_days` · `empty_note` · `evidence_note`(trend)(확장 도구) /
`collected_at` · `blocks` · `block_types` · `snapshot_note`(serp) / `scope_note`(usage) / `review`(검토 전) /
`call_cost` · `spent` · `remaining` · `tool_review`(공통).

`lm_keyword_info`의 `lm_meta.variant_groups.<canonical>` 그룹 필드 (`selftest_tools.py`가 대조한다):

```
variant_groups.<canonical>
  keywords, volume_field, volume_lo, volume_hi, volume_missing, duplicates
```

`volume_lo`·`volume_hi`는 `[추정]`(응답값으로 계산한 경계 — 어느 쪽이 맞는지는 모른다)이다 —
`volume_lo ≤ 실제 그룹 볼륨 ≤ volume_hi`로 읽는다. `duplicates`는 `{중복 행: 대표 행}`이고 상한 합에서
빠진다. 예: `선크림` 40,000 · `선 크림` 6,000이면 하한 40,000 · 상한 46,000. 실측 예(치환 `썬→선`):
`썬크림` 68,973 · `선크림` 65,186 → 하한 68,973 · 상한 134,159.

## 4-Label

| 라벨 | 이 스킬에서의 적용 |
|---|---|
| `[실제 데이터]` | 응답 반환값 · `cost_detail.total_cost` · `used_credits`(월간 누적으로만) · 응답에서 직접 계산한 `yoy_ex_last_month` |
| `[추정]` | 호출 전 intent 비용 추정(반환 ≤ limit) · `last_month_suspect` 판정 · `dup_of`(같은 검색의 중복 판정) · 표기변형 그룹 볼륨 경계 `volume_lo`·`volume_hi`(응답값으로 계산했지만 어느 쪽이 맞는지는 모른다) |
| `[가정]` | 노드·경로 상한(limit+1 · limit×3) · 기저 게이트 3,000 · `canonical` 정규화·치환 규칙 · 절단 판정 규칙 |
| `[데이터 공백]` | 오류 호출의 비용(null) · `cost_detail` 미반환 · 명세에 단가 없는 도구(usage)의 비용 · SERP 수집 시각 없음 · 결측 월 · 계산 불가 · `not_returned` · 일부 시장의 `demography` 미반환(사양) |

런타임은 `lm_meta.labels`로 필드별 라벨을 에이전트에 넘기고, STEP 2 규칙이 답에 라벨을 붙이게 한다.

## 한계

- **단가는 명세값이다.** 명세의 `*Cost` 기본값을 결정식에 쓴다 — keyword_info·intent·cluster·path·serp·trend는
  실측(2026-09-28~29 · 한 환경)과 일치를 확인했고, keyword_list 2종은 실측 대조 전이다. 명세에 적히지 않은 과금 규칙(trend 빈 결과 0)은
  판단 파일에 실측 근거(1건 · 환경마다 확인)와 함께 적었다. 명세와 실제 과금이 다르면 원장 `formula_match=false`로만 드러난다
- **자동 추가된 도구는 응답 해석이 없다.** 절단·중복·기준월 같은 함정 처리는 사람이 응답을 보고 판단 파일에
  규칙을 넣은 뒤에야 붙는다. 그 전에는 기본으로 꺼져 있고, 켜도 수치를 판정에 쓰지 않게 한다
- `sync`는 명세 문서를 비교할 뿐이다. 응답 모양이 명세 없이 바뀌면 잡지 못한다 — 실측 응답 모양 회귀
  (`real-shapes/`)와 원장 `formula_match`가 그 몫이다
- **dry-run은 연결을 검증하지 응답을 검증하지 않는다.** keyword_info·intent 모의 응답은 합성이고,
  cluster·path는 실측 응답 원문이지만 한 시드·한 시점이다 — 사용자 환경의 응답 모양은 첫 실호출 원장의
  `formula_match`로 확인한다
- 예산 가드는 **호출 전 추정**으로 막는다. cluster·path 상한은 관측에 기댄 `[가정]`이라 실제가 넘을
  수 있고, 그때는 이미 쓴 뒤에 멈춘다(`halted_after_overrun`). 관측 밖이 걱정되면 cluster는
  `--cluster-bound structural`, path는 `--path-kw-mult`를 올린다
- cluster 기본 응답(`communities`만)은 절단을 판정하지 못할 수 있다(`truncated=null`). cluster 관계
  행이 limit보다 조금 적게 온 응답(limit 500에 475~499행)도 관측됐다 — 행 수가 limit 미만이라는 것만으로
  «그래프 전체»라고 단정하지 않는다 `[가정]`
- T5 철자 변형(선/썬 등)은 치환 규칙이 있어야 묶인다 — 규칙 사전은 시장마다 사람이 준다
- 이 런타임은 세션 단위다. 여러 에이전트·프로세스가 같은 예산을 공유하면 원장을 합쳐야 한다
- rate limit 수치·플랜 조건은 계약마다 다르다 — 이 스킬은 429를 받으면 물러설 뿐 한도를 모른다
- 월 그레인 · 기준월은 응답에서 읽는다(관측 1개월 지연). 에이전트가 주간 조기경보를 약속하게 두지 않는다
- 검색은 관심 신호이지 구매가 아니다. 검색량 단위는 «건»이다. 세션 인접은 집계 행동이지 개인 여정이 아니다
- 분석 결론(점유·기회·진입)은 내지 않는다 — 그 판단의 함정(논브랜드 분리 등)은 분석 스킬의 몫이다
