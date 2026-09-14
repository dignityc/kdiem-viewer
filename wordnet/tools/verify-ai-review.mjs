import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
const output = new URL('../', import.meta.url);
const read = p => JSON.parse(fs.readFileSync(new URL(p, output), 'utf8'));
const original = read('archive/2026-09-08-before-ai/graph.json');
const data = read('graph.json');
const audit = read('semantic-audit.json');
const nodes = new Map(data.nodes.map(n => [n.id,n]));
const edgeKey = e => `${e.source}\u0001${e.target}\u0001${e.type}`;
const edges = new Set(data.edges.map(edgeKey));
assert.equal(edges.size, data.edges.length);
assert.equal(nodes.size, data.nodes.length);
for (const e of original.edges) assert(edges.has(edgeKey(e)), 'Original relation removed');
for (const n of original.nodes) {
  const after = nodes.get(n.id);
  assert(after, 'Original node removed');
  for (const key of ['kind','label','gloss','glossStatus','uses','sets','setExamples','fieldExamples','recordAliases','source','evidence']) assert.deepEqual(after[key], n[key], `${n.label}: original ${key} changed`);
}
assert.equal(data.nodes.filter(n => n.kind === 'record').length, 281);
assert.equal(data.nodes.filter(n => n.kind === 'record').reduce((s,n) => s+n.uses,0),2538);
assert.equal(audit.reviewDecisions.length,161);
assert.equal(new Set(audit.reviewDecisions.map(d=>d.term)).size,161);
assert.equal(audit.reviewDecisions.filter(d=>d.status==='ai_inferred').length,154);
assert.equal(data.nodes.filter(n=>n.kind==='record'&&n.reviewStatus==='needs_review').length,7);
assert.equal(data.nodes.filter(n=>n.kind==='synset'&&n.reviewStatus==='ai_inferred').length,154);
const parents = new Map(data.nodes.map(n=>[n.id,[]]));
for(const e of data.edges) {
  assert(nodes.has(e.source)&&nodes.has(e.target),'Dangling edge');
  if (e.type==='hypernym') {
    assert.equal(nodes.get(e.source).kind,'synset'); assert.equal(nodes.get(e.target).kind,'synset');
    assert(nodes.get(e.evidenceRef)?.gloss,'Missing definition evidence'); parents.get(e.source).push(e.target);
  }
  if (['hasDomain','coOccurs'].includes(e.type)) assert.equal(nodes.get(e.source).kind,'record');
  if (e.type==='coOccurs') assert.equal(nodes.get(e.target).kind,'record');
}
const done=new Set(),active=new Set();
function visit(id) { assert(!active.has(id),'Hierarchy cycle'); if(done.has(id)) return; active.add(id); parents.get(id).forEach(visit); active.delete(id); done.add(id); }
data.nodes.forEach(n=>visit(n.id));
for(const n of data.nodes.filter(n=>['sense','synset'].includes(n.kind))) {
  assert(n.gloss); assert.equal(n.uses,undefined); assert.equal(n.sets,undefined);
  if(n.kind==='sense') {
    assert.equal(data.edges.filter(e=>e.source===n.id&&e.type==='senseOf').length,1);
    assert.equal(data.edges.filter(e=>e.target===n.id&&e.type==='hasSense').length,1);
  }
  if(n.reviewStatus==='ai_inferred') assert.equal(n.glossStatus,'ai_inferred');
}
for(const d of audit.reviewDecisions) {
  if(d.status==='ai_inferred') {
    assert(d.rationale && d.definition && d.fieldExamples.length && d.setExamples.length);
    const n=nodes.get(d.meaningId); assert.equal(n.gloss,d.definition);
    assert(data.edges.some(e=>e.type==='documentsMeaning'&&e.source===d.recordId&&e.target===n.id));
  } else assert(d.reason.length>30);
}
// A hidden general link must remain reachable through its displayed intermediate concept.
const refined = data.edges.filter(e => e.navigationVia);
assert.equal(refined.length,15);
for (const e of refined) {
  assert.equal(e.type,'hypernym');
  assert(edges.has(edgeKey({source:e.source,target:e.navigationVia,type:'hypernym'})));
  assert(edges.has(edgeKey({source:e.navigationVia,target:e.target,type:'hypernym'})));
}
assert.equal(audit.codeCategoryReview.length,3);
assert.deepEqual(audit.codeCategoryReview.map(c=>[c.members.length,c.sourceDefinedMembers,c.aiInferredMembers]),[[11,3,8],[2,2,0],[2,2,0]]);
for(const category of audit.codeCategoryReview) {
  assert.equal(nodes.get(category.id).reviewStatus,'editorial');
  for(const member of category.members) {
    assert.equal(nodes.get(member.recordId).gloss,member.sourceDefinition);
    assert.equal(nodes.get(member.meaningId).gloss,member.definition);
    assert(edges.has(edgeKey({source:member.meaningId,target:category.id,type:'hypernym'})));
  }
}
assert.equal(data.stats.editorialConcepts,28);
const yearly = data.nodes.find(n=>n.kind==='record'&&n.label==='보유년도');
assert.deepEqual(yearly.recordAliases,['보유연도']);
assert(!data.edges.some(e=>e.type==='documentsMeaning'&&e.source===yearly.id));
const html = fs.readFileSync(new URL('reviewed-fragment.html', output),'utf8');
const script=html.match(/<script>([\s\S]*)<\/script>/)[1];
new vm.Script(script); // Parse the actual emitted browser program.
const start=html.lastIndexOf('})({"nodes":');
const embedded=JSON.parse(html.slice(start+3,html.lastIndexOf(');</script>')));
assert.deepEqual(embedded,data);
assert(html.includes('AI 추정 정의') && html.includes('wn-status'));
assert(!html.includes('의미 판단 보류 5개'));
// Added definitions and their evidence intentionally exceed the former 1 MB cap.
assert(Buffer.byteLength(html)<3_000_000,'Unexpected payload growth');
audit.validation={status:'passed',originalRecordsPreserved:true,originalRelationsPreserved:true,reviewCoverage:161,hypernymAcyclic:true,endpointReferencesValid:true,singleSynsetPerSense:true,metadataOnRecords:true,aiDefinitionsLabelled:true,browserScriptParsed:true};
fs.writeFileSync(new URL('semantic-audit.json',output),JSON.stringify(audit,null,2));
console.log('PASS: 161 decisions, 154 inferred / 7 pending; original definitions and metadata preserved; hierarchy and sense integrity; actual browser script and embedded data verified.');
