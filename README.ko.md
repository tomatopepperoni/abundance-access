# Abundance Access

**국가별 교육·디지털 접근 여건을 비교하는 연구용 정적 대시보드와 로컬 읽기 전용 MCP 서버**입니다.

핵심 질문은 **“무료 온라인 교육이 있어도, 그것을 이용할 기반 여건은 국가별로 어떻게 다를까?”**입니다. 교육 지원을 검토하는 연구자·비영리단체 담당자가 국가·경제의 연간 통계를 비교하고, 추가로 조사할 질문을 기록하도록 돕습니다. 교육 효과·고용·소득·개인 능력을 진단하거나 국가별 종합 점수를 만들지 않습니다.

Yorke Rhodes 교수님의 공급망 수업에서 영감을 받은 독립적인 개인 프로젝트입니다. 교수님이 제작·요구·보증한 도구가 아닙니다. 현재 버전은 기존 카메라 품질검사·합성 재생·퀴즈를 핵심 흐름에서 제외했습니다.

## 공개 사이트와 소스

- [GitHub Pages 데모](https://tomatopepperoni.github.io/abundance-access/)
- [소스 저장소](https://github.com/tomatopepperoni/abundance-access)
- [English README](README.md)

첫 화면의 **Try Korea, India and Kenya (2022)** 버튼으로 비교 예시를 엽니다. MCP는 웹과 별도로 실행하는 로컬 stdio 서버입니다.

## 실행

Node.js **22.12 이상**, npm이 필요합니다. 현재 로컬 검증 환경은 Node 25.1.0입니다.

```sh
npm ci
npm run dev
```

`http://127.0.0.1:5173/#overview`를 엽니다. 개발 서버와 MCP 서버는 서로 다른 프로세스입니다.

```sh
npm run typecheck
npm run validate:data
npm test
npm run test:mcp
npm run build
npm run preview
```

`npm run check`는 타입·데이터 검증·단위 테스트·MCP 실제 통신 검증·빌드를 실행합니다. 앱은 빌드에 포함된 실제 통계 스냅샷과 지도만 읽습니다. 기본 기능에는 외부 API 연결·로그인·API 키·LLM 호출이 필요 없습니다. 출처 링크 접속과 새 데이터 수집에는 인터넷이 필요합니다.

## 비교 재현·공통 연도·계산 노트

- **Share this comparison**: 국가·통계 기준 연도·차트 지표·스냅샷 ID만 포함하는 공유 링크를 만듭니다. 개인 메모는 포함하지 않습니다. 같은 스냅샷이 제공되는 동안 같은 값을 재현할 수 있습니다. 이전 스냅샷 링크는 현재 데이터 사용을 명시적으로 선택해야 하며, 과거 값을 자동 복원하지 않습니다. 잘못된 코드·중복·허용되지 않은 파라미터는 거부합니다.
- **Use latest complete year**: 선택 국가들의 세 지표가 모두 보고된 최신 공통 연도를 찾습니다. 연도별 관측·결측 개수를 제공하고, 실제 연도 변경은 버튼을 눌러 적용합니다. 완결성은 값의 존재 여부이며 국가별 방법론의 동일성을 뜻하지 않습니다.
- **Calculated observations**: 선택한 지표·동일 연도의 국가 간 차이를 원본 정밀도로 계산해 퍼센트포인트(pp)로 표시합니다. 결측 쌍은 계산하지 않습니다. 국가 순위·원인·교육 효과는 추정하지 않습니다.
- 계산을 노트 초안으로 옮기면 출처·원본 수치·산식·스냅샷을 사용자 관찰·질문과 별도로 보존합니다. 다른 문맥의 미완성 초안이 있으면 덮어쓰지 않고 기존 초안을 엽니다. CSV·Markdown에도 계산과 원본 파일·레코드 인덱스를 포함합니다. 기존 스키마 1·2의 일반 메모는 계속 읽을 수 있습니다.

## 비교에서 후속 조사 계획으로

비교표와 국가 변경 버튼은 앞에 유지합니다. **Choose what to investigate next**에서 연결 비용·기기 접근·전력 안정성·학습 지원 중 조사할 조건을 고릅니다. 노트에서 대상 학습자·지역·수집할 근거·확인할 출처·조사 상태·근거가 영향을 줄 사업 판단을 기록합니다. 항목은 빈칸에서 시작하며, 도구가 지역 상황이나 원인을 만들어 입력하지 않습니다. 비교에서 시작하면 같은 국가·연도·지표·스냅샷의 계산 근거도 별도로 보존합니다.

기존 초안의 문맥이 다르거나 이미 계획이 있으면 덮어쓰지 않고 기존 초안을 엽니다. 조사 계획만으로도 저장·복원할 수 있고, 계산 근거를 제거해도 계획은 남습니다. **Not checked / In progress / Reviewed by you**는 사용자의 조사 상태이며, 도구가 출처 정확성이나 결론을 검증했다는 뜻이 아닙니다.

예시 사용 흐름은 ‘케냐의 보고된 2022년 인터넷 이용률 확인 → 연결 비용 조사 선택 → 대상 지역과 학습자 지정 → 현지 요금표·인터뷰 등 필요한 자료 명시 → 자료 확인 후 교육 전달 방식 검토’입니다. 이 예시는 실제로 수집한 현지 자료나 지원 대상국 추천이 아닙니다. 국가 지표들을 같은 개인의 상황처럼 결합해 해석하지 않습니다.

수업과의 연결은 데이터 출처·검증 원칙을 교육 접근 문제에 적용했다는 점입니다. 상거래 공급망 추적이나 자동화의 정책 효과를 분석하는 기능은 없습니다. [실행 프롬프트·검토 기록](docs/research-workflow-improvement-2026-11-05.json)은 자체 구현 기록이며 교수님의 실제 요청·평가·보증이 아닙니다.

## 작은 국가 검색과 지도 조작

지도 바로 위 **Find any country**에서 국가명·ISO2·ISO3 코드로 검색합니다. 큰 **Add to comparison** 버튼으로 비교에 추가하며, **Show on map**은 해당 국가의 실제 도형으로 확대하고 키보드 초점을 옮깁니다. 지도 보기는 비교에 추가하는 동작과 별개입니다. 3개 국가를 이미 선택했어도 다른 국가의 지도·상세 확인은 할 수 있습니다.

국가를 바꾸려면 지도 검색 결과·검색 표·국가 상세에서 아직 선택하지 않은 국가의 **Replace a country**를 누르고, 교체할 기존 국가를 고릅니다. 3개를 이미 선택한 상태에서도 먼저 삭제할 필요 없이 한 번에 교체합니다. 선택한 슬롯만 바뀌고 다른 국가의 순서·비교 국가 수·통계 기준 연도·지표는 유지합니다. **Cancel replacement** 또는 Escape로 닫으면 선택은 바뀌지 않습니다. 기존 메모·초안·조사 계획은 원래 국가·연도·스냅샷 문맥을 유지하며 교체한 국가로 다시 표시하지 않습니다.

현재 Natural Earth 지도는 도형 176개 중 170개가 선택 가능한 국가·경제 목록과 연결됩니다. 전체 목록 217개 중 **47개는 지도에 도형이 없습니다**. 싱가포르처럼 지도에 없는 국가도 검색 결과에 ‘Not drawn at this map scale’을 표시하고, **Inspect country**로 실제 통계를 확인하거나 비교에 추가할 수 있습니다. 확대해도 없는 경계가 생기지는 않으며 가짜 위치·확장 경계를 만들지 않습니다. 룩셈부르크 같은 작은 도형은 8배 확대해도 터치하기 작으므로 큰 검색·선택 버튼을 함께 사용합니다.

- **Zoom in / Zoom out**: 1~8배 확대·축소합니다.
- **Pan map** 네 방향 버튼과 확대 후 마우스 드래그로 이동합니다. 드래그 종료를 국가 선택으로 처리하지 않습니다.
- **Reset world view**: 전체 지도로 복원하며 비교 선택·노트는 유지합니다.
- 터치 화면은 이동 버튼을 사용합니다. 일반 페이지 스크롤을 막거나 휠로 자동 확대하지 않습니다.
- 지도 국가의 초점은 화살표 키로 이동하며 Enter/Space로 선택합니다. 화면 밖으로 이동한 키보드 대상도 표시합니다.
- 지도 초점·검색어는 임시 상태이며, 실제 비교 선택·연구 노트는 기존 브라우저 저장을 유지합니다.

국가 상세의 **Inspect saved source record**에서 수집 당시 원본·해시·레코드 인덱스를 펼쳐 확인할 수 있습니다. 표의 국가명을 눌러 상세를 확인하면 제목으로 키보드 초점을 옮깁니다. [실행 프롬프트와 검증 기록](docs/map-access-improvement-2026-11-05.json).

## 실제 확보한 데이터

수집은 **2026-11-04 뉴욕 시간**에 수행했습니다. 원본과 스냅샷에는 UTC 시각을 기록하므로 수집 기록의 날짜는 `2026-11-05`입니다. 수동 메타데이터 검토일은 `2026-11-04`이며 수집 명령이 이 날짜를 갱신하지 않습니다.

| 항목                    | 현재 스냅샷                 |
| ----------------------- | --------------------------- |
| 국가·경제               | 217개                       |
| 별도 분리한 집계 항목   | 79개: 세계·지역·소득집단 등 |
| 지표                    | 3개                         |
| 통계 기준 연도          | 2015~2025년                 |
| 국가×지표×연도 레코드   | 7,161개                     |
| 실제 수치가 있는 관측값 | 5,359개                     |
| 결측 레코드             | 1,802개                     |
| 원본 API 응답           | 14개, 파일별 SHA-256 보존   |

표본은 한국·인도·케냐의 2022년 인터넷 이용률로 먼저 확인한 뒤 전체 범위로 확장했습니다. 원본 응답과 요청 기록은 `data/raw/`에 보존합니다. 수집 명령을 다시 실행하면 실행별 보고서를 `reports/data-collection/`에 생성합니다. 합성 수치는 사용하지 않습니다.

| 지표                | 의미와 원제공기관                                                                       | 공식 정의                                                                                                                    |
| ------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `IT.NET.USER.ZS`    | 지난 3개월 내 인터넷 이용 인구 비율. ITU                                                | [World Bank metadata](https://databank.worldbank.org/metadataglossary/world-development-indicators/series/IT.NET.USER.ZS)    |
| `EG.ELC.ACCS.ZS`    | 전기에 접근 가능한 인구 비율. World Bank/ESMAP SDG 7.1.1                                | [World Bank metadata](https://databank.worldbank.org/metadataglossary/world-development-indicators/series/EG.ELC.ACCS.ZS)    |
| `SE.SEC.CMPT.LO.ZS` | 전기 중등교육 최종 학년 신규 진입자와 해당 연령 인구를 이용한 이수 대리지표. UNESCO UIS | [World Bank metadata](https://databank.worldbank.org/metadataglossary/world-development-indicators/series/SE.SEC.CMPT.LO.ZS) |

배포 창구는 **World Bank — World Development Indicators**이며 원제공기관은 위와 같이 구분합니다. 교육 지표는 연령이 다른 진입자를 포함하므로 **100%를 넘을 수 있고**, 최종 학년 중도탈락을 직접 반영하지 않는 대리지표입니다. 값을 100으로 잘라내지 않습니다.

수집 당시 한국·인도·케냐의 2022년 인터넷 이용률은 각각 `97.16855335`, `55.9`, `29.40589905`였습니다. UI는 최대 소수 1자리로 표시하고 CSV·MCP는 원본 수치 정밀도를 유지합니다. 이는 해당 스냅샷의 관측값으로, 현재 상태나 교육 효과를 의미하지 않습니다.

## 사용자 흐름과 해석

첫 화면은 비교 대상과 목적을 직접 설명하고, **국가 선택 → 같은 연도 비교 → 출처 확인·질문 저장**의 세 단계를 안내합니다. **Try Korea, India and Kenya (2022)** 버튼은 세 국가의 인터넷 이용률 비교를 바로 엽니다. 기존 작성 중 노트와 저장한 노트는 유지합니다. 본문 기본 크기는 16px이며, 작은 화면에서는 추세 차트를 가로로 스크롤할 수 있습니다.

구체적인 사용 사례는 **무료 온라인 교육 지원 사업 후보국을 검토할 때, 어떤 현지 접근 조건을 추가 조사할지 정리하기**입니다. 지원 국가를 자동 추천하거나 사업 성공을 예측하지 않습니다. 국가 데이터는 217개 국가·경제를 포함하며, 동시 비교만 차트 가독성을 위해 3개로 제한합니다. 비교 화면은 연도·선택 국가·**Change countries** 버튼과 세 지표 표에서 시작합니다. **Chart indicator**는 막대 차트 바로 위에 있으며 선택 결과가 인접한 차트에 반영됩니다. 짧은 조사 항목 선택은 계산 결과 직후에 있고, 긴 설명은 아래의 접힌 안내에 있습니다. 이 질문은 프로젝트의 고정된 연구 프롬프트이며 자동 분석 결과가 아닙니다.

현재는 세 지표만 포함하며 외부 CSV나 임의 데이터 결합 기능은 없습니다. 연결 비용·기기 접근·연결 품질·지역 격차를 추가하려면 원출처·정의·연도·국가 범위·라이선스를 먼저 검토해야 합니다. 사이드바의 의미 없는 세 장식 막대는 제거했고, 선택 상태·입력 경계·지도 구간의 대비를 강화했습니다.

1. **Choose other countries** 또는 **Country explorer**에서 지표와 기준 연도를 선택합니다. 초기 연도는 **2022년**이라는 고정된 공통 비교 시작점이며 ‘최신 연도’라는 뜻이 아닙니다. 2015~2025년으로 변경할 수 있습니다.
2. 지도 또는 검색 표에서 국가·경제를 2~3개 선택합니다. 초기 선택은 한국·케냐이며 비교 한도는 3개입니다. 검색한 나라의 **Replace a country**로 기존 비교 국가를 바로 교체할 수 있습니다. 선택 칩이나 **Clear countries**로 제거할 수도 있습니다.
3. **Compare countries**는 모든 국가에 동일한 연도를 적용합니다. 세 지표를 같은 연도로 비교하고, 선택한 지표의 시계열을 봅니다. 선은 결측 구간을 건너 연결하지 않습니다.
4. **Most recent value for each country**는 2015~2025년 중 국가별 최신 관측 연도를 따로 표시합니다. 이 값을 공통 연도 차트에 대입하지 않습니다.
5. **Sources & methods**에서 정의·원제공기관·배포기관·갱신일·수동 검토일·누락·라이선스·제외 집계 목록을 확인합니다.
6. **Research notebook**에서 관찰 내용과 추가 조사 질문을 분리해 작성합니다. 첫 입력 당시 국가·연도·지표·데이터셋을 초안에 기록하고, 이후 필터를 바꿔도 이 문맥으로 저장합니다. CSV와 Markdown으로 내보낼 수 있습니다.

인터넷 이용률은 연결 속도·요금·기기 보유·접근성·학습 참여를 직접 측정하지 않습니다. 전기 접근률은 안정적인 전력 공급을 뜻하지 않습니다. 교육 이수 지표는 교육의 질이나 개인의 능력을 평가하지 않습니다. 국가 평균은 지역·성별·소득·장애·도시/농촌 차이를 가릴 수 있습니다. 차이는 추가 조사의 단서이며 원인이나 정책 효과를 입증하지 않습니다.

## 저장과 내보내기

- **Export scope** 기본값은 **Current comparison only**입니다. 현재 세 지표의 수치·출처만 내보내고 초안·저장 노트·조사 계획은 제외합니다. **Comparison + matching notes**는 국가 집합·연도·차트 지표·스냅샷이 모두 같은 메모만 포함합니다. **Entire workspace**는 다른 비교와 과거 스냅샷, 문맥 미지정 초안까지 명시적으로 포함합니다. 포함할 메모 개수·설명이 화면에 표시되며 CSV·Markdown에도 범위를 기록합니다. 국가가 없어도 전체 작업공간 범위에서는 기존 기록을 내보낼 수 있습니다.
- 저장 키는 기존 `abundance-access:research:v1`을 유지하고 내부 스키마를 **2**로 갱신했습니다. 스키마 1의 저장 노트는 문맥과 함께 유지합니다. 원래 문맥을 기록하지 않았던 기존 초안은 내용을 보존한 채 문맥 미지정 상태로 복구하며, 사용자가 **Assign current selection to draft**로 명시적으로 연결하기 전까지 노트 추가를 제한합니다.
- 국가·지표·연도·검색·지역 필터·작성 중 노트·저장한 노트를 브라우저 `localStorage`에 보존합니다.
- 노트는 최대 100개이며, 관찰·질문 각각 6,000자까지 저장합니다. 다른 기기로 동기화하거나 서버에 전송하지 않습니다.
- **Reset research workspace**는 새 앱의 선택·노트·저장 키만 초기화합니다. 이전 `abundance-pathways:*` 키는 보존합니다.
- 필터와 초안 문맥이 다르면 초안의 원래 문맥과 **Return to draft selection**을 표시합니다. 노트 추가는 기록된 문맥을 사용하며 원래 데이터셋 ID도 보존합니다. 현재 데이터셋과 다를 때 현재 관측값을 초안 당시 값처럼 표시하지 않습니다. 초안을 저장하거나 완전히 비운 뒤 새로 입력하면 새 문맥을 기록합니다.
- 저장소 읽기 차단과 `setItem` 할당량 초과 모두 **Session only**로 표시합니다. 상단·노트 상태를 일치시키고 탭을 닫기 전 내보내기를 안내합니다. 노트 추가 알림은 작업 공간에 추가됐다는 뜻이며 영구 저장 성공을 단정하지 않습니다. 손상되거나 현재 국가 목록과 맞지 않는 저장 데이터는 기본값으로 복구합니다.
- CSV는 `export-metadata`, `observation`, `draft`, `saved-note`, `evidence-observation`, `calculated-comparison`, `investigation-plan`을 구분합니다. `exportScope`와 각 메모의 국가·연도·지표·스냅샷을 기록합니다. 조사 상태는 사용자 판단임을 명시합니다. 전체 작업공간 범위에서는 문맥 미지정 초안도 텍스트와 `unassigned` 상태로 내보냅니다. Markdown도 동일한 범위와 원래 문맥을 보존합니다.
- **Open saved raw response**는 검증한 Git 커밋에 고정된 원본 API 응답을 엽니다. SHA-256과 **0부터 시작하는 `response[1][index]`의 레코드 인덱스**를 표시합니다. 이는 파일 줄 번호가 아닙니다. 원본 해시는 파일 무결성을 확인하며 통계의 진실성을 입증하지 않습니다. 새 수집 후 원본·해시·커밋을 직접 확인한 뒤 `src/lib/provenance.ts`의 공개 스냅샷 레지스트리를 갱신합니다. 미등록·과거 스냅샷에 현재 원본 링크를 대신 붙이지 않습니다.
- 결측은 빈 값과 명시적인 상태로 내보냅니다. 0으로 바꾸지 않습니다. 사용자 텍스트는 CSV 따옴표와 스프레드시트 수식 주입 방어를 적용합니다.

## 데이터 수집·재현·검증

```sh
npm run data:fetch
npm run validate:data
npm run build
```

`data:fetch`는 공식 [World Bank Indicators API](https://datahelpdesk.worldbank.org/knowledgebase/articles/889392)를 사용합니다.

- 표본 확인 → 국가/집계 분리 → 지표 메타데이터 → 2015~2025년 통계 페이지 전체 수집.
- 요청당 8초 제한, 최대 3회 시도, 요청 시작 간 최소 1.1초 간격.
- 네트워크 오류·429·5xx만 제한적으로 재시도합니다. 지수 백오프와 최대 10초의 `Retry-After`를 반영합니다.
- 페이지 번호·총 페이지·총 행 수와 API 오류 응답을 확인합니다.
- 원본 응답은 `data/raw/<runId>/`에 보존하고 URL·수집 시각·바이트·SHA-256을 manifest에 기록합니다.
- 수치가 반환되지 않은 조합도 `reported-null` 또는 `not-returned`로 명시합니다. 앞선 연도의 값을 이월하지 않습니다.
- 성공한 스냅샷은 `data/snapshots/<runId>.json`과 `latest.json`으로 작성합니다. 실패하면 기존 `latest.json`을 덮어쓰지 않습니다.
- 성공·실패 보고서는 `reports/data-collection/<runId>.json`에 남습니다.
- 실패 시 공식 CSV 다운로드 경로의 접속 가능성도 확인합니다. 이 대체 경로 점검은 CSV 수집·정규화 성공으로 간주하지 않습니다. 검증된 스냅샷을 확보하지 못하면 숫자를 만들어 넣지 않습니다.

`validate:data`는 스키마, 중복, 전체 국가×지표×연도 격자, 집계 혼입, 단위·원제공기관, 원본 참조와 해시를 검사합니다. 반환된 모든 정상화 값·국가·연도·지표를 원본 행과 다시 대조합니다. **처리와 출처의 일치를 검사하는 것이며 외부 통계 자체의 진실을 입증하는 검사는 아닙니다.**

표준 관측값에는 `countryCode`, `countryName`, `indicatorCode`, `year`, `value`, `unit`, `sourceOrganization`, `distributor`, `sourceUrl`, `fetchedAt`, `sourceUpdatedAt`, `status`, `rawFile`, `rawRow`, `sourceStatus`를 보존합니다.

## 메타데이터 편집과 지표 추가

`src/content/indicators.json`은 수동 검토한 설명·정의·한계·원제공기관·라이선스와 **수동 검토일**을 보존합니다. `src/content/en.ts`는 영문 UI 문구를 관리합니다.

새 지표를 추가하려면 먼저 공식 정의·단위·원제공기관·라이선스·결측·기간·국가 간 비교 가능성을 검토합니다. 그다음 아래를 함께 변경합니다.

1. `src/lib/schema.ts`의 지표 allowlist와 지표 개수·격자 검증.
2. `indicators.json`의 정의·한계·연결 근거 및 수동 검토 기록.
3. 수집기의 지표·기간과 값 범위 검증. 비율이라는 이유만으로 0~100 제한을 적용하지 않습니다.
4. 지도 구간·차트 축·단위·MCP 도구 입력과 내보내기.
5. 관련 단위·통합·브라우저 검증 후 새 스냅샷 수집.

관측 데이터를 손으로 보정하거나 결측을 채워 공식값처럼 표시하지 않습니다. API 수집은 수동 검토일을 바꾸지 않습니다.

## 세계지도

[Natural Earth Admin 0 Countries 1:110m](https://www.naturalearthdata.com/downloads/110m-cultural-vectors/110m-admin-0-countries/)의 공개 도메인 경계 데이터를 사용합니다. [이용 조건](https://www.naturalearthdata.com/about/terms-of-use/)

- 원본: `data/raw/natural-earth-110m.geojson`.
- 변환: `npm run data:map`; 결과 `src/content/world-map.json`.
- 원본 해시·수집/변환 시각·변환 규칙: `data/map-provenance.json`.
- Antarctica는 제외하고 원래 좌표를 유지합니다. 기존 World Bank·ISO·ADM0 속성을 현재 World Bank 국가 코드와 대조하며 Kosovo의 KOS/KSV 표기는 XKX에 연결합니다.
- 작은 경제·영토 등 이 축척에 없는 대상은 검색 표에서 선택할 수 있습니다. 소스에 있으나 현재 World Bank 목록과 연결되지 않은 경계는 그 상태를 표시합니다.
- 지도는 통계 탐색용이며 주권·국경 분쟁에 대한 입장을 뜻하지 않습니다.
- 지도는 방향키·Home·End로 탐색하고 Enter/Space로 선택할 수 있습니다. 검색 표도 동일한 지표·연도 값을 제공합니다.

## 로컬 MCP 서버

설정 없이 한국·인도·케냐 비교를 직접 실행하려면 다음 명령을 사용합니다. 실제 MCP 클라이언트가 서버를 실행해 세 지표의 정의를 조회하고 `compare_countries`를 호출합니다. 숫자를 파일에서 직접 읽어 출력하는 대체 경로는 사용하지 않습니다.

```sh
npm run mcp:demo          # 2022년 비교
npm run mcp:demo -- 2023  # 다른 공통 연도 (2015~2025)
```

터미널에 비교표를 출력하고 실제 도구 응답과 출처를 `reports/mcp-demo-<year>.json`에 보존합니다. 이 명령은 대화형 AI나 전역 MCP 설정을 변경하지 않습니다. `npm run mcp`만 실행하면 자연어 질문을 받는 화면이 나타나는 것이 아니라 stdio 메시지를 기다립니다.

MCP는 웹사이트와 별도인 **로컬 stdio 서버**입니다. 실제 수집한 `latest.json`을 읽으며 도구 호출 때 외부 API를 조회하거나 데이터를 갱신하지 않습니다. 대시보드와 동일한 `src/lib/query.ts`를 사용합니다. 메모리·노트·전역 클라이언트 설정을 수정하는 도구는 없습니다.

공식 TypeScript SDK `@modelcontextprotocol/server` / `@modelcontextprotocol/client` **2.4.0**을 사용했습니다. 서버는 `serveStdio` factory로 2025 계열과 2026-07-28 계열 연결을 지원합니다. [공식 서버 가이드](https://modelcontextprotocol.io/docs/develop/build-server) · [공식 SDK](https://github.com/modelcontextprotocol/typescript-sdk)

```sh
npm run mcp
```

직접 실행하면 클라이언트의 stdio 메시지를 기다립니다. 로그는 stderr로 보내며 stdout은 MCP 통신에만 사용합니다. 중지하려면 Ctrl+C를 누릅니다.

| 도구                     | 입력·반환                                                                           |
| ------------------------ | ----------------------------------------------------------------------------------- |
| `list_countries`         | `query`, `offset`, `limit`(최대 100). 국가·경제 목록과 페이지 정보; 집계 제외       |
| `get_indicator_metadata` | `indicatorCode`. 원제공기관·공식 API 메타데이터·수동 검토 정의·방법론·한계·라이선스 |
| `get_country_metrics`    | `countryCode`, `indicatorCodes`, `startYear`, `endYear`. 최대 33개 연간 레코드      |
| `compare_countries`      | 서로 다른 국가 코드 2~3개, 지표 코드 1~3개, 공통 `year`. 최대 9개 비교 레코드       |

지표 코드는 allowlist로 제한하고 국가·중복·연도·범위를 검증합니다. 응답에는 값·단위·연도·출처·수집 시각·결측 상태·데이터셋 ID와 해석 한계가 포함됩니다. 다른 연도의 최신값을 공통 연도에 대신 넣지 않습니다.

예시 `tools/call` 인수:

```json
{
  "name": "compare_countries",
  "arguments": {
    "countryCodes": ["KOR", "IND", "KEN"],
    "indicatorCodes": ["IT.NET.USER.ZS", "EG.ELC.ACCS.ZS"],
    "year": 2022
  }
}
```

### 클라이언트 연결 예시

다음 명령은 현재 체크아웃의 실제 절대 경로로 설정 예시를 **출력만** 합니다. 사용자 전역 설정을 수정하지 않습니다.

```sh
node --import tsx scripts/mcp-config.ts
```

출력 형식은 다음과 같습니다. 사용하는 클라이언트의 MCP 설정 위치에 맞게 사용자가 등록합니다. `node`와 tsx loader를 절대 경로로 지정하므로 클라이언트의 작업 디렉터리에 의존하지 않습니다.

```json
{
  "mcpServers": {
    "abundance-access": {
      "command": "/ABSOLUTE/PATH/TO/node",
      "args": [
        "--import",
        "/ABSOLUTE/PROJECT/node_modules/tsx/dist/loader.mjs",
        "/ABSOLUTE/PROJECT/mcp/server.ts"
      ]
    }
  }
}
```

실제 프로토콜 검증:

```sh
npm run test:mcp
```

공식 SDK 클라이언트가 서버 프로세스를 실행해 stdio 연결·도구 목록·네 가지 도구 호출·잘못된 입력 거부·결측 처리·대시보드 공통 조회 결과와의 일치를 검사합니다. 구형·신형 프로토콜을 각각 확인하고 `reports/mcp-verification.json`을 작성합니다. 이는 실제 도구 통신 검증이며 특정 대화형 AI 호스트의 UI 연결이나 답변 품질을 검증한 것은 아닙니다.

## 브라우저 검증

GitHub CI는 고정된 의존성 버전의 Playwright 브라우저를 설치하고, 호스팅된 Ubuntu 이미지에 이미 있는 실행 라이브러리·Liberation 글꼴을 사용합니다. 실행 로그에서 추가 글꼴 21.9MB 다운로드가 수 분 지연되는 것을 확인해 CI의 일괄 시스템 의존성 설치를 제거했습니다. 실제 브라우저 실행과 전체 데스크톱·모바일 테스트는 그대로 수행합니다. 향후 실행 이미지에서 필요한 라이브러리가 빠지면 해당 의존성을 설치한 후 다시 검증해야 합니다.

```sh
npx playwright install chromium
npm run test:e2e
```

설치된 Chrome을 사용하려면 macOS에서 `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e`를 실행합니다.

테스트는 빌드 결과를 `/abundance-access/` 하위 경로에만 제공하는 엄격한 정적 서버를 실행합니다. 데스크톱 1440×1000·모바일 390×844에서 국가 선택→공통 연도 비교→추세→노트→내보내기→복구→초기화, 지도/표 값 일치, 결측·100 초과 표시, 키보드·저장 차단·스냅샷 실패/재시도·하위 경로 새로고침을 확인합니다. axe 자동 접근성 검사는 전체 보조기술 사용성을 보증하지 않습니다.

검증 결과는 `playwright-report/`, 화면 캡처는 `reports/screenshots/`에 생성됩니다. GitHub Actions의 실패 보고서도 해당 실행에서 확인할 수 있습니다.

검증 구성은 단위 테스트 67개와 데스크톱·모바일 브라우저 사례 66개이며, 국가 직접 교체·취소·기존 메모 문맥 보존을 포함합니다. 실행 결과는 테스트 보고서와 GitHub Actions에서 확인합니다. 실행 프롬프트와 세 차례 검토·수정 기록은 [구현·검토 기록](docs/improvement-review-2026-11-05.json)에 있습니다. 교수님의 실제 검토·평가·보증이 아니라 공개 강의 소개의 근거·한계·실용성 기준을 적용한 자체 검토입니다.

## 출처·링크 점검과 라이선스

세 지표의 World Bank glossary는 각각 CC BY 4.0으로 표기합니다. [현재 World Bank 데이터 이용 조건](https://www.worldbank.org/ext/en/legal/terms-conditions/datasets)의 추가 조건과 제공기관 표시를 함께 유지합니다. 새 지표의 제3자 예외는 별도로 확인해야 합니다. 지표 메타데이터에 남은 옛 라이선스 URL이 404인 것을 링크 점검으로 발견했고, 현재 공식 약관을 직접 읽은 뒤 링크를 수동 수정했습니다. 원본 응답은 그대로 보존했습니다.

```sh
npm run check:links
```

공식 정의·제공기관·문서·라이선스 링크를 중복 제거해 순차 점검합니다. 요청당 8초, 최대 3회 시도, 최소 1.1초 간격, 최대 10초 백오프를 적용합니다. 403·405·501 HEAD는 제한된 GET으로 재확인합니다. 401/403은 `restricted`, 429는 `rate-limited`, 네트워크·시간 초과·5xx는 `transient`로 보고하며 자동 삭제하지 않습니다.

보고서는 `reports/link-check-*.json/.md`와 `latest.json`입니다. HTTP 성공은 당시 접속 성공이며 정의·정확성·교육 효과의 재검토가 아닙니다. 일부 원제공기관 사이트가 403을 반환하더라도 World Bank API 수집 성공과 구분합니다. 링크 점검은 콘텐츠나 수동 검토일을 바꾸지 않습니다.

## GitHub Actions·Pages

GitHub 저장소와 Pages 배포를 위한 워크플로가 포함돼 있습니다. 실제 실행 상태는 저장소의 Actions 탭에서 확인합니다:

- `ci.yml`: PR·push에서 타입·스키마·원본 대조·단위 테스트·실제 MCP 통신·브라우저 흐름·빌드.
- `link-check.yml`: 기존 매주 월요일 14:17 UTC 예약과 수동 실행 유지. 링크 상태만 점검하고 보고서를 artifact로 보관합니다.
- `collect-data.yml`: **수동 실행만** 제공. 공식 통계 수집·검증 결과와 원본을 artifact로 보관하며 자동 커밋·배포·수동 검토일 갱신을 하지 않습니다.
- `pages.yml`: 수동 배포. Settings → Pages → Source를 GitHub Actions로 설정하고 저장소·환경 권한을 확인해야 합니다.

Vite의 `base`는 `./`이고 탐색은 `#overview`, `#explore`, `#compare`, `#methodology`, `#notes`입니다. 저장소 이름을 하드코딩하지 않습니다. 하위 경로 루트 주소는 `/`로 끝나야 합니다. 고정 base가 필요하면 `BASE_PATH=/repository-name/ npm run build`를 사용합니다.

타입·데이터·단위·MCP·브라우저 검사를 로컬에서 실행했습니다. 원격 검사·배포의 실제 결과는 GitHub Actions에 기록합니다. 수집 시각과 수동 검토일은 배포 과정에서 갱신하지 않습니다.

## 파일 구조

```text
src/content/indicators.json       수동 검토 정의·한계·출처
src/content/en.ts                 영문 UI 문구
src/content/world-map.json        Natural Earth 경계 변환본
src/lib/schema.ts                 데이터 구조·관계 검증
src/lib/query.ts                  UI·MCP 공통 조회
src/lib/research.ts               개인화·노트 저장 검증
src/lib/export.ts                 CSV·Markdown 내보내기
src/components/                  지도·탐색·비교·방법론·노트
scripts/collect-data.ts           수동 공식 API 수집
scripts/world-bank.ts             원본 파싱·정규화·요청 정책
scripts/validate-data.ts          원본 해시·행 대조
scripts/prepare-map.ts            지도 코드 연결·변환
scripts/test-mcp.ts               실제 stdio 통합 검증
scripts/mcp-config.ts             절대 경로 설정 예시 출력
mcp/server.ts                    읽기 전용 MCP 서버
data/raw/                        원본 API·경계 데이터
data/snapshots/                  공식 통계 스냅샷
data/map-provenance.json          지도 변환·출처 기록
reports/                         수집·MCP·링크·브라우저 검증
```

`reports/`는 수집·MCP·링크 검사 명령을 실행할 때 생성되며 저장소에 포함하지 않습니다. 브라우저 검사는 `playwright-report/`와 `test-results/`를 생성합니다.

## 알려진 한계

- 수집 시점의 연간 국가·경제 통계이며 실시간 관측이 아닙니다. 2025년 등 최근 연도의 결측이 많을 수 있습니다.
- 원본과 정상화 값의 일치는 확인했지만 외부 통계 정확성·모든 국가 방법론의 동등성·수정 이력을 독립적으로 검증하지 않았습니다.
- 국내 지역·성별·소득·장애·학습비용·기기·언어·교육 콘텐츠 접근성 등을 직접 측정하지 않습니다.
- 지도에 없는 소규모 경제는 표로 탐색합니다. 경계와 경제 코드가 완전히 일대일로 대응하지 않습니다.
- 국가 종합 점수, 정책 자동 추천, 교육·고용 효과의 인과 분석, 개인 학습 경로·시험은 제공하지 않습니다.
- 노트는 로컬 저장이며 기기 동기화·로그인·서버 백업이 없습니다.
- MCP는 수집한 스냅샷 조회용입니다. 자연어 해석은 연결한 AI 클라이언트의 역할이며 이 앱이 사실성을 보증하지 않습니다.
- 모바일 검증은 Chrome 에뮬레이션입니다. 모든 실제 기기·스크린 리더 조합은 확인하지 않았습니다.
