'use strict';

// Inspired by the separate LapisOrbits/MetalClone classes from index(1).html:
// physical defenses now interact with incoming projectiles in the fight world.
// These interactions use the same entity and damage rules as the host engine.
const originalEntitiesStep = Fight.entitiesStep.bind(Fight);
Fight.entitiesStep = function(dt){
  const g=this.g;
  if(!g?.e?.length)return originalEntitiesStep(dt);
  const activeOrbits=g.e.filter(e=>e.kind==='orbit'&&e.life>0);
  const activeSummons=g.e.filter(e=>e.kind==='summon'&&e.life>0&&e.hp>0);
  const threats=g.e.filter(e=>e.kind==='projectile'&&e.life>0);

  for(const shot of threats){
    const projectedX=shot.x+shot.vx*dt;
    const projectedY=shot.y+(shot.vy||0)*dt;
    let intercepted=false;

    for(const orbit of activeOrbits){
      if(orbit.owner===shot.owner)continue;
      const fighter=g.f[orbit.owner];
      if(!fighter||fighter.hp<=0)continue;
      const count=orbit.count||2;
      for(let n=0;n<count;n++){
        const a=g.t*5+n*Math.PI*2/count;
        const x=fighter.x+Math.cos(a)*orbit.r;
        const y=fighter.y-45+Math.sin(a)*orbit.r*.55;
        if(Math.hypot(projectedX-x,projectedY-y)>14+(shot.r||10))continue;
        intercepted=true;
        this.spark(x,y,fighter.c.color,10);
        this.float('ОТРАЖЕНО',x,y-28,fighter.c.color);
        break;
      }
      if(intercepted)break;
    }

    if(!intercepted)for(const summoned of activeSummons){
      if(summoned.owner===shot.owner)continue;
      if(Math.abs(projectedX-summoned.x)>25+(shot.r||10)||
         Math.abs(projectedY-(summoned.y-48))>37+(shot.r||10))continue;
      summoned.hp=Math.max(0,summoned.hp-(shot.dmg||10));
      this.spark(projectedX,projectedY,summoned.color||'#a7c7d5',9);
      intercepted=true;
      break;
    }

    if(intercepted)shot.life=0;
  }
  return originalEntitiesStep(dt);
};
