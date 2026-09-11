import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import ts from 'typescript';
const levelCode=ts.transpileModule(fs.readFileSync(new URL('../lib/levels.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const levelUrl='data:text/javascript;base64,'+Buffer.from(levelCode).toString('base64');

import * as T from 'three';
let code=ts.transpileModule(fs.readFileSync(new URL('../lib/game.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
code=code.replace(/from ['"]\.\/levels['"]/g,'from '+JSON.stringify(levelUrl));
const {NightGame,decodeCampaignSave}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
let viewCode=ts.transpileModule(fs.readFileSync(new URL('../lib/game-view.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
viewCode=viewCode.replace(/from (['"])(three[^'"]*)\1/g,(_,q,name)=>'from '+JSON.stringify(import.meta.resolve(name)));
viewCode=viewCode.replace(/from ['"]\.\/levels['"]/g,'from '+JSON.stringify(levelUrl));
const {NightView}=await import('data:text/javascript;base64,'+Buffer.from(viewCode).toString('base64'));
function collisionWorld(){
 const v=Object.assign(Object.create(NightView.prototype),{scene:new T.Scene(),terrain:new T.Group(),effects:new T.Group(),geometries:new Set(),materials:new Set(),lamps:[],colliders:[],textures:[],art:new Map(['forest','enemies'].map(k=>[k,new T.Texture()])),paintedTrees:[],frames:JSON.parse(fs.readFileSync(new URL('../public/art/frames.json',import.meta.url),'utf8')),camera:new T.OrthographicCamera(-18,18,10,-10,.1,180)});
 v.camera.position.set(0,27,22);v.camera.lookAt(0,0,0);v.camera.updateMatrixWorld();
 v.buildWorld([new T.Texture(),new T.Texture(),new T.Texture(),new T.Texture()]);return v;
}

const context=new Proxy({},{get(){return()=>{};}});
class Canvas extends EventTarget{getContext(){return context;}focus(){}}
globalThis.window=new EventTarget();window.matchMedia=()=>({matches:false});
globalThis.document=new EventTarget();document.createElement=()=>new Canvas();
globalThis.requestAnimationFrame=()=>1;globalThis.cancelAnimationFrame=()=>{};
const memory=new Map();globalThis.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)};
function setup(world){return new NightGame(new Canvas(),()=>{},{render(){},destroy(){},canWalk(x,y){return world?world.canWalk(x,y):true;}});}
test('two chapters preserve upgrades, require story resolution and stop before unreleased chapters',()=>{
 const g=setup();g.start();g.powers.add(7);
 for(let stage=0;stage<2;stage++){assert.equal(g.stage,stage);g.player.x=800;g.player.y=250;g.bossDefeated=true;g.doInteract();assert.equal(g.mode,'dialogue');g.chooseDialogue(0);assert.equal(g.records.length,stage+1);assert.equal(g.mode,stage===1?'won':'interlude');if(stage===0)g.nextChapter();}
 assert.ok(g.story.merciful);g.nextChapter();assert.equal(g.stage,1);
 assert.ok(decodeCampaignSave(memory.get('nightward-campaign-v3')));g.destroy();
 const resumed=setup();resumed.continueCampaign();assert.equal(resumed.mode,'won');assert.equal(resumed.records.length,2);resumed.destroy();
});

test('checkpoint persists alive enemies and restores a safe, playable combat state across reload',()=>{
 const g=setup();g.start();g.spawn('shield',850,3200);g.events.add(1);g.player.y=3300;g.powers.add(4);g.storeSave();g.destroy();
 const resumed=setup();resumed.continueCampaign();assert.equal(resumed.player.y,3300);assert.equal(resumed.enemies.length,1);assert.equal(resumed.enemies[0].kind,'shield');assert.equal(resumed.enemies[0].wind,0);assert.ok(resumed.powers.has(4));assert.ok(resumed.events.has(1));resumed.destroy();
});
test('invalid or old local saves are rejected without crashing',()=>{
 for(const raw of [null,'no','{}','{"version":1}','null',JSON.stringify({version:2,stage:99})])assert.equal(decodeCampaignSave(raw),null);
 const g=setup();g.start();const data=JSON.parse(memory.get('nightward-campaign-v3'));data.checkpoint.upgrades=[999];assert.equal(decodeCampaignSave(JSON.stringify(data)),null);g.destroy();
});
test('healing consumes finite charges, full-health use does not; difficulty and armour reduce damage',()=>{
 const g=setup();g.start();g.action('heal');assert.equal(g.potions,3);g.player.hp=10;g.action('heal');assert.equal(g.player.hp,50);assert.equal(g.potions,2);
 g.powers.add(8);g.action('heal');assert.equal(g.player.hp,100);g.difficulty='story';g.player.inv=0;g.hurt(20);assert.equal(g.player.hp,88);g.player.inv=0;g.powers.add(11);g.hurt(20);assert.equal(g.player.hp,78);g.destroy();
});
test('one precise dodge grants one reward even against a cluster of attacks',()=>{
 const g=setup();g.start();g.player.energy=0;g.action('dodge');g.hurt(20);g.hurt(20);assert.equal(g.player.hp,100);assert.equal(g.perfectDodges,1);assert.equal(g.player.energy,1);g.destroy();
});
test('simulation pace matches 20 Hz and 60 Hz renders and freezes while paused',()=>{
 const run=hz=>{const g=setup();g.start();g.events=new Set([0,1,2,3,4,5,6,7]);g.keys.add('arrowup');g.frame(1000);for(let i=1;i<=hz;i++)g.frame(1000+i*1000/hz);const y=g.player.y;g.togglePause();g.frame(9000);assert.equal(g.player.y,y);g.destroy();return y;};
 assert.ok(Math.abs(run(20)-run(60))<4,'at most one fixed simulation tick of difference');
});

// No damage overrides or forced kills: drive movement and the same player actions.
function playChapter(g){
 const checkpoints=g.stage===0?[{x:1030,y:2890,id:0},{x:650,y:1880,id:1},{x:790,y:1300,id:2},{x:800,y:250,id:3}]:[{x:1120,y:2780,id:0},{x:450,y:2080,id:1},{x:1100,y:1320,id:2},{x:800,y:250,id:3}];
 let goalIndex=0,steps=0,stuck=0,previous={x:g.player.x,y:g.player.y};
 let path=[],pathGoal='';
 const steer=(x,y)=>{
   if(g.stage===1&&Math.hypot(x,y)>20){
     const p=g.player,tx=p.x+x,ty=p.y+y,n=Math.ceil(Math.hypot(x,y)/20);let clear=true;for(let i=1;i<=n;i++)if(!g.canWalk(p.x+x*i/n,p.y+y*i/n)){clear=false;break;}
     if(!clear){
       const gx=Math.round(tx/40),gy=Math.round(ty/40),goal=gx+','+gy;
       if(pathGoal!==goal||!path.length){pathGoal=goal;const sx=Math.round(p.x/40),sy=Math.round(p.y/40),queue=[[sx,sy]],parents=new Map([[sx+','+sy,null]]);let found=null;
         for(let i=0;i<queue.length&&i<5000;i++){const [cx,cy]=queue[i];if(Math.hypot(cx*40-tx,cy*40-ty)<65){found=cx+','+cy;break;}for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=cx+dx,ny=cy+dy,key=nx+','+ny;if(parents.has(key)||!g.canWalk(nx*40,ny*40))continue;parents.set(key,cx+','+cy);queue.push([nx,ny]);}}
         path=[];while(found){path.unshift(found.split(',').map(Number));found=parents.get(found);}path.shift();
       }
       while(path.length&&Math.hypot(path[0][0]*40-p.x,path[0][1]*40-p.y)<6)path.shift();
       if(path.length){x=path[0][0]*40-p.x;y=path[0][1]*40-p.y;}
     }
   }
   g.keys.clear();if(Math.abs(x)>2)g.keys.add(x>0?'arrowright':'arrowleft');if(Math.abs(y)>2)g.keys.add(y>0?'arrowdown':'arrowup');
 };

 while(g.mode!=='interlude'&&g.mode!=='won'&&steps++<48000){
   if(g.mode==='dead')return {done:false,time:g.time,hp:0,kills:g.kills,at:g.player.y};
   if(g.mode==='dialogue'){g.chooseDialogue(0);continue;}
   if(g.mode==='upgrade'){const priority=[4,7,5,9,1,11,10,8,3,2,0,6];g.chooseUpgrade(priority.find(x=>g.choices.includes(x))??g.choices[0]);continue;}
   const p=g.player,live=g.enemies.filter(e=>!e.dead).sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y)),enemy=live[0],distance=enemy?Math.hypot(enemy.x-p.x,enemy.y-p.y):Infinity;
   if(p.hp<57&&g.potions>0)g.action('heal');
   g.updateAim();
   if(enemy&&distance<490){
     const danger=live.find(e=>e.wind>0&&e.wind<.14&&Math.hypot(e.x-p.x,e.y-p.y)<(e.kind==='boss'?350:e.kind==='elite'?170:120));
     if(danger&&p.dodge<=0){steer(p.x-danger.x,p.y-danger.y);g.action('dodge');}
     else{
       if(distance>72)steer(enemy.x-p.x,enemy.y-p.y);else steer(0,0);
       if(p.atk<=0){
         if(g.skillUnlocked('spin')&&distance<155&&p.e<=0)g.action('spin');
         else if(g.skillUnlocked('dash')&&distance>95&&distance<260&&p.q<=0)g.action('dash');
         else if(distance<102)g.action('attack');
         else if(g.skillUnlocked('ranged')&&distance<390&&p.energy>0)g.action('ranged');
       }
     }
   }else{
     const goal=checkpoints[goalIndex];
     if(goal.id<3&&g.used.has(goal.id)){goalIndex++;continue;}
     if(Math.hypot(p.x-goal.x,p.y-goal.y)<65){steer(0,0);g.action('interact');}
     else{
       // Centre the approach before crossing the river.
       const nextX=g.stage===1?goal.x:p.y>2380&&goal.y<2180?800:Math.abs(p.y-goal.y)>180?800+Math.sin(p.y*.0024)*105:goal.x;
       steer(nextX-p.x,goal.y-p.y);
     }
   }
   if(Math.hypot(p.x-previous.x,p.y-previous.y)<.1)stuck++;else stuck=0;
   if(stuck>180&&p.dodge<=0){g.keys.add('arrowright');g.action('dodge');stuck=0;}
   previous={x:p.x,y:p.y};g.clock+=1/60;g.update(1/60);
 }
 return {done:g.mode==='interlude'||g.mode==='won',time:Math.round(g.time),hp:g.player.hp,kills:g.kills,at:Math.round(g.player.y),x:Math.round(g.player.x),live:g.enemies.filter(e=>!e.dead).map(e=>({kind:e.kind,x:Math.round(e.x),y:Math.round(e.y),hp:e.hp}))};
}
test('standard-difficulty combat bot completes both released chapters using normal unlocked actions',()=>{
 const g=setup(collisionWorld());g.start();const results=[];
 for(let i=0;i<2;i++){const result=playChapter(g);results.push(result);assert.ok(result.done,JSON.stringify({stage:i,...result}));if(i<1)g.nextChapter();}
 assert.equal(g.mode,'won');assert.equal(g.records.length,2);console.log('Campaign combat simulation:',JSON.stringify(results));g.destroy();
});

test('village rescues require nearby guards defeated and persist consequences after dialogue',()=>{
 const g=setup();g.startSelectedChapter(1);g.player.x=1120;g.player.y=2780;const e=g.spawn('shield',1130,2780);g.doInteract();assert.equal(g.mode,'playing');assert.equal(g.used.size,0);g.hit(e,500,false,true);g.doInteract();assert.equal(g.mode,'dialogue');assert.ok(g.story.blacksmith);g.chooseDialogue(0);assert.equal(g.mode,'upgrade');g.chooseUpgrade(g.choices[0]);const restored=setup();restored.continueCampaign();assert.ok(restored.used.has(0));assert.ok(restored.story.blacksmith);g.destroy();restored.destroy();
});

test('village fire has warning and stops after its rescue; forest has no magical fire zones',()=>{
 const g=setup();g.start();g.player.y=2840;g.updateChapterMechanics(.1);assert.equal(g.hazards.length,0);g.stage=1;g.player.x=1040;g.updateChapterMechanics(.1);assert.equal(g.hazards.length,1);assert.ok(g.hazards[0].delay>=1);g.hazards=[];g.used.add(0);g.clock=10;g.updateChapterMechanics(.1);assert.equal(g.hazards.length,0);g.destroy();
});

test('enemies cannot walk or be knocked through the river outside the bridge',()=>{
 const g=setup();g.start();const e=g.spawn('beast',500,2390);g.moveEnemy(e,0,-180);assert.ok(e.y>=2350);e.x=800;e.y=2390;g.moveEnemy(e,0,-180);assert.ok(e.y<2220);g.destroy();
});

test('restarting a chapter restores its entry build instead of farming the same upgrades',()=>{
 const g=setup();g.start();g.powers.add(0);g.stage=1;g.start(true);g.powers.add(7);g.restartChapter();assert.deepEqual([...g.powers],[0]);g.destroy();
});
test('holding an attack key cannot auto-select an upgrade, and holding F cannot skip chapter results',()=>{
 const g=setup();g.start();g.offerUpgrade();
 const press=(key,repeat)=>{const e=new Event('keydown');Object.defineProperties(e,{key:{value:key},repeat:{value:repeat}});window.dispatchEvent(e);};
 press('z',true);assert.equal(g.mode,'upgrade');press('z',false);assert.equal(g.mode,'playing');
 g.finishChapter();press('f',true);assert.equal(g.mode,'interlude');press('f',false);assert.equal(g.stage,1);g.destroy();
});

test('chapter skill unlocks and future chapter guard work for keyboard and direct entry',()=>{
 const g=setup();g.start();g.action('ranged');g.action('spin');g.action('dash');assert.equal(g.shots.length,1);assert.equal(g.player.energy,2);assert.equal(g.player.e,0);assert.equal(g.player.q,0);g.action('guard');assert.ok(g.guard>0);
 g.startSelectedChapter(1);g.action('dash');assert.ok(g.player.q>0);g.startSelectedChapter(2);assert.equal(g.stage,1);g.startSelectedChapter(7);assert.equal(g.stage,1);g.destroy();
});
test('village buildings block walking and fast projectiles while the former river is traversable',()=>{
 const g=setup();g.startSelectedChapter(1);assert.equal(g.canWalk(760,3040),false);assert.equal(g.canWalk(450,2280),true);g.events=new Set([0,1,2,3,4,5,6,7]);g.player.x=800;g.player.y=3250;g.shoot(800,3250,-Math.PI/2,30,false);g.update(.3);assert.equal(g.shots.length,0);g.destroy();
});

test('village art rebuild keeps all objectives reachable and restores old saves outside new obstacles',()=>{
 const g=setup();g.startSelectedChapter(1);g.player.x=340;g.player.y=3450;g.spawn('shield',795,3420);g.storeSave();g.destroy();
 const resumed=setup();resumed.continueCampaign();assert.ok(resumed.canWalk(resumed.player.x,resumed.player.y));for(const e of resumed.enemies)assert.ok(resumed.canWalk(e.x,e.y));
 const queue=[[800,3920]],seen=new Set(['800,3920']);
 for(let i=0;i<queue.length;i++){const [x,y]=queue[i];for(const [dx,dy] of [[20,0],[-20,0],[0,20],[0,-20]]){const nx=x+dx,ny=y+dy,key=nx+','+ny;if(!seen.has(key)&&resumed.canWalk(nx,ny)){seen.add(key);queue.push([nx,ny]);}}}
 for(const [x,y] of [[1120,2780],[535,2050],[1100,1320],[800,250]])assert.ok(queue.some(([nx,ny])=>Math.hypot(nx-x,ny-y)<35),'reachable objective '+x+','+y);
 resumed.destroy();
});

test('chapter guidance follows health and story progress without unlocking later skills',()=>{
 const g=setup();g.start();assert.match(g.contextGuidance(),/移动/);g.player.hp=20;assert.match(g.contextGuidance(),/药剂/);g.player.hp=100;g.player.y=1880;assert.match(g.currentObjective(),/军令/);g.used.add(1);assert.match(g.currentObjective(),/补给/);g.used.add(2);assert.match(g.currentObjective(),/加雷斯/);
 g.startSelectedChapter(1);assert.match(g.contextGuidance(),/Q/);g.used.add(0);g.used.add(1);assert.match(g.currentObjective(),/最后一处/);g.used.add(2);assert.match(g.currentObjective(),/三处/);assert.equal(g.skillUnlocked('ranged'),true);g.destroy();
});

test('missed forest clue points back south and unlocks the boss when investigated',()=>{
 const g=setup();g.start();g.player.y=500;g.updateEvents();
 assert.equal(g.enemies.some(e=>e.kind==='boss'),false);
 assert.match(g.currentObjective(),/↓ 返回/);
 g.time=60;g.enemies=[];assert.match(g.contextGuidance(),/调查后.*加雷斯/);
 g.player.x=650;g.player.y=1880;g.doInteract();assert.ok(g.used.has(1));
 g.chooseDialogue(0);g.chooseUpgrade(g.choices[0]);
 g.player.y=700;g.updateEvents();g.updateEvents();
 assert.equal(g.enemies.filter(e=>e.kind==='boss').length,1);
 assert.match(g.currentObjective(),/击败加雷斯/);g.destroy();
});
