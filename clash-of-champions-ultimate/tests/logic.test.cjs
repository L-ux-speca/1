'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const project = path.resolve(__dirname, '..');
const scripts = ['core.js','app.js','fight.js','rt.js','network.js',
  'portraits.js','ai-enhanced.js','combat-refinements.js','rt-abilities.js'];
const context = vm.createContext({
  console, Math, Date, Map, Set, Promise, String, Number, Boolean,
  Object, Array, JSON, Error, Uint8Array,
  structuredClone, setTimeout, clearTimeout,
  localStorage: {getItem:()=>null,setItem:()=>{}},
  addEventListener:()=>{},
  window: {addEventListener:()=>{},devicePixelRatio:1},
  document: {querySelector:()=>null, querySelectorAll:()=>[],getElementById:()=>null,addEventListener:()=>{}},
  performance: {now:()=>0}
});
for(const script of scripts){
  const source=fs.readFileSync(path.join(project,'src',script),'utf8');
  new vm.Script(source,{filename:script}).runInContext(context);
}

vm.runInContext('AudioSys.sfx=()=>{};RT.spark=()=>{}',context);
const chars=vm.runInContext('CHARS',context);
assert.equal(chars.length,14);
assert.equal(new Set(chars.map(c=>c.id)).size,14);

for(const c of chars){
  const asset=path.join(project,'assets','portraits',c.id+(c.id==='lapis'?'.png':'.jpg'));
  assert.ok(fs.existsSync(asset),`Missing full-resolution portrait: ${c.id}`);
  assert.ok(fs.statSync(asset).size>10000,`Unexpectedly small portrait: ${c.id}`);
  const markup=vm.runInContext(`portrait(CHARS.find(c=>c.id==='${c.id}'))`,context);
  assert.ok(markup.includes(`portrait-${'original'}`));
  assert.ok(markup.includes(`/${c.id}.`));

  // Run every adapted RT skill against a real lightweight game state.
  for(let i=0;i<c.skills.length;i++){
    if(c.skills[i].passive)continue;
    vm.runInContext(`RT.g={c:CHARS.find(c=>c.id==='${c.id}'),
      state:'active',phase:1,phaseWait:0,cd:[0,0,0,0],
      hp:${c.hp},pe:${c.pe},x:700,y:440,dx:-1,dy:0,t:1,
      inv:0,shield:0,objects:[],bullets:[],shots:[],fx:[],warnings:[],
      activeAbilities:[],damage:0,bossHP:720,
      targets:[{id:'flag',hp:720,maxHp:720,x:250,y:260,r:60,ship:true}]};
      RT.cast(${i});`,context);
    const cooldown=vm.runInContext(`RT.g.cd[${i}]`,context);
    assert.ok(cooldown>=0,`Invalid cooldown for ${c.id} ability ${i+1}`);
  }

  vm.runInContext(`Fight.g={e:[]}`,context);
  const f={id:c.id,c,hp:c.hp,maxHp:c.hp,pe:c.pe,x:240,y:460,
    side:1,face:1,cd:[0,0,0,0],st:{},aiTimer:0,ai:{},
    recovery:0,stun:0,grounded:true};
  const enemy={x:405,y:460,side:0,attack:null,grounded:true,crouch:false};
  context.mockFighter=f;
  context.mockOpponent=enemy;
  const action=vm.runInContext('Fight.ai(mockFighter,mockOpponent)',context);
  assert.ok(action && typeof action==='object');
}
console.log('PASS: 14 portraits, 14 AI profiles, every active RT ability, and JavaScript parse');
