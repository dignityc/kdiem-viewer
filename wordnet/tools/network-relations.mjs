// Explicit conceptual links; a related edge asserts association, never synonymy.
const links = [
  ['altitude','length','hypernym','수직 방향의 길이','고도는 기준면에 대한 수직 높이이고 높이는 길이의 한 형태다. 두 작업 정의를 근거로 상위 개념을 연결했다.'],
  ['datetime','date','related','시간 표현','일시는 날짜와 시각을 함께 나타낸다. 날짜는 일시와 연관되지만 같은 개념은 아니다.'],
  ['datetime','time','related','시간 표현','일시와 시각은 시점을 표현하는 서로 다른 정보다. 날짜 포함 범위를 구분한다.'],
  ['date','year','related','달력 표현','날짜와 연도는 달력상의 시점을 서로 다른 상세 수준으로 나타낸다. 연도를 날짜의 하위어로 단정하지 않는다.'],
  ['coordinate','angle','related','공간 표현','좌표는 위치를, 각도는 방향 사이의 벌어짐을 나타낸다. 위치와 방향을 함께 기술하는 공간 정보로 연결했다.'],
  ['coordinate','length','related','공간 표현','좌표는 위치를, 길이는 거리나 크기를 나타낸다. 좌표값 자체를 거리로 해석하지 않는다.'],
  ['coordinate','spatial-code','related','위치 표현','좌표와 공간 구분 코드는 위치·구역을 표현하는 서로 다른 수단이다. 서로 변환 가능하다고 주장하지 않는다.'],
  ['speed','length','related','이동과 거리','속도는 이동·전파의 빠르기이고 길이는 이동 거리를 설명한다. 개념적 관련성만 연결하며 환산식·단위는 추가하지 않았다.'],
  ['quantity','number','related','수량과 식별 구분','수량은 양을 나타내고 번호는 구별·순서를 나타낸다. 숫자 표현 때문에 혼동하기 쉬운 두 역할을 비교하기 위한 관련 관계다.'],
  ['quantity','coefficient','related','계산의 값과 비중','계수는 계산에서 값에 적용할 비중이나 배율이고 수량은 계산의 대상이 될 수 있는 양이다. 두 개념을 동일시하지 않는다.'],
  ['coefficient','index','related','수치 평가','계수는 반영 비중, 지수는 수준을 나타내는 지표다. 평가에서의 상이한 역할을 비교하는 관련 관계이며 특정 산식을 주장하지 않는다.'],
  ['symbol','name','related','대상 표현','부호와 명칭은 대상을 표현하거나 구별하는 서로 다른 방식이다. 명칭 전체가 부호의 하위어라는 주장은 하지 않는다.'],
  ['name','text','related','이름과 설명','명칭은 대상을 부르는 이름이고 설명문은 내용을 서술한다. 이름과 설명의 역할을 구분하기 위한 관련 관계다.'],
  ['path','name','related','파일 이름과 위치','영상파일명·물리적영상파일경로처럼 파일의 이름과 저장 위치를 함께 기술한다. 파일 경로를 명칭의 하위어로 연결하지 않는다.'],
  ['version','identifier','related','자료 식별과 개정','문서 식별자는 문서를 구별하고 버전 정보는 개정 상태를 구별한다. 하나의 문서와 그 판본을 구분하는 관련 개념이다.'],
  ['boolean','state-code','related','상태 표현','여부 정보는 성립 여부를, 상태 분류 코드는 상태 범주를 표현한다. 이진값과 상태코드의 값 체계를 동일시하지 않는다.'],
];

export function addNetworkRelations({nodes,edges}) {
  const result=[];
  for (const [a,b,type,label,evidence] of links) {
    const source=`synset:curated:${a}`,target=`synset:curated:${b}`;
    if(!nodes.has(source)||!nodes.has(target)) throw new Error('Missing reviewed concept');
    const id=`${source}\u0001${target}\u0001${type}`;
    const e={id,source,target,type,label,evidence,reviewStatus:'ai_inferred',provenance:'개념 정의 비교 · AI 판단 · 2026-09-14',evidenceRef:source,weight:type==='hypernym'?1000:300};
    edges.set(id,e);result.push(e);
  }
  return result;
}
