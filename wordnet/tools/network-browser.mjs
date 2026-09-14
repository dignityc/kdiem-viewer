export function browserApp(data) {
  const root=document.getElementById('kmtf-domain-wordnet'),$=s=>root.querySelector(s),results=$('#wn-results'),search=$('#wn-search');
  const nodes=new Map(data.nodes.map(n=>[n.id,n])),adj=new Map(data.nodes.map(n=>[n.id,[]]));
  for(const e of data.edges){adj.get(e.source).push({e,id:e.target,out:true});adj.get(e.target).push({e,id:e.source,out:false});}
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const label=n=>n.label.replace(/[{}]/g,'');
  const status=n=>n.reviewStatus==='editorial'?'AI 분류 개념':n.reviewStatus==='ai_inferred'?'AI 추정 의미':n.reviewStatus==='needs_review'?'의미 검토 필요':'원문 기반 의미';
  const itemOrigin=n=>n.reviewStatus==='editorial'?'AI가 추가한 분류':'원본 항목';
  const definitionStatus=n=>n.reviewStatus==='needs_review'?'정의 미확정':n.glossStatus==='ai_inferred'?'AI 추정 정의':n.reviewStatus==='editorial'?'AI 작성 정의':'원문 기반 정의';
  const candidates=data.nodes.filter(n=>n.kind==='synset'||(n.kind==='record'&&n.reviewStatus==='needs_review'));
  const parents=id=>adj.get(id).filter(x=>x.e.type==='hypernym'&&!x.e.navigationVia&&x.out);
  const children=id=>adj.get(id).filter(x=>x.e.type==='hypernym'&&!x.e.navigationVia&&!x.out);
  const members=id=>[...new Set(adj.get(id).filter(x=>x.e.type==='senseOf'&&!x.out).flatMap(x=>adj.get(x.id).filter(y=>y.e.type==='hasSense'&&!y.out).map(y=>label(nodes.get(y.id)))))];
  const record=id=>nodes.get(id).kind==='record'?nodes.get(id):nodes.get(adj.get(id).find(x=>x.e.type==='documentsMeaning'&&!x.out)?.id);
  const senseNumber=n=>{const s=adj.get(n.id).find(x=>x.e.type==='senseOf'&&!x.out);return s?Number(nodes.get(s.id).label.match(/의미 (\d+)/)?.[1]||1):1;};
  const contexts=new Map();let serial=0,selectedId=null,visits=[],visitIndex=-1;
  const expanded=new Set(['synset:curated:quantity']),filteredClosed=new Set();let filtering=false;
  const sortNodes=(a,b)=>label(a).localeCompare(label(b),'ko')||senseNumber(a)-senseNumber(b);
  function sourceHtml(n){const r=record(n.id);return `<details class="source"><summary>근거</summary><p>${esc(n.reviewNote||'AI가 구성한 작업 의미입니다.')}</p>${r?`<p><strong>${esc(r.evidence)}</strong> · ${esc(r.alt)}</p><p>원문 정의: ${esc(r.gloss||'기재 없음')}</p><p>MDR 도메인: ${adj.get(r.id).filter(x=>x.e.type==='hasDomain').map(x=>esc(label(nodes.get(x.id)))).join(', ')||'기재 없음'}</p><p>${(r.setExamples||[]).map(esc).join('<br>')}</p><p>${(r.fieldExamples||[]).map(esc).join('<br>')}</p>`:`<p>${esc(n.evidence)}</p>`}</details>`;}
  function line(id,edge=null){const n=nodes.get(id),key=String(++serial);contexts.set(key,id);const words=members(id),terms=words.length?words:[label(n)],r=record(id);
    const semantic=n.kind==='synset';
    return `<li class="sense" data-instance="${key}"><div class="sense-line">${semantic?`<button class="text-link synset-toggle" data-synset="${key}" aria-expanded="false" aria-label="${esc(label(n))} 관계 펼치기">S:</button>`:'<span class="pending">?:</span>'} <span class="pos">(${semantic?'명사형':'미확정'})</span> ${terms.map(w=>`<button class="text-link word" data-word="${esc(w)}">${esc(w)}</button>`).join(', ')} <span class="sense-number">[뜻 ${semantic?senseNumber(n):'미확정'}]</span> <span class="gloss" title="${n.glossStatus==='ai_inferred'?'AI 추정 정의':n.reviewStatus==='editorial'?'AI 분류 정의':'원문 정의'}">(${esc(n.gloss||'정의 미확정')})</span> <span class="status ${n.reviewStatus}">[${esc(status(n))}]</span></div>${r?.setExamples?.length?`<div class="examples">사용 문맥: ${(r.setExamples||[]).map(esc).join(' / ')}</div>`:''}${edge?`<details class="edge-evidence"><summary>관계 근거</summary><p>${esc(edge.evidence)} · ${esc(edge.provenance)}</p></details>`:''}${sourceHtml(n)}<div class="relation-menu" data-menu="${key}" hidden></div></li>`;
  }
  function relationMenu(key){const id=contexts.get(key),up=parents(id),down=children(id);const sister=new Set(up.flatMap(x=>children(x.id).map(y=>y.id)).filter(x=>x!==id));const assoc=adj.get(id).filter(x=>x.e.type==='related');
    const action=(type,name)=>`<button class="text-link" data-relation="${type}" data-key="${key}">${name}</button>`;
    return `<ul class="relation-types">${down.length?`<li>${action('down','직접 하위어')} / ${action('descendants','전체 하위어')}<div data-slot="down"></div><div data-slot="descendants"></div></li>`:''}${up.length?`<li>${action('up','직접 상위어')} / ${action('ancestors','전체 상위 경로')}${sister.size?' / '+action('sisters','같은 상위어의 뜻'):''}<div data-slot="up"></div><div data-slot="ancestors"></div><div data-slot="sisters"></div></li>`:''}${assoc.length?`<li>${action('related','AI 연관 제안')}<div data-slot="related"></div></li>`:''}${!up.length&&!down.length&&!assoc.length?'<li class="help">수록된 의미 관계가 없습니다.</li>':''}</ul>`;
  }
  function recursive(id,up){const links=up?parents(id):children(id);return links.length?`<ul>${links.map(x=>{const html=line(x.id,x.e);return html.slice(0,-5)+recursive(x.id,up)+'</li>';}).join('')}</ul>`:'';}
  function renderRelation(key,type){const id=contexts.get(key);if(type==='ancestors'||type==='descendants')return recursive(id,type==='ancestors');
    if(type==='sisters'){return `<ul>${parents(id).map(p=>{const siblings=children(p.id).filter(x=>x.id!==id);return `<li>공통 상위어: <button class="text-link" data-word="${esc(label(nodes.get(p.id)))}">${esc(label(nodes.get(p.id)))}</button><ul>${siblings.map(x=>line(x.id,x.e)).join('')}</ul></li>`;}).join('')}</ul>`;}
    const links=type==='up'?parents(id):type==='down'?children(id):adj.get(id).filter(x=>x.e.type==='related');return `${type==='related'?'<p class="help">아래는 AI가 제안한 연관으로, 동의어·상하위 관계와 별개입니다.</p>':''}<ul>${links.map(x=>line(x.id,x.e)).join('')}</ul>`;
  }
  function relationGroup(title,links){return `<section class="key-relation"><h3>${title} <span>${links.length}</span></h3>${links.length?`<ul class="relation-cards">${links.map(x=>{const n=nodes.get(x.id);return `<li><button class="relation-card" data-select="${esc(n.id)}"><strong>${esc(label(n))}</strong><span>${esc(n.gloss||'정의 미확정')}</span></button><details class="edge-evidence"><summary>관계 근거</summary><p>${esc(x.e.evidence)} · ${esc(x.e.provenance)}</p></details></li>`;}).join('')}</ul>`:'<p class="help">등록된 관계가 없습니다.</p>'}</section>`;}
  function highlight(){for(const row of results.querySelectorAll('[data-select]')){const active=row.dataset.select===selectedId;row.classList.toggle('selected',active);if(active)row.setAttribute('aria-current','true');else row.removeAttribute('aria-current');}
    $('#wn-list-context').textContent=results.querySelector('[aria-current="true"]')?'선택한 항목의 뜻과 관계':'현재 뜻은 검색 범위 밖에 있습니다. 트리는 유지됩니다.';
  }
  function selectMeaning(id,remember=true){if(!nodes.has(id))return;if(remember&&id!==selectedId){visits=visits.slice(0,visitIndex+1);visits.push(id);visitIndex=visits.length-1;}selectedId=id;contexts.clear();serial=0;
    const n=nodes.get(id),words=members(id),terms=words.length?words:[label(n)];
    const variants=candidates.filter(x=>x.id!==id&&members(x.id).some(w=>terms.includes(w)));
    $('#wn-detail').innerHTML=`<div class="detail-heading"><p class="eyebrow">${esc(itemOrigin(n))}</p><h2>${esc(label(n))}</h2><p class="help">${n.kind==='synset'?'뜻 '+senseNumber(n):'뜻 미확정'}${words.length>1?' · 같은 뜻의 표기: '+words.map(esc).join(', '):''}</p></div><p class="definition-label">${esc(definitionStatus(n))}</p><p class="definition">${esc(n.gloss||'정의 미확정')}</p>${variants.length?`<div class="other-senses">같은 용어의 다른 뜻: ${variants.map(x=>`<button class="text-link" data-select="${esc(x.id)}">뜻 ${senseNumber(x)} · ${esc(label(x))}</button>`).join(' / ')}</div>`:''}<div class="key-relations">${relationGroup('상위 개념',parents(id))}${relationGroup('하위 개념',children(id))}${adj.get(id).some(x=>x.e.type==='related')?relationGroup('AI 연관 제안',adj.get(id).filter(x=>x.e.type==='related')):''}</div><section class="evidence-section"><h3>정의와 사용 근거</h3>${sourceHtml(n)}</section>${n.kind==='synset'?`<details class="extended-relations"><summary>전체 상위 경로 · 하위어 더 탐색</summary><p class="help">S:를 누르고 원하는 관계를 펼쳐보세요.</p><ul>${line(id)}</ul></details>`:''}`;
    $('#wn-detail').scrollTop=0;$('#wn-back').disabled=visitIndex<=0;$('#wn-forward').disabled=visitIndex>=visits.length-1;highlight();
  }
  function treeBranch(n,path,matches,keep){
    const descendants=children(n.id).map(x=>nodes.get(x.id)).filter(x=>keep.has(x.id)).sort((a,b)=>Number(children(b.id).length>0)-Number(children(a.id).length>0)||sortNodes(a,b)),isOpen=filtering?!filteredClosed.has(path):expanded.has(path);
    const context=filtering&&!matches.has(n.id),hasChildren=descendants.length>0;
    return `<li class="tree-node" data-tree-path="${esc(path)}"><div class="tree-row${context?' path-context':''}">${hasChildren?`<button class="tree-toggle" data-toggle="${esc(path)}" aria-label="${esc(label(n))} 하위 항목" aria-expanded="${isOpen}">${isOpen?'▾':'▸'}</button>`:'<span class="tree-leaf" aria-hidden="true">·</span>'}<button class="term-row origin-${n.reviewStatus==='editorial'?'ai':'source'}" data-select="${esc(n.id)}" aria-label="${esc(label(n))} ${esc(itemOrigin(n))}" title="${esc(itemOrigin(n))}${context?' · 상위 경로':''}"><span class="origin-icon" aria-hidden="true"></span><span class="term-name">${esc(label(n))}${hasChildren?` <span class="branch-count">${descendants.length}</span>`:''}</span></button></div>${hasChildren?`<ul class="tree-children"${isOpen?'':' hidden'}>${descendants.map(x=>treeBranch(x,path+'/'+x.id,matches,keep)).join('')}</ul>`:''}</li>`;
  }
  function setBranch(button,open){const path=button.dataset.toggle;button.setAttribute('aria-expanded',String(open));button.textContent=open?'▾':'▸';button.closest('.tree-node').querySelector(':scope > .tree-children').hidden=!open;
    if(filtering){if(open)filteredClosed.delete(path);else filteredClosed.add(path);}else{if(open)expanded.add(path);else expanded.delete(path);}
  }
  function lookup(query){const q=query.trim(),normalized=q.toLowerCase(),mode=$('#wn-status').value;search.value=q;filtering=Boolean(q||mode);filteredClosed.clear();
    const hits=candidates.filter(n=>(!mode||(mode==='source'?n.reviewStatus!=='editorial':n.reviewStatus==='editorial'))&&(!q||`${n.label} ${n.alt||''} ${n.search||''} ${members(n.id).join(' ')}`.toLowerCase().includes(normalized))),matches=new Set(hits.map(n=>n.id)),keep=new Set(matches);
    function includeParents(id){for(const x of parents(id)){if(!keep.has(x.id)){keep.add(x.id);includeParents(x.id);}}}
    hits.forEach(n=>includeParents(n.id));
    const roots=candidates.filter(n=>n.kind==='synset'&&keep.has(n.id)&&!parents(n.id).length).sort(sortNodes),pending=hits.filter(n=>n.kind==='record').sort(sortNodes);
    $('#wn-result-summary').textContent=filtering?`${q?'“'+q+'”':'선택한 구분'} · ${hits.length}개 항목 · 상위 경로 함께 표시`:`전체 · ${candidates.length}개 항목`;
    const pendingOpen=filtering?!filteredClosed.has('pending'):expanded.has('pending');
    results.innerHTML=hits.length?`<ul class="term-tree">${roots.map(n=>treeBranch(n,n.id,matches,keep)).join('')}${pending.length?`<li class="tree-node pending-group" data-tree-path="pending"><div class="tree-row"><button class="tree-toggle" data-toggle="pending" aria-label="미분류 항목" aria-expanded="${pendingOpen}">${pendingOpen?'▾':'▸'}</button><span class="group-label">미분류 항목 <span class="branch-count">${pending.length}</span><small>상위 개념 미연결</small></span></div><ul class="tree-children"${pendingOpen?'':' hidden'}>${pending.map(n=>treeBranch(n,'pending/'+n.id,matches,keep)).join('')}</ul></li>`:''}</ul>`:'<p class="empty-list">검색 결과가 없습니다.</p>';
    results.scrollTop=0;highlight();
  }
  root.addEventListener('click',e=>{const toggle=e.target.closest('[data-toggle]');if(toggle){setBranch(toggle,toggle.getAttribute('aria-expanded')!=='true');return;}const selected=e.target.closest('[data-select]');if(selected){selectMeaning(selected.dataset.select);return;}
    const t=e.target.closest('[data-synset]');if(t){const key=t.dataset.synset,menu=root.querySelector('[data-menu="'+key+'"]');if(!menu.innerHTML)menu.innerHTML=relationMenu(key);menu.hidden=!menu.hidden;t.setAttribute('aria-expanded',String(!menu.hidden));return;}
    const rel=e.target.closest('[data-relation]');if(rel){const menu=root.querySelector('[data-menu="'+rel.dataset.key+'"]'),slot=menu.querySelector(':scope > .relation-types > li > [data-slot="'+rel.dataset.relation+'"]');if(!slot.innerHTML){slot.innerHTML=renderRelation(rel.dataset.key,rel.dataset.relation);slot.hidden=false;}else slot.hidden=!slot.hidden;rel.setAttribute('aria-expanded',String(!slot.hidden));return;}
    const word=e.target.closest('[data-word]');if(word){const item=word.closest('[data-instance]');const id=item?contexts.get(item.dataset.instance):candidates.find(n=>label(n)===word.dataset.word)?.id;if(id)selectMeaning(id);}
  });
  function searchNow(){lookup(search.value);}
  $('#wn-submit').addEventListener('click',searchNow);$('#wn-search-form').addEventListener('submit',e=>{e.preventDefault();searchNow();});search.addEventListener('input',searchNow);search.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();searchNow();}});
  $('#wn-status').addEventListener('change',searchNow);$('#wn-all').addEventListener('click',()=>{$('#wn-status').value='';lookup('');});
  $('#wn-collapse').addEventListener('click',()=>{for(const button of results.querySelectorAll('[data-toggle]'))setBranch(button,false);});
  $('#wn-locate').addEventListener('click',()=>{let selected=results.querySelector('[aria-current="true"]');if(!selected){$('#wn-status').value='';lookup('');selected=results.querySelector('[aria-current="true"]');}if(!selected)return;let branch=selected.closest('.tree-node').parentElement.closest('.tree-node');while(branch){const toggle=branch.querySelector(':scope > .tree-row > [data-toggle]');if(toggle)setBranch(toggle,true);branch=branch.parentElement.closest('.tree-node');}selected.scrollIntoView({block:'nearest'});selected.focus({preventScroll:true});});
  $('#wn-back').addEventListener('click',()=>{if(visitIndex>0)selectMeaning(visits[--visitIndex],false);});$('#wn-forward').addEventListener('click',()=>{if(visitIndex<visits.length-1)selectMeaning(visits[++visitIndex],false);});
  lookup('');selectMeaning(candidates.find(n=>members(n.id).includes('소요량'))?.id||candidates[0].id);
}
