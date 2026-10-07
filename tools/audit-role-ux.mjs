// Isolated browser walkthrough. Authentication/memberships are fixtures;
// Supabase traffic is blocked. No real account or shared records are changed.
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const base = process.argv[2] || 'http://127.0.0.1:4177';
const port = process.argv[3] || '9239';
const output = process.argv[4] || '/tmp/hatake-role-audit';
await mkdir(output, { recursive: true });
async function connect(url) {
  const ws = new WebSocket(url), pending = new Map();
  let seq = 0;
  ws.addEventListener('message', e => {
    const r = JSON.parse(e.data), p = pending.get(r.id);
    if (!p) return;
    clearTimeout(p.timer); pending.delete(r.id);
    if (r.error) p.reject(new Error(r.error.message)); else p.resolve(r.result);
  });
  await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once:true }); ws.addEventListener('error', reject, { once:true }); });
  return { close:() => ws.close(), call(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++seq;
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Timed out: ${method}`)); }, 25000);
      pending.set(id, {resolve, reject, timer}); ws.send(JSON.stringify({id,method,params}));
    });
  } };
}
const version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
const browser = await connect(version.webSocketDebuggerUrl);
const { browserContextId } = await browser.call('Target.createBrowserContext');
const records = [];
try {
 for (const width of (process.env.AUDIT_PC_ONLY ? [1440] : [1440, 390])) {
  const { targetId } = await browser.call('Target.createTarget', { url:'about:blank', browserContextId });
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const page = await connect(targets.find(t => t.id === targetId).webSocketDebuggerUrl);
  const evaluate = async expression => {
    const result = await page.call('Runtime.evaluate', {expression, awaitPromise:true, returnByValue:true});
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };
  try {
   await page.call('Network.enable');
   await page.call('Network.setBlockedURLs', { urls:['*supabase.co/*'] });
   await page.call('Page.enable');
   await page.call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width===390});
   await page.call('Page.navigate',{url:`${base}/app.html#profile`});
   await evaluate(`new Promise((resolve,reject)=>{let count=0;const timer=setInterval(()=>{if(document.documentElement.dataset.appReady==='true'){clearInterval(timer);resolve(true);}else if(++count>160){clearInterval(timer);reject(new Error('App did not initialize'));}},100);})`);
   assert.equal(await evaluate(`document.querySelector('#loginScreen').checkVisibility()`),true,'未ログインでは専用ログイン画面');
   assert.equal(await evaluate(`document.querySelector('#googleSignInButton').checkVisibility() && document.querySelector('#sendMagicLinkButton').checkVisibility()`),true,'Googleとメールの入口');
   await evaluate(`window.auditVisible = n => Boolean(n && n.checkVisibility({visibilityProperty:true}));
    window.auditSetup = (roles, preferred, registered=true) => {
      clearDirtyForms(); localStorage.clear(); suppressRemoteSync = true;
      stateRepository={save:()=>({}),load:()=>null}; lastSaveFailed=false;
      supabaseSyncCoordinator?.cancel(); supabaseSyncCoordinator=null;
      supabaseSession={user:{id:'audit-user',email:'audit@example.invalid'}};
      const workspace={id:'audit-region',name:'仮想操作の地域',prefecture:'茨城県',municipality:'笠間市',district:'確認用'};
      const memberships=roles.map(role=>({workspace_id:workspace.id,role,status:'active',workspaces:workspace}));
      supabaseMemberships=memberships;
      localStorage.setItem(ACTIVE_WORKSPACE_KEY,workspace.id);
      state=normalizeState(createSampleState());
      state.profile=defaultProfile(); state.profile.registered=registered; state.profile.role=registered?preferred:null;
      state.profile.name=registered?'仮想利用者':''; state.profile.targetMunicipalities=[];
      state.role=preferred; activeRole=preferred;
      state.fields.forEach(f=>{f.ownerUserId=['spray-field-a','organic-field-a'].includes(f.id)?'audit-user':'audit-other';});
      supabaseAuthService={session:async()=>supabaseSession,memberships:async()=>memberships,
        accountDeletionRequest:async()=>null,loadProfile:async()=>({profile:state.profile,equipmentTemplate:{}}),saveProfile:async()=>({}),
        createWorkspace:async input=>{memberships.push({workspace_id:'audit-created',role:input.role,status:'active',workspaces:{id:'audit-created',...input}});return 'audit-created';},
        setMyWorkspaceRoles:async(id,roles)=>{const workspace=memberships.find(m=>m.workspace_id===id).workspaces;for(let i=memberships.length-1;i>=0;i--){if(memberships[i].workspace_id===id && memberships[i].role!=='admin')memberships.splice(i,1);}roles.forEach(role=>memberships.push({workspace_id:id,role,status:'active',workspaces:workspace}));},
        addWorkspaceRole:async(id,role)=>{memberships.push({workspace_id:id,role,status:'active',workspaces:memberships.find(m=>m.workspace_id===id).workspaces});}};
      workspaceCreationFeedback=null;
      renderAll(); switchView('dashboard');
    };
    window.auditSummary=()=>({role:activeRole,profileRole:state.profile.role,available:availableRoles(),nav:[...document.querySelectorAll('.nav-list [data-view-target],.mobile-quickbar [data-view-target]')].filter(auditVisible).map(n=>n.textContent.trim()),roleButtons:[...document.querySelectorAll('#roleSwitcher [data-role]')].filter(auditVisible).map(n=>({label:n.textContent.trim(),y:Math.round(n.getBoundingClientRect().y)})),overflow:document.documentElement.scrollWidth-innerWidth});`);
   for (const [name, roles, preferred] of [
     ['sprayer',['sprayer'],'sprayer'], ['neighbor',['neighbor'],'neighbor'], ['admin',['admin'],'admin'], ['combined',['sprayer','admin'],'sprayer'],
     ['all-roles',['sprayer','neighbor','admin'],'sprayer'],
   ]) {
    await evaluate(`auditSetup(${JSON.stringify(roles)},${JSON.stringify(preferred)})`);
    const row = { width, name, home:await evaluate('auditSummary()') };
    if(name==='sprayer') {
      row.plan = await evaluate(`(()=>{ document.querySelector('#caseList [data-action="new-plan"]').click();const f=document.querySelector('#planForm');return {view:activeView,fields:[...f.elements].filter(auditVisible).filter(n=>n.name).map(n=>({name:n.name,required:n.required,label:n.closest('label')?.textContent.trim().slice(0,55)})),pageHeight:document.documentElement.scrollHeight};})()`);
      row.noticeDraft=await evaluate(`(()=>{auditSetup(['sprayer'],'sprayer');switchView('notify');const text=document.querySelector('#noticeText');text.value+='\\n手入力した連絡事項';text.dispatchEvent(new Event('input',{bubbles:true}));const dirty=document.querySelectorAll('form[data-dirty="true"]').length;const response=document.querySelector('[data-notify-response]');response.value='確認しました';response.dispatchEvent(new Event('change',{bubbles:true}));return {trigger:'相手の返答を記録',dirty,retained:document.querySelector('#noticeText').value.includes('手入力した連絡事項')};})()`);
    }
    if(name==='neighbor') {
      row.homeField=await evaluate(`({ownFields:allFields().filter(f=>isSelfOwned(f)).length,notices:document.querySelectorAll('.notice-card').length,text:document.querySelector('#roleActionPanel').innerText.slice(0,900)})`);
      row.replyDraft=await evaluate(`(()=>{const notes=[...document.querySelectorAll('[data-reply-note]')];notes[1].value='別の予定について書きかけ';notes[1].dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('[data-notify-action][data-response="確認しました"]').click();return {retained:[...document.querySelectorAll('[data-reply-note]')].some(n=>n.value.includes('書きかけ'))};})()`);
      row.newField=await evaluate(`(()=>{switchView('fields');document.querySelector('#newFieldStatusButton').click();const field=activeField();return {name:field.name,geometry:field.geometry||null,geo:field.geo||null,mapGeometry:fieldFeatureCollection().features.find(f=>f.id===field.id)?.geometry,legacyRect:[field.x,field.y,field.w,field.h],geometryControls:[...document.querySelector('#fieldStatusForm').elements].filter(auditVisible).map(n=>n.name),owner:field.ownerUserId};})()`);
    }
    if(name==='neighbor') {
      row.positionRegistration = await evaluate(`(()=>{const field=activeField(), count=allFields().length; const geometry=structuredClone(normalizedFieldGeometry(allFields().find(f=>f.id==='organic-field-a'))); document.querySelector('[data-register-field-position="'+field.id+'"]').click(); lastClickedParcel={geometry,properties:{}}; adoptParcel('neighbor'); const saved=fieldRepository.get(field.id);return {countBefore:count,countAfter:allFields().length,positionUnregistered:saved.positionUnregistered,geometryMatches:JSON.stringify(saved.geometry)===JSON.stringify(geometry),view:activeView};})()`);
      assert.equal(row.positionRegistration.countBefore,row.positionRegistration.countAfter,'位置登録で畑を二重作成しない');
      assert.equal(row.positionRegistration.positionUnregistered,false);
      assert.equal(row.positionRegistration.geometryMatches,true,'選択した境界を採用する');
    }
    if(name==='admin') {
      row.controls=await evaluate(`(()=>{switchView('admin');const admin=[...document.querySelectorAll('[data-view="admin"] button')].filter(auditVisible).map(n=>n.textContent.trim());switchView('profile');return {admin,profileButtons:[...document.querySelectorAll('[data-view="profile"] button')].filter(auditVisible).map(n=>n.textContent.trim())};})()`);
    }
    if(name==='combined') {
      row.switch=await evaluate(`(()=>{const initialPlan=activePlan().id;document.querySelector('#roleSwitcher [data-role="admin"]').click();switchView('admin');const other=[...document.querySelectorAll('[data-admin-plan]')].find(n=>n.dataset.adminPlan!==initialPlan);other?.click();const reviewed=activePlan().id;document.querySelector('#roleSwitcher [data-role="sprayer"]').click();return {initialPlan,reviewed,returnedPlan:activePlan().id,returnedRole:activeRole};})()`);
      row.profileSave=await evaluate(`(async()=>{document.querySelector('#roleSwitcher [data-role="admin"]').click();switchView('profile');activePlan().notificationAcks={'organic-field-a':'2026-09-08T00:00:00Z'};const before={role:activeRole,profileRole:state.profile.role,planId:activePlan().id,operator:activePlan().operator,revision:activePlan().noticeRevision||0,acks:activePlan().notificationAcks};document.querySelector('#profileForm').elements.name.value='兼務者の新しい氏名';await saveProfileFromForm();return {before,after:{role:activeRole,profileRole:state.profile.role,planId:activePlan().id,operator:activePlan().operator,revision:activePlan().noticeRevision||0,acks:activePlan().notificationAcks}};})()`);
    }
    if(name==='all-roles') {
      row.sameField=await evaluate(`(()=>{state.fields.forEach(f=>{if(f.type!=='spray')f.ownerUserId='audit-other';});state.activeFieldId='spray-field-a';document.querySelector('#roleSwitcher [data-role="neighbor"]').click();return {owned:allFields().filter(isSelfOwned).map(f=>({id:f.id,type:f.type,name:f.name})),ownFieldsInNeighborHome:allFields().filter(f=>isSelfOwned(f)).length,homeName:activeField()?.name,visibleHome:document.querySelector('#roleActionPanel').innerText.slice(0,550)};})()`);
    }
    await evaluate(`clearDirtyForms();switchView('profile');window.scrollTo(0,0)`);
    row.profile=await evaluate(`(()=>{const f=document.querySelector('#profileForm');return {summary:auditSummary(),controls:[...f.elements].filter(auditVisible).filter(n=>n.name).length,required:[...f.elements].filter(n=>n.required).map(n=>n.name),profileTop:Math.round(f.getBoundingClientRect().top),pageHeight:document.documentElement.scrollHeight,body:document.querySelector('#profileModeBanner').innerText,selectedProfileRole:f.elements.role.value};})()`);
    await evaluate(`document.querySelector('#toast').classList.remove('show')`);
    const shot=await page.call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
    await writeFile(`${output}/${name}-${width}.png`,Buffer.from(shot.data,'base64'));
    if (row.noticeDraft) assert.equal(row.noticeDraft.retained, true, '連絡文の下書きを保持');
    if (row.replyDraft) assert.equal(row.replyDraft.retained, true, '別のお知らせの下書きを保持');
    if (row.newField) assert.equal(row.newField.mapGeometry, undefined, '位置未登録の畑を地図に出さない');
    if (row.switch) assert.equal(row.switch.returnedPlan, row.switch.initialPlan, '兼務で元の予定へ戻る');
    if (row.profileSave) assert.deepEqual(row.profileSave.after, row.profileSave.before, '本人情報の保存で既存の予定と立場を変えない');
    if (row.sameField) assert.equal(row.sameField.homeName, row.sameField.owned[0].name, '散布対象の畑も周辺関係者として利用できる');
    assert.equal(row.profile.summary.overflow, 0, '横方向のはみ出しなし');
    records.push(row);console.log(JSON.stringify(row));
   }
   const neighborRegistration = await evaluate(`(async()=>{
     auditSetup(['sprayer'],'sprayer',false); switchView('profile');
     let joined;
     supabaseAuthService.joinMunicipality=async(code,roles)=>{joined={code,roles};await supabaseAuthService.setMyWorkspaceRoles('audit-region',roles);return 'audit-region';};
     document.querySelector('[data-profile-role="neighbor"]').click();
     const form=document.querySelector('#profileForm');
     form.elements.name.value='一般利用者';form.elements.preferredContactMethod.value='line';renderContactFields();
     form.elements.lineId.value='sample-line';form.elements.targetMunicipality.value='08201';
     const conditional=form.elements.lineId.checkVisibility() && !form.elements.email.checkVisibility();
     await saveProfileFromForm();
     return {joined,conditional,view:activeView,setup:state.profileSetup,line:state.profile.lineId,privatePhone:state.profile.visibility.phone};
   })()`);
   assert.deepEqual(neighborRegistration.joined,{code:'08201',roles:['neighbor']});
   assert.equal(neighborRegistration.conditional,true);
   assert.equal(neighborRegistration.view,'dashboard');
   assert.equal(neighborRegistration.setup,null);
   assert.equal(neighborRegistration.line,'sample-line');
   assert.equal(neighborRegistration.privatePhone,'private');
   records.push({width,name:'neighbor-registration',...neighborRegistration});
   const missingRoleRpc = await evaluate(`(async()=>{
     auditSetup(['admin'],'admin'); switchView('profile');
     let savedProfile;
     supabaseAuthService.setMyWorkspaceRoles=async()=>{throw Object.assign(new Error('missing RPC'),{cause:{code:'PGRST202'}});};
     supabaseAuthService.saveProfile=async profile=>{savedProfile=structuredClone(profile);};
     document.querySelector('#profileForm').elements.name.value='保存確認の氏名';
     await saveProfileFromForm();
     return {name:savedProfile?.name,role:savedProfile?.role,available:availableRoles(),
       feedback:document.querySelector('#profileRoleSaveStatus').innerText,
       retained:document.querySelector('#profileForm').elements.role.value,
       dirty:document.querySelector('#profileForm').dataset.dirty};
   })()`);
   assert.equal(missingRoleRpc.name,'保存確認の氏名','立場RPC未適用でも基本情報はクラウドへ保存する');
   assert.equal(missingRoleRpc.role,'admin','失敗した立場を保存済みにしない');
   assert.deepEqual(missingRoleRpc.available,['admin']);
   assert.ok(missingRoleRpc.feedback.includes('立場の変更は未保存'));
   assert.equal(missingRoleRpc.retained,'sprayer');
   assert.equal(missingRoleRpc.dirty,'true');
   records.push({width,name:'missing-role-rpc',...missingRoleRpc});
   await evaluate(`auditSetup([],null,false);switchView('profile')`);
   const onboarding=await evaluate(`(async()=>{const before={role:activeRole,profileRole:state.profile.role,available:availableRoles()};document.querySelector('#workspaceNameInput').value='最初の地域';await createSupabaseWorkspace();return {before,after:{role:activeRole,profileRole:state.profile.role,available:availableRoles(),profileButtons:[...document.querySelectorAll('[data-profile-role]')].map(n=>({role:n.dataset.profileRole,disabled:n.disabled})),plans:allPlans().length,fields:allFields().length,card:document.querySelector('#activeWorkspaceCard').innerText}};})()`);
   assert.equal(onboarding.after.plans,0,'新しい地域にサンプル予定を混ぜない');
   assert.equal(onboarding.after.fields,0,'新しい地域にサンプル畑を混ぜない');
   assert.ok(onboarding.after.available.includes('sprayer'),'初回地域作成から散布者として開始できる');
   assert.ok(!onboarding.after.available.includes('admin'),'地域作成で管理者にならない');
   const combinedSetup=await evaluate(`(async()=>{switchView('profile');document.querySelector('[data-profile-role="both"]').click();document.querySelector('#profileForm').elements.name.value='初回兼務者';await saveProfileFromForm();return {roles:state.profile.roles,available:availableRoles(),adminChoice:Boolean(document.querySelector('[data-profile-role="admin"]'))};})()`);
   assert.deepEqual(combinedSetup.roles,['sprayer','neighbor']);
   assert.deepEqual([...combinedSetup.available].sort(),['neighbor','sprayer']);
   assert.equal(combinedSetup.adminChoice,false);
   records.push({width,name:'first-region',...onboarding});console.log(JSON.stringify({width,name:'first-region',...onboarding}));
   const missingMunicipality = await evaluate(`(async()=>{
     switchView('profile');
     const form=document.querySelector('#profileForm');
     form.elements.name.value='登録エラー確認';form.dataset.dirty='true';
     supabaseAuthService.joinMunicipality=async()=>{throw Object.assign(new Error('missing RPC'),{cause:{code:'PGRST202'}});};
     const results=[];
     for (const selector of ['#profileBasicSave', '[data-setup-action="complete"]']) {
       if(selector.includes('complete')) {
         const feature=parcelData.features[0];lastClickedParcel={geometry:feature.geometry,properties:feature.properties};selectSetupParcel();
       }
       const button=document.querySelector(selector);
       button.scrollIntoView({block:'center',behavior:'instant'});
       await new Promise(resolve=>setTimeout(resolve,200));
       const before=scrollY;
       button.click();
       await new Promise(resolve=>setTimeout(resolve,250));
       const status=document.querySelector('#profileRoleSaveStatus');
       results.push({selector,before,after:scrollY,noJump:Math.abs(scrollY-before)<50,error:!status.hidden && status.textContent.includes('未適用'),view:activeView});
     }
     delete supabaseAuthService.joinMunicipality;
     state.profileSetup.fields=[];renderProfileSetup();
     return results;
   })()`);
   console.log(JSON.stringify(missingMunicipality));
   for(const result of missingMunicipality) {assert.equal(result.noJump,true);assert.equal(result.error,true);assert.equal(result.view,'profile');}
   records.push({width,name:'missing-municipality-clicks',results:missingMunicipality});
   const setupFlow = await evaluate(`(async()=>{
     stateRepository={save:()=>({}),load:()=>null};
     switchView('profile'); document.querySelector('#profileForm').elements.name.value='初回登録者';
     if (!document.querySelector('#profileSetupFlow #mapCanvas')) throw Error('保存前から同じ画面に地図を表示');
     if (document.querySelector('[name="visibility_name"]')) throw Error('公開範囲の入力欄を削除');
     if (document.querySelector('#profileBasicSave').textContent !== '基本情報を保存する') throw Error('基本情報保存ボタンの表記');
     document.querySelector('#profileBasicSave').click();
     await new Promise((resolve,reject)=>{let n=0;const timer=setInterval(()=>{if(!setupLoading && document.querySelector('#profileForm').dataset.dirty!=='true'){clearInterval(timer);resolve();}else if(++n>150){clearInterval(timer);reject(Error('保存クリックが完了しない'));}},100);});
     const entered=activeView==='profile' && state.profileSetup.step==='fields' && document.querySelector('#profileSetupFlow #mapCanvas') !== null;
     if (!parcelData?.features?.length) throw Error('市町村境界の読込に失敗');
     if (!setupMapMessage.includes('表示しました')) throw Error('圃場選択へ進むと自動で境界を読み込む');
     await new Promise(resolve=>setTimeout(resolve,900));
     const mapShell=document.querySelector('#profileSetupFlow .map-shell');
     if (Math.abs(mapShell.getBoundingClientRect().top-110)>15 && Math.abs(window.scrollY + window.innerHeight - document.documentElement.scrollHeight)>15) throw Error('保存後は地図までスクロール: '+mapShell.getBoundingClientRect().top);
     for (const overlay of mapShell.querySelectorAll('.map-overlay,.map-legend')) if(getComputedStyle(overlay).display !== 'none') throw Error('登録地図の不要な表示');
     if (!mapShell.querySelector('.maplibregl-ctrl-zoom-in') || !mapShell.querySelector('.maplibregl-ctrl-zoom-out')) throw Error('地図の拡大縮小ボタン');
     const before=allFields().length;
     for(const feature of parcelData.features.slice(0,2)){lastClickedParcel={geometry:feature.geometry,properties:feature.properties}; selectSetupParcel();}
     const staged=state.profileSetup.fields.length===2 && allFields().length===before;
     await handleProfileSetup('back');
     const kept=document.querySelector('#profileForm').elements.name.value==='初回登録者' && state.profileSetup.fields.length===2;
     await handleProfileSetup('map');
     state=normalizeState(structuredClone(state));
     const restored=state.profileSetup.fields.length===2;
     document.querySelector('#profileForm').elements.name.value='完了時に更新した氏名';
     document.querySelector('#profileForm').dataset.dirty='true';
     document.querySelector('[data-setup-action="complete"]').click();
     await new Promise(resolve=>setTimeout(resolve,500));
     if(activeProfile().name !== '完了時に更新した氏名') throw Error('未保存の基本情報も登録完了時に保存');
     if (activeView !== 'dashboard') throw Error('登録完了後は予定・記録へ');
     if (document.querySelector('#toast').textContent !== 'プロフィールの登録が完了しました。') throw Error('登録完了メッセージ');
     return {entered,staged,kept,restored,complete:state.profileSetup.step==='complete',added:allFields().length-before};
   })()`);
   for(const key of ['entered','staged','kept','restored','complete']) assert.equal(setupFlow[key],true,'プロフィールから圃場登録: '+key);
   assert.equal(setupFlow.added,2);
   records.push({width,name:'profile-setup-flow',...setupFlow}); console.log(JSON.stringify({width,name:'profile-setup-flow',...setupFlow}));
   await evaluate(`clearDirtyForms()`);
   await page.call('Page.navigate',{url:`${base}/app.html?demo=1`});
   await evaluate(`new Promise(resolve=>{const timer=setInterval(()=>{if(document.documentElement.dataset.appReady==='true'){clearInterval(timer);resolve();}},100);})`);
   const demo=await evaluate(`({isolated:!supabaseRuntime.enabled && !supabaseSession,roles:availableRoles(),plans:allPlans().length,banner:document.querySelector('#demoExperienceBanner').innerText,loginHidden:document.querySelector('#loginScreen').hidden})`);
   assert.equal(demo.isolated,true);assert.equal(demo.roles.length,3);assert.ok(demo.plans>=3);assert.equal(demo.loginHidden,true);
   records.push({width,name:'isolated-demo',...demo});
  } finally { page.close(); await browser.call('Target.closeTarget',{targetId}); }
 }
 await writeFile(`${output}/findings.json`,JSON.stringify(records,null,2));
} finally { await browser.call('Target.disposeBrowserContext',{browserContextId});browser.close(); }
