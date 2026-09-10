import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import ts from 'typescript';
const levelCode=ts.transpileModule(fs.readFileSync(new URL('../lib/levels.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const levelUrl='data:text/javascript;base64,'+Buffer.from(levelCode).toString('base64');

let code = ts.transpileModule(fs.readFileSync(new URL('../lib/game.ts', import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
code=code.replace(/from ['"]\.\/levels['"]/g,'from '+JSON.stringify(levelUrl));
const { NightGame, inSlash } = await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const context = new Proxy({}, {get(_,key){if(key==='createRadialGradient')return()=>({addColorStop(){}});return()=>{};},set(){return true;}});
class Canvas extends EventTarget {getContext(){return context;} focus(){} getBoundingClientRect(){return{x:0,y:0,left:0,top:0,width:1280,height:720};}}
globalThis.window = new EventTarget();window.matchMedia=()=>({matches:false});
globalThis.document = new EventTarget();document.createElement=()=>new Canvas();
globalThis.requestAnimationFrame = ()=>1;globalThis.cancelAnimationFrame=()=>{};
function setup(){const g=new NightGame(new Canvas(),()=>{});g.training=true;g.start();g.events=new Set([0,1,2,3,4,5,6,7]);g.toast='';g.enemies=[];g.player.x=800;g.player.y=3200;g.player.a=0;return g;}
function key(type,k){const e=new Event(type);Object.defineProperty(e,'key',{value:k});window.dispatchEvent(e);}

test('keyboard movement is normalized; pause and focus loss clear held inputs',()=>{const g=setup();key('keydown','ArrowUp');key('keydown','ArrowRight');const{x,y}=g.player;g.update(.02);assert.ok(Math.abs(Math.hypot(g.player.x-x,g.player.y-y)-4.5)<.001);g.togglePause();assert.equal(g.keys.size,0);assert.equal(g.mode,'paused');key('keydown','q');assert.equal(g.player.q,0);g.togglePause();key('keydown','ArrowUp');window.dispatchEvent(new Event('blur'));assert.equal(g.mode,'paused');assert.equal(g.keys.size,0);g.destroy();});
test('melee only hits its arc, builds energy, and advances a three-hit combo',()=>{const g=setup();g.player.energy=0;const front=g.spawn('elite',855,3200),back=g.spawn('elite',745,3200);g.action('attack');assert.equal(front.hp,262);assert.equal(back.hp,280);assert.equal(g.player.energy,1);const hp=front.hp;g.action('attack');assert.equal(front.hp,hp);g.player.atk=0;front.x=855;g.action('attack');assert.equal(front.hp,240);g.player.atk=0;front.x=855;g.action('attack');assert.equal(front.hp,206);assert.equal(g.player.energy,3);assert.equal(g.player.combo,2);assert.equal(inSlash(0,0,0,-30,0,88,10),false);g.destroy();});
test('piercing sword wave damages a target once and cannot fire without energy',()=>{const g=setup();g.player.energy=1;const e=g.spawn('elite',850,3200);g.action('ranged');assert.equal(g.player.energy,0);g.update(.14);assert.equal(e.hp,280);g.update(.04);assert.equal(e.hp,250);g.update(.01);assert.equal(e.hp,250);g.player.atk=0;const count=g.shots.length;g.action('ranged');assert.equal(g.shots.length,count);g.destroy();});
test('shield guards front strikes, heavy combo breaks guard, and back strikes work',()=>{const g=setup();const e=g.spawn('shield',850,3200);e.aim=Math.PI;g.action('attack');assert.equal(e.hp,115);g.player.atk=0;g.player.combo=1;g.player.comboTimer=.5;e.x=850;g.action('attack');assert.equal(e.hp,81);g.player.atk=0;e.aim=0;e.x=850;g.action('attack');assert.equal(e.hp,63);g.destroy();});
test('dodge grants brief invulnerability, cooldown blocks spam, river crossing stays on bridge',()=>{const g=setup();g.player.inv=0;const before=g.player.x;g.action('dodge');assert.ok(Math.abs(g.player.x-before-126)<1e-6);g.hurt(20);assert.equal(g.player.hp,100);g.action('dodge');assert.ok(Math.abs(g.player.x-before-126)<1e-6);g.player.inv=0;g.hurt(20);assert.equal(g.player.hp,80);g.player.x=500;g.player.y=2190;g.movePlayer(0,120);assert.ok(g.player.y<=2220);g.player.x=800;g.movePlayer(0,120);assert.ok(g.player.y>2220);g.destroy();});
test('telegraphed melee does not damage a player standing behind the enemy',()=>{const g=setup();g.player.inv=0;const e=g.spawn('shield',845,3200);e.aim=0;g.enemyAttack(e);assert.equal(g.player.hp,100);e.aim=Math.PI;g.enemyAttack(e);assert.equal(g.player.hp,88);g.destroy();});
test('camp checkpoint restores powers and event progression, allowing boss to respawn after death',()=>{const g=setup();g.events.delete(7);g.used.add(1);g.player.x=790;g.player.y=1300;g.player.hp=30;g.action('interact');assert.equal(g.mode,'dialogue');g.chooseDialogue(0);assert.equal(g.mode,'upgrade');assert.equal(g.player.hp,100);const choice=g.choices[0];g.chooseUpgrade(choice);assert.ok(g.powers.has(choice));assert.ok(g.save.upgrades.includes(choice));g.player.y=700;g.updateEvents();assert.ok(g.enemies.some(e=>e.kind==='boss'));g.player.inv=0;g.hurt(200);assert.equal(g.mode,'dead');g.retry();assert.equal(g.player.y,1300);assert.equal(g.mode,'playing');assert.ok(g.powers.has(choice));assert.ok(!g.events.has(7));g.player.y=700;g.updateEvents();assert.equal(g.enemies.filter(e=>e.kind==='boss').length,1);g.destroy();});
test('boss phases create hazards, final blow clears threats, and lamp interaction completes the level',()=>{const g=setup();g.player.x=800;g.player.y=750;const boss=g.spawn('boss',800,500);boss.hp=400;boss.attack=2;g.enemyAttack(boss);assert.equal(g.hazards.length,0);g.hit(boss,500,false,true);assert.ok(g.bossDefeated);assert.equal(g.hazards.length,0);g.player.y=250;g.action('interact');g.chooseDialogue(0);assert.equal(g.mode,'interlude');g.destroy();});
test('death retry retains a playable initial route without permanently consuming early events',()=>{const g=new NightGame(new Canvas(),()=>{});g.training=true;g.start();g.player.y=3500;g.updateEvents();assert.ok(g.events.has(0));g.player.inv=0;g.hurt(120);g.retry();assert.equal(g.player.y,3930);assert.equal(g.events.size,0);g.player.y=3500;g.updateEvents();assert.ok(g.enemies.length>=2);g.destroy();});
test('clustered A and X acquire targets without mouse, held A chains, R pauses',()=>{const g=setup();g.aimMode='mouse';g.player.a=Math.PI;const e=g.spawn('elite',855,3200);key('keydown','a');assert.equal(g.aimMode,'auto');assert.equal(g.player.a,0);assert.equal(e.hp,262);g.player.atk=0;e.x=855;g.update(.01);assert.equal(e.hp,240);key('keyup','a');g.player.atk=0;key('keydown','x');assert.ok(g.shots.length>0);assert.ok(g.shots[0].vx>0);key('keyup','x');key('keydown','r');assert.equal(g.mode,'paused');key('keyup','r');g.destroy();});
test('F starts and retries, Z/X/C choose upgrades, movement sets facing without a target',()=>{const g=new NightGame(new Canvas(),()=>{});key('keydown','f');assert.equal(g.mode,'playing');g.events=new Set([0,1,2,3,4,5,6,7]);g.enemies=[];g.player.x=800;g.player.y=3200;key('keydown','ArrowLeft');g.update(.016);assert.ok(Math.abs(g.player.a-Math.PI)<1e-6);key('keyup','ArrowLeft');g.offerUpgrade();const choice=g.choices[1];key('keydown','x');assert.ok(g.powers.has(choice));assert.equal(g.mode,'playing');g.player.inv=0;g.hurt(200);key('keydown','f');assert.equal(g.mode,'playing');assert.equal(g.player.hp,100);g.destroy();});
test('3D adapter supplies terrain collision and pointer projection to the same combat logic',()=>{let disposed=false;const view={render(){},destroy(){disposed=true;},canWalk(x,y){return x<900;},pointerWorld(){return{x:800,y:3000};}};const g=new NightGame(new Canvas(),()=>{},view);g.training=true;g.start();g.player.x=800;g.player.y=3200;g.aimMode='mouse';g.updateAim();assert.ok(Math.abs(g.player.a+Math.PI/2)<1e-6);g.movePlayer(200,0);assert.ok(g.player.x<900);g.destroy();assert.ok(disposed);});

test('melee impact pause is capped for groups, heavier for finishers, and absent on misses/ranged hits',()=>{const g=setup();g.action('attack');assert.equal(g.hitStop,0);const e=g.spawn('elite',850,3200);g.player.atk=0;g.action('attack');const light=g.hitStop;assert.ok(light>0&&light<.04);g.hit(e,1,false);assert.equal(g.hitStop,light,'multiple targets must not stack the pause');g.player.atk=0;e.x=850;g.action('attack');assert.equal(g.strike.combo,2);assert.ok(g.hitStop>light&&g.hitStop<=.06);const frozen=g.hitStop;assert.equal(g.consumeHitStop(.02),0);assert.ok(Math.abs(g.consumeHitStop(.05)-(.07-frozen))<1e-8);assert.equal(g.hitStop,0);g.hit(e,1,true);assert.equal(g.hitStop,0);g.hit(e,1,false);g.retry();assert.equal(g.hitStop,0);assert.equal(g.strike,null);g.destroy();});
test('footstep feedback follows distance travelled and stops against obstacles',()=>{const g=setup();g.view={canWalk:()=>false,destroy(){}};g.keys.add('arrowleft');for(let i=0;i<30;i++)g.update(.02);assert.equal(g.player.moving,false);assert.equal(g.stepDistance,0);assert.equal(g.fx.length,0);g.view.canWalk=()=>true;for(let i=0;i<12;i++)g.update(.02);assert.equal(g.player.moving,true);assert.ok(g.fx.some(f=>!f.text));assert.ok(g.stepDistance<48);g.destroy();});

test('X winds up before release, uses residual frame time, and locks its direction',()=>{const g=setup();g.action('ranged');const shot=g.shots[0];assert.equal(g.abilityPose.kind,'cast');assert.equal(g.player.energy,2);g.update(.1);assert.ok(shot.delay>0);assert.equal(shot.x,800);g.player.a=Math.PI;g.update(.06);assert.ok(Math.abs(shot.x-(800+670*.02))<1e-6);assert.equal(shot.vy,0);assert.ok(shot.vx>0);assert.equal(g.abilityPose.angle,0);g.destroy();});
test('dodge, another skill or death cancel an unreleased sword wave',()=>{for(const action of ['dodge','dash','spin','death']){const g=setup();g.action('ranged');if(action==='death'){g.player.inv=0;g.hurt(200);}else g.action(action);assert.equal(g.shots.filter(s=>s.delay>0).length,0,action);if(action==='dash'||action==='spin')assert.equal(g.abilityPose.kind,action);else assert.equal(g.abilityPose,null);g.destroy();}});

test('combat audio distinguishes combos and skills; cancelled X never plays its release',()=>{
  const g=setup(),heard=[];g.combatSound=(...args)=>heard.push(args);
  for(let i=0;i<3;i++){g.player.atk=0;g.action('attack');}
  assert.deepEqual(heard.map(x=>x.slice(0,2)),[['slash',0],['slash',1],['slash',2]]);
  heard.length=0;g.player.atk=0;g.action('ranged');
  assert.deepEqual(heard.map(x=>x[0]),['charge']);
  g.update(.1);assert.equal(heard.length,1);
  g.update(.05);assert.equal(heard[1][0],'wave');
  heard.length=0;g.player.atk=0;g.action('ranged');g.action('dodge');g.update(.2);
  assert.deepEqual(heard.map(x=>x[0]),['charge','dodge']);
  g.action('dash');g.action('spin');
  assert.deepEqual(heard.slice(-2).map(x=>x[0]),['dash','spin']);g.destroy();
});

test('audio layers are bounded, muted immediately, cleaned up and group impacts throttled',()=>{
  const g=setup(),sources=[],params=[];
  const param=()=>({value:0,cancelScheduledValues(){},setTargetAtTime(v){this.value=v;},setValueAtTime(v){assert.ok(Number.isFinite(v));this.value=v;},exponentialRampToValueAtTime(v){assert.ok(v>0&&Number.isFinite(v));params.push(v);}});
  const node=()=>({connect(){},disconnect(){this.disconnected=true;}});
  const source=()=>{const n={...node(),frequency:param(),start(t){assert.ok(t>=10);},stop(t){assert.ok(t>10&&t<11);}};sources.push(n);return n;};
  g.audio={currentTime:10,state:'running',createOscillator:source,createBufferSource:source,createBiquadFilter:()=>({...node(),frequency:param(),Q:param()}),createGain:()=>({...node(),gain:param()}),createStereoPanner:()=>({...node(),pan:param()}),close(){}};
  g.audioMaster={...node(),gain:param()};g.audioNoise={};
  for(const name of ['slash','charge','wave','dodge','dash','spin','impact','heavy','guard','hurt'])g.combatSound(name);
  const count=sources.length;assert.ok(count>20);
  g.combatSound('impact');assert.equal(sources.length,count);
  g.muted=true;assert.equal(g.audioMaster.gain.value,0);
  g.audio.currentTime=10.1;g.combatSound('impact');assert.equal(sources.length,count);
  g.muted=false;assert.equal(g.audioMaster.gain.value,.65);
  g.combatSound('impact');assert.ok(sources.length>count);
  for(const s of sources){s.onended();assert.equal(s.disconnected,true);}
  assert.ok(params.length>0);g.destroy();
});
test('A attacks without consuming potions; W heals once and D dodges without moving on WASD',()=>{
 const g=setup();g.player.hp=40;const potions=g.potions;
 key('keydown','a');assert.equal(g.potions,potions);assert.equal(g.player.hp,40);assert.ok(g.player.atk>0);key('keyup','a');
 key('keydown','w');assert.equal(g.potions,potions-1);assert.equal(g.player.hp,80);key('keyup','w');
 const before={x:g.player.x,y:g.player.y};key('keydown','d');assert.ok(g.player.dodge>0);assert.ok(Math.hypot(g.player.x-before.x,g.player.y-before.y)>100);key('keyup','d');
 key('keydown','s');assert.ok(g.guard>0);key('keyup','s');
 key('keydown','z');assert.equal(g.keys.has('a'),false);key('keyup','z');g.destroy();
});
