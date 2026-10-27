'use strict';

// The situational choices and character-specific weights are adapted from the
// more detailed combat AI in index(1).html, using the new engine's commands.
const AI_PROFILES = Object.freeze({
  yuzuha: (d,f,e) => [d<115?3:0, d<170&&!e.crouch?2:0, f.hp<f.maxHp*.55?2:0],
  caesar: (d,f) => [d<245?2.4:0, d>95&&d<340?2.1:0, !f.shield&&d<200?2:0],
  araya: d => [d>125?3:1, d>170?2:0, d<230?2.1:0],
  lapis: (d,f,e,g) => [d>145&&d<275&&!g.e.some(o=>o.owner===f.side&&o.kind==='orbit')?2.4:0,
    e.grounded&&d>90?3:0, !f.magnet&&(d>260||f.x<115||f.x>985)?2:0],
  tori: (d,f) => [!f.flying&&f.pe>45?2.2:f.flying&&f.pe<17?2.4:0,
    d<400?1.5:0, f.flying&&f.y<400&&d<170?3:0,
    f.maxHp-f.hp>=25?4:0],
  akira: (d,f,e) => [d<200&&!e.crouch?2.4:0,d<170?2.5:0,e.grounded&&d>85?2:0],
  sonic: (d,f) => [f.hp>45&&!(f.st.speed>0)?1.4:0,d<350?2.2:0,
    !(f.st.katana>0)&&d<190?2.7:0],
  david: (d,f) => [d<115&&!(f.st.fist>0)?2.5:0,d>110?2:0,d<340?1.8:0],
  chieko: d => [d>100&&d<350?2:0,d<400?2:0,d<170?1.7:0,d<270?3:0],
  airi: d => [d<480?2.2:0,d<230?2.1:0,d>100&&d<450?2.6:0],
  dio: (d,f,e,g) => [d<115?3:0,d<145&&(e.attack||g.e.some(o=>o.owner===e.side))?3:0,0],
  kayano: (d,f) => [d<118?(f.comboPoints>=2?4:1.2):0],
  mechamaru: (d,f) => [d>100?3:1.5,d<500?2.5:0,
    !f.robot?2.7:0],
  kisei: (d,f,e) => [e.grounded&&d>150?2.5:0,d>60&&d<180?2.2:0,
    d<380?2:0,d<500?2:0]
});

if (!['easy','normal','hard'].includes(Pref.aiDifficulty)) Pref.aiDifficulty = 'normal';

const originalSettings = App.settings.bind(App);
App.settings = function(tab) {
  originalSettings(tab);
  if (tab === 'keys') return;
  const first = document.querySelector('#modalRoot .two-cols > div');
  if (!first) return;
  const field = document.createElement('div');
  field.className = 'field';
  field.innerHTML = `<label>СЛОЖНОСТЬ ОБЫЧНОГО ИИ</label><select id="ai-difficulty-setting">
    <option value="easy">Лёгкая · медленные решения</option>
    <option value="normal">Обычная · адаптивный бой</option>
    <option value="hard">Сложная · умная защита</option>
  </select>`;
  first.append(field);
  field.querySelector('select').value = Pref.aiDifficulty;
  field.querySelector('select').addEventListener('change', event => {
    Pref.aiDifficulty = event.target.value;
    App.savePrefs();
  });
};

Fight.ai = function(f, opponent) {
  const dt = 1/60, g = this.g;
  const d = Math.abs(opponent.x - f.x);
  const direction = Math.sign(opponent.x - f.x) || f.face;
  const ranged = !['sonic','tori','dio','kayano'].includes(f.id);
  const difficulty = Pref.aiDifficulty || 'normal';
  const reaction = difficulty === 'hard' ? .13 : difficulty === 'easy' ? .42 : .26;
  const defenseChance = difficulty === 'hard' ? .8 : difficulty === 'easy' ? .24 : .5;

  const brain = f._brain ??= {style:'approach',styleLeft:0,dodgeUntil:0,hopReady:0};
  brain.styleLeft -= dt;
  brain.dodgeUntil = Math.max(0,brain.dodgeUntil-dt);
  brain.hopReady = Math.max(0,brain.hopReady-dt);
  if (brain.styleLeft <= 0) {
    brain.styleLeft = 1.1+Math.random()*1.7;
    brain.style = Math.random()<(ranged?.24:.13)?'space':'approach';
  }
  const ideal = ranged ? 170 : 65;
  const command = {};
  if (d > ideal + 28 || (d>110&&brain.style==='approach'))
    command[direction>0?'right':'left']=true;
  else if (brain.style==='space'&&d<ideal-42&&d>45)
    command[direction>0?'left':'right']=true;

  const approachingProjectile = g.e.some(projectile =>
    projectile.owner!==f.side&&projectile.kind==='projectile'&&
    Math.abs(projectile.x-f.x)<180&&
    Math.abs(projectile.y-(f.y-45))<85&&
    Math.sign(projectile.vx||0)===Math.sign(f.x-projectile.x));
  if (approachingProjectile && brain.hopReady <= 0 && Math.random()<defenseChance*.13) {
    command.up=true;
    brain.hopReady=2.2;
    brain.dodgeUntil=.25;
  }
  if (opponent.attack && d<115 && Math.random()<defenseChance*.16) {
    if (opponent.attack.kind==='punch') command.down=true;
    else if (brain.hopReady<=0) {command.up=true;brain.hopReady=2;}
    else command.block=true;
    brain.dodgeUntil=.22;
  }
  if (!command.up && !command.down && d<110 && Math.random()<defenseChance*.06)
    command.block=true;
  if (brain.dodgeUntil>0 && !command.up) command.block=true;

  if (f.id==='lapis' && f.magnet && d>260 && Math.random()<.07)
    command.doubleRight=true;
  if (f.id==='tori' && f.flying && f.pe<15) command.s1=true;

  f.aiTimer -= dt;
  if (f.aiTimer > 0 || f.recovery>.1 || f.stun>0) return command;
  f.aiTimer = reaction+rnd(0,reaction*.55);

  if (d<110&&!command.block) {
    const attackChance=difficulty==='hard'?.75:difficulty==='easy'?.37:.55;
    if (Math.random()<attackChance) command[Math.random()<.58?'punch':'kick']=true;
    else if(d<65&&Math.random()<.16)command.throw=true;
  }

  const profile = AI_PROFILES[f.id];
  const weights = profile?profile(d,f,opponent,g):[];
  const ready = f.c.skills.map((skill,index) => ({skill,index,weight:weights[index]||0}))
    .filter(({skill,index,weight}) => weight>0&&!skill.passive&&
      f.cd[index]<=0&&f.pe>=skill.cost);
  if (!ready.length) return command;
  const skillChance = difficulty==='hard'?.83:difficulty==='easy'?.44:.65;
  if (Math.random()>skillChance) return command;
  const sum=ready.reduce((s,c)=>s+c.weight,0);
  let roll=Math.random()*sum;
  for(const choice of ready){
    roll-=choice.weight;
    if(roll<=0){command['s'+(choice.index+1)]=true;break;}
  }
  return command;
};
