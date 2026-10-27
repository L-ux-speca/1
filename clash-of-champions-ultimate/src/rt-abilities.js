'use strict';

// Character-aware adaptation of the 14 original techniques to the ship arena.
// A small registry keeps a future character's RT moves outside the boss engine.
// Passive effects are never presented as activatable skills.
const RTAbility = {
  target(rt) { return rt.target(); },
  volley(rt,count,damage=7,spread=.09,speed=700) {
    for(let n=0;n<count;n++) rt.shoot(damage,(n-(count-1)/2)*spread,5,speed);
    rt.spark(rt.g.x,rt.g.y,rt.g.c.color,Math.min(20,count*3));
  },
  strike(rt,damage) {
    const t=this.target(rt);
    if (!t) return;
    rt.hitTarget(t,damage);
    rt.spark(t.x,t.y,rt.g.c.color,20);
  },
  shock(rt,radius=155,damage=0) {
    const g=rt.g;
    g.bullets=g.bullets.filter(b=>hypot(b.x-g.x,b.y-g.y)>radius);
    g.objects.push({kind:'pulse',x:g.x,y:g.y,r:radius,life:.38,full:.38});
    if(damage>0)for(const t of [...rt.targets()])
      if(hypot(t.x-g.x,t.y-g.y)<radius+35)rt.hitTarget(t,damage);
    rt.spark(g.x,g.y,g.c.color,24);
  },
  shield(rt,seconds=2.4){
    rt.g.shield=Math.max(rt.g.shield,seconds);
    rt.g.inv=Math.max(rt.g.inv,.2);
    rt.spark(rt.g.x,rt.g.y,'#a2f5ef',22);
  },
  heal(rt,amount){rt.g.hp=Math.min(rt.g.c.hp,rt.g.hp+amount);rt.spark(rt.g.x,rt.g.y,'#a3eab6',24);},
  effect(rt,kind,seconds,options={}){
    rt.g.activeAbilities??=[];
    rt.g.activeAbilities.push({kind,life:seconds,interval:options.interval||.4,
      timer:0,damage:options.damage||0,radius:options.radius||95,
      targetId:rt.target()?.id,originX:options.x??rt.g.x,
      originY:options.y??rt.g.y,shots:options.shots||1});
  },
  damageOverTime(rt,seconds,damagePerTick,interval=.4){
    this.effect(rt,'damage-over-time',seconds,{damage:damagePerTick,interval});
  },
  summon(rt,seconds=5,damage=6,shots=1){
    this.effect(rt,'summon',seconds,{damage,shots,interval:.72});
  },
  slowField(rt,seconds=4,radius=140){
    this.effect(rt,'magnet',seconds,{radius});
  },
  orbit(rt,seconds=3.4){
    this.effect(rt,'orbit',seconds,{radius:70,damage:5,interval:.7});
  }
};

const RT_SKILL_HANDLERS = Object.freeze({
  yuzuha: [
    rt=>RTAbility.strike(rt,20),
    rt=>RTAbility.damageOverTime(rt,1.8,4,.35),
    rt=>RTAbility.shield(rt,3)
  ],
  caesar: [
    rt=>RTAbility.volley(rt,7,4,.12,520),
    rt=>RTAbility.volley(rt,1,18,0,980),
    rt=>RTAbility.shield(rt,3.2)
  ],
  araya: [
    rt=>RTAbility.volley(rt,7,5,.14,590),
    rt=>{RTAbility.strike(rt,26);rt.g.inv=Math.max(rt.g.inv,.45);},
    rt=>RTAbility.shield(rt,3)
  ],
  lapis: [
    rt=>RTAbility.orbit(rt,3.4),
    rt=>RTAbility.strike(rt,25),
    rt=>RTAbility.slowField(rt,4.5,175)
  ],
  tori: [
    rt=>RTAbility.effect(rt,'flight',4.2,{radius:120}),
    rt=>RTAbility.volley(rt,1,18,0,740),
    rt=>{RTAbility.shock(rt,145,30);rt.g.inv=Math.max(rt.g.inv,.35);},
    rt=>RTAbility.heal(rt,30)
  ],
  akira: [
    rt=>RTAbility.damageOverTime(rt,2.0,5,.4),
    rt=>RTAbility.strike(rt,17),
    rt=>{RTAbility.volley(rt,2,7,.035,540);RTAbility.damageOverTime(rt,2,2,.5);}
  ],
  sonic: [
    rt=>{rt.g.hp=Math.max(1,rt.g.hp-20);RTAbility.effect(rt,'speed',6);},
    rt=>RTAbility.summon(rt,7,4,3),
    rt=>RTAbility.effect(rt,'blade',8,{damage:5,interval:.55})
  ],
  david: [
    rt=>RTAbility.effect(rt,'fist',5,{damage:5,interval:.65}),
    rt=>{RTAbility.volley(rt,1,25,0,520);RTAbility.damageOverTime(rt,3,3,.6);},
    rt=>RTAbility.damageOverTime(rt,7,4,1.4)
  ],
  chieko: [
    rt=>{RTAbility.shock(rt,155);RTAbility.volley(rt,1,2,0,450);},
    rt=>RTAbility.strike(rt,20),
    rt=>{RTAbility.shield(rt,2.4);RTAbility.effect(rt,'counter',2.4,{damage:9});},
    rt=>RTAbility.shock(rt,220,20)
  ],
  airi: [
    rt=>RTAbility.damageOverTime(rt,3,10,.95),
    rt=>RTAbility.summon(rt,8,5),
    rt=>RTAbility.damageOverTime(rt,3.2,12,1.05)
  ],
  dio: [
    rt=>{RTAbility.strike(rt,10);RTAbility.heal(rt,8);},
    rt=>{RTAbility.effect(rt,'counter',2,{damage:25});RTAbility.shield(rt,.5);},
    null // Last Chance activates on an otherwise lethal hit.
  ],
  kayano: [
    rt=>RTAbility.damageOverTime(rt,1.05,6,.18)
  ],
  mechamaru: [
    rt=>RTAbility.strike(rt,36),
    rt=>RTAbility.volley(rt,12,5,.06,660),
    rt=>{RTAbility.summon(rt,12,9,2);RTAbility.shield(rt,1.6);}
  ],
  kisei: [
    rt=>RTAbility.strike(rt,25),
    rt=>RTAbility.strike(rt,20),
    rt=>{RTAbility.volley(rt,1,18,0,540);RTAbility.damageOverTime(rt,3,3,.7);},
    rt=>RTAbility.effect(rt,'revolver',5,{damage:5,interval:.4})
  ]
});

RT.cast = function(index) {
  const g=this.g,skill=g?.c.skills[index];
  if(!g||!skill||skill.passive||g.state!=='active'||g.phaseWait>0||g.cd[index]>0)return;
  const revolverOn=g.c.id==='kisei'&&index===3&&g.activeAbilities?.some(e=>e.kind==='revolver'&&e.life>0);
  const cost=revolverOn?4:skill.cost;
  if(g.pe<cost&&!Cheats.energy)return;
  if(!Cheats.energy)g.pe-=cost;
  g.cd[index]=Cheats.cooldowns?0:revolverOn?.4:skill.cd;
  AudioSys.sfx('cast');
  this.announce(skill.name.toUpperCase());
  if(revolverOn){this.shoot(5,0,5,830);return;}
  const handler=RT_SKILL_HANDLERS[g.c.id]?.[index];
  if(handler)handler(this);
};

const originalRTStart = RT.start.bind(RT);
RT.start = function(...args){
  originalRTStart(...args);
  if(this.g){this.g.activeAbilities=[];this.g.lastDamageFromCounter=0;this.g.lastPhase=this.g.phase;}
};

const originalRTPhase = RT.phase.bind(RT);
RT.phase = function(n){
  originalRTPhase(n);
  if(this.g)this.g.activeAbilities=[];
};

const originalRTHitHero = RT.hitHero.bind(RT);
RT.hitHero = function(damage,options){
  const g=this.g;
  if(!g)return false;
  const before=g.hp;
  const landed=originalRTHitHero(damage,options);
  if(landed&&g.hp<before&&g.activeAbilities?.some(e=>e.kind==='counter')){
    RTAbility.strike(this,Math.min(25,damage*2));
  }
  if(g.hp<=0&&g.c.id==='dio'&&!g.lastChanceUsed&&g.pe>=30){
    g.pe-=30;g.hp=Math.min(g.c.hp,30);g.inv=1;g.lastChanceUsed=true;
    this.announce('ПОСЛЕДНИЙ ШАНС');
    this.spark(g.x,g.y,'#f4d883',30);
  }
  return landed;
};

const originalRTStep = RT.step.bind(RT);
RT.step = function(dt){
  originalRTStep(dt);
  const g=this.g;
  if(!g||App.paused||g.state!=='active'||g.phaseWait>0||!g.activeAbilities?.length)return;
  for(const effect of g.activeAbilities){
    effect.life-=dt;
    effect.timer-=dt;
    if(effect.kind==='orbit'){
      g.bullets=g.bullets.filter(b=>hypot(b.x-g.x,b.y-g.y)>effect.radius);
    } else if(effect.kind==='magnet'){
      // A local Lorentz field bends hostile trajectories; no blood-iron control.
      for(const b of g.bullets){
        if(hypot(b.x-g.x,b.y-g.y)>effect.radius||b._magnetized)continue;
        b.vx*=.62;b.vy*=.62;b._magnetized=true;
      }
    } else if(effect.kind==='flight'){
      g.x=clamp(g.x+g.dx*85*dt,24,936);
      g.y=clamp(g.y+g.dy*85*dt,110,572);
    } else if(effect.kind==='speed'){
      g.shootTimer=Math.min(g.shootTimer,.045);
    }

    if(effect.timer>0)continue;
    effect.timer+=effect.interval;
    if(effect.kind==='damage-over-time'){
      const target=g.targets.find(t=>t.id===effect.targetId&&t.hp>0)||this.target();
      if(target)this.hitTarget(target,effect.damage);
    } else if(effect.kind==='summon'){
      for(let i=0;i<effect.shots;i++)this.shoot(effect.damage,(i-(effect.shots-1)/2)*.11,5,690);
    } else if(effect.kind==='orbit'||effect.kind==='blade'||effect.kind==='fist'){
      this.shoot(effect.damage,0,5,730);
    }
    if(g.state!=='active')break;
  }
  g.activeAbilities=g.activeAbilities.filter(effect=>effect.life>0);
};

const originalRTDraw = RT.draw.bind(RT);
RT.draw = function(){
  originalRTDraw();
  const g=this.g,c=App.ctx;
  if(!g||!c||!g.activeAbilities?.length)return;
  c.save();
  for(const effect of g.activeAbilities){
    if(effect.kind==='orbit'){
      c.strokeStyle='#8edff2';c.lineWidth=2;
      c.beginPath();c.arc(g.x,g.y,effect.radius,0,Math.PI*2);c.stroke();
      for(let i=0;i<2;i++){
        const a=g.t*5+i*Math.PI;
        c.fillStyle='#99dfe8';c.beginPath();
        c.arc(g.x+Math.cos(a)*effect.radius,g.y+Math.sin(a)*effect.radius,12,0,Math.PI*2);c.fill();
      }
    }else if(effect.kind==='magnet'){
      c.strokeStyle='#58e4fa88';c.lineWidth=2;c.setLineDash([10,7]);
      c.beginPath();c.arc(g.x,g.y,effect.radius,0,Math.PI*2);c.stroke();c.setLineDash([]);
    }else if(effect.kind==='summon'){
      c.fillStyle=g.c.color;c.fillRect(g.x-53,g.y-28,14,19);
      c.strokeStyle='#fff7';c.strokeRect(g.x-53,g.y-28,14,19);
    }
  }
  c.restore();
};

// Accessible metadata for adding other characters or future RT controllers.
window.RTAbilityRegistry = Object.freeze({handlers:RT_SKILL_HANDLERS,helpers:RTAbility});
