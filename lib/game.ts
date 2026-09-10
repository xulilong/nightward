import { AVAILABLE_CHAPTERS, sitesFor, villageWalkable, villageEncounters, safeVillagePoint, villageFireSites } from './levels';
export type Mode = 'menu' | 'playing' | 'paused' | 'upgrade' | 'dead' | 'won' | 'interlude' | 'dialogue';
export const chapters = [
 {name:'雾林边境',subtitle:'第一章 · 失踪的巡逻队',boss:'叛逃骑士 · 加雷斯',intro:'烬：七天。把你和密信送到王城，任务就结束了。\n艾琳：那边有一匹空鞍马……巡逻队出事了。',ending:'旧徽记上仍刻着渡鸦。加雷斯的话，让三年前的记忆重新浮现。\n远方村庄升起黑烟，艾琳坚持去看看。',mission:'追踪巡逻队，寻找遗留军令',color:'#9ec7b1'},
 {name:'灰烬村庄',subtitle:'第二章 · 谁值得被救',boss:'劫掠首领 · 乌尔夫',intro:'艾琳：谷仓里还有人！我们不能就这样走。\n烬：沿着院墙走。Q 突进贴近弩手，我来打开道路。',ending:'村民走出灰烬，通往鸦渡要塞的道路重新开放。\n烬发现征粮令上的印章，正属于自己曾经效忠的家族。',mission:'搜救谷仓与庭院中的幸存者',color:'#e6b887'},
] as const;
export type BattleRecord={stage:number;time:number;kills:number;damage:number;dodges:number;rank:string};
export type Snapshot = {guidance:string;completedSites:number[];dialogue:{speaker:string;text:string;choices:string[]}|null;story:Story;training:boolean;ritualTime:number|null;ritualId:number|null;stage:number;difficulty:'normal'|'story';potions:number;damage:number;perfectDodges:number;records:BattleRecord[];hasSave:boolean;relays:number;playerX:number;playerY:number; mode:Mode; hp:number; energy:number; kills:number; time:number; chapter:number; progress:number; objective:string; dodgeCD:number; qCD:number; eCD:number; bossHP:number|null; toast:string; interact:string; choices:number[]; upgradeCount:number; aimMode:'auto'|'mouse' };
export const initialSnapshot: Snapshot = {guidance:'',completedSites:[],dialogue:null,story:{hunter:false,merciful:false,blacksmith:false,grain:false},training:false,ritualTime:null,ritualId:null,stage:0,difficulty:'normal',potions:3,damage:0,perfectDodges:0,records:[],hasSave:false,relays:0,playerX:960,playerY:3930,mode:'menu',hp:100,energy:3,kills:0,time:0,chapter:0,progress:0,objective:'沿驿道向北前进',dodgeCD:0,qCD:0,eCD:0,bossHP:null,toast:'',interact:'',choices:[0,1,2],upgradeCount:0,aimMode:'auto'};
export const upgrades = [
  {name:'裂光',tag:'剑气 · 分裂',description:'剑气首次命中后，分裂成两道追击剑气。'},
  {name:'刃潮',tag:'剑术 · 冲击',description:'第三段普攻向前释放一道不消耗刃能的剑气。'},
  {name:'追影',tag:'身法 · 连击',description:'闪避后的下一次普攻造成双倍伤害，闪避冷却缩短。'},
  {name:'回锋',tag:'剑术 · 回旋',description:'回旋斩范围增大，命中敌人缩短冷却，最多缩短 3 秒。'},
  {name:'灯火护身',tag:'灯火 · 恢复',description:'施放突进斩或回旋斩，恢复 5 点生命。'},
  {name:'破阵',tag:'剑术 · 突进',description:'突进斩伤害翻倍，击破持盾守卫的正面防御。'},
  {name:'余烬回响',tag:'刃能 · 恢复',description:'精准闪避额外恢复 1 点刃能，获得短暂强化。'},
  {name:'淬刃',tag:'剑术 · 伤害',description:'所有攻击伤害提升 20%。'},
  {name:'长明',tag:'灯火 · 治疗',description:'治疗药剂恢复量从 40 提升至 60。'},
  {name:'疾风',tag:'身法 · 冷却',description:'突进斩与回旋斩的冷却缩短 20%。'},
  {name:'穿云',tag:'剑气 · 伤害',description:'剑气伤害提升 35%。'},
  {name:'不屈',tag:'护甲 · 减伤',description:'受到的伤害降低 18%。'},
];
type EnemyKind='beast'|'archer'|'shield'|'elite'|'boss';
type Enemy={strikeTime?:number;id:number;x:number;y:number;kind:EnemyKind;hp:number;max:number;r:number;speed:number;cd:number;wind:number;attack:number;aim:number;tx:number;ty:number;flash:number;stun:number;active:boolean;dead:boolean};
type Shot={delay?:number;x:number;y:number;vx:number;vy:number;life:number;damage:number;enemy:boolean;hit:Set<number>;split:boolean;r:number};
type FX={x:number;y:number;vx:number;vy:number;life:number;max:number;size:number;color:string;text?:string};
type Slash={combo?:number;x:number;y:number;angle:number;radius:number;life:number;max:number;spin:boolean};
type Hazard={x:number;y:number;r:number;life:number;delay:number};
type Tree={x:number;y:number;s:number;seed:number};
export type Story={hunter:boolean;merciful:boolean;blacksmith:boolean;grain:boolean};
type Save={story?:Story;y:number;x:number;kills:number;events:number[];upgrades:number[];used:number[];enemies?:Enemy[]};
type CampaignSave={story?:Story;entryPowers?:number[];version:3;stage:number;difficulty:'normal'|'story';time:number;damage:number;dodges:number;records:BattleRecord[];checkpoint:Save;completed:boolean};
export function decodeCampaignSave(raw:string|null):CampaignSave|null{
  try{if(!raw||raw.length>100000)return null;const d=JSON.parse(raw),c=d.checkpoint;
    const num=(v:unknown,max:number)=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=max;
    const ids=(v:unknown,max:number)=>Array.isArray(v)&&v.length<=max+1&&v.every(x=>Number.isInteger(x)&&x>=0&&x<=max)&&new Set(v).size===v.length;
    if(d.version!==3||!Number.isInteger(d.stage)||d.stage<0||d.stage>=AVAILABLE_CHAPTERS||!['normal','story'].includes(d.difficulty)||!num(d.time,1e7)||!num(d.damage,1e7)||!num(d.dodges,1e7)||typeof d.completed!=='boolean'||!c||!num(c.x,1345)||c.x<255||!num(c.y,4140)||c.y<170||!num(c.kills,10000)||!ids(c.events,7)||!ids(c.upgrades,11)||!ids(c.used,2))return null;
    for(const story of [d.story,c.story])if(story!==undefined&&(!story||['hunter','merciful','blacksmith','grain'].some(k=>typeof story[k]!=='boolean')))return null;
    if(!Array.isArray(d.records)||d.records.length>3||!d.records.every((r:BattleRecord,i:number)=>Number.isInteger(r.stage)&&r.stage>=0&&r.stage<=d.stage&&(i===0||r.stage>d.records[i-1].stage)&&num(r.time,1e7)&&num(r.kills,10000)&&num(r.damage,1e7)&&num(r.dodges,1e7)&&['S','A','B','C'].includes(r.rank)))return null;
    if(d.entryPowers!==undefined&&(!ids(d.entryPowers,11)||!d.entryPowers.every((id:number)=>c.upgrades.includes(id))))return null;
    if(d.records.length>d.stage+1||d.completed&&d.records.at(-1)?.stage!==d.stage||!d.completed&&d.records.some((r:BattleRecord)=>r.stage>=d.stage))return null;
    if(!Array.isArray(c.enemies)||c.enemies.length>120||!c.enemies.every((e:Enemy)=>['beast','archer','shield','elite','boss'].includes(e.kind)&&num(e.id,100000)&&Number.isInteger(e.id)&&num(e.x,1600)&&num(e.y,4300)&&num(e.hp,5000)&&e.hp>0&&num(e.max,5000)&&e.max>=e.hp&&num(e.r,100)&&num(e.speed,200)))return null;
    if(new Set(c.enemies.map((e:Enemy)=>e.id)).size!==c.enemies.length)return null;
    return d;
  }catch{return null;}
}

export const clamp=(v:number,min:number,max:number)=>Math.max(min,Math.min(max,v));
export const angleDifference=(a:number,b:number)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
export const inSlash=(px:number,py:number,angle:number,ex:number,ey:number,radius:number,enemyRadius:number)=>Math.hypot(ex-px,ey-py)<radius+enemyRadius && Math.abs(angleDifference(Math.atan2(ey-py,ex-px),angle))<1.35;
const W=1600,H=4300,TAU=Math.PI*2;
const pathX=(y:number)=>800+Math.sin(y*.0024)*105;
function random(seed:number){return()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return(seed>>>0)/4294967296;};}

export interface GameView { render(game:NightGame):void; destroy():void; canWalk?(x:number,y:number):boolean; pointerWorld?(x:number,y:number):{x:number;y:number}|null; }

export class NightGame {
  training=false;story:Story={hunter:false,merciful:false,blacksmith:false,grain:false};dialogue:Snapshot['dialogue']=null;dialogueActions:(()=>void)[]=[];guard=0;guardCD=0;
  ritual:{id:number;x:number;y:number;remaining:number;wave:number}|null=null;trapCycles=new Map<number,number>();
  chapterPowers:number[]=[];
  stage=0;difficulty:'normal'|'story'='normal';potions=3;damageTaken=0;perfectDodges=0;records:BattleRecord[]=[];savedCampaign:CampaignSave|null=null;dodgeWindow=0;accumulator=0;
  canvas:HTMLCanvasElement;ctx:CanvasRenderingContext2D;onChange:(s:Snapshot)=>void;
  mode:Mode='menu';aimMode:'auto'|'mouse'='auto';keys=new Set<string>();held=new Set<number>();mouse={x:860,y:250};cam={x:800,y:3260};
  player={x:960,y:3360,hp:100,energy:3,a:-Math.PI/2,inv:0,atk:0,combo:0,comboTimer:0,dodge:0,q:0,e:0,boost:0,moving:false};
  enemies:Enemy[]=[];shots:Shot[]=[];fx:FX[]=[];slashes:Slash[]=[];hazards:Hazard[]=[];trees:Tree[]=[];
  events=new Set<number>();used=new Set<number>();powers=new Set<number>();choices=[0,1,2];kills=0;time=0;clock=0;toast='';toastTimer=0;interact='';
  abilityPose:{kind:'cast'|'spin'|'dash';time:number;duration:number;angle:number}|null=null;
  hitStop=0;stepDistance=0;strike:{time:number;duration:number;angle:number;combo:number}|null=null;
  nextId=1;last=0;raf=0;emitAt=0;shake=0;bossDefeated=false;save:Save|null=null;destroyed=false;ground:HTMLCanvasElement;audio:AudioContext|null=null;
  removers:(()=>void)[]=[];
  constructor(canvas:HTMLCanvasElement,onChange:(s:Snapshot)=>void,public view?:GameView){
    this.canvas=canvas;this.ctx=(view?document.createElement('canvas'):canvas).getContext('2d')!;this.onChange=onChange;
    this.ground=document.createElement('canvas');this.ground.width=W;this.ground.height=H;
    if(!view)this.createGround();
    this.spawn('beast',1110,3130);this.spawn('archer',1020,2900);
    const listen=(el:EventTarget,type:string,fn:EventListener,options?:AddEventListenerOptions)=>{el.addEventListener(type,fn,options);this.removers.push(()=>el.removeEventListener(type,fn,options));};
    listen(window,'keydown',((e:KeyboardEvent)=>{
      if(e.metaKey||e.ctrlKey||e.altKey)return;
      const k=(e.code?.startsWith('Key')?e.code.slice(3):e.key).toLowerCase();
      if(this.mode==='playing'&&'qwerfasdzxc'.includes(k)&&k.length===1)e.preventDefault();
      if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(k))e.preventDefault();
      if(this.mode==='dialogue'){if(!e.repeat){if((k==='f'||k==='enter')&&this.dialogueActions.length===1)this.chooseDialogue(0);else if(['z','x','c'].includes(k))this.chooseDialogue(['z','x','c'].indexOf(k));}e.preventDefault();return;}
      if(this.mode==='interlude'&&!e.repeat&&(k==='f'||k==='enter')){e.preventDefault();this.nextChapter();return;}
      if(this.mode==='menu'&&!e.repeat&&['1','2'].includes(k)){this.startSelectedChapter(Number(k)-1);return;}
      if(this.mode==='menu'&&!e.repeat&&k==='c'){this.continueCampaign();return;}
      if(this.mode==='menu'&&!e.repeat&&(k==='a'||k==='d')){this.difficulty=this.difficulty==='normal'?'story':'normal';this.emit();return;}
      if((k==='f'||k==='enter')&&!e.repeat&&['menu','dead','won'].includes(this.mode)){e.preventDefault();if(this.mode==='dead')this.retry();else if(this.mode==='menu'&&this.savedCampaign)this.continueCampaign();else this.start();return;}
      if(this.mode==='upgrade'&&!e.repeat&&['z','x','c'].includes(k)){e.preventDefault();const id=this.choices[['z','x','c'].indexOf(k)];if(id!==undefined)this.chooseUpgrade(id);return;}
      if(this.mode==='paused'&&k==='f'){e.preventDefault();this.togglePause();return;}
      if(this.mode==='paused'&&k==='x'){e.preventDefault();this.restartChapter();return;}
      if(k==='escape'||k==='r'){if(!e.repeat)this.togglePause();return;}
      if(this.mode!=='playing')return;
      this.keys.add(k);
      if(k==='a'||k==='x'){this.aimMode='auto';this.updateAim();if(!e.repeat)this.action(k==='a'?'attack':'ranged');}
      if(!e.repeat){if(k==='d'||k===' ')this.action('dodge');if(k==='q')this.action('dash');if(k==='e')this.action('spin');if(k==='f')this.action('interact');if(k==='w')this.action('heal');if(k==='s')this.action('guard');}
    }) as EventListener);
    listen(window,'keyup',((e:KeyboardEvent)=>{this.keys.delete((e.code?.startsWith('Key')?e.code.slice(3):e.key).toLowerCase());}) as EventListener);
    listen(canvas,'pointermove',((e:PointerEvent)=>{const r=canvas.getBoundingClientRect();this.mouse={x:(e.clientX-r.left)/r.width*1280,y:(e.clientY-r.top)/r.height*720};}) as EventListener);
    listen(canvas,'pointerdown',((e:PointerEvent)=>{if(this.mode!=='playing')return;canvas.focus();if(e.pointerType!=='touch')this.aimMode='mouse';this.updateAim();this.held.add(e.button);this.unlockAudio();this.action(e.button===2?'ranged':'attack');}) as EventListener);
    listen(window,'pointerup',((e:PointerEvent)=>{this.held.delete(e.button);}) as EventListener);
    listen(window,'pointercancel',(()=>this.clearInput()) as EventListener);
    listen(canvas,'contextmenu',((e:Event)=>e.preventDefault()) as EventListener);
    listen(window,'blur',(()=>{this.clearInput();if(this.mode==='playing')this.togglePause();}) as EventListener);
    listen(document,'visibilitychange',(()=>{if(document.hidden){this.clearInput();if(this.mode==='playing')this.togglePause();}}) as EventListener);
    try{this.savedCampaign=decodeCampaignSave(localStorage.getItem('nightward-campaign-v3'));}catch{}
    this.raf=requestAnimationFrame(this.frame);this.emit();
  }
  destroy(){this.destroyed=true;cancelAnimationFrame(this.raf);this.removers.forEach(f=>f());void this.audio?.close();this.view?.destroy();}
  clearInput(){this.keys.clear();this.held.clear();}
  setKey(key:string,down:boolean){if(down&&this.mode==='playing')this.keys.add(key);else this.keys.delete(key);}
  private audioMuted=false;
  private audioMaster:GainNode|null=null;
  private audioNoise:AudioBuffer|null=null;
  private effectTimes=new Map<string,number>();
  get muted(){return this.audioMuted;}
  set muted(value:boolean){this.audioMuted=value;if(this.audioMaster&&this.audio){this.audioMaster.gain.cancelScheduledValues(this.audio.currentTime);this.audioMaster.gain.setTargetAtTime(value?0:.65,this.audio.currentTime,.012);}if(!value)this.unlockAudio();}
  unlockAudio(){
    if(this.destroyed)return;
    try{
      if(!this.audio)this.audio=new AudioContext();
      if(!this.audioMaster){
        const master=this.audio.createGain(),limiter=this.audio.createDynamicsCompressor();
        master.gain.value=this.muted?0:.65;
        limiter.threshold.value=-14;limiter.knee.value=12;limiter.ratio.value=8;limiter.attack.value=.003;limiter.release.value=.12;
        master.connect(limiter);limiter.connect(this.audio.destination);this.audioMaster=master;
        this.audioNoise=this.audio.createBuffer(1,this.audio.sampleRate,this.audio.sampleRate);
        const data=this.audioNoise.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
      }
      if(this.audio.state==='suspended')void this.audio.resume().catch(()=>{});
    }catch{/* Sound must never block gameplay. */}
  }
  // Short, layered procedural foley: reusable noise, shaped envelopes, no downloads.
  private audioLayer(noise:boolean,from:number,to:number,duration:number,volume:number,delay=0,pan=0,kind:OscillatorType='sine',attack=.006){
    const ac=this.audio;if(this.muted||!ac||ac.state!=='running'||!this.audioMaster)return;
    const start=ac.currentTime+delay,end=start+duration;
    const source=noise?ac.createBufferSource():ac.createOscillator();
    const filter=ac.createBiquadFilter(),gain=ac.createGain(),stereo=ac.createStereoPanner();
    filter.type=noise?'bandpass':'lowpass';filter.Q.value=noise?.7:.5;
    filter.frequency.setValueAtTime(noise?from:7000,start);
    if(noise){(source as AudioBufferSourceNode).buffer=this.audioNoise;filter.frequency.exponentialRampToValueAtTime(to,end);}
    else {const osc=source as OscillatorNode;osc.type=kind;osc.frequency.setValueAtTime(from,start);osc.frequency.exponentialRampToValueAtTime(to,end);}
    gain.gain.setValueAtTime(.0001,start);gain.gain.exponentialRampToValueAtTime(volume,start+Math.min(attack,duration*.45));gain.gain.exponentialRampToValueAtTime(.0001,end);
    stereo.pan.value=clamp(pan,-.75,.75);
    source.connect(filter);filter.connect(gain);gain.connect(stereo);stereo.connect(this.audioMaster);
    source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();stereo.disconnect();};
    source.start(start);source.stop(end+.01);
  }
  sound(frequency:number,duration=.1,kind:OscillatorType='sine',volume=.055){
    this.audioLayer(false,frequency,Math.max(40,frequency*.35),duration,volume,0,0,kind);
  }
  combatSound(kind:'slash'|'charge'|'wave'|'dodge'|'dash'|'spin'|'impact'|'heavy'|'guard'|'hurt',combo=0,pan=0){
    const ac=this.audio;if(this.muted||!ac||ac.state!=='running')return;
    // Multiple enemies struck in one frame share an impact, avoiding loud stacks.
    const last=this.effectTimes.get(kind)??-Infinity;
    if(ac.currentTime-last<.045)return;this.effectTimes.set(kind,ac.currentTime);
    const vary=.96+Math.random()*.08;
    const air=(f:number,t:number,d:number,v:number,delay=0,attack=.012)=>this.audioLayer(true,f*vary,t,d,v,delay,pan,'sine',attack);
    const tone=(f:number,t:number,d:number,v:number,delay=0)=>this.audioLayer(false,f*vary,t,d,v,delay,pan);
    switch(kind){
      case 'slash':
        air([3200,2400,1800][combo],280,[.19,.23,.3][combo],.24,0,.025);
        tone([1800,1450,1050][combo],650,.16,.026,.035);
        if(combo===2)tone(135,48,.22,.13);
        break;
      case 'charge':air(400,2600,.14,.09,0,.06);tone(310,930,.14,.038);break;
      case 'wave':air(4200,380,.38,.25);tone(980,180,.32,.065);tone(1470,370,.42,.027,.025);break;
      case 'dodge':air(1100,220,.18,.16);break;
      case 'dash':air(4400,170,.27,.3);tone(180,48,.23,.12);tone(1250,400,.18,.03);break;
      case 'spin':for(let i=0;i<3;i++){air(2800-i*450,300,.21,.2,i*.065);tone(1200-i*160,420,.18,.025,i*.065);}tone(120,42,.32,.1);break;
      case 'impact':air(1900,550,.095,.2);tone(160,55,.12,.12);break;
      case 'heavy':air(2400,380,.14,.28);tone(110,38,.23,.19);tone(780,220,.14,.04);break;
      case 'guard':air(5200,1800,.07,.14);for(const f of [1700,2630,3910])tone(f,f*.91,.27,.045);break;
      case 'hurt':air(750,120,.2,.19);tone(95,35,.25,.16);break;
    }
  }
  start(keepCampaign=false){
    if(this.stage>=AVAILABLE_CHAPTERS&&keepCampaign)return;
    if(!keepCampaign){this.story={hunter:false,merciful:false,blacksmith:false,grain:false};this.stage=0;this.records=[];this.powers.clear();}
    this.dialogue=null;this.dialogueActions=[];this.guard=0;this.guardCD=0;const inherited=[...this.powers];this.chapterPowers=inherited;this.damageTaken=0;this.perfectDodges=0;this.potions=3;this.dodgeWindow=0;this.accumulator=0;this.ritual=null;this.trapCycles.clear();
    if(!document.fullscreenElement){const root=this.canvas.closest?.('main');void root?.requestFullscreen?.().catch(()=>{});}
    this.hitStop=0;this.strike=null;this.abilityPose=null;this.stepDistance=0;this.mode='playing';this.player={x:this.stage===1?800:pathX(3930),y:3930,hp:100,energy:3,a:-Math.PI/2,inv:1.5,atk:0,combo:0,comboTimer:0,dodge:0,q:0,e:0,boost:0,moving:false};
    this.enemies=[];this.shots=[];this.fx=[];this.slashes=[];this.hazards=[];this.events.clear();this.used.clear();this.powers=new Set(inherited);this.kills=0;this.time=0;this.nextId=1;this.bossDefeated=false;this.clearInput();this.cam={x:800,y:this.stage===1?3710:3890};this.mouse={x:640,y:200};this.save=null;this.storeSave();this.unlockAudio();this.message(chapters[this.stage].intro,5);this.canvas.focus();this.emit();
  }
  persistCampaign(completed=false){
    if(!this.save)return;
    const data:CampaignSave={story:{...this.story},entryPowers:this.chapterPowers,version:3,stage:this.stage,difficulty:this.difficulty,time:this.time,damage:this.damageTaken,dodges:this.perfectDodges,records:this.records.map(r=>({...r})),checkpoint:this.save,completed};
    this.savedCampaign=data;try{localStorage.setItem('nightward-campaign-v3',JSON.stringify(data));}catch{/* Private browsing still supports session checkpoints. */}
  }
  storeSave(){this.save={story:{...this.story},x:this.player.x,y:this.player.y,kills:this.kills,events:[...this.events],upgrades:[...this.powers],used:[...this.used],enemies:this.enemies.filter(e=>!e.dead).map(e=>({...e}))};this.persistCampaign(this.mode==='won'||this.mode==='interlude');}
  continueCampaign(){
    const data=this.savedCampaign;if(!data)return;
    this.story=data.story??{hunter:false,merciful:false,blacksmith:false,grain:false};this.chapterPowers=data.entryPowers??data.checkpoint.upgrades;this.stage=data.stage;this.difficulty=data.difficulty;this.records=data.records.map(r=>({...r}));this.time=data.time;this.damageTaken=data.damage;this.perfectDodges=data.dodges;this.save=data.checkpoint;
    this.retry();if(data.completed){this.bossDefeated=true;this.mode=this.stage===AVAILABLE_CHAPTERS-1?'won':'interlude';this.emit();}this.unlockAudio();
  }
  startSelectedChapter(stage:number){if(!Number.isInteger(stage)||stage<0||stage>=AVAILABLE_CHAPTERS)return;this.stage=stage;this.records=[];this.powers.clear();this.story={hunter:false,merciful:false,blacksmith:false,grain:false};this.start(true);}
  restartChapter(){this.powers=new Set(this.chapterPowers);this.start(true);}
  nextChapter(){if(this.mode!=='interlude'||this.stage>=AVAILABLE_CHAPTERS-1)return;this.stage++;this.start(true);}
  finishChapter(){
    const rank=this.damageTaken<70?'S':this.damageTaken<180?'A':this.damageTaken<350?'B':'C';
    this.records=this.records.filter(r=>r.stage<this.stage);this.records.push({stage:this.stage,time:this.time,kills:this.kills,damage:this.damageTaken,dodges:this.perfectDodges,rank});
    this.mode=this.stage===AVAILABLE_CHAPTERS-1?'won':'interlude';this.clearInput();this.sound(850,.8);this.storeSave();this.persistCampaign(true);this.emit();
  }
  retry(){
    this.hitStop=0;this.strike=null;this.abilityPose=null;this.stepDistance=0;const s=this.save;if(!s){this.start();return;}
    this.dialogue=null;this.dialogueActions=[];this.story=s.story?{...s.story}:this.story;this.player={...this.player,x:s.x,y:s.y,hp:100,energy:3,inv:2,atk:0,combo:0,comboTimer:0,dodge:0,q:0,e:0,boost:0};this.kills=s.kills;this.events=new Set(s.events);this.powers=new Set(s.upgrades);this.used=new Set(s.used);this.enemies=(s.enemies||[]).map(e=>({...e,cd:1.1,wind:0,attack:0,aim:0,tx:0,ty:0,flash:0,stun:0,active:false,dead:false}));if(this.stage===1){Object.assign(this.player,safeVillagePoint(this.player.x,this.player.y));for(const e of this.enemies)Object.assign(e,safeVillagePoint(e.x,e.y));}this.nextId=Math.max(0,...this.enemies.map(e=>e.id))+1;this.potions=3;this.dodgeWindow=0;this.accumulator=0;this.ritual=null;this.trapCycles.clear();this.fx=[];this.shots=[];this.hazards=[];this.slashes=[];this.bossDefeated=false;this.mode='playing';this.clearInput();this.cam={x:800,y:clamp(this.player.y-(this.stage===1?220:100),360,H-360)};this.message('火种仍在。再试一次。');this.canvas.focus();this.emit();
  }
  toggleAim(){this.aimMode=this.aimMode==='auto'?'mouse':'auto';this.updateAim();this.message(this.aimMode==='auto'?'键盘模式 · 自动锁定附近敌人':'鼠标模式 · 自由瞄准');this.emit();}
  updateAim(mx=0,my=0){const p=this.player;if(this.aimMode==='mouse'){const world=this.view?.pointerWorld?.(this.mouse.x/1280*2-1,1-this.mouse.y/720*2);if(world){p.a=Math.atan2(world.y-p.y,world.x-p.x);return;}p.a=Math.atan2(this.mouse.y-360+this.cam.y-p.y,this.mouse.x-640+this.cam.x-p.x);return;}let target:Enemy|undefined;let distance=600;for(const e of this.enemies){if(e.dead)continue;const d=Math.hypot(e.x-p.x,e.y-p.y);if(d<distance){distance=d;target=e;}}if(target)p.a=Math.atan2(target.y-p.y,target.x-p.x);else if(mx||my)p.a=Math.atan2(my,mx);}
  togglePause(){if(this.mode==='playing')this.mode='paused';else if(this.mode==='paused')this.mode='playing';else return;this.clearInput();this.last=performance.now();this.emit();}
  message(text:string,duration=3){this.toast=text;this.toastTimer=duration;}
  spawn(kind:EnemyKind,x:number,y:number){const stats={beast:[52,17,96],archer:[60,17,55],shield:[120,23,48],elite:[280,34,48],boss:[1100,47,43]}[kind];const e:Enemy={id:this.nextId++,kind,x,y,hp:stats[0],max:stats[0],r:stats[1],speed:stats[2],cd:1.1,wind:0,attack:0,aim:0,tx:0,ty:0,flash:0,stun:0,active:false,dead:false};const scale=(1+this.stage*.18)*(this.difficulty==='story'?.8:1);e.hp=e.max=Math.round(e.hp*scale);if(this.stage>0&&kind==='boss')e.speed+=this.stage*5;this.enemies.push(e);return e;}
  currentObjective(){
    if(this.bossDefeated)return '走近战败的对手 · F 交谈';
    if(this.stage===0){
      if(!this.used.has(1)){
        const clue=sitesFor(0).find(s=>s.id===1)!;
        if(this.player.y>2450)return '沿路向上过桥 · 寻找巡逻队遗物';
        if(this.player.y<clue.y-180)return '↓ 返回哨桥北侧 · 调查遗留军令';
        if(this.player.y>clue.y+180)return '↑ 继续向上 · 军令在桥后左侧石碑下';
        const dx=clue.x-this.player.x;
        return Math.abs(dx)>95?(dx<0?'← 向左靠近石碑下的军令':'→ 向右靠近石碑下的军令'):'靠近石碑 · 清除守卫后按 F 调查军令';
      }
      if(this.enemies.some(e=>e.kind==='boss'&&!e.dead))return '击败加雷斯 · 战后按 F 交谈';
      if(!this.used.has(2))return this.player.y<1120?'↓ 废弃哨所可补给 · 或向上挑战加雷斯':'前往废弃哨所 · 补给并保存进度';
      return '沿灯火北行 · 寻找加雷斯';
    }
    if(this.used.size>=2)return this.used.size===3?'三处搜救完成 · 前往北门战场':'北门已可前往 · 仍可完成最后一处搜救';
    const next=sitesFor(1).filter(s=>!this.used.has(s.id)).sort((a,b)=>Math.hypot(a.x-this.player.x,a.y-this.player.y)-Math.hypot(b.x-this.player.x,b.y-this.player.y))[0];
    return '搜救'+next.name+' · '+this.used.size+' / 3（至少两处）';
  }
  contextGuidance(){
    if(this.mode!=='playing')return '';
    const p=this.player;if(p.hp<45&&this.potions>0)return 'W · 使用药剂恢复生命，补给点可补充药剂';
    const enemy=this.enemies.filter(e=>!e.dead&&Math.hypot(e.x-p.x,e.y-p.y)<300).sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0];
    if(enemy?.wind&&enemy.wind>0)return 'D · 侧向闪避蓄力攻击，避开红色预警';
    if(this.time<12)return this.stage===0?'↑ ↓ ← → 移动 · 按住 A 连斩，D 闪避':'Q · 突进斩已解锁，可快速接近弩手';
    if(enemy?.kind==='shield')return '绕到盾兵侧后方攻击 · 或打出第三段重斩';
    if(this.time<45&&enemy)return 'A · 按住连续出剑，攻击间隙可移动调整位置';
    if(this.stage===0&&!this.used.has(1)&&p.y<2450)return '军令在哨桥与废弃哨所之间的左侧石碑下 · 调查后北端营地才会出现加雷斯';
    return '';
  }
  emit(){const p=this.player;const chapter=p.y>2850?0:p.y>1750?1:p.y>1000?2:3;const boss=this.enemies.find(e=>e.kind==='boss'&&!e.dead);this.onChange({guidance:this.contextGuidance(),completedSites:[...this.used],dialogue:this.dialogue,story:{...this.story},training:this.training,ritualTime:this.ritual?.remaining??null,ritualId:this.ritual?.id??null,stage:this.stage,difficulty:this.difficulty,potions:this.potions,damage:this.damageTaken,perfectDodges:this.perfectDodges,records:this.records,hasSave:!!this.savedCampaign,relays:this.used.size,playerX:p.x,playerY:p.y,mode:this.mode,hp:Math.max(0,p.hp),energy:p.energy,kills:this.kills,time:this.time,chapter,progress:clamp((3930-p.y)/3520*100,0,100),objective:this.currentObjective(),dodgeCD:p.dodge,qCD:p.q,eCD:p.e,bossHP:boss&&boss.active?Math.max(0,boss.hp/boss.max*100):null,toast:this.toast,interact:this.interact,choices:this.choices,upgradeCount:this.powers.size,aimMode:this.aimMode});}
  chooseUpgrade(id:number){if(this.mode!=='upgrade'||!this.choices.includes(id))return;this.powers.add(id);this.mode='playing';this.clearInput();this.message('已获得强化 · '+upgrades[id].name);this.sound(700,.4);this.storeSave();this.emit();this.canvas.focus();}
  offerUpgrade(){const available=upgrades.map((_,i)=>i).filter(i=>!this.powers.has(i)&&(this.training||[2,6,7,8,11,...(this.stage===1?[5,9]:[])].includes(i)));const shift=this.used.size%Math.max(1,available.length);this.choices=[...available.slice(shift),...available.slice(0,shift)].slice(0,3);if(!this.choices.length)return;this.mode='upgrade';this.clearInput();this.emit();}
  skillUnlocked(action:string){return this.training||!['ranged','spin','dash'].includes(action)||action==='dash'&&this.stage===1;}
  talk(speaker:string,text:string,choices:{label:string;action:()=>void}[]){
    this.dialogue={speaker,text,choices:choices.map(c=>c.label)};this.dialogueActions=choices.map(c=>c.action);this.mode='dialogue';this.clearInput();this.emit();
  }
  chooseDialogue(index:number){if(this.mode!=='dialogue'||!this.dialogueActions[index])return;const action=this.dialogueActions[index];this.dialogue=null;this.dialogueActions=[];this.mode='playing';action();this.emit();this.canvas.focus();}
  action(action:string){
    if(this.mode!=='playing')return;if(!this.skillUnlocked(action))return;const p=this.player;this.unlockAudio();
    if(action==='guard'){if(this.guardCD<=0){this.guard=.42;this.guardCD=.8;this.sound(360,.12,'triangle',.025);}return;}
    if(action==='heal'){if(this.potions>0&&p.hp<100){this.potions--;p.hp=Math.min(100,p.hp+(this.powers.has(8)?60:40));this.float(p.x,p.y-35,'灯火疗愈','#b9ebae');this.sound(580,.3);this.emit();}return;}
    if(action==='interact'){this.doInteract();return;}
    if(action==='attack'&&p.atk<=0){this.abilityPose=null;
      p.combo=p.comboTimer>0?(p.combo+1)%3:0;p.comboTimer=1.05;p.atk=p.combo===2?.48:.3;
      this.strike={time:this.clock,duration:p.atk,angle:p.a,combo:p.combo};
      const damage=([18,22,34][p.combo])*(p.boost>0?2:1);p.boost=0;
      this.slashes.push({x:p.x,y:p.y,angle:p.a,radius:p.combo===2?96:84,life:p.combo===2?.28:.2,max:p.combo===2?.28:.2,spin:false,combo:p.combo});
      let hit=false;for(const e of this.enemies){if(!e.dead&&inSlash(p.x,p.y,p.a,e.x,e.y,88,e.r)){this.hit(e,damage,false,p.combo===2);hit=true;}}
      if(hit)p.energy=Math.min(3,p.energy+1);
      if(p.combo===2&&this.powers.has(1))this.shoot(p.x,p.y,p.a,30,false,false);
      this.combatSound('slash',p.combo);
    }
    if(action==='ranged'&&p.energy>0&&p.atk<=0){this.strike=null;p.energy--;p.atk=.52;this.abilityPose={kind:'cast',time:this.clock,duration:.52,angle:p.a};this.shoot(p.x,p.y,p.a,30,false,this.powers.has(0),.14);this.combatSound('charge');}
    if(action==='dodge'&&p.dodge<=0){this.strike=null;this.abilityPose=null;this.shots=this.shots.filter(s=>!s.delay);let dx=Number(this.keys.has('arrowright'))-Number(this.keys.has('arrowleft')),dy=Number(this.keys.has('arrowdown'))-Number(this.keys.has('arrowup'));const a=dx||dy?Math.atan2(dy,dx):p.a;this.movePlayer(Math.cos(a)*126,Math.sin(a)*126,true);p.inv=.28;this.dodgeWindow=.16;p.dodge=this.powers.has(2)?.85:1.2;p.atk=0;if(this.powers.has(2))p.boost=2;this.combatSound('dodge');}
    if(action==='dash'&&p.q<=0){
      this.strike=null;this.shots=this.shots.filter(s=>!s.delay);this.abilityPose={kind:'dash',time:this.clock,duration:.12,angle:p.a};const ox=p.x,oy=p.y;p.q=this.powers.has(9)?4:5;p.inv=.3;p.atk=.12;this.movePlayer(Math.cos(p.a)*205,Math.sin(p.a)*205,true);
      for(const e of this.enemies){const dx=p.x-ox,dy=p.y-oy,t=clamp(((e.x-ox)*dx+(e.y-oy)*dy)/(dx*dx+dy*dy||1),0,1);if(!e.dead&&Math.hypot(e.x-ox-dx*t,e.y-oy-dy*t)<e.r+42)this.hit(e,this.powers.has(5)?80:40,false,true);}
      this.slashes.push({x:p.x,y:p.y,angle:p.a,radius:115,life:.25,max:.25,spin:false});this.combatSound('dash');if(this.powers.has(4))p.hp=Math.min(100,p.hp+5);
    }
    if(action==='spin'&&p.e<=0){this.strike=null;this.shots=this.shots.filter(s=>!s.delay);this.abilityPose={kind:'spin',time:this.clock,duration:.2,angle:p.a};p.e=this.powers.has(9)?6.4:8;p.atk=.2;const radius=this.powers.has(3)?168:132;let hits=0;for(const e of this.enemies){if(!e.dead&&Math.hypot(e.x-p.x,e.y-p.y)<radius+e.r){this.hit(e,48,false,true);hits++;}}if(this.powers.has(3))p.e-=Math.min(3,hits*.7);this.slashes.push({x:p.x,y:p.y,angle:p.a,radius,life:.42,max:.42,spin:true});this.combatSound('spin');if(this.powers.has(4))p.hp=Math.min(100,p.hp+5);}
    this.emit();
  }
  shoot(x:number,y:number,a:number,damage:number,enemy:boolean,split:boolean=false,delay=0){const speed=enemy?255:670;this.shots.push({delay,x,y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,life:enemy?3:1.05,damage,enemy,hit:new Set(),split,r:enemy?7:15});}
  hit(e:Enemy,damage:number,ranged:boolean,breakGuard=false){
    if(e.dead)return;const p=this.player;const guarded=e.kind==='shield'&&Math.abs(angleDifference(Math.atan2(p.y-e.y,p.x-e.x),e.aim))<1.1&&!breakGuard;
    const amount=Math.round(damage*(guarded?.25:1)*(this.powers.has(7)?1.2:1)*(ranged&&this.powers.has(10)?1.35:1));e.hp-=amount;e.flash=.13;e.active=true;e.stun=guarded?.04:e.kind==='boss'?.025:.18;
    if(breakGuard&&e.kind!=='boss')e.stun=.5;
    const a=Math.atan2(e.y-p.y,e.x-p.x);if(e.kind!=='boss'){this.moveEnemy(e,Math.cos(a)*(ranged?5:13),Math.sin(a)*(ranged?5:13));}
    const heavy=breakGuard&&!guarded;
    if(!ranged)this.hitStop=Math.max(this.hitStop,guarded?.018:heavy?.055:.028);
    const sparkColor=guarded?'#e8c78c':heavy?'#ffe2a1':'#b9f9e8';
    for(let i=0;i<(heavy?15:8);i++){const direction=a+(Math.random()-.5)*2.2,speed=70+Math.random()*(heavy?230:140),life=.12+Math.random()*.18;this.fx.push({x:e.x,y:e.y,vx:Math.cos(direction)*speed,vy:Math.sin(direction)*speed,life,max:life,size:heavy?3:2,color:sparkColor});}
    this.particles(e.x,e.y,guarded?'#d8c693':'#c5b9a5',heavy?9:4);this.float(e.x,e.y-25,guarded?amount+' 格挡':String(amount),guarded?'#c1b88c':'#f1e5be');this.shake=Math.max(this.shake,2.4);this.combatSound(guarded?'guard':heavy?'heavy':'impact',0,(e.x-this.player.x)/500);
    if(e.hp<=0){e.dead=true;this.kills++;this.particles(e.x,e.y,'#9be2bb',18);this.float(e.x,e.y-42,'+ 火种','#9bbd8c');if(e.kind==='boss'){this.bossDefeated=true;this.shots=this.shots.filter(s=>!s.enemy);this.hazards=[];for(const other of this.enemies)if(other!==e)other.dead=true;this.message('守灯者倒下了。向北点亮灯站。',6);}else if(e.kind==='elite'){this.player.hp=Math.min(100,this.player.hp+15);this.message('精英已击败 · 恢复 15 点生命');}else if(this.kills%4===0){this.player.hp=Math.min(100,this.player.hp+4);}}
  }
  hurt(amount:number){const p=this.player;if(this.mode!=='playing')return;if(p.inv>0){if(this.dodgeWindow>0){this.dodgeWindow=0;this.perfectDodges++;p.energy=Math.min(3,p.energy+(this.powers.has(6)?2:1));if(this.powers.has(6))p.boost=2;this.float(p.x,p.y-35,'精准闪避','#b7f9e9');this.sound(1100,.15,'sine',.03);}return;}if(this.guard>0){amount*=.35;this.float(p.x,p.y-30,'防御','#e8d4a4');this.combatSound('guard');}amount=Math.round(amount*(this.difficulty==='story'?.6:1)*(this.powers.has(11)?.82:1));this.damageTaken+=amount;p.hp=Math.max(0,p.hp-amount);p.inv=.75;this.shake=7;this.particles(p.x,p.y,'#f29f88',10);this.float(p.x,p.y-35,'−'+amount,'#ffa89b');this.combatSound('hurt');if(p.hp<=0){this.abilityPose=null;this.shots=this.shots.filter(s=>!s.delay);this.mode='dead';this.clearInput();this.emit();}}
  particles(x:number,y:number,color:string,count:number){for(let i=0;i<count;i++){const a=Math.random()*TAU,s=30+Math.random()*110,life=.25+Math.random()*.45;this.fx.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life,max:life,size:1+Math.random()*3,color});}}
  float(x:number,y:number,text:string,color:string){this.fx.push({x,y,vx:0,vy:-35,life:.85,max:.85,size:16,color,text});}
  movePlayer(dx:number,dy:number,trail=false){const p=this.player,n=Math.max(1,Math.ceil(Math.hypot(dx,dy)/12));for(let i=0;i<n;i++){const nx=clamp(p.x+dx/n,255,1345),ny=clamp(p.y+dy/n,170,4140);if(this.canWalk(nx,p.y))p.x=nx;if(this.canWalk(p.x,ny))p.y=ny;if(trail&&i%2===0)this.particles(p.x,p.y,'#95d8ca',2);}}
  moveEnemy(e:Enemy,dx:number,dy:number){
    const steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)/10));
    for(let i=0;i<steps;i++){const x=clamp(e.x+dx/steps,250,1350),y=clamp(e.y+dy/steps,200,4140);if(this.canWalk(x,e.y))e.x=x;if(this.canWalk(e.x,y))e.y=y;}
  }
  canWalk(x:number,y:number){if(this.stage===1)return villageWalkable(x,y);if(y>2220&&y<2350&&(x<640||x>965))return false;if(this.view?.canWalk)return this.view.canWalk(x,y);for(const t of this.trees)if(Math.abs(t.y-y)<35&&Math.hypot(t.x-x,t.y-y)<t.s*12+14)return false;return true;}
  doInteract(){const p=this.player;
    if(this.bossDefeated&&(Math.hypot(p.x-800,p.y-250)<160||this.enemies.some(e=>e.kind==='boss'&&e.dead&&Math.hypot(p.x-e.x,p.y-e.y)<180))){
      if(this.stage===0)this.talk('加雷斯','三年前，我们都奉命留下。你为什么能活着走出那座烽火台？\n艾琳握紧密信，低声问：你还要把他交给那些下令的人吗？',[
        {label:this.potions>0?'留下药物，让他离开':'放他离开，指明安全路线',action:()=>{if(this.potions>0)this.potions--;this.story.merciful=true;this.finishChapter();}},
        {label:'交给驻军审问',action:()=>{this.story.merciful=false;this.finishChapter();}},
      ]);
      else this.talk('艾琳','这不是一群普通的盗匪。你看，征粮令上有渡鸦家族的印章。\n通往鸦渡要塞的路已经打开。我们在那里寻找答案。',[{label:'收起军令，结束本章',action:()=>this.finishChapter()}]);
      return;
    }
    const site=sitesFor(this.stage).find(s=>!this.used.has(s.id)&&Math.hypot(p.x-s.x,p.y-s.y)<115);if(!site)return;
    if(this.enemies.some(e=>!e.dead&&Math.hypot(e.x-site.x,e.y-site.y)<275)){this.message('附近仍有守卫，先确保安全');return;}
    this.used.add(site.id);
    if(this.stage===0){
      const text=[
        '猎人：巡逻队往北走了，再没有回来。谢谢你……村庄西侧有一条旧巷，走那里能避开路口的弩手。',
        '烬拾起染血的渡鸦徽记。军令写着：“放弃外侧哨所，不许接应撤退者。”\n艾琳：为什么王室的军令，会出现在逃兵身上？',
        '艾琳：你以前也是这里的守军？\n烬：过去的事了。休息一下，前面的骑士也许知道答案。',
      ][site.id];if(site.id===0)this.story.hunter=true;
      if(site.id===2){p.hp=100;this.potions=3;p.energy=3;}
      this.talk(site.id===0?'受伤的猎人':site.id===1?'巡逻队遗物':'哨所篝火',text,[{label:'继续调查 · 选择强化',action:()=>{this.storeSave();this.offerUpgrade();}}]);
    }else{
      if(site.id===0){this.story.blacksmith=true;this.powers.add(7);}if(site.id===2)this.story.grain=true;
      p.hp=Math.min(100,p.hp+25);if(site.id===2)this.potions=Math.min(3,this.potions+1);
      const text=['铁匠：他们从正门放了火。你从侧门进来，救了我们。这块磨石你带着。刀刃够利，才能带更多人出去。\n获得淬刃：所有攻击伤害提升 20%（已有则不叠加）。','村民：他们把所有反抗的人关在院子里。首领就在北门战场，小心他的长柄斧。\n村民已脱险；恢复 25 点生命，获得一次强化选择。','艾琳关闭火油阀。粮仓外的火势逐渐减弱。\n粮食保住了，村里的人至少能够熬过这个冬天。\n获得 1 瓶药剂（最多 3 瓶），附近火势熄灭。'][site.id];
      this.talk(site.name,text,[{label:'安置幸存者 · 保存进度',action:()=>{this.storeSave();this.offerUpgrade();}}]);
    }
  }
  updateEvents(){const y=this.player.y;
    const trigger=(id:number,at:number,fn:()=>void)=>{if(y<at&&!this.events.has(id)){this.events.add(id);fn();}};
    if(this.stage===0){
      trigger(0,3730,()=>{this.spawn('beast',760,3530);this.spawn('beast',925,3480);this.message('空鞍马停在血迹旁 · A 连斩，D 闪避，S 防御',4);});
      trigger(1,3360,()=>{this.spawn('archer',850,3180);this.spawn('beast',1020,3140);this.message('前方传来呼救 · 猎人营地位于东侧');});
      trigger(2,3100,()=>{this.spawn('beast',940,2930);this.spawn('archer',1080,2790);});
      trigger(3,2680,()=>{this.spawn('shield',760,2450);this.spawn('archer',700,2130);this.message('溪流哨桥 · 三段重斩压制盾兵，绕过箭线');});
      trigger(4,2050,()=>{this.spawn('shield',890,1850);this.spawn('beast',1030,1800);this.message('西侧石碑下，有巡逻队留下的物品');});
      trigger(5,1750,()=>{this.spawn('elite',800,1530);this.message('旧哨所被逃兵占据 · 留意重击的蓄势');});
      trigger(6,1080,()=>{this.spawn('shield',730,960);});
      if(this.used.has(1))trigger(7,780,()=>{this.spawn('boss',800,510).active=true;this.spawn('beast',980,710);this.message('加雷斯：“烬？你还有脸回来？”',4);});
    }else{
      for(const [id,event] of villageEncounters.entries())trigger(id,event.at,()=>{for(const [kind,x,yy] of event.units)this.spawn(kind,x,yy);if(id===0)this.message(this.story.hunter?'猎人留下的路线：沿西侧街巷绕行，可避开入口弩手':'艾琳：街道被封锁了，沿院墙找侧路。Q 可突进接近弩手。',4);});
      if(this.used.size>=2)trigger(7,1000,()=>{this.spawn('boss',800,490).active=true;this.message('乌尔夫：“你救得了几个？这里的粮食都是我的！”',4);});
    }
    const p=this.player,site=sitesFor(this.stage).find(s=>!this.used.has(s.id)&&Math.hypot(p.x-s.x,p.y-s.y)<115);
    this.interact=site?(this.enemies.some(e=>!e.dead&&Math.hypot(e.x-site.x,e.y-site.y)<275)?'附近仍有敌人 · 清除守卫后交互':site.detail):this.bossDefeated&&(Math.hypot(p.x-800,p.y-250)<160||this.enemies.some(e=>e.kind==='boss'&&e.dead&&Math.hypot(p.x-e.x,p.y-e.y)<180))?'与战败的对手交谈':'';
  }
  updateChapterMechanics(dt:number){
    if(this.stage!==1)return;
    const fires=villageFireSites;
    for(const f of fires){if(this.used.has(f.id)||Math.hypot(this.player.x-f.x,this.player.y-f.y)>380)continue;const cycle=Math.floor(this.clock/5);if(this.trapCycles.get(f.id)===cycle)continue;this.trapCycles.set(f.id,cycle);this.hazards.push({x:f.x,y:f.y,r:48,life:1.8,delay:1.2});}
  }
  update(dt:number){
    const p=this.player;this.time+=dt;this.guard=Math.max(0,this.guard-dt);this.guardCD=Math.max(0,this.guardCD-dt);this.dodgeWindow=Math.max(0,this.dodgeWindow-dt);this.shake=Math.max(0,this.shake-dt*18);
    for(const key of ['inv','atk','comboTimer','dodge','q','e','boost'] as const)p[key]=Math.max(0,p[key]-dt);
    if(this.toastTimer>0){this.toastTimer-=dt;if(this.toastTimer<=0)this.toast='';}
    const mx=Number(this.keys.has('arrowright'))-Number(this.keys.has('arrowleft')),my=Number(this.keys.has('arrowdown'))-Number(this.keys.has('arrowup'));
    p.moving=!!(mx||my);if(p.moving){const ox=p.x,oy=p.y,n=Math.hypot(mx,my),speed=p.atk>.15?166:225;this.movePlayer(mx/n*speed*dt,my/n*speed*dt);const distance=Math.hypot(p.x-ox,p.y-oy);p.moving=distance>.01;this.stepDistance+=distance;
      if(this.stepDistance>=48){this.stepDistance%=48;this.particles(p.x,p.y,p.y>2220&&p.y<2350?'#a6c8c5':'#a5ab92',3);this.sound(p.y>2220&&p.y<2350?115:85,.035,'triangle',.009);}
    }
    this.updateAim(mx,my);
    if((this.held.has(0)||this.keys.has('a'))&&p.atk<=0)this.action('attack');if((this.held.has(2)||this.keys.has('x'))&&p.atk<=0&&p.energy>0)this.action('ranged');this.updateEvents();this.updateChapterMechanics(dt);
    for(const e of this.enemies){
      if(e.dead)continue;e.flash=Math.max(0,e.flash-dt);e.stun=Math.max(0,e.stun-dt);if(e.stun>0)continue;
      const dx=p.x-e.x,dy=p.y-e.y,d=Math.hypot(dx,dy),a=Math.atan2(dy,dx);if(d<490)e.active=true;if(!e.active)continue;
      if(e.kind==='boss'&&e.hp<e.max*.5&&e.max>0&&!e.strikeTime){e.strikeTime=-1;this.message(chapters[this.stage].boss+' · 改变战斗架势',3);this.shake=6;if(this.stage===1){this.spawn('archer',1100,1030);this.spawn('shield',470,1030);}}
      if(e.wind>0){e.wind-=dt;if(e.wind<=0)this.enemyAttack(e);continue;}
      e.cd-=dt;e.aim=a;const range=e.kind==='archer'?340:e.kind==='boss'?205:e.kind==='elite'?135:68;
      if(d<range&&e.cd<=0){e.wind=e.kind==='boss'?.95:e.kind==='elite'?.85:e.kind==='archer'?.72:.48;e.tx=p.x;e.ty=p.y;e.aim=a;if(e.kind==='boss')e.attack=(e.attack+1)%3;continue;}
      if(e.kind==='archer'&&d<175){this.moveEnemy(e,-Math.cos(a)*e.speed*dt,-Math.sin(a)*e.speed*dt);}
      else if(d>range*.72){const crossing=this.stage===0&&(e.y>2350&&p.y<2350||e.y<2220&&p.y>2220);
        const nav=crossing?Math.atan2((e.y>2350?2300:2270)-e.y,800-e.x):a;this.moveEnemy(e,Math.cos(nav)*e.speed*dt,Math.sin(nav)*e.speed*dt);}
      for(const other of this.enemies){if(other===e||other.dead)continue;const ax=e.x-other.x,ay=e.y-other.y,dist=Math.hypot(ax,ay),min=(e.r+other.r)*.8;if(dist>0&&dist<min){e.x+=ax/dist*dt*25;e.y+=ay/dist*dt*25;}}
      e.x=clamp(e.x,250,1350);e.y=clamp(e.y,200,4140);
    }
    for(const s of [...this.shots]){let advance=dt;if(s.delay&&s.delay>0){const wait=Math.min(s.delay,dt);s.delay-=wait;advance-=wait;if(s.delay>0)continue;s.x=p.x;s.y=p.y;this.combatSound('wave');}s.life-=advance;const sx=s.x,sy=s.y;s.x+=s.vx*advance;s.y+=s.vy*advance;if(this.stage===1){let blocked=false;const n=Math.max(1,Math.ceil(Math.hypot(s.x-sx,s.y-sy)/12));for(let i=1;i<=n;i++)if(!villageWalkable(sx+(s.x-sx)*i/n,sy+(s.y-sy)*i/n,0)){blocked=true;break;}if(blocked){s.life=0;continue;}}if(s.enemy){if(Math.hypot(s.x-p.x,s.y-p.y)<s.r+16){this.hurt(s.damage);s.life=0;}}else{for(const e of this.enemies){if(e.dead||s.hit.has(e.id)||Math.hypot(s.x-e.x,s.y-e.y)>e.r+s.r)continue;s.hit.add(e.id);this.hit(e,s.damage,true);if(s.split){s.split=false;const a=Math.atan2(s.vy,s.vx);for(const offset of [-.38,.38]){this.shoot(s.x,s.y,a+offset,18,false);this.shots[this.shots.length-1].hit.add(e.id);}}}}}
    this.shots=this.shots.filter(s=>s.life>0);
    for(const h of this.hazards){h.delay-=dt;if(h.delay<=0){h.life-=dt;if(Math.hypot(h.x-p.x,h.y-p.y)<h.r+12)this.hurt(10);}}this.hazards=this.hazards.filter(h=>h.life>0);
    for(const f of this.fx){f.life-=dt;f.x+=f.vx*dt;f.y+=f.vy*dt;}this.fx=this.fx.filter(f=>f.life>0);for(const s of this.slashes)s.life-=dt;this.slashes=this.slashes.filter(s=>s.life>0);
    this.cam.x+=(clamp(p.x+(this.aimMode==='mouse'?(this.mouse.x-640)*.08:0),640,W-640)-this.cam.x)*Math.min(1,dt*5);this.cam.y+=(clamp(p.y-(this.stage===1?220:80),360,H-360)-this.cam.y)*Math.min(1,dt*6);
  }
  enemyAttack(e:Enemy){if(e.kind==='beast')e.strikeTime=this.clock;const p=this.player;const d=Math.hypot(p.x-e.x,p.y-e.y);e.cd=e.kind==='boss'?1.6:e.kind==='archer'?1.7:e.kind==='elite'?1.8:1.25;
    if(e.kind==='archer'){this.shoot(e.x,e.y,e.aim,9,true);return;}
    if(e.kind==='boss'){
      if(e.attack===0){if(d<215&&Math.abs(angleDifference(Math.atan2(p.y-e.y,p.x-e.x),e.aim))<1.5)this.hurt(19);this.slashes.push({x:e.x,y:e.y,angle:e.aim,radius:210,life:.25,max:.25,spin:false});}
      else if(e.attack===1){const ox=e.x,oy=e.y,dx=e.tx-e.x,dy=e.ty-e.y,dist=Math.hypot(dx,dy)||1,length=Math.min(330,dist+65);e.x=clamp(e.x+dx/dist*length,340,1260);e.y=clamp(e.y+dy/dist*length,300,950);const vx=e.x-ox,vy=e.y-oy,t=clamp(((p.x-ox)*vx+(p.y-oy)*vy)/(vx*vx+vy*vy||1),0,1);if(Math.hypot(p.x-ox-vx*t,p.y-oy-vy*t)<60)this.hurt(22);e.stun=.75;this.particles(e.x,e.y,'#b7927a',25);}
      else{if(d<165&&Math.abs(angleDifference(Math.atan2(p.y-e.y,p.x-e.x),e.aim))<1.4)this.hurt(23);this.particles(e.x,e.y,'#b6a38a',20);this.slashes.push({x:e.x,y:e.y,angle:e.aim,radius:165,life:.25,max:.25,spin:false});}
      if(e.hp<e.max*.5)e.cd*=.78;this.shake=5;this.sound(65,.25,'triangle');return;
    }
    if(e.kind==='beast'){this.moveEnemy(e,Math.cos(e.aim)*32,Math.sin(e.aim)*32);}
    if(Math.hypot(p.x-e.x,p.y-e.y)<(e.kind==='elite'?150:75)&&Math.abs(angleDifference(Math.atan2(p.y-e.y,p.x-e.x),e.aim))<1.3)this.hurt(e.kind==='elite'?18:e.kind==='shield'?12:8);
    this.particles(e.x+Math.cos(e.aim)*30,e.y+Math.sin(e.aim)*30,'#c18583',8);
  }
  consumeHitStop(dt:number){const frozen=Math.min(this.hitStop,dt);this.hitStop=Math.max(0,this.hitStop-frozen);return dt-frozen;}
  frame=(now:number)=>{
    if(this.destroyed)return;const dt=Math.min(.1,Math.max(0,(now-(this.last||now))/1000));this.last=now;
    if(this.mode==='playing'){this.accumulator=Math.min(.1,this.accumulator+dt);while(this.accumulator>=1/60&&this.mode==='playing'){const advance=this.consumeHitStop(1/60);this.clock+=advance;if(advance>0)this.update(advance);this.accumulator-=1/60;}}
    else{this.accumulator=0;if(this.mode==='menu')this.clock+=dt;}
    if(this.view)this.view.render(this);else this.render();if(now-this.emitAt>100){this.emitAt=now;this.emit();}this.raf=requestAnimationFrame(this.frame);
  };

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
