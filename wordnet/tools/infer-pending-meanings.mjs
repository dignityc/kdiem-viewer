import { additionalConcepts, meaningDecisions, pendingDecisions } from './ai-meaning-decisions.mjs';

export function inferPendingMeanings({ nodes, edges }) {
  const records = [...nodes.values()].filter(n => n.kind === 'record' && n.reviewStatus === 'needs_review');
  const decisions = new Map(meaningDecisions.map(d => [d.term, d]));
  const expected = new Set([...decisions.keys(), ...Object.keys(pendingDecisions)]);
  if (records.length !== expected.size || records.some(r => !expected.has(r.label))) throw new Error('Pending review coverage changed');
  if (decisions.size !== meaningDecisions.length) throw new Error('Duplicate AI decision');
  const addEdge = e => {
    if (!nodes.has(e.source) || !nodes.has(e.target)) throw new Error('AI edge missing endpoint');
    const id = `${e.source}\u0001${e.target}\u0001${e.type}`;
    edges.set(id, { ...e, id });
  };
  for (const [key, label, gloss] of additionalConcepts) {
    const id = `synset:curated:${key}`, lexical = `lex:curated:${key}`, sense = `sense:curated:${key}`;
    const common = { gloss, source: 'AI가 추가한 분류 개념', evidence: '2026-09-08 · AI 추정 의미를 분류하기 위해 추가함. MDR 원문 정의 아님.', reviewStatus: 'editorial', glossStatus: 'editorial', pos: 'n' };
    nodes.set(id, { id, kind: 'synset', label: `{${label}}`, search: label, ...common });
    nodes.set(lexical, { id: lexical, kind: 'lexical', label, ...common });
    nodes.set(sense, { id: sense, kind: 'sense', label: `${label} · 의미 1`, ...common });
    addEdge({ source: lexical, target: sense, type: 'hasSense', provenance: common.source, evidence: common.evidence });
    addEdge({ source: sense, target: id, type: 'senseOf', provenance: common.source, evidence: common.evidence });
  }
  const reviewed = [];
  for (const record of records) {
    const decision = decisions.get(record.label);
    const basis = { source: record.evidence, sourceDefinition: record.gloss || '', english: record.alt || '', setExamples: record.setExamples || [], fieldExamples: record.fieldExamples || [] };
    if (!decision) {
      record.reviewNote = pendingDecisions[record.label];
      record.reviewedAt = '2026-09-08';
      reviewed.push({ term: record.label, status: 'needs_review', reason: record.reviewNote, ...basis });
      continue;
    }
    record.reviewStatus = 'source_record';
    record.reviewNote = 'AI가 문맥으로 추정한 의미를 별도로 연결했다. 이 레코드의 원문 정의·필드 사용 횟수·도메인은 그대로 보존한다.';
    const id = `synset:ai:${record.id}`, sense = `sense:ai:${record.id}`;
    const lexical = [...edges.values()].find(e => e.type === 'hasRecord' && e.target === record.id && nodes.get(e.source)?.label === record.label)?.source;
    if (!lexical) throw new Error(`Missing lexical record: ${record.label}`);
    const common = {
      gloss: decision.definition, glossStatus: 'ai_inferred', reviewStatus: 'ai_inferred',
      source: 'KMTF 사용 문맥·MDR 속성 기반 AI 추정', evidence: record.evidence,
      reviewNote: [decision.rationale, decision.note].filter(Boolean).join(' '),
      reviewedAt: decision.reviewedAt, pos: '명사형 데이터 요소명',
      sourceQuote: record.gloss || undefined,
    };
    nodes.set(id, { id, kind: 'synset', label: `{${record.label}}`, search: `${record.label} ${record.alt}`, alt: record.alt, ...common });
    nodes.set(sense, { id: sense, kind: 'sense', label: `${record.label} · AI 추정 의미`, ...common });
    const provenance = '문맥 기반 AI 추정 · 2026-09-08';
    addEdge({ source: lexical, target: sense, type: 'hasSense', provenance, evidence: '현재 확인된 사용 문맥에서 추정한 작업 의미.' });
    addEdge({ source: sense, target: id, type: 'senseOf', provenance, evidence: '추정 의미 연결. MDR 공식 정의가 아님.' });
    addEdge({ source: record.id, target: id, type: 'documentsMeaning', provenance, evidence: '원문과 사용 문맥을 근거로 추정함. 전체 사용 행의 의미를 확정한 매핑은 아님.' });
    addEdge({ source: id, target: `synset:curated:${decision.parent}`, type: 'hypernym', reviewStatus: 'ai_inferred', provenance, evidence: decision.rationale, evidenceRef: id, weight: 1000 });
    reviewed.push({ ...decision, ...basis, meaningId: id, recordId: record.id });
  }
  const synsets = [...nodes.values()].filter(n => n.kind === 'synset');
  return {
    aiReviewedRecords: reviewed.length, aiInferredMeanings: decisions.size,
    pendingRecords: records.length - decisions.size,
    sourceBasedMeanings: synsets.filter(n => !['editorial', 'ai_inferred'].includes(n.reviewStatus)).length,
    draftMeanings: synsets.filter(n => n.reviewStatus !== 'editorial').length,
    editorialConcepts: synsets.filter(n => n.reviewStatus === 'editorial').length,
    reviewDecisions: reviewed,
  };
}
