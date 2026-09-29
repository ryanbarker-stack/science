(function () {
  'use strict';
  const root = document.querySelector('#activity');
  const fields = [...root.querySelectorAll('input[name],select[name],textarea[name]')];
  const required = [...root.querySelectorAll('[data-required]')];
  const steps = [...root.querySelectorAll('.step')];
  const grade = document.documentElement.dataset.grade;
  const assignment = {
    id: grade === '6' ? '2026-27-G6-ES-LIGHT-DETECTIVE-01' : '2026-27-G7-LS-CELL-SYSTEMS-01',
    title: grade === '6' ? 'Grade 6 — Light Detective: Seeing the Invisible' : 'Grade 7 — From Cells to Systems',
    course: grade === '6' ? 'G6-EARTH-SPACE' : 'G7-LIFE-SCIENCE', schoolYear: '2026-27', version: '1.0.0'
  };
  function keyFor(el) { return el.name || el.querySelector('[name]')?.name; }
  function valueFor(el) {
    if(el.tagName==='FIELDSET') return el.querySelector('input:checked')?.value || '';
    if(el.type==='checkbox') return el.checked;
    if(el.type==='radio') return root.querySelector('input[name="'+el.name+'"]:checked')?.value || '';
    return el.value;
  }
  function collectResponses() {
    const out = {};
    fields.forEach(el => { if(el.type === 'radio') { if(!(el.name in out)) out[el.name] = ''; if(el.checked) out[el.name] = el.value; } else out[el.name] = el.type === 'checkbox' ? el.checked : el.value; });
    return out;
  }
  function answered(el) { const v=valueFor(el); return typeof v==='boolean' ? v : String(v||'').trim().length>0; }
  function updateProgress() {
    const done = required.filter(answered).length;
    const bar=document.querySelector('#progress'); bar.max=required.length; bar.value=done;
    document.querySelector('#progress-label').textContent=done+' / '+required.length+' responses';
    steps.forEach(step => { const qs=[...step.querySelectorAll('[data-required]')]; const complete=qs.length>0 && qs.every(answered); const a=document.querySelector('[data-step-link="'+step.id+'"]'); if(a){a.classList.toggle('complete',complete);a.querySelector('.step-mark').textContent=complete?'✓':'○';} });
    document.querySelector('#finish-summary').textContent = done===required.length ? 'All responses are filled. Check your name and period, then turn in.' : (required.length-done)+' responses still need an answer. You can revisit any section.';
  }
  function clearFeedback() { root.querySelectorAll('.check-feedback').forEach(n=>n.remove()); root.querySelectorAll('[aria-invalid]').forEach(n=>n.removeAttribute('aria-invalid')); }
  function restoreResponses(responses) {
    fields.forEach(el=>{const v=responses[el.name]; if(el.type==='checkbox') el.checked=v===true; else if(el.type==='radio') el.checked=v===el.value; else el.value=v==null?'':String(v);}); clearFeedback(); updateProgress();
  }
  function resetResponses() { restoreResponses({}); root.querySelectorAll('details').forEach(n=>n.open=false); }
  function validate(responses) {
    const errors=[];
    required.forEach(el=>{const value=responses[keyFor(el)]; const valid=typeof value==='boolean'?value:String(value||'').trim().length>0; if(!valid) errors.push(el.dataset.required);});
    return {ok:errors.length===0,errors:errors.map(x=>'Complete: '+x)};
  }
  function checkSection(id) {
    if(root.inert) return;
    const section=document.getElementById(id); if(!section)return;
    section.querySelectorAll('.check-feedback').forEach(n=>n.remove());
    section.querySelectorAll('[data-answer]').forEach(el=>{
      const v=String(valueFor(el)||''); const accepted=el.dataset.answer.split('|'); const correct=accepted.includes(v);
      const feedback=document.createElement('p');feedback.className='check-feedback '+(correct?'correct':'retry');feedback.setAttribute('role','status');
      feedback.textContent=!v?'Choose an answer, then check again.':correct?'✓ '+(el.dataset.feedback||'That matches the evidence.'):'Try again. '+(el.dataset.feedback||'Compare your choice with the model or data.');
      el.setAttribute('aria-invalid', v&&!correct?'true':'false');
      el.insertAdjacentElement('afterend',feedback);
    });
    updateProgress();
  }
  const nav=document.querySelector('#step-nav');
  steps.forEach((step,i)=>{const a=document.createElement('a');a.href='#'+step.id;a.dataset.stepLink=step.id;const m=document.createElement('span');m.className='step-mark';m.setAttribute('aria-hidden','true');m.textContent='○';a.append(m,document.createTextNode(' '+(i+1)+'. '+step.dataset.title));nav.append(a);});
  document.querySelectorAll('[data-check]').forEach(b=>b.addEventListener('click',()=>checkSection(b.dataset.check)));
  root.addEventListener('input',e=>{const s=e.target.closest('.step'); if(s){s.querySelectorAll('.check-feedback').forEach(n=>n.remove());s.querySelectorAll('[aria-invalid]').forEach(n=>n.removeAttribute('aria-invalid'));}updateProgress();});
  root.addEventListener('change',updateProgress);
  document.querySelector('#setup-note').hidden=!!window.IACA_SUBMISSION_ENDPOINT;
  window.lessonTools={collectResponses,validate,restoreResponses,resetResponses,checkSection};
  window.assignmentSubmission=IACASubmission.init({
    mount:'#submission',workRoot:'#activity',endpoint:window.IACA_SUBMISSION_ENDPOINT,assignment,
    identity:{type:'student_name',namespace:'iaca-2026-27',periods:['1','2','3','4','5','6','7'],requirePeriod:true},
    collectResponses,restoreResponses,resetResponses,validate,autosaveMs:350,
    collectResults(){let correct=0,total=0;root.querySelectorAll('[data-answer]').forEach(el=>{total++;if(el.dataset.answer.split('|').includes(String(valueFor(el)||'')))correct++;});return {practiceCorrect:correct,practiceTotal:total,requiredCompleted:required.filter(answered).length,requiredTotal:required.length};},
    collectArtifacts(){return [];}
  });
  document.querySelector('#finish-turn-in').addEventListener('click',()=>{window.assignmentSubmission.turnIn();document.querySelector('#submission').scrollIntoView({behavior:'smooth',block:'start'});});
  const sub=document.querySelector('#submission');
  function syncReceipt(){const source=sub.querySelector('[data-iaca="turn-in"]');const target=document.querySelector('#finish-turn-in');target.textContent=source.textContent;target.disabled=source.disabled;document.querySelector('#finish-status').textContent=sub.querySelector('[data-iaca="status-title"]').textContent;}
  new MutationObserver(syncReceipt).observe(sub,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['disabled','data-iaca-state']});
  syncReceipt();updateProgress();
})();
