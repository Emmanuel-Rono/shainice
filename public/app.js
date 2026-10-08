import { STORAGE_KEY,emptyState,validState,mergeStates,sameEntries,getValue,writeValue,monthProgress,reviewComplete,nextMonth,weekKey,listEntries,safeUrl } from './state.js';

const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dateLabel = (iso,opts={day:'numeric',month:'short',year:'numeric'}) => new Intl.DateTimeFormat('en-GB',{...opts,timeZone:'Africa/Nairobi'}).format(new Date(iso+'T12:00:00Z'));
let programme,state=emptyState(),page='today',selectedMonth='m1',selectedWeek=weekKey(),role='student',workTab='evidence';
let connected=false,pending=false,syncing=false,saveTimer,toastTimer,storageAvailable=true;
const value = (key,fallback='') => getValue(state,key,fallback);
try { role=localStorage.getItem('fieldnotes.role') || 'student';const saved = localStorage.getItem(STORAGE_KEY); if(saved){const parsed=JSON.parse(saved);if(validState(parsed))state=parsed;else throw new Error('Invalid saved data');} } catch { storageAvailable=false; }
function toast(text){$('#toast').textContent=text;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,4500);}
function setStatus(text,tone=''){const el=$('#save-status');el.textContent=text;el.className='save-status '+tone;$('#settings-status').textContent=connected?'Connected to the shared space. Changes sync when online.':'Progress is saved in this browser. Connect the shared space to use both devices.';}
function persist(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));storageAvailable=true;}catch{storageAvailable=false;setStatus('Could not save locally. Export a backup.','error');}}
function change(key,val){writeValue(state,key,val);persist();pending=true;clearTimeout(saveTimer);if(connected){setStatus('Changes waiting to sync','warning');saveTimer=setTimeout(syncNow,800);}else if(storageAvailable)setStatus('Saved on this device');}
async function syncNow({quiet=false}={}){
  if(!connected){if(!quiet)toast('Connect the shared space first. Local progress is already saved.');return;}
  if(syncing)return;
  syncing=true;setStatus('Syncing…');
  try{
    const res=await fetch('/api/progress',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(state)});
    const data=await res.json();
    if(!res.ok)throw Object.assign(new Error(data.error || 'Unable to sync.'),{status:res.status});
    if(!validState(data.state))throw new Error('Shared progress was not recognised.');
    state=mergeStates(state,data.state);persist();
    pending=!sameEntries(state,data.state);
    setStatus(pending?'Changes waiting to sync':'Synced with shared space',pending?'warning':'');
    if(!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))render();
    if(pending)saveTimer=setTimeout(syncNow,1000);
  }catch(error){if(error.status===401){connected=false;$('#connect-button').textContent='Reconnect shared space';}setStatus('Saved locally · sync pending','warning');if(!quiet)toast(error.message);}
  finally{syncing=false;}
}
async function pullShared({initial=false}={}){
  if(syncing || (pending && connected)){if(connected)await syncNow({quiet:true});return;}
  try{
    const res=await fetch('/api/progress');
    if(!res.ok)return;
    const data=await res.json();if(!validState(data.state))return;
    connected=true;$('#connect-button').textContent='Shared space connected';
    const merged=mergeStates(state,data.state);const changed=JSON.stringify(state)!==JSON.stringify(merged);state=merged;persist();
    pending=!sameEntries(state,data.state);
    setStatus(pending?'Changes waiting to sync':'Synced with shared space',pending?'warning':'');
    if(changed && !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))render();
    if(pending)await syncNow({quiet:initial});
  }catch{if(connected)setStatus('Offline · saved on this device','warning');}
}
function checked(key){return value(key,false)?'checked':'';}
function inputField(label,key,{type='textarea',placeholder='',required=false}={}){
  const id='field-'+key.replaceAll(':','-');const req=required?' required':'';
  return `<div class="form-field"><label for="${esc(id)}">${esc(label)}</label>${type==='textarea'?`<textarea id="${esc(id)}" data-key="${esc(key)}" maxlength="10000" placeholder="${esc(placeholder)}"${req}>${esc(value(key))}</textarea>`:`<input id="${esc(id)}" type="${type}" data-key="${esc(key)}" value="${esc(value(key))}" maxlength="10000"${req}>`}</div>`;
}
function monthOptions(selected=selectedMonth){return programme.months.map(m=>`<option value="${m.id}" ${selected===m.id?'selected':''}>${String(m.number).padStart(2,'0')} / ${esc(dateLabel(m.date,{month:'short',year:'numeric'}))} — ${esc(m.title)}</option>`).join('');}
function heading(title,description,extra=''){return `<div class="page-heading"><div><p class="eyebrow">${role==='sibling'?'SIBLING VIEW / SUPPORT & REVIEW':'YOUR SPACE / LEARN & REFLECT'}</p><h1>${esc(title)}</h1><p class="quiet">${esc(description)}</p></div>${extra}</div>`;}
function countComplete(){return programme.months.filter(m=>monthProgress(state,m.id).complete).length;}
function ring(percent,label,sub){const length=2*Math.PI*58;return `<div class="progress-ring" role="img" aria-label="${esc(label+' '+sub)}"><svg viewBox="0 0 128 128" aria-hidden="true"><circle class="track" cx="64" cy="64" r="58"/><circle class="arc" cx="64" cy="64" r="58" stroke-dasharray="${length*percent/100} ${length}"/></svg><div class="ring-label"><strong>${esc(label)}</strong><span>${esc(sub)}</span></div></div>`;}
function nextReview(){return programme.months.find(m=>!reviewComplete(state,m.id)) || programme.months.at(-1);}
function todayView(){
  const month=programme.months.find(m=>m.id===selectedMonth),p=monthProgress(state,month.id),done=countComplete(),review=nextReview();
  const tasks=programme.months.reduce((sum,m)=>sum+monthProgress(state,m.id).count,0);
  const name=value('profile:name');
  return `${heading(role==='sibling'?'A clear view of her progress':name?`Welcome back, ${name}.`:'Your first year, one week at a time.',role==='sibling'?'Look at the work, listen to her thinking, and agree one next step.':'Use your own thinking. Build useful skills. Keep a record of the work.',`<button class="button mobile-settings" data-action="settings">Settings</button>`)}
  <div class="overview-grid"><section class="panel progress-panel" aria-label="Annual progress">${ring(Math.round(done/12*100),done+'/12','MONTHS COMPLETE')}<div class="progress-copy"><p class="eyebrow">OCT 2026 — SEP 2027</p><h2>Steady, thoughtful progress.</h2><p>One resource. Small tasks. A monthly conversation.</p><div class="mini-stats"><div><strong>${tasks}<span>/ 84 checkpoints</span></strong></div><div><strong>${programme.months.filter(m=>reviewComplete(state,m.id)).length}<span>reviews complete</span></strong></div><div><strong>3 hrs<span>each week</span></strong></div></div></div></section>
  <section class="panel review-panel"><div><p class="eyebrow">NEXT SIBLING CHECK-IN</p><div class="review-date">${dateLabel(review.reviewDate)}</div><p>45 minutes · ${esc(review.reviewLead)}</p></div><button class="button" data-action="review" data-month="${review.id}">Prepare review <span aria-hidden="true">↗</span></button></section></div>
  <div class="section-heading"><div><h2>${role==='sibling'?'This month’s work':'Continue learning'}</h2><p>Work through the four weekly tasks at your own pace.</p></div><label class="sr-only" for="month-select">Choose a learning month</label><select id="month-select" class="month-select" data-month-select>${monthOptions()}</select></div>
  <div class="learning-grid"><section class="panel"><div class="month-header"><div><p class="eyebrow">MONTH ${String(month.number).padStart(2,'0')} / ${esc(dateLabel(month.date,{month:'long',year:'numeric'}))}</p><h2>${esc(month.title)}</h2></div><span class="progress-small">${p.count}/7</span></div>
  ${month.weeks.map((task,i)=>`<div class="task-row ${p.weeks[i]?'done':''}"><input type="checkbox" id="${month.id}-week-${i}" data-key="${month.id}:week:${i}" ${checked(`${month.id}:week:${i}`)}><div><label for="${month.id}-week-${i}"><h3>Week ${i+1}</h3><p class="task-text">${esc(task)}</p></label><details><summary>My notes & evidence</summary><label class="sr-only" for="${month.id}-weeknote-${i}">Week ${i+1} notes</label><textarea id="${month.id}-weeknote-${i}" data-key="${month.id}:weeknote:${i}" maxlength="10000" placeholder="What did you do? What did you learn?">${esc(value(`${month.id}:weeknote:${i}`))}</textarea></details></div></div>`).join('')}</section>
  <div class="right-stack"><section class="panel resource-panel"><p class="eyebrow">YOUR ONE FREE RESOURCE</p><h3>${esc(month.resource.title)}</h3>${month.resource.embed?`<div class="video-wrap" id="video-slot"><button type="button" class="video-placeholder" data-action="play-video" data-month="${month.id}"><span class="play-symbol" aria-hidden="true">▶</span>Play the TED talk here</button></div>`:`<p>${month.number===2?'Continue the same course. Focus on asking and refining questions.':month.number===7?'Use only Weeks 1–2: your interests, values and abilities.':month.number===11?'Return to the opportunity, application and action-planning sections.':'Open the course and practise the ideas in this month’s tasks. A free account may be needed.'}</p>`}<a class="button ${month.resource.embed?'':'primary'}" href="${esc(month.resource.url)}" target="_blank" rel="noopener noreferrer">${month.resource.embed?'Open video on TED':'Open free course'} <span aria-hidden="true">↗</span></a><label class="check-line"><input type="checkbox" data-key="${month.id}:resource" ${checked(`${month.id}:resource`)}>I worked through the assigned learning.</label></section>
  <section class="panel result-panel"><p class="eyebrow quiet">SHOW WHAT YOU LEARNED</p><h3>Monthly result</h3><p>${esc(month.result)}</p><label class="sr-only" for="result-notes">Monthly result notes and evidence</label><textarea id="result-notes" data-key="${month.id}:resultnotes" maxlength="10000" placeholder="Describe your result or paste an evidence link…">${esc(value(`${month.id}:resultnotes`))}</textarea><label class="check-line"><input type="checkbox" data-key="${month.id}:result" ${checked(`${month.id}:result`)}>My result is ready to discuss.</label><button class="text-button" data-action="work" data-month="${month.id}">Add it to My work <span aria-hidden="true">↗</span></button></section></div></div>
  <div class="thinking-note"><p class="eyebrow">KEEP YOUR THINKING IN THE LOOP</p><p>Attempt first. Ask for help. Verify the answer. Close AI and explain it yourself.</p></div>
  <div class="learning-bottom"><span class="quiet small">A month is complete after 4 tasks, learning, the result and your review.</span><button class="text-button" data-action="review" data-month="${month.id}">${p.review?'View completed review':'Prepare this month’s review'} <span aria-hidden="true">↗</span></button></div>`;
}
function programmeView(){const next=nextMonth(state,programme.months);return `${heading('Your year programme','Twelve months of learning beyond the classroom.',`<span class="pill green">${countComplete()}/12 complete</span>`)}<div class="filter-bar"><p>October 2026 to September 2027. One free resource per month.</p><button class="button" data-action="learn" data-month="${next.id}">Continue next month ↗</button></div><div class="year-list">${programme.months.map(m=>{const p=monthProgress(state,m.id);return `<article class="year-card ${m.id===next.id?'current':''}"><div><div class="month-num">MONTH ${String(m.number).padStart(2,'0')}</div><p class="eyebrow">${dateLabel(m.date,{month:'short',year:'numeric'})}</p></div><div><h3>${esc(m.title)}</h3><p>${esc(m.resource.title)}</p></div><div class="year-progress"><span class="small quiet">${p.count}/7 checkpoints</span><div class="meter"><div class="meter-fill" data-percent="${p.percent}"></div></div><span class="small quiet">${p.complete?'Complete':p.count?'In progress':'Not started'}</span></div><button class="button" data-action="learn" data-month="${m.id}">Open ↗</button></article>`;}).join('')}</div>`;}
function habitsView(){
  const checkedHabits=programme.habits.filter(h=>value(`habit:${selectedWeek}:${h.id}`,false)).length;
  return `${heading('Small habits, each week.','A manageable routine that leaves room for your degree and campus life.',`<span class="pill green">${checkedHabits}/5 this week</span>`)}<div class="filter-bar"><p>Tick each habit after its weekly activity is complete.</p><div class="week-controls"><button class="text-button" data-action="this-week">This week</button><label class="sr-only" for="week-date">Choose a week</label><input type="date" id="week-date" value="${selectedWeek}"></div></div><div class="habit-grid"><section class="panel"><div class="month-header"><div><p class="eyebrow">WEEK OF ${dateLabel(selectedWeek)}</p><h2>Your three-hour routine</h2></div></div>${programme.habits.map(h=>`<div class="habit-card"><input type="checkbox" id="habit-${h.id}" data-key="habit:${selectedWeek}:${h.id}" ${checked(`habit:${selectedWeek}:${h.id}`)}><div><label for="habit-${h.id}"><h3>${esc(h.title)}</h3><p>${esc(h.how)}</p></label><p class="small">Keep: ${esc(h.evidence)}</p>${h.id==='h5'?`<a class="inline-link book-link" target="_blank" rel="noopener noreferrer" href="${esc(programme.book.url)}">Read the book ↗</a>`:''}</div><span class="time">${h.minutes} min</span></div>`).join('')}</section><section class="panel form-panel"><p class="eyebrow quiet">YOUR WORDS / NO AI NEEDED</p><h2>Weekly reflection</h2>${inputField('What did I learn?',`reflection:${selectedWeek}:learned`,{placeholder:'An idea you can explain yourself…'})}${inputField('What was difficult? What will I try next?',`reflection:${selectedWeek}:next`)}${inputField('Faith reading: one idea, question and action',`reflection:${selectedWeek}:faith`,{placeholder:'Write honestly. Bring a question to your sibling review.'})}<p class="quiet small">Saved as you type. In exam weeks, pause extra learning.</p></section></div><section class="rules"><div class="section-heading"><h2>Your AI & digital habits</h2></div><div class="rules-grid">${programme.rules.filter(r=>!['Free learning','Annual outcome','Strengths record','Faith reflection'].includes(r.title)).map(r=>`<article class="rule"><h3>${esc(r.title)}</h3><p>${esc(r.text)}</p></article>`).join('')}</div></section>`;
}
function monthTag(id){const m=programme.months.find(m=>m.id===id);return m?`Month ${m.number} / ${dateLabel(m.date,{month:'short',year:'numeric'})}`:'Your year';}
function evidenceForm(){return `<form id="evidence-form" class="panel form-panel"><h2>Add a piece of work</h2><div class="form-field"><label for="work-title">Title</label><input id="work-title" name="title" required maxlength="150"></div><div class="form-field"><label for="work-month">Learning month</label><select id="work-month" name="month">${monthOptions()}</select></div><div class="form-field"><label for="work-url">Evidence link (optional)</label><input id="work-url" name="url" type="url" placeholder="https://…" maxlength="2000"></div><div class="form-field"><label for="work-note">Your contribution and what it demonstrates</label><textarea id="work-note" name="note" required maxlength="8000" placeholder="What did you do yourself? What feedback did you receive?"></textarea></div><label class="check-line"><input name="portfolio" type="checkbox">Include in my six-piece portfolio</label><button class="button primary" type="submit">Save work</button><p class="quiet small">Add links to work you have permission to share. Files stay in your chosen storage.</p></form>`;}
function strengthForm(){return `<form id="strength-form" class="panel form-panel"><h2>Notice a strength</h2><div class="form-field"><label for="strength-title">Skill or activity</label><input id="strength-title" name="title" required maxlength="150" placeholder="For example, explaining a complex idea"></div><div class="form-field"><label for="strength-evidence">Evidence and feedback</label><textarea id="strength-evidence" name="note" required maxlength="8000" placeholder="Describe the real work and what someone noticed."></textarea></div><p class="quiet small">Rate this experience from 1 (low) to 5 (high).</p><div class="score-grid">${['Enjoyment','Quality','Improvement','Initiative'].map(label=>`<div class="form-field"><label for="score-${label}">${label}</label><select id="score-${label}" name="${label.toLowerCase()}">${[1,2,3,4,5].map(n=>`<option ${n===3?'selected':''}>${n}</option>`).join('')}</select></div>`).join('')}</div><button class="button primary" type="submit">Save observation</button><p class="quiet small">Look for repeated evidence over time. These scores are reflection prompts, not a personality test.</p></form>`;}
function opportunityForm(){return `<form id="opportunity-form" class="panel form-panel"><h2>Track an opportunity</h2><div class="form-field"><label for="opp-org">Organisation</label><input id="opp-org" name="organisation" required maxlength="150"></div><div class="form-field"><label for="opp-title">Role or pitch</label><input id="opp-title" name="title" required maxlength="150"></div><div class="form-field"><label for="opp-url">Listing or organisation link</label><input id="opp-url" name="url" type="url" maxlength="2000"></div><div class="form-field"><label for="opp-status">Status</label><select id="opp-status" name="status">${['Considering','Applied','Followed up','Interview','Accepted','Closed'].map(s=>`<option>${s}</option>`).join('')}</select></div><div class="form-field"><label for="opp-followup">Follow-up date</label><input type="date" id="opp-followup" name="followup"></div><div class="form-field"><label for="opp-note">Notes</label><textarea id="opp-note" name="note" maxlength="8000" placeholder="Duties, time commitment, payment, questions to ask…"></textarea></div><button class="button primary" type="submit">Save opportunity</button><p class="quiet small">Verify the organisation. Do not pay recruitment fees.</p></form>`;}
function workView(){
  const prefix=workTab+':';const records=listEntries(state,prefix).reverse();const portfolio=listEntries(state,'evidence:').filter(r=>r.portfolio).length;
  let list=records.map(r=>`<article class="record"><div class="record-header"><p class="eyebrow">${workTab==='evidence'?esc(monthTag(r.month)):workTab==='strength'?'STRENGTH OBSERVATION':esc(r.organisation)}</p><button class="icon-button" data-action="delete-record" data-key="${esc(r.key)}" aria-label="Delete ${esc(r.title)}">×</button></div><h3>${esc(r.title)}</h3><p>${esc(r.note)}</p>${safeUrl(r.url)?`<a class="inline-link" href="${esc(safeUrl(r.url))}" target="_blank" rel="noopener noreferrer">${workTab==='opportunity'?'Open listing':'View evidence'} ↗</a>`:''}${workTab==='strength'?`<div class="record-footer small quiet">${['enjoyment','quality','improvement','initiative'].map(k=>`${k}: ${esc(r[k])}/5`).join(' · ')}</div>`:workTab==='opportunity'?`<div class="record-footer"><label class="sr-only" for="opp-${esc(r.key)}">Opportunity status</label><select id="opp-${esc(r.key)}" data-opportunity="${esc(r.key)}">${['Considering','Applied','Followed up','Interview','Accepted','Closed'].map(s=>`<option ${s===r.status?'selected':''}>${s}</option>`).join('')}</select>${r.followup?`<span class="small quiet">Follow up ${dateLabel(r.followup)}</span>`:''}</div>`:`<div class="record-footer"><label class="check-line"><input type="checkbox" data-portfolio="${esc(r.key)}" ${r.portfolio?'checked':''}>Portfolio piece</label><span class="small quiet">${esc(r.created?.slice(0,10) || '')}</span></div>`}</article>`).join('');
  if(!list)list=`<div class="empty"><h3>${workTab==='evidence'?'Let your work show your progress.':workTab==='strength'?'Start with a real example.':'Keep your opportunities in one place.'}</h3><p>${workTab==='evidence'?'Add coursework, projects and feedback as you learn.':workTab==='strength'?'Notice what you enjoy, improve at and choose to do.':'Save listings, track applications and set a follow-up date.'}</p></div>`;
  return `${heading('Your work tells the story.','Keep evidence, discover strengths, and follow through on opportunities.',`<span class="pill green">${portfolio}/6 portfolio pieces</span>`)}<div class="tabs" role="tablist" aria-label="Work records">${[['evidence','Work & portfolio'],['strength','Strengths'],['opportunity','Opportunities']].map(([id,label])=>`<button role="tab" aria-selected="${id===workTab}" data-work-tab="${id}" class="${id===workTab?'active':''}">${label}</button>`).join('')}</div>${workTab==='strength'?`<div class="thinking-note"><p class="eyebrow">FROM OBSERVATION TO DIRECTION</p><p>Month 7: identify two promising strengths. Month 9: choose a main strength and one supporting skill.</p></div><div class="form-columns">${inputField('My main strength','strengths:main',{type:'text'})}${inputField('My supporting skill','strengths:support',{type:'text'})}</div>`:''}<div class="work-layout">${workTab==='evidence'?evidenceForm():workTab==='strength'?strengthForm():opportunityForm()}<div class="records">${list}</div></div>`;
}
function reviewsView(){
  const m=programme.months.find(m=>m.id===selectedMonth);const p=monthProgress(state,m.id);const done=reviewComplete(state,m.id);
  const ready=['date','understanding','action'].every(k=>String(value(`${m.id}:review:${k}`)).trim());
  return `${heading('A conversation, not an inspection.','Show the work. Explain the thinking. Agree one useful next step.',`<span class="pill green">${programme.months.filter(m=>reviewComplete(state,m.id)).length}/12 reviews</span>`)}<div class="review-layout"><nav class="review-months" aria-label="Review months">${programme.months.map(x=>`<button data-action="select-review" data-month="${x.id}" class="${x.id===m.id?'active':''}"><span>${esc(dateLabel(x.date,{month:'short',year:'numeric'}))}</span><span>${reviewComplete(state,x.id)?'DONE':'45 MIN'}</span></button>`).join('')}</nav><section class="panel review-form"><p class="eyebrow quiet">MONTH ${String(m.number).padStart(2,'0')}</p><h2>${esc(m.title)}</h2><div class="review-meta"><p>Planned: ${dateLabel(m.reviewDate)} · ${esc(m.reviewLead)}</p><span class="pill ${done?'green':''}">${done?'Review complete':'Review preparation'}</span></div><div class="summary-strip"><div><strong>${p.weeks.filter(Boolean).length}/4</strong><span>weekly tasks</span></div><div><strong>${p.resource?'Yes':'No'}</strong><span>learning done</span></div><div><strong>${p.result?'Ready':'Pending'}</strong><span>monthly result</span></div></div><div class="review-guide">0–10 min: campus life and wellbeing.<br>10–20 min: show the work and explain without AI.<br>20–35 min: feedback, strengths, social media and faith reflection.<br>35–45 min: agree one next action and support.</div><div class="form-columns">${inputField('Actual review date',`${m.id}:review:date`,{type:'date'})}${inputField('Campus life and wellbeing',`${m.id}:review:wellbeing`,{placeholder:'How has the month been? What support is needed?'})}<div class="full">${inputField('Work shown and progress',`${m.id}:review:work`,{placeholder:'What did she complete? What evidence did you discuss?'})}</div>${inputField('Explain without AI',`${m.id}:review:understanding`,{placeholder:'What could she explain? What needs further practice?'})}${inputField('Strengths and feedback',`${m.id}:review:strengths`)}${inputField('AI use, social media and faith reflection',`${m.id}:review:reflection`)}${inputField('One agreed next action',`${m.id}:review:action`,{placeholder:'One specific action, who will do it, and by when.'})}</div><div class="review-check"><label class="check-line"><input id="review-complete" type="checkbox" data-key="${m.id}:review:complete" ${checked(`${m.id}:review:complete`)} ${ready||value(`${m.id}:review:complete`,false)?'':'disabled'}>We held the conversation and agreed our next step.</label><p id="review-requirements">${ready?'You can mark the review complete.':'Add the actual date, an independent explanation and the next action to complete this review.'}</p></div></section></div>`;
}
function render(){
  if(!programme)return;
  document.querySelectorAll('#navigation a').forEach(a=>{const active=a.dataset.page===page;a.classList.toggle('active',active);if(active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  document.querySelectorAll('[data-role]').forEach(b=>b.classList.toggle('selected',b.dataset.role===role));
  $('#main').innerHTML=({today:todayView,programme:programmeView,habits:habitsView,work:workView,reviews:reviewsView}[page] || todayView)();
  // SVG/CSS values are set from known numeric progress, never from user text.
  document.querySelectorAll('[data-percent]').forEach(el=>el.style.width=Number(el.dataset.percent)+'%');
}
function go(target,month){if(month)selectedMonth=month;if(page===target){render();return;}location.hash=target;}
function openSettings(){$('#student-name').value=value('profile:name');$('#settings-dialog').showModal();setStatus($('#save-status').textContent);}
document.addEventListener('click',event=>{
  const close=event.target.closest('[data-close]');if(close){$('#'+close.dataset.close).close();return;}
  const roleButton=event.target.closest('[data-role]');if(roleButton){role=roleButton.dataset.role;try{localStorage.setItem('fieldnotes.role',role);}catch{}render();return;}
  const tab=event.target.closest('[data-work-tab]');if(tab){workTab=tab.dataset.workTab;render();return;}
  const action=event.target.closest('[data-action]');if(!action)return;
  const {month,key}=action.dataset;
  switch(action.dataset.action){
    case 'learn':go('today',month);break;
    case 'review':go('reviews',month);break;
    case 'select-review':selectedMonth=month;render();break;
    case 'work':workTab='evidence';go('work',month);break;
    case 'settings':openSettings();break;
    case 'this-week':selectedWeek=weekKey();render();break;
    case 'play-video':{
      const m=programme.months.find(x=>x.id===month);if(!m?.resource.embed)return;
      const iframe=document.createElement('iframe');iframe.src=m.resource.embed;iframe.title=m.resource.title;iframe.allow='fullscreen';iframe.referrerPolicy='strict-origin-when-cross-origin';iframe.allowFullscreen=true;iframe.loading='lazy';$('#video-slot').replaceChildren(iframe);break;
    }
    case 'delete-record':if(confirm('Remove this entry? The deletion will also sync to your shared space.')){change(key,null);render();}break;
  }
});
document.addEventListener('input',event=>{
  const el=event.target;if(!el.dataset.key || el.type==='checkbox')return;
  change(el.dataset.key,el.value);
  if(el.dataset.key.includes(':review:')){
    const ready=['date','understanding','action'].every(k=>String(value(`${selectedMonth}:review:${k}`)).trim());
    $('#review-complete').disabled=!ready && !value(`${selectedMonth}:review:complete`,false);$('#review-requirements').textContent=ready?'You can mark the review complete.':'Add the actual date, an independent explanation and the next action to complete this review.';
  }
});
document.addEventListener('change',event=>{
  const el=event.target;
  if(el.dataset.key && el.type==='checkbox'){const key=el.dataset.key;change(key,el.checked);render();document.querySelector(`[data-key="${key}"]`)?.focus();}
  if(el.hasAttribute('data-month-select')){selectedMonth=el.value;render();}
  if(el.id==='week-date'){selectedWeek=weekKey(new Date(el.value+'T12:00:00Z'));render();}
  if(el.dataset.portfolio){const key=el.dataset.portfolio;change(key,{...value(key),portfolio:el.checked});render();}
  if(el.dataset.opportunity){const key=el.dataset.opportunity;change(key,{...value(key),status:el.value});}
});
document.addEventListener('submit',event=>{
  const form=event.target;if(!['evidence-form','strength-form','opportunity-form'].includes(form.id))return;
  event.preventDefault();const fields=Object.fromEntries(new FormData(form));const prefix=form.id.split('-')[0];
  if(fields.url && !safeUrl(fields.url)){toast('Use an http or https link.');return;}
  if(prefix==='evidence')fields.portfolio=fields.portfolio==='on';
  if(prefix==='strength')for(const field of ['enjoyment','quality','improvement','initiative'])fields[field]=Number(fields[field]);
  fields.created=new Date().toISOString();change(`${prefix}:${crypto.randomUUID()}`,fields);render();toast('Entry saved.');
});
$('#settings-button').addEventListener('click',openSettings);
$('#student-name').addEventListener('input',event=>{change('profile:name',event.target.value);});
$('#settings-dialog').addEventListener('close',render);
$('#connect-button').addEventListener('click',()=>{if(connected){openSettings();return;}$('#connect-error').textContent='';$('#connect-dialog').showModal();});
$('#connect-form').addEventListener('submit',async event=>{
  event.preventDefault();$('#connect-submit').disabled=true;$('#connect-error').textContent='';
  try{
    const res=await fetch('/api/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:$('#access-code').value})});
    const data=await res.json();if(!res.ok)throw new Error(data.error || 'Unable to connect.');
    $('#access-code').value='';connected=true;$('#connect-button').textContent='Shared space connected';$('#connect-dialog').close();await syncNow();
  }catch(error){$('#connect-error').textContent=error.message;}
  finally{$('#connect-submit').disabled=false;}
});
$('#disconnect-button').addEventListener('click',async()=>{
  if(pending && connected)await syncNow();
  try{const res=await fetch('/api/session',{method:'DELETE'});if(!res.ok)throw new Error();connected=false;pending=false;clearTimeout(saveTimer);$('#connect-button').textContent='Connect shared space';setStatus('Saved on this device');toast('Disconnected. Your local copy remains on this device.');}catch{toast('Could not disconnect. Try again when online.');}
});
$('#sync-button').addEventListener('click',()=>syncNow());
$('#export-button').addEventListener('click',()=>{
  const data={...state,programmeVersion:programme.version,exportedAt:new Date().toISOString()};
  const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`fieldnotes-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Backup exported.');
});
$('#import-file').addEventListener('change',async event=>{
  const file=event.target.files[0];if(!file)return;
  try{
    if(file.size>500000)throw new Error('That backup is too large.');const incoming=JSON.parse(await file.text());if(!validState(incoming))throw new Error('Choose a valid Fieldnotes backup.');
    if(!confirm('Merge this backup into your current progress? Newer entries will be kept.'))return;
    state=mergeStates(state,incoming);persist();pending=true;render();if(connected)await syncNow();toast('Backup merged.');
  }catch(error){toast(error.message);}finally{event.target.value='';}
});
$('#print-button').addEventListener('click',()=>{$('#settings-dialog').close();window.print();});
window.addEventListener('hashchange',()=>{page=location.hash.slice(1);if(!['today','programme','habits','work','reviews'].includes(page))page='today';render();});
window.addEventListener('online',()=>{if(connected)syncNow({quiet:true});else pullShared({initial:true});});
window.addEventListener('storage',event=>{if(event.key!==STORAGE_KEY || !event.newValue)return;try{const other=JSON.parse(event.newValue);if(validState(other)){state=mergeStates(state,other);render();}}catch{}});
window.addEventListener('beforeunload',event=>{if(pending&&connected){event.preventDefault();event.returnValue='';}});
for(const dialog of document.querySelectorAll('dialog'))dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();});
async function start(){
  try{
    const res=await fetch('./programme.json');if(!res.ok)throw new Error();programme=await res.json();
    selectedMonth=nextMonth(state,programme.months).id;page=location.hash.slice(1)||'today';if(!['today','programme','habits','work','reviews'].includes(page))page='today';render();
    setStatus(storageAvailable?'Saved on this device':'Local saving unavailable. Export a backup.',storageAvailable?'':'error');
    await pullShared({initial:true});
    setInterval(()=>{if(document.visibilityState==='visible')pullShared({initial:true});},60000);
  }catch{$('#main').innerHTML='<section class="fatal"><h1>The programme could not be loaded.</h1><p>Your saved progress has not been changed. Refresh this page or check your connection.</p><button class="button" id="retry">Try again</button></section>';$('#retry').addEventListener('click',()=>location.reload());}
}
start();
