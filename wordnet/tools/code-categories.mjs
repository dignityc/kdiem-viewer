// Reviewed membership, not a suffix-based classifier. Source records stay intact.
export const codeCategories = [
  { key: 'unit-code', label: '부대 식별 코드', gloss: '특정 부대를 구별하거나 참조하기 위해 부여하는 코드.',
    rationale: '부대의 종류나 역할을 분류하는 값이 아니라 어느 부대인지를 구별하는 공통 기능으로 묶었다.',
    terms: ['적부대코드','상급부대코드','첩보수집부대구분코드','등록부대코드','보고부대코드','수신부대코드','요청부대코드','비행대대부대코드','수집부대코드','사격부대코드','표적정보지등록부대코드'] },
  { key: 'source-code', label: '출처 구분 코드', gloss: '정보나 표적 등을 얻은 출처를 구분하여 나타내는 코드.',
    rationale: '원문 정의가 공통으로 정보 또는 표적의 획득 출처를 구분한다고 명시한다.',
    terms: ['인간정보출처코드','표적획득출처코드'] },
  { key: 'direction-code', label: '방향 구분 코드', gloss: '대상이나 현상의 방향을 구분하여 나타내는 코드.',
    rationale: '원문 정의가 각각 바람의 방향과 표적의 이동 방향을 구분한다고 명시한다. 각도값이나 동일한 코드값 체계라고 가정하지 않는다.',
    terms: ['풍향코드','표적이동방향코드'] },
];

export function addCodeCategories({nodes,edges}) {
  const code='synset:curated:code', key=e=>`${e.source}\u0001${e.target}\u0001${e.type}`;
  if(!nodes.has(code))throw new Error('Code root missing');
  const add=e=>edges.set(key(e),{...e,id:key(e)}),decisions=[];
  for(const category of codeCategories){
    const id=`synset:curated:${category.key}`,lexical=`lex:curated:${category.key}`,sense=`sense:curated:${category.key}`;
    const members=category.terms.map(term=>{
      const matching=[...nodes.values()].filter(n=>n.kind==='synset'&&n.label===`{${term}}`);
      if(matching.length!==1)throw new Error(`Ambiguous category member: ${term}`);
      const n=matching[0],sourceEdge=[...edges.values()].find(e=>e.type==='documentsMeaning'&&e.target===n.id),record=nodes.get(sourceEdge?.source);
      if(!record||!edges.has(key({source:n.id,target:code,type:'hypernym'})))throw new Error(`Missing source or code parent: ${term}`);
      return {term,meaningId:n.id,recordId:record.id,definition:n.gloss,definitionBasis:n.glossStatus==='ai_inferred'?'ai_inferred':'source_defined',source:record.evidence,sourceDefinition:record.gloss||''};
    });
    const inferred=members.filter(m=>m.definitionBasis==='ai_inferred').length;
    const evidence=`${category.rationale} 원문 정의 기반 ${members.length-inferred}개, AI 추정 정의 기반 ${inferred}개. 대상: ${category.terms.join(', ')}.`;
    const common={gloss:category.gloss,glossStatus:'editorial',reviewStatus:'editorial',source:'AI가 추가한 분류 개념',evidence,reviewNote:evidence,reviewedAt:'2026-09-14',pos:'n'};
    nodes.set(id,{id,kind:'synset',label:`{${category.label}}`,search:category.label,...common});
    nodes.set(lexical,{id:lexical,kind:'lexical',label:category.label,...common});
    nodes.set(sense,{id:sense,kind:'sense',label:`${category.label} · 의미 1`,...common});
    const provenance='코드 의미 분류 · AI 판단 · 2026-09-14';
    add({source:lexical,target:sense,type:'hasSense',provenance,evidence});
    add({source:sense,target:id,type:'senseOf',provenance,evidence});
    add({source:id,target:code,type:'hypernym',reviewStatus:'editorial',provenance,evidence:category.gloss,evidenceRef:id,weight:1000});
    for(const member of members){
      add({source:member.meaningId,target:id,type:'hypernym',reviewStatus:'ai_inferred',provenance,
        evidence:`${member.definitionBasis==='ai_inferred'?'AI 추정 정의':'원문 정의'}: ${member.definition} 분류 판단: ${category.rationale}`,
        evidenceRef:member.meaningId,definitionBasis:member.definitionBasis,sourceRef:member.recordId,weight:1000});
      // The original general relation remains valid. Navigate via the more specific concept.
      edges.get(key({source:member.meaningId,target:code,type:'hypernym'})).navigationVia=id;
    }
    decisions.push({id,label:category.label,definition:category.gloss,rationale:category.rationale,sourceDefinedMembers:members.length-inferred,aiInferredMembers:inferred,members});
  }
  return decisions;
}
