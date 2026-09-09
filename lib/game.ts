export type Mode = 'menu' | 'playing' | 'paused' | 'upgrade' | 'dead' | 'won';
export type Snapshot = { mode:Mode; hp:number; energy:number; kills:number; time:number; chapter:number; progress:number; objective:string; dodgeCD:number; qCD:number; eCD:number; bossHP:number|null; toast:string; interact:string; choices:number[]; upgradeCount:number; aimMode:'auto'|'mouse' };
export const initialSnapshot: Snapshot = {mode:'menu',hp:100,energy:3,kills:0,time:0,chapter:0,progress:0,objective:'沿驿道向北前进',dodgeCD:0,qCD:0,eCD:0,bossHP:null,toast:'',interact:'',choices:[0,1,2],upgradeCount:0,aimMode:'auto'};
export const upgrades = [
  {name:'裂光',tag:'剑气 · 分裂',description:'剑气首次命中后，分裂成两道追击剑气。'},
  {name:'刃潮',tag:'剑术 · 冲击',description:'第三段普攻向前释放一道不消耗刃能的剑气。'},
  {name:'追影',tag:'身法 · 连击',description:'闪避后的下一次普攻造成双倍伤害，闪避冷却缩短。'},
  {name:'回锋',tag:'剑术 · 回旋',description:'回旋斩范围增大，命中敌人缩短冷却，最多缩短 3 秒。'},
  {name:'灯火护身',tag:'灯火 · 恢复',description:'施放突进斩或回旋斩，恢复 5 点生命。'},
  {name:'破阵',tag:'剑术 · 突进',description:'突进斩伤害翻倍，击破持盾守卫的正面防御。'},
];
type EnemyKind='beast'|'archer'|'shield'|'elite'|'boss';
type Enemy={id:number;x:number;y:number;kind:EnemyKind;hp:number;max:number;r:number;speed:number;cd:number;wind:number;attack:number;aim:number;tx:number;ty:number;flash:number;stun:number;active:boolean;dead:boolean};
type Shot={x:number;y:number;vx:number;vy:number;life:number;damage:number;enemy:boolean;hit:Set<number>;split:boolean;r:number};
type FX={x:number;y:number;vx:number;vy:number;life:number;max:number;size:number;color:string;text?:string};
type Slash={x:number;y:number;angle:number;radius:number;life:number;max:number;spin:boolean};
type Hazard={x:number;y:number;r:number;life:number;delay:number};
type Tree={x:number;y:number;s:number;seed:number};
type Save={y:number;x:number;kills:number;events:number[];upgrades:number[];used:number[]};
export const clamp=(v:number,min:number,max:number)=>Math.max(min,Math.min(max,v));
export const angleDifference=(a:number,b:number)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
export const inSlash=(px:number,py:number,angle:number,ex:number,ey:number,radius:number,enemyRadius:number)=>Math.hypot(ex-px,ey-py)<radius+enemyRadius && Math.abs(angleDifference(Math.atan2(ey-py,ex-px),angle))<1.35;
const W=1600,H=4300,TAU=Math.PI*2;
const pathX=(y:number)=>800+Math.sin(y*.0024)*105;
function random(seed:number){return()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return(seed>>>0)/4294967296;};}

export class NightGame {
  canvas:HTMLCanvasElement;ctx:CanvasRenderingContext2D;onChange:(s:Snapshot)=>void;
  mode:Mode='menu';aimMode:'auto'|'mouse'='auto';muted=false;keys=new Set<string>();held=new Set<number>();mouse={x:860,y:250};cam={x:800,y:3260};
  player={x:960,y:3360,hp:100,energy:3,a:-Math.PI/2,inv:0,atk:0,combo:0,comboTimer:0,dodge:0,q:0,e:0,boost:0,moving:false};
  enemies:Enemy[]=[];shots:Shot[]=[];fx:FX[]=[];slashes:Slash[]=[];hazards:Hazard[]=[];trees:Tree[]=[];
  events=new Set<number>();used=new Set<number>();powers=new Set<number>();choices=[0,1,2];kills=0;time=0;clock=0;toast='';toastTimer=0;interact='';
  nextId=1;last=0;raf=0;emitAt=0;shake=0;bossDefeated=false;save:Save|null=null;destroyed=false;ground:HTMLCanvasElement;audio:AudioContext|null=null;
  removers:(()=>void)[]=[];
  constructor(canvas:HTMLCanvasElement,onChange:(s:Snapshot)=>void){
    this.canvas=canvas;this.ctx=canvas.getContext('2d')!;this.onChange=onChange;
    this.ground=document.createElement('canvas');this.ground.width=W;this.ground.height=H;
    this.createGround();
    this.spawn('beast',1110,3130);this.spawn('archer',1020,2900);
    const listen=(el:EventTarget,type:string,fn:EventListener,options?:AddEventListenerOptions)=>{el.addEventListener(type,fn,options);this.removers.push(()=>el.removeEventListener(type,fn,options));};
    listen(window,'keydown',((e:KeyboardEvent)=>{
      if(e.metaKey||e.ctrlKey||e.altKey)return;
      const k=(e.code?.startsWith('Key')?e.code.slice(3):e.key).toLowerCase();
      if(this.mode==='playing'&&'wasdqerfzxc'.includes(k)&&k.length===1)e.preventDefault();
      if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(k))e.preventDefault();
      if((k==='f'||k==='enter')&&['menu','dead','won'].includes(this.mode)){e.preventDefault();if(this.mode==='dead')this.retry();else this.start();return;}
      if(this.mode==='upgrade'&&['z','x','c'].includes(k)){e.preventDefault();const id=this.choices[['z','x','c'].indexOf(k)];if(id!==undefined)this.chooseUpgrade(id);return;}
      if(this.mode==='paused'&&k==='f'){e.preventDefault();this.togglePause();return;}
      if(this.mode==='paused'&&k==='x'){e.preventDefault();this.start();return;}
      if(k==='escape'||k==='r'){if(!e.repeat)this.togglePause();return;}
      if(this.mode!=='playing')return;
      this.keys.add(k);
      if(k==='z'||k==='x'){this.aimMode='auto';this.updateAim();if(!e.repeat)this.action(k==='z'?'attack':'ranged');}
      if(!e.repeat){if(k==='c'||k===' ')this.action('dodge');if(k==='q')this.action('dash');if(k==='e')this.action('spin');if(k==='f')this.action('interact');}
    }) as EventListener);
    listen(window,'keyup',((e:KeyboardEvent)=>{this.keys.delete((e.code?.startsWith('Key')?e.code.slice(3):e.key).toLowerCase());}) as EventListener);
    listen(canvas,'pointermove',((e:PointerEvent)=>{const r=canvas.getBoundingClientRect();this.mouse={x:(e.clientX-r.left)/r.width*1280,y:(e.clientY-r.top)/r.height*720};}) as EventListener);
    listen(canvas,'pointerdown',((e:PointerEvent)=>{if(this.mode!=='playing')return;canvas.focus();if(e.pointerType!=='touch')this.aimMode='mouse';this.updateAim();this.held.add(e.button);this.unlockAudio();this.action(e.button===2?'ranged':'attack');}) as EventListener);
    listen(window,'pointerup',((e:PointerEvent)=>{this.held.delete(e.button);}) as EventListener);
    listen(window,'pointercancel',(()=>this.clearInput()) as EventListener);
    listen(canvas,'contextmenu',((e:Event)=>e.preventDefault()) as EventListener);
    listen(window,'blur',(()=>{this.clearInput();if(this.mode==='playing')this.togglePause();}) as EventListener);
    listen(document,'visibilitychange',(()=>{if(document.hidden){this.clearInput();if(this.mode==='playing')this.togglePause();}}) as EventListener);
    this.raf=requestAnimationFrame(this.frame);this.emit();
  }
  destroy(){this.destroyed=true;cancelAnimationFrame(this.raf);this.removers.forEach(f=>f());void this.audio?.close();}
  clearInput(){this.keys.clear();this.held.clear();}
  setKey(key:string,down:boolean){if(down&&this.mode==='playing')this.keys.add(key);else this.keys.delete(key);}
  unlockAudio(){try{if(!this.audio)this.audio=new AudioContext();if(this.audio.state==='suspended')void this.audio.resume();}catch{/* Audio is optional. */}}
  sound(frequency:number,duration=.1,kind:OscillatorType='sine',volume=.055){
    if(this.muted||!this.audio||this.audio.state!=='running')return;
    const now=this.audio.currentTime,osc=this.audio.createOscillator(),gain=this.audio.createGain();osc.type=kind;osc.frequency.setValueAtTime(frequency,now);osc.frequency.exponentialRampToValueAtTime(Math.max(40,frequency*.35),now+duration);gain.gain.setValueAtTime(volume,now);gain.gain.exponentialRampToValueAtTime(.001,now+duration);osc.connect(gain);gain.connect(this.audio.destination);osc.start(now);osc.stop(now+duration);
  }
  start(){
    this.mode='playing';this.player={x:pathX(3930),y:3930,hp:100,energy:3,a:-Math.PI/2,inv:1.5,atk:0,combo:0,comboTimer:0,dodge:0,q:0,e:0,boost:0,moving:false};
    this.enemies=[];this.shots=[];this.fx=[];this.slashes=[];this.hazards=[];this.events.clear();this.used.clear();this.powers.clear();this.kills=0;this.time=0;this.nextId=1;this.bossDefeated=false;this.clearInput();this.cam={x:800,y:3890};this.mouse={x:640,y:200};this.save=null;this.storeSave();this.unlockAudio();this.message('雾林驿道\n循着灯火，向北前进',4);this.canvas.focus();this.emit();
  }
  storeSave(){this.save={x:this.player.x,y:this.player.y,kills:this.kills,events:[...this.events],upgrades:[...this.powers],used:[...this.used]};}
  retry(){
    const s=this.save;if(!s){this.start();return;}
    this.player={...this.player,x:s.x,y:s.y,hp:100,energy:3,inv:2,atk:0,combo:0,comboTimer:0,dodge:0,q:0,e:0,boost:0};this.kills=s.kills;this.events=new Set(s.events);this.powers=new Set(s.upgrades);this.used=new Set(s.used);this.enemies=[];this.fx=[];this.shots=[];this.hazards=[];this.slashes=[];this.bossDefeated=false;this.mode='playing';this.clearInput();this.cam={x:800,y:clamp(s.y-100,360,H-360)};this.message('火种仍在。再试一次。');this.canvas.focus();this.emit();
  }
  toggleAim(){this.aimMode=this.aimMode==='auto'?'mouse':'auto';this.updateAim();this.message(this.aimMode==='auto'?'键盘模式 · 自动锁定附近敌人':'鼠标模式 · 自由瞄准');this.emit();}
  updateAim(mx=0,my=0){const p=this.player;if(this.aimMode==='mouse'){p.a=Math.atan2(this.mouse.y-360+this.cam.y-p.y,this.mouse.x-640+this.cam.x-p.x);return;}let target:Enemy|undefined;let distance=600;for(const e of this.enemies){if(e.dead)continue;const d=Math.hypot(e.x-p.x,e.y-p.y);if(d<distance){distance=d;target=e;}}if(target)p.a=Math.atan2(target.y-p.y,target.x-p.x);else if(mx||my)p.a=Math.atan2(my,mx);}
  togglePause(){if(this.mode==='playing')this.mode='paused';else if(this.mode==='paused')this.mode='playing';else return;this.clearInput();this.last=performance.now();this.emit();}
  message(text:string,duration=3){this.toast=text;this.toastTimer=duration;}
  spawn(kind:EnemyKind,x:number,y:number){const stats={beast:[52,17,96],archer:[60,17,55],shield:[120,23,48],elite:[280,34,48],boss:[1100,47,43]}[kind];const e:Enemy={id:this.nextId++,kind,x,y,hp:stats[0],max:stats[0],r:stats[1],speed:stats[2],cd:1.1,wind:0,attack:0,aim:0,tx:0,ty:0,flash:0,stun:0,active:false,dead:false};this.enemies.push(e);return e;}
  emit(){const p=this.player;const chapter=p.y>2850?0:p.y>1750?1:p.y>1000?2:3;const boss=this.enemies.find(e=>e.kind==='boss'&&!e.dead);this.onChange({mode:this.mode,hp:Math.max(0,p.hp),energy:p.energy,kills:this.kills,time:this.time,chapter,progress:clamp((3930-p.y)/3520*100,0,100),objective:this.bossDefeated?'按 F 点亮北方灯站':chapter===0?'沿驿道向北前进':chapter===1?'穿越旧桥与林间伏击':chapter===2?'点亮营地，获得补给':'击败驿站守灯者',dodgeCD:p.dodge,qCD:p.q,eCD:p.e,bossHP:boss&&boss.active?Math.max(0,boss.hp/boss.max*100):null,toast:this.toast,interact:this.interact,choices:this.choices,upgradeCount:this.powers.size,aimMode:this.aimMode});}
  chooseUpgrade(id:number){if(this.mode!=='upgrade'||!this.choices.includes(id))return;this.powers.add(id);this.mode='playing';this.clearInput();this.message('已获得强化 · '+upgrades[id].name);this.sound(700,.4);if(this.used.has(2)&&Math.abs(this.player.y-1300)<180)this.storeSave();this.emit();this.canvas.focus();}
  offerUpgrade(){const available=upgrades.map((_,i)=>i).filter(i=>!this.powers.has(i));const shift=this.used.size%Math.max(1,available.length);this.choices=[...available.slice(shift),...available.slice(0,shift)].slice(0,3);if(!this.choices.length)return;this.mode='upgrade';this.clearInput();this.emit();}
  action(action:string){
    if(this.mode!=='playing')return;const p=this.player;this.unlockAudio();
    if(action==='interact'){this.doInteract();return;}
    if(action==='attack'&&p.atk<=0){
      p.combo=p.comboTimer>0?(p.combo+1)%3:0;p.comboTimer=1.05;p.atk=p.combo===2?.48:.3;
      const damage=([18,22,34][p.combo])*(p.boost>0?2:1);p.boost=0;
      this.slashes.push({x:p.x,y:p.y,angle:p.a,radius:p.combo===2?96:84,life:.2,max:.2,spin:false});
      let hit=false;for(const e of this.enemies){if(!e.dead&&inSlash(p.x,p.y,p.a,e.x,e.y,88,e.r)){this.hit(e,damage,false,p.combo===2);hit=true;}}
      if(hit)p.energy=Math.min(3,p.energy+1);
      if(p.combo===2&&this.powers.has(1))this.shoot(p.x,p.y,p.a,30,false,false);
      this.sound(p.combo===2?150:240,.12,'triangle');
    }
    if(action==='ranged'&&p.energy>0&&p.atk<=0){p.energy--;p.atk=.38;this.shoot(p.x,p.y,p.a,30,false,this.powers.has(0));this.sound(630,.17,'sine');}
    if(action==='dodge'&&p.dodge<=0){let dx=Number(this.keys.has('d')||this.keys.has('arrowright'))-Number(this.keys.has('a')||this.keys.has('arrowleft')),dy=Number(this.keys.has('s')||this.keys.has('arrowdown'))-Number(this.keys.has('w')||this.keys.has('arrowup'));const a=dx||dy?Math.atan2(dy,dx):p.a;this.movePlayer(Math.cos(a)*126,Math.sin(a)*126,true);p.inv=.28;p.dodge=this.powers.has(2)?.85:1.2;p.atk=0;if(this.powers.has(2))p.boost=2;this.sound(180,.1,'triangle');}
    if(action==='dash'&&p.q<=0){
      const ox=p.x,oy=p.y;p.q=5;p.inv=.3;p.atk=.12;this.movePlayer(Math.cos(p.a)*205,Math.sin(p.a)*205,true);
      for(const e of this.enemies){const dx=p.x-ox,dy=p.y-oy,t=clamp(((e.x-ox)*dx+(e.y-oy)*dy)/(dx*dx+dy*dy||1),0,1);if(!e.dead&&Math.hypot(e.x-ox-dx*t,e.y-oy-dy*t)<e.r+42)this.hit(e,this.powers.has(5)?80:40,false,true);}
      this.slashes.push({x:p.x,y:p.y,angle:p.a,radius:115,life:.25,max:.25,spin:false});this.sound(310,.22,'sawtooth',.025);if(this.powers.has(4))p.hp=Math.min(100,p.hp+5);
    }
    if(action==='spin'&&p.e<=0){p.e=8;p.atk=.2;const radius=this.powers.has(3)?168:132;let hits=0;for(const e of this.enemies){if(!e.dead&&Math.hypot(e.x-p.x,e.y-p.y)<radius+e.r){this.hit(e,48,false,true);hits++;}}if(this.powers.has(3))p.e-=Math.min(3,hits*.7);this.slashes.push({x:p.x,y:p.y,angle:p.a,radius,life:.42,max:.42,spin:true});this.sound(360,.3,'triangle');if(this.powers.has(4))p.hp=Math.min(100,p.hp+5);}
    this.emit();
  }
  shoot(x:number,y:number,a:number,damage:number,enemy:boolean,split:boolean=false){const speed=enemy?255:670;this.shots.push({x,y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,life:enemy?3:1.05,damage,enemy,hit:new Set(),split,r:enemy?7:15});}
  hit(e:Enemy,damage:number,ranged:boolean,breakGuard=false){
    if(e.dead)return;const p=this.player;const guarded=e.kind==='shield'&&Math.abs(angleDifference(Math.atan2(p.y-e.y,p.x-e.x),e.aim))<1.1&&!breakGuard;
    const amount=Math.round(damage*(guarded?.25:1));e.hp-=amount;e.flash=.13;e.active=true;e.stun=guarded?.04:e.kind==='boss'?.025:.18;
    if(breakGuard&&e.kind!=='boss')e.stun=.5;
    const a=Math.atan2(e.y-p.y,e.x-p.x);if(e.kind!=='boss'){e.x+=Math.cos(a)*(ranged?5:13);e.y+=Math.sin(a)*(ranged?5:13);}
    this.particles(e.x,e.y,guarded?'#d8c693':'#98f4d1',7);this.float(e.x,e.y-25,guarded?amount+' 格挡':String(amount),guarded?'#c1b88c':'#f1e5be');this.shake=Math.max(this.shake,2.4);this.sound(guarded?460:120,.07,'triangle',.035);
    if(e.hp<=0){e.dead=true;this.kills++;this.particles(e.x,e.y,'#9be2bb',18);this.float(e.x,e.y-42,'+ 火种','#9bbd8c');if(e.kind==='boss'){this.bossDefeated=true;this.shots=this.shots.filter(s=>!s.enemy);this.hazards=[];for(const other of this.enemies)if(other!==e)other.dead=true;this.message('守灯者倒下了。向北点亮灯站。',6);}else if(e.kind==='elite'){this.player.hp=Math.min(100,this.player.hp+15);this.message('精英已击败 · 恢复 15 点生命');}else if(this.kills%4===0){this.player.hp=Math.min(100,this.player.hp+4);}}
  }
  hurt(amount:number){const p=this.player;if(p.inv>0||this.mode!=='playing')return;p.hp=Math.max(0,p.hp-amount);p.inv=.75;this.shake=7;this.particles(p.x,p.y,'#f29f88',10);this.float(p.x,p.y-35,'−'+amount,'#ffa89b');this.sound(80,.17,'sawtooth',.045);if(p.hp<=0){this.mode='dead';this.clearInput();this.emit();}}
  particles(x:number,y:number,color:string,count:number){for(let i=0;i<count;i++){const a=Math.random()*TAU,s=30+Math.random()*110,life=.25+Math.random()*.45;this.fx.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life,max:life,size:1+Math.random()*3,color});}}
  float(x:number,y:number,text:string,color:string){this.fx.push({x,y,vx:0,vy:-35,life:.85,max:.85,size:16,color,text});}
  movePlayer(dx:number,dy:number,trail=false){const p=this.player,n=Math.max(1,Math.ceil(Math.hypot(dx,dy)/12));for(let i=0;i<n;i++){const nx=clamp(p.x+dx/n,255,1345),ny=clamp(p.y+dy/n,170,4140);if(this.canWalk(nx,p.y))p.x=nx;if(this.canWalk(p.x,ny))p.y=ny;if(trail&&i%2===0)this.particles(p.x,p.y,'#95d8ca',2);}}
  canWalk(x:number,y:number){if(y>2220&&y<2350&&(x<640||x>965))return false;for(const t of this.trees)if(Math.abs(t.y-y)<35&&Math.hypot(t.x-x,t.y-y)<t.s*12+14)return false;return true;}
  doInteract(){const p=this.player;
    if(Math.hypot(p.x-1030,p.y-2890)<135&&!this.used.has(0)){if(this.enemies.some(e=>!e.dead&&Math.hypot(e.x-1030,e.y-2890)<310)){this.message('先击退货车附近的怪物');return;}this.used.add(0);p.hp=Math.min(100,p.hp+25);this.offerUpgrade();return;}
    if(Math.hypot(p.x-650,p.y-1880)<110&&!this.used.has(1)){this.used.add(1);this.offerUpgrade();return;}
    if(Math.hypot(p.x-790,p.y-1300)<135&&!this.used.has(2)){if(this.enemies.some(e=>!e.dead&&Math.hypot(e.x-p.x,e.y-p.y)<300)){this.message('附近仍有敌人，先确保营地安全');return;}this.used.add(2);p.hp=100;p.energy=3;this.enemies=this.enemies.filter(e=>e.y<1050);this.shots=[];this.storeSave();this.offerUpgrade();return;}
    if(Math.hypot(p.x-800,p.y-250)<150&&this.bossDefeated){this.mode='won';this.clearInput();this.sound(850,.8);this.emit();}
  }
  updateEvents(){const y=this.player.y;
    const trigger=(id:number,at:number,fn:()=>void)=>{if(y<at&&!this.events.has(id)){this.events.add(id);fn();}};
    trigger(0,3730,()=>{this.spawn('beast',760,3530);this.spawn('beast',925,3480);this.message('草丛传来低吼 · Z 连斩，X 剑气，C 闪避');});
    trigger(1,3360,()=>{this.spawn('archer',850,3180);this.spawn('beast',1020,3140);});
    trigger(2,3100,()=>{this.spawn('beast',940,2930);this.spawn('beast',1120,2790);this.spawn('archer',930,2700);this.message('翻倒的货车旁似乎还有幸存者');});
    trigger(3,2680,()=>{this.spawn('shield',760,2450);this.spawn('archer',700,2130);this.spawn('archer',930,2100);this.spawn('beast',1090,2400);this.message('前方旧桥 · 突进贴近弓手，重斩击破盾牌');});
    trigger(4,2050,()=>{this.spawn('beast',620,1840);this.spawn('shield',890,1850);this.spawn('beast',1030,1800);});
    trigger(5,1750,()=>{this.spawn('elite',800,1530);this.spawn('beast',1000,1580);this.message('重锤守卫挡住了去路 · 留意红色攻击预警');});
    trigger(6,1080,()=>{this.spawn('shield',730,960);this.spawn('archer',1010,890);this.message('北方灯站就在前方',3);});
    trigger(7,780,()=>{const boss=this.spawn('boss',800,510);boss.active=true;this.message('「止步……灯站，不许靠近。」',4);});
    this.interact='';const p=this.player;if(Math.hypot(p.x-1030,p.y-2890)<135&&!this.used.has(0))this.interact='救援商人 · 恢复与强化';else if(Math.hypot(p.x-650,p.y-1880)<110&&!this.used.has(1))this.interact='拾取遗失火种 · 选择强化';else if(Math.hypot(p.x-790,p.y-1300)<135&&!this.used.has(2))this.interact='点亮营地 · 补满生命并存档';else if(Math.hypot(p.x-800,p.y-250)<150&&this.bossDefeated)this.interact='点亮北方灯站 · 完成冒险';
  }
  update(dt:number){
    const p=this.player;this.time+=dt;this.shake=Math.max(0,this.shake-dt*18);
    for(const key of ['inv','atk','comboTimer','dodge','q','e','boost'] as const)p[key]=Math.max(0,p[key]-dt);
    if(this.toastTimer>0){this.toastTimer-=dt;if(this.toastTimer<=0)this.toast='';}
    const mx=Number(this.keys.has('d')||this.keys.has('arrowright'))-Number(this.keys.has('a')||this.keys.has('arrowleft')),my=Number(this.keys.has('s')||this.keys.has('arrowdown'))-Number(this.keys.has('w')||this.keys.has('arrowup'));
    p.moving=!!(mx||my);if(p.moving){const n=Math.hypot(mx,my),speed=p.atk>.15?166:225;this.movePlayer(mx/n*speed*dt,my/n*speed*dt);}
    this.updateAim(mx,my);
    if((this.held.has(0)||this.keys.has('z'))&&p.atk<=0)this.action('attack');if((this.held.has(2)||this.keys.has('x'))&&p.atk<=0&&p.energy>0)this.action('ranged');this.updateEvents();
    for(const e of this.enemies){
      if(e.dead)continue;e.flash=Math.max(0,e.flash-dt);e.stun=Math.max(0,e.stun-dt);if(e.stun>0)continue;
      const dx=p.x-e.x,dy=p.y-e.y,d=Math.hypot(dx,dy),a=Math.atan2(dy,dx);if(d<490)e.active=true;if(!e.active)continue;
      if(e.wind>0){e.wind-=dt;if(e.wind<=0)this.enemyAttack(e);continue;}
      e.cd-=dt;e.aim=a;const range=e.kind==='archer'?340:e.kind==='boss'?205:e.kind==='elite'?135:68;
      if(d<range&&e.cd<=0){e.wind=e.kind==='boss'?.95:e.kind==='elite'?.85:e.kind==='archer'?.72:.48;e.tx=p.x;e.ty=p.y;e.aim=a;if(e.kind==='boss')e.attack=(e.attack+1)%3;continue;}
      if(e.kind==='archer'&&d<175){e.x-=Math.cos(a)*e.speed*dt;e.y-=Math.sin(a)*e.speed*dt;}
      else if(d>range*.72){e.x+=Math.cos(a)*e.speed*dt;e.y+=Math.sin(a)*e.speed*dt;}
      for(const other of this.enemies){if(other===e||other.dead)continue;const ax=e.x-other.x,ay=e.y-other.y,dist=Math.hypot(ax,ay),min=(e.r+other.r)*.8;if(dist>0&&dist<min){e.x+=ax/dist*dt*25;e.y+=ay/dist*dt*25;}}
      e.x=clamp(e.x,250,1350);e.y=clamp(e.y,200,4140);
    }
    for(const s of [...this.shots]){s.life-=dt;s.x+=s.vx*dt;s.y+=s.vy*dt;if(s.enemy){if(Math.hypot(s.x-p.x,s.y-p.y)<s.r+16){this.hurt(s.damage);s.life=0;}}else{for(const e of this.enemies){if(e.dead||s.hit.has(e.id)||Math.hypot(s.x-e.x,s.y-e.y)>e.r+s.r)continue;s.hit.add(e.id);this.hit(e,s.damage,true);if(s.split){s.split=false;const a=Math.atan2(s.vy,s.vx);for(const offset of [-.38,.38]){this.shoot(s.x,s.y,a+offset,18,false);this.shots[this.shots.length-1].hit.add(e.id);}}}}}
    this.shots=this.shots.filter(s=>s.life>0);
    for(const h of this.hazards){h.delay-=dt;if(h.delay<=0){h.life-=dt;if(Math.hypot(h.x-p.x,h.y-p.y)<h.r+12)this.hurt(10);}}this.hazards=this.hazards.filter(h=>h.life>0);
    for(const f of this.fx){f.life-=dt;f.x+=f.vx*dt;f.y+=f.vy*dt;}this.fx=this.fx.filter(f=>f.life>0);for(const s of this.slashes)s.life-=dt;this.slashes=this.slashes.filter(s=>s.life>0);
    this.cam.x+=(clamp(p.x+(this.aimMode==='mouse'?(this.mouse.x-640)*.08:0),640,W-640)-this.cam.x)*Math.min(1,dt*5);this.cam.y+=(clamp(p.y-80,360,H-360)-this.cam.y)*Math.min(1,dt*6);
  }
  enemyAttack(e:Enemy){const p=this.player;const d=Math.hypot(p.x-e.x,p.y-e.y);e.cd=e.kind==='boss'?1.6:e.kind==='archer'?1.7:e.kind==='elite'?1.8:1.25;
    if(e.kind==='archer'){this.shoot(e.x,e.y,e.aim,9,true);return;}
    if(e.kind==='boss'){
      if(e.attack===0){if(d<215&&Math.abs(angleDifference(Math.atan2(p.y-e.y,p.x-e.x),e.aim))<1.5)this.hurt(19);this.slashes.push({x:e.x,y:e.y,angle:e.aim,radius:210,life:.25,max:.25,spin:false});}
      else if(e.attack===1){const ox=e.x,oy=e.y,dx=e.tx-e.x,dy=e.ty-e.y,dist=Math.hypot(dx,dy)||1,length=Math.min(330,dist+65);e.x=clamp(e.x+dx/dist*length,340,1260);e.y=clamp(e.y+dy/dist*length,300,950);const vx=e.x-ox,vy=e.y-oy,t=clamp(((p.x-ox)*vx+(p.y-oy)*vy)/(vx*vx+vy*vy||1),0,1);if(Math.hypot(p.x-ox-vx*t,p.y-oy-vy*t)<60)this.hurt(22);e.stun=.75;this.particles(e.x,e.y,'#b7927a',25);}
      else{if(d<165)this.hurt(23);this.particles(e.x,e.y,'#ec9e76',40);this.hazards.push({x:e.x,y:e.y,r:155,life:.3,delay:0});if(e.hp<e.max*.5){for(let i=0;i<5;i++){const a=i*TAU/5;this.hazards.push({x:e.x+Math.cos(a)*175,y:e.y+Math.sin(a)*175,r:48,life:4.5,delay:.7});}}}
      if(e.hp<e.max*.5)e.cd*=.78;this.shake=5;this.sound(65,.25,'triangle');return;
    }
    if(e.kind==='beast'){e.x+=Math.cos(e.aim)*32;e.y+=Math.sin(e.aim)*32;}
    if(Math.hypot(p.x-e.x,p.y-e.y)<(e.kind==='elite'?150:75)&&Math.abs(angleDifference(Math.atan2(p.y-e.y,p.x-e.x),e.aim))<1.3)this.hurt(e.kind==='elite'?18:e.kind==='shield'?12:8);
    this.particles(e.x+Math.cos(e.aim)*30,e.y+Math.sin(e.aim)*30,'#c18583',8);
  }
  frame=(now:number)=>{if(this.destroyed)return;const dt=Math.min(.033,Math.max(0,(now-(this.last||now))/1000));this.last=now;if(this.mode==='playing'){this.clock+=dt;this.update(dt);}else if(this.mode==='menu')this.clock+=dt;this.render();if(now-this.emitAt>85){this.emitAt=now;this.emit();}this.raf=requestAnimationFrame(this.frame);};

  createGround(){const g=this.ground.getContext('2d')!,r=random(72);g.fillStyle='#17302c';g.fillRect(0,0,W,H);
    for(let i=0;i<23000;i++){const x=r()*W,y=r()*H;g.fillStyle=['#1c3830','#203d31','#244337','#102923','#294237'][Math.floor(r()*5)];g.beginPath();g.ellipse(x,y,4+r()*23,2+r()*10,r()*TAU,0,TAU);g.fill();}
    const path=(width:number,color:string)=>{g.strokeStyle=color;g.lineWidth=width;g.lineCap='round';g.beginPath();for(let y=150;y<H;y+=20){const x=pathX(y);if(y===150)g.moveTo(x,y);else g.lineTo(x,y);}g.stroke();};
    path(540,'#243c30');path(440,'#394838');path(365,'#45503c');
    for(let i=0;i<6300;i++){const y=180+r()*(H-200),x=pathX(y)+(r()-.5)*430;g.fillStyle=['#3b4938','#4a5440','#525942','#334532','#616148'][Math.floor(r()*5)];g.globalAlpha=.4+r()*.3;g.beginPath();g.ellipse(x,y,2+r()*17,1+r()*9,r()*2,0,TAU);g.fill();}g.globalAlpha=1;
    for(let y=380;y<4200;y+=68){for(let j=-1;j<=1;j++){const x=pathX(y)+j*65+(r()-.5)*20;g.fillStyle=r()>.5?'#59614b':'#4d5945';g.strokeStyle='#263c30';g.lineWidth=3;g.beginPath();g.moveTo(x-25,y-15);g.lineTo(x+20,y-18);g.lineTo(x+30,y+9);g.lineTo(x+14,y+20);g.lineTo(x-24,y+14);g.closePath();g.fill();g.stroke();}}
    // A shallow river crossed by a broad wooden bridge.
    g.fillStyle='#173f43';g.fillRect(0,2205,W,165);g.fillStyle='#294c48';g.fillRect(0,2197,W,10);g.fillRect(0,2370,W,12);
    for(let i=0;i<110;i++){const x=r()*W,y=2210+r()*145;g.fillStyle='#4e777255';g.fillRect(x,y,20+r()*70,2);}
    for(let y=2190;y<2385;y+=21){g.fillStyle=y%2?'#666044':'#736c4d';g.fillRect(623,y,360,18);g.fillStyle='#94835a66';g.fillRect(630,y+2,344,2);g.fillStyle='#282f27';for(const x of [644,959])g.fillRect(x,y+5,4,5);}
    g.fillStyle='#3b3b2d';g.fillRect(616,2185,10,203);g.fillRect(980,2185,10,203);
    // Circular ruins of the north lamp station.
    g.fillStyle='#33473c';g.beginPath();g.ellipse(800,550,445,355,0,0,TAU);g.fill();
    for(let ring=1;ring<=5;ring++){g.strokeStyle=ring===5?'#5b6850':'#53624c77';g.lineWidth=ring===5?9:2;g.beginPath();g.ellipse(800,550,ring*77,ring*62,0,0,TAU);g.stroke();for(let i=0;i<ring*8;i++){const a=i*TAU/(ring*8);g.beginPath();g.moveTo(800+Math.cos(a)*(ring-1)*77,550+Math.sin(a)*(ring-1)*62);g.lineTo(800+Math.cos(a)*ring*77,550+Math.sin(a)*ring*62);g.stroke();}}
    for(let i=0;i<2500;i++){const x=r()*W,y=r()*H;if(Math.abs(x-pathX(y))<245||y<920&&Math.abs(x-800)<450)continue;g.strokeStyle=['#42654c','#56815b','#365e43'][Math.floor(r()*3)];g.lineWidth=1;g.beginPath();g.moveTo(x,y);g.lineTo(x-3-r()*6,y-5-r()*10);g.moveTo(x,y);g.lineTo(x+4+r()*5,y-4-r()*9);g.stroke();}
    for(let i=0;i<320;i++){const y=170+r()*(H-200),x=70+r()*(W-140);if(Math.abs(x-pathX(y))<315||y<1000&&Math.abs(x-800)<510||y>2170&&y<2420)continue;this.trees.push({x,y,s:.8+r()*.9,seed:Math.floor(r()*10000)});}
    this.trees.sort((a,b)=>a.y-b.y);
  }
  ellipse(x:number,y:number,rx:number,ry:number,color:string){const c=this.ctx;c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,0,0,TAU);c.fill();}
  glow(x:number,y:number,r:number,color:string){const c=this.ctx,g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,'transparent');c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);}
  tree(t:Tree){const c=this.ctx,r=random(t.seed),{x,y,s}=t;c.save();c.translate(x,y);c.scale(s,s);this.ellipse(15,5,58,22,'#081c2277');c.fillStyle='#26332c';c.beginPath();c.moveTo(-10,5);c.lineTo(-6,-60);c.lineTo(7,-60);c.lineTo(11,7);c.lineTo(0,0);c.closePath();c.fill();c.strokeStyle='#62705455';c.lineWidth=3;c.beginPath();c.moveTo(0,0);c.lineTo(2,-60);c.stroke();
    for(let tier=0;tier<4;tier++){const yy=-25-tier*26,width=67-tier*11;c.fillStyle=['#102d2c','#173932','#1d4337','#29503d'][tier];c.beginPath();c.moveTo(0,yy-64);for(let j=0;j<=8;j++){const xx=-width+j*width/4;c.lineTo(xx,yy+Math.abs(xx)/width*9+(r()-.5)*10);}c.closePath();c.fill();c.strokeStyle='#52725433';c.lineWidth=1;c.beginPath();c.moveTo(0,yy-56);c.lineTo(-width+7,yy+4);c.stroke();}c.restore();}
  lamp(x:number,y:number,on=true,big=false){const c=this.ctx,s=big?1.8:1;c.save();c.translate(x,y);c.scale(s,s);this.ellipse(2,8,24,11,'#0b202888');if(on)this.glow(0,-42,125,'#e8b96325');c.fillStyle='#45483b';c.fillRect(-15,1,30,8);c.fillStyle='#817657';c.fillRect(-9,-4,18,7);c.fillStyle='#546051';c.fillRect(-4,-46,8,45);c.fillStyle='#293c36';c.fillRect(-12,-66,24,29);c.strokeStyle='#9e9265';c.lineWidth=2;c.strokeRect(-12,-66,24,29);if(on){this.glow(0,-52,35,'#ffc96b88');this.ellipse(0,-52,6,10,'#f7d891');this.ellipse(0,-54+Math.sin(this.clock*6)*2,3,7,'#fff5c5');}else this.ellipse(0,-52,5,7,'#405755');c.fillStyle='#8a805b';c.beginPath();c.moveTo(-17,-66);c.lineTo(0,-78);c.lineTo(17,-66);c.closePath();c.fill();c.restore();}
  cart(){const c=this.ctx;c.save();c.translate(1030,2890);c.rotate(-.23);this.ellipse(0,8,60,27,'#0a202a99');for(const y of [-29,27]){c.fillStyle='#202c26';c.fillRect(-45,y-5,90,12);for(const x of [-34,35]){this.ellipse(x,y,14,13,'#3b3c2c');c.strokeStyle='#a18a54';c.lineWidth=3;c.beginPath();c.arc(x,y,11,0,TAU);c.stroke();}}c.fillStyle='#3d4430';c.fillRect(-46,-25,92,48);for(let i=0;i<6;i++){c.fillStyle=i%2?'#7d7049':'#6c6643';c.fillRect(-44+i*15,-24,12,44);}c.fillStyle='#9a8d61';c.fillRect(-40,-28,80,6);c.fillRect(-40,23,80,5);c.fillStyle='#a89862';c.fillRect(-24,-20,33,30);c.fillStyle='#b2a274';c.fillRect(-20,-19,4,28);c.restore();this.lamp(1110,2880,!this.used.has(0));if(!this.used.has(0)){this.ellipse(1075,2940,14,8,'#0a202a88');this.ellipse(1075,2925,12,16,'#8d784d');this.ellipse(1075,2908,8,9,'#cab991');}}
  character(x:number,y:number,a:number,enemy?:Enemy){const c=this.ctx;const boss=enemy?.kind==='boss',elite=enemy?.kind==='elite',scale=boss?2.35:elite?1.7:enemy?.kind==='shield'?1.25:1;const moving=enemy?enemy.active&&enemy.wind<=0:this.player.moving;const bob=moving?Math.sin(this.clock*13)*2:Math.sin(this.clock*2)*.7;
    c.save();c.translate(x,y);c.scale(scale,scale);if(enemy?.flash)c.globalAlpha=.55;else if(!enemy&&this.player.inv>0)c.globalAlpha=.55+Math.sin(this.clock*45)*.3;
    this.ellipse(0,6,20,9,'#081c2699');
    if(enemy?.kind==='beast'){
      c.rotate(a);this.ellipse(-3,0,23,13,'#3b4a40');this.ellipse(13,0,12,9,'#5b6550');c.fillStyle='#7a795d';c.beginPath();c.moveTo(5,-8);c.lineTo(0,-20);c.lineTo(14,-9);c.moveTo(5,8);c.lineTo(0,20);c.lineTo(14,9);c.fill();c.strokeStyle='#293e36';c.lineWidth=5;for(const yy of [-11,11]){c.beginPath();c.moveTo(-10,yy);c.lineTo(-18+Math.sin(this.clock*11)*3,yy*1.6);c.moveTo(8,yy);c.lineTo(3,yy*1.6);c.stroke();}c.strokeStyle='#647053';c.lineWidth=4;c.beginPath();c.moveTo(-22,0);c.quadraticCurveTo(-38,-8,-31,-19);c.stroke();this.ellipse(17,-5,3,2,'#ee8b97');this.ellipse(17,5,3,2,'#ee8b97');c.fillStyle='#ded2b1';c.fillRect(23,-7,5,3);c.fillRect(23,4,5,3);c.restore();return;
    }
    c.fillStyle='#16292b';c.fillRect(-10,0+bob,7,12-bob);c.fillRect(4,0-bob,7,12+bob);c.fillStyle='#839080';c.fillRect(-11,9+bob,9,4);c.fillRect(4,9-bob,9,4);
    const body=enemy?(boss?'#566253':enemy.kind==='archer'?'#574b5c':'#62715a'):'#7b9b87';c.fillStyle=body;c.beginPath();c.moveTo(-11,-27+bob);c.lineTo(11,-27+bob);c.lineTo(17,5);c.lineTo(-17,5);c.closePath();c.fill();c.fillStyle=enemy?'#39483e':'#3f6863';c.beginPath();c.moveTo(-12,-23);c.lineTo(-17,7);c.lineTo(0,13);c.lineTo(14,5);c.lineTo(8,-23);c.closePath();c.fill();c.fillStyle=body;c.fillRect(-10,-24+bob,20,20);c.fillStyle='#b5bba0';c.fillRect(-10,-8,20,3);
    if(!enemy){c.fillStyle='#b85d4c';c.beginPath();c.moveTo(-8,-25);c.lineTo(12,-25);c.lineTo(3,-17);c.lineTo(-6,-17);c.closePath();c.fill();c.beginPath();c.moveTo(-7,-23);c.quadraticCurveTo(-22,-18+Math.sin(this.clock*5)*5,-37,-27+Math.sin(this.clock*5)*8);c.lineTo(-28,-17);c.lineTo(-7,-16);c.fill();}
    this.ellipse(0,-34+bob,10,11,enemy?'#829078':'#d4ccb0');c.fillStyle=enemy?'#303d3a':'#aabca6';c.beginPath();c.moveTo(-11,-32+bob);c.lineTo(-10,-43+bob);c.lineTo(3,-47+bob);c.lineTo(12,-37+bob);c.lineTo(8,-29+bob);c.lineTo(4,-35+bob);c.lineTo(-6,-33+bob);c.closePath();c.fill();c.fillStyle=enemy?'#ef9a9c':'#183d38';c.fillRect(Math.cos(a)*4-2,-33+bob,5,2);
    if(boss||elite){c.strokeStyle='#afab84';c.lineWidth=4;c.beginPath();c.moveTo(-8,-42);c.lineTo(-16,-48);c.lineTo(-13,-56);c.moveTo(7,-42);c.lineTo(15,-48);c.lineTo(12,-56);c.stroke();this.ellipse(-16,-20,9,8,'#7c8566');this.ellipse(16,-20,9,8,'#7c8566');if(boss){this.glow(-8,-21,37,'#ec9d6655');this.ellipse(-8,-23,7,11,'#e6ac6d');}}
    if(enemy?.kind==='shield'){c.fillStyle='#728263';c.strokeStyle='#c6bd8c';c.lineWidth=2;c.beginPath();c.moveTo(-27,-24);c.lineTo(-10,-27);c.lineTo(-8,-7);c.lineTo(-20,4);c.lineTo(-30,-8);c.closePath();c.fill();c.stroke();}
    c.save();c.translate(5,-14);c.rotate(a);
    if(enemy?.kind==='archer'){c.strokeStyle='#b9a37f';c.lineWidth=3;c.beginPath();c.arc(13,0,20,-1.15,1.15);c.stroke();c.strokeStyle='#b8c1a3';c.lineWidth=1;c.beginPath();c.moveTo(21,-18);c.lineTo(21,18);c.stroke();}
    else{c.fillStyle='#bca77e';c.fillRect(9,-3,10,6);c.fillStyle='#a0b9aa';c.fillRect(20,-5,boss?29:elite?25:30,10);c.fillStyle='#d0e5cc';c.beginPath();c.moveTo(20,-5);c.lineTo(51,-5);c.lineTo(61,0);c.lineTo(20,0);c.closePath();c.fill();c.fillStyle='#d8c087';c.fillRect(17,-9,4,18);if(elite){c.fillStyle='#7d8b73';c.fillRect(40,-15,19,30);}}
    c.restore();if(!enemy){this.glow(14,-2,42,'#eccc7633');c.fillStyle='#e5c274';c.fillRect(10,-9,8,11);c.fillStyle='#fff0ac';c.fillRect(12,-7,4,6);}c.restore();
  }
  render(){const c=this.ctx;c.clearRect(0,0,1280,720);c.save();const shake=this.shake;c.translate(640-this.cam.x+(Math.random()-.5)*shake,360-this.cam.y+(Math.random()-.5)*shake);c.drawImage(this.ground,0,0);
    // Soft moving river highlights and fireflies.
    c.fillStyle='#85bdad24';for(let i=0;i<18;i++)c.fillRect((i*119+this.clock*23)%1600,2230+(i*37)%125,42,2);
    for(const h of this.hazards){this.ellipse(h.x,h.y,h.r,h.r,h.delay>0?'#ec8c7444':'#ce703b66');c.strokeStyle='#f19a78aa';c.lineWidth=2;c.beginPath();c.arc(h.x,h.y,h.r,0,TAU);c.stroke();if(h.delay<=0)this.glow(h.x,h.y,h.r,'#d98a4233');}
    for(const e of this.enemies){if(e.dead||e.wind<=0)continue;c.save();c.translate(e.x,e.y);c.rotate(e.aim);c.fillStyle='#e0778350';c.strokeStyle='#f1a095bb';c.lineWidth=2;c.beginPath();if(e.kind==='archer'){c.moveTo(0,-7);c.lineTo(410,-7);c.lineTo(410,7);c.lineTo(0,7);c.closePath();}else if(e.kind==='boss'&&e.attack===1){c.rect(0,-50,330,100);}else if(e.kind==='boss'&&e.attack===2){c.arc(0,0,165,0,TAU);}else{const range=e.kind==='boss'?215:e.kind==='elite'?150:85;c.moveTo(0,0);c.arc(0,0,range,-1.3,1.3);c.closePath();}c.fill();c.stroke();c.restore();}
    const objects:{y:number;draw:()=>void}[]=[];for(const t of this.trees)if(Math.abs(t.y-this.cam.y)<540)objects.push({y:t.y,draw:()=>this.tree(t)});
    for(let y=450;y<H;y+=470){const side=(Math.floor(y/470)%2===0?1:-1),x=pathX(y)+side*245;objects.push({y,draw:()=>this.lamp(x,y)});}
    objects.push({y:2890,draw:()=>this.cart()},{y:1300,draw:()=>this.lamp(790,1300,this.used.has(2),true)},{y:250,draw:()=>this.lamp(800,250,this.mode==='won',true)});
    if(!this.used.has(1))objects.push({y:1880,draw:()=>{this.glow(650,1860,65,'#d2be6944');this.ellipse(650,1885,22,9,'#233b3288');c.save();c.translate(650,1860+Math.sin(this.clock*3)*4);c.rotate(Math.PI/4);c.fillStyle='#e1c577';c.fillRect(-7,-7,14,14);c.strokeStyle='#ffdf9c';c.strokeRect(-10,-10,20,20);c.restore();}});
    for(const e of this.enemies)if(!e.dead&&Math.abs(e.y-this.cam.y)<500)objects.push({y:e.y,draw:()=>this.character(e.x,e.y,e.aim,e)});
    objects.push({y:this.player.y,draw:()=>this.character(this.player.x,this.player.y,this.player.a)});objects.sort((a,b)=>a.y-b.y);for(const o of objects)o.draw();
    for(const e of this.enemies){if(e.dead||e.kind==='boss'||e.hp>=e.max||Math.abs(e.y-this.cam.y)>450)continue;c.fillStyle='#152825';c.fillRect(e.x-20,e.y-e.r*2.5-8,40,3);c.fillStyle='#bc8f83';c.fillRect(e.x-20,e.y-e.r*2.5-8,40*Math.max(0,e.hp/e.max),3);}
    for(const s of this.slashes){const progress=1-s.life/s.max;c.save();c.translate(s.x,s.y-9);c.rotate(s.angle);c.globalAlpha=s.life/s.max;const start=s.spin?progress*TAU:-1.5+progress*.6,end=s.spin?start+TAU* .85:1.3+progress*.7;c.strokeStyle='#dcfff0';c.lineWidth=4+10*(1-progress);c.beginPath();c.arc(0,0,s.radius,start,end);c.stroke();c.strokeStyle='#88e1c455';c.lineWidth=23;c.beginPath();c.arc(0,0,s.radius-9,start+.1,end-.1);c.stroke();c.restore();}
    for(const s of this.shots){c.save();c.translate(s.x,s.y);c.rotate(Math.atan2(s.vy,s.vx));this.glow(0,0,s.enemy?24:45,s.enemy?'#ee819655':'#96ffdf44');c.strokeStyle=s.enemy?'#f9a4b3':'#cefff1';c.lineWidth=s.enemy?3:5;c.beginPath();if(s.enemy){c.moveTo(-18,0);c.lineTo(9,0);}else c.arc(-10,0,25,-.95,.95);c.stroke();c.restore();}
    for(const f of this.fx){c.globalAlpha=clamp(f.life/f.max,0,1);if(f.text){c.fillStyle=f.color;c.font=`${f.size}px Arial`;c.textAlign='center';c.shadowColor='#081b20';c.shadowBlur=5;c.fillText(f.text,f.x,f.y);c.shadowBlur=0;}else this.ellipse(f.x,f.y,f.size,f.size,f.color);}c.globalAlpha=1;
    for(let i=0;i<32;i++){const x=this.cam.x-700+((i*157+Math.sin(this.clock*.5+i)*20)%1450),y=this.cam.y-430+((i*117+this.clock*5)%850);this.glow(x,y,8,'#bdcf6533');this.ellipse(x,y,1.1,1.1,`rgba(214,224,143,${.3+Math.sin(this.clock+i)*.2})`);}
    c.restore();
    // The mist is translucent, so enemies and attack tells stay readable.
    for(let i=0;i<3;i++){const x=300+i*460+Math.sin(this.clock*.06+i)*80,g=c.createRadialGradient(x,70+i*160,10,x,70+i*160,390);g.addColorStop(0,'#a3c7b30b');g.addColorStop(1,'transparent');c.fillStyle=g;c.fillRect(0,0,1280,720);}
    const vignette=c.createRadialGradient(640,360,240,640,360,770);vignette.addColorStop(0,'transparent');vignette.addColorStop(1,'#03151c99');c.fillStyle=vignette;c.fillRect(0,0,1280,720);
    if(this.mode==='playing'){
      // A small route compass points to the next objective without a cluttered minimap.
      const targetY=this.bossDefeated?250:Math.max(300,this.player.y-450),a=Math.atan2(targetY-this.player.y,800-this.player.x);c.save();c.translate(1210,610);c.strokeStyle='#becba54d';c.lineWidth=1;c.beginPath();c.arc(0,0,25,0,TAU);c.stroke();c.fillStyle='#bac7a5';c.font='9px Arial';c.textAlign='center';c.fillText('N',0,-31);c.rotate(a);c.fillStyle='#e0c688';c.beginPath();c.moveTo(14,0);c.lineTo(-6,-5);c.lineTo(-3,0);c.lineTo(-6,5);c.closePath();c.fill();c.restore();
      if(this.aimMode==='mouse'){c.strokeStyle='#e3e8c88c';c.lineWidth=1;c.beginPath();c.arc(this.mouse.x,this.mouse.y,6,0,TAU);c.moveTo(this.mouse.x-10,this.mouse.y);c.lineTo(this.mouse.x-4,this.mouse.y);c.moveTo(this.mouse.x+4,this.mouse.y);c.lineTo(this.mouse.x+10,this.mouse.y);c.stroke();}else{const target=this.enemies.filter(e=>!e.dead&&Math.hypot(e.x-this.player.x,e.y-this.player.y)<600).sort((a,b)=>Math.hypot(a.x-this.player.x,a.y-this.player.y)-Math.hypot(b.x-this.player.x,b.y-this.player.y))[0];if(target){c.save();c.translate(target.x-this.cam.x+640,target.y-this.cam.y+360);c.strokeStyle='#e3d599aa';c.lineWidth=1.5;c.setLineDash([5,7]);c.beginPath();c.ellipse(0,8,target.r+8,(target.r+8)*.5,0,0,TAU);c.stroke();c.restore();}}
      if(this.player.hp<30){c.strokeStyle=`rgba(201,78,89,${.2+Math.sin(this.clock*3)*.08})`;c.lineWidth=16;c.strokeRect(0,0,1280,720);}
    }
  }
}
