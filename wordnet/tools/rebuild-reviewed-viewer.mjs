import fs from 'node:fs';
import { inferPendingMeanings } from './infer-pending-meanings.mjs';
import { addNetworkRelations } from './network-relations.mjs';
import { addCodeCategories } from './code-categories.mjs';
import { renderNetwork } from './render-network.mjs';

// Rebuild from the preserved source-context snapshot. Does not alter source XLSX.
const output = new URL('../', import.meta.url);
const before = new URL('archive/2026-09-08-before-ai/', output);
const data = JSON.parse(fs.readFileSync(new URL('graph.json', before), 'utf8'));
const previousAudit = JSON.parse(fs.readFileSync(new URL('semantic-audit.json', before), 'utf8'));
const nodes = new Map(data.nodes.map(n => [n.id, n]));
const edges = new Map(data.edges.map(e => [`${e.source}\u0001${e.target}\u0001${e.type}`, e]));
const { reviewDecisions, ...reviewStats } = inferPendingMeanings({ nodes, edges });
const networkReview = addNetworkRelations({ nodes, edges });
const codeCategoryReview = addCodeCategories({ nodes, edges });
data.nodes = [...nodes.values()];
data.edges = [...edges.values()].map(({ id, ...e }) => e);
Object.assign(data.stats, reviewStats, {
  needsReview: reviewStats.pendingRecords,
  editorialConcepts: data.nodes.filter(n => n.kind === 'synset' && n.reviewStatus === 'editorial').length,
  hypernyms: data.edges.filter(e => e.type === 'hypernym').length,
  relatedRelations: data.edges.filter(e => e.type === 'related').length,
  synsets: data.nodes.filter(n => n.kind === 'synset').length,
  senses: data.nodes.filter(n => n.kind === 'sense').length,
  lexicalEntries: data.nodes.filter(n => n.kind === 'lexical').length,
});
const fragment = renderNetwork(data);
fs.writeFileSync(new URL('reviewed-fragment.html', output), fragment);
const outer = fs.readFileSync(new URL('viewer.html', before), 'utf8');
const encoded = outer.match(/srcdoc="([\s\S]*?)"><\/iframe>/)[1];
const decode = s => s.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const escape = s => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
let inner = decode(encoded);
const start = inner.indexOf('<div id="kmtf-domain-wordnet">');
const end = inner.lastIndexOf(');</script>\n</div>') + ');</script>\n</div>'.length;
if (start < 0 || end < start) throw new Error('Viewer fragment boundary missing');
inner = inner.slice(0, start) + fragment + inner.slice(end);
fs.writeFileSync(new URL('index.html', output), outer.replace(encoded, escape(inner)));
fs.writeFileSync(new URL('graph.json', output), JSON.stringify(data, null, 2));
const audit = {
  ...previousAudit, ...data.stats, reviewedAt: '2026-09-08', networkUpdatedAt: '2026-09-14',
  reviewBasis: 'Preserved MDR records, English names, domains and up to three KMTF set/field examples; no source definitions overwritten.',
  reviewDecisions, networkReview, codeCategoryReview,
  decisions: previousAudit.decisions.map(d => {
    const r = reviewDecisions.find(r => r.term === d.term);
    return r ? { ...d, status: r.status, parent: r.parent || null, note: r.reason || r.note || r.rationale, inferredDefinition: r.definition || null } : d;
  }),
  relations: data.edges.filter(e => e.type === 'hypernym'),
  meanings: data.nodes.filter(n => n.kind === 'synset').map(n => ({ id: n.id, label: n.label, definition: n.gloss, status: n.reviewStatus, note: n.reviewNote })),
  validation: { status: 'pending' },
};
fs.writeFileSync(new URL('semantic-audit.json', output), JSON.stringify(audit, null, 2));
const cell = s => String(s || '').replace(/\|/g, ' / ').replace(/\n/g, ' ');
const rows = reviewDecisions.map(d => `| ${cell(d.term)} | ${d.status === 'ai_inferred' ? 'AI 추정' : '보류'} | ${cell(d.definition)} | ${cell(d.parent ? nodes.get(`synset:curated:${d.parent}`).label : '')} | ${cell(d.reason || [d.rationale,d.note].filter(Boolean).join(' '))} | ${cell(d.source)}; ${cell(d.english)}; ${cell(d.fieldExamples.join('; '))}; ${cell(d.setExamples.join('; '))} |`);
fs.writeFileSync(new URL('ai-review-2026-09-08.md', output), `# KMTF–MDR 미확정 항목 재검토\n\n2026-09-08. 기존 161개 중 AI 추정 정의 ${reviewStats.aiInferredMeanings}개, 보류 ${reviewStats.pendingRecords}개. 원문 기반 의미 121개와 원문 레코드는 보존했다.\n\nAI가 한글·영문명, MDR 도메인, 최대 3개의 KMTF 세트·필드 예시를 함께 읽고 판단했다. 아래 정의는 AI 추정이며 MDR 공식 정의가 아니다. 전체 사용 행을 개별 검토하거나 단위·코드값·산식을 확정한 결과는 아니다.\n\n| 용어 | 판정 | AI 추정 정의 | 상위 개념 | 판단 근거 또는 보류 이유 | 원본 및 사용 문맥 |\n|---|---|---|---|---|---|\n${rows.join('\n')}\n`);
console.log(JSON.stringify({ ...reviewStats, editorialConcepts: data.stats.editorialConcepts, graphNodes: data.nodes.length, graphEdges: data.edges.length, viewerBytes: fs.statSync(new URL('index.html', output)).size }, null, 2));
