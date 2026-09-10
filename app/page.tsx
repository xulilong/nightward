'use client';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Flame, Swords, Volume2, VolumeX, Maximize, Pause, Play, ArrowUpRight, RotateCcw, Wind, Sparkles, Crosshair, ChevronRight, Heart, Shield, Lock } from 'lucide-react';
import { futureChapters, sitesFor, villageBuildings, villageDistricts, villageRoads } from '@/lib/levels';
import { Button } from '@/components/ui/button';
import { NightGame, initialSnapshot, upgrades, chapters, type Snapshot } from '@/lib/game';

export default function Home() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const game = useRef<NightGame | null>(null);
  const shell = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<Snapshot>(initialSnapshot);
  const [chapterMenu,setChapterMenu]=useState(false);
  const [muted, setMuted] = useState(false);
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(0);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [pageHidden, setPageHidden] = useState(false);
  const [heldKey, setHeldKey] = useState<Record<string, boolean>>({});
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if(event.metaKey||event.ctrlKey||event.altKey)return;
      const key = (event.code?.startsWith('Key')?event.code.slice(3):event.key).toUpperCase();
      if (!event.repeat && ['A','S','D','Q','W','F',' '].includes(key)) {
        setHeldKey(keys => ({...keys, [key === ' ' ? 'D' : key]: true}));
      }
    };
    const up = (event: KeyboardEvent) => {
      const key = event.key === ' ' ? 'D' : (event.code?.startsWith('Key')?event.code.slice(3):event.key).toUpperCase();
      setHeldKey(keys => keys[key] ? {...keys, [key]: false} : keys);
    };
    const clear = () => setHeldKey({});
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', clear);
    document.addEventListener('visibilitychange', clear);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', clear);
      document.removeEventListener('visibilitychange', clear);
    };
  }, []);
  useEffect(() => setHeldKey({}), [state.mode, chapterMenu]);
  useEffect(() => {
    const visibility = () => setPageHidden(document.hidden);
    visibility();
    document.addEventListener('visibilitychange', visibility);
    return () => document.removeEventListener('visibilitychange', visibility);
  }, []);
  useEffect(() => {
    let disposed = false;
    let view: import('@/lib/game-view').NightView | undefined;
    const boot = async () => {
      try {
        const { NightView } = await import('@/lib/game-view');
        if (disposed || !canvas.current) return;
        view = new NightView(canvas.current);
        await view.load(value => { if (!disposed) setLoading(value); });
        if (disposed) { view.destroy(); return; }
        game.current = new NightGame(canvas.current, setState, view);
        setReady(true);
      } catch (error) {
        view?.destroy();
        if (!disposed) setLoadError(error instanceof Error ? error.message : '场景加载失败');
      }
    };
    void boot();
    return () => { disposed = true; if (game.current) {game.current.destroy();game.current=null;} else view?.destroy(); };
  }, []);
  useEffect(()=>{
    if(!chapterMenu)return;
    const key=(event:KeyboardEvent)=>{event.stopPropagation();if(['Escape','f','F'].includes(event.key)){event.preventDefault();setChapterMenu(false);}else if(['1','2'].includes(event.key)&&ready){event.preventDefault();setChapterMenu(false);game.current?.startSelectedChapter(Number(event.key)-1);}};
    window.addEventListener('keydown',key,true);return()=>window.removeEventListener('keydown',key,true);
  },[chapterMenu,ready]);
  const start = () => { if (ready) game.current?.start(); };
  const currentChapter = chapters[state.stage];
  const formatTime = (time:number) => Math.floor(time/60)+':'+Math.floor(time%60).toString().padStart(2,'0');
  const restartChapter = () => { if (ready) game.current?.restartChapter(); };
  const setDifficulty = (difficulty:'normal'|'story') => {if(game.current){game.current.difficulty=difficulty;game.current.emit();}};
  const fullscreen = async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await shell.current?.requestFullscreen(); }
    catch { setNotice('当前浏览器不支持全屏，仍可在此窗口正常试玩。'); }
  };
  const iconButtons = <>
    <Button variant="ghost" size="icon" aria-label={muted ? '开启音效' : '关闭音效'} onClick={() => {setMuted(!muted); if (game.current) game.current.muted = !muted;}}>{muted ? <VolumeX/> : <Volume2/>}</Button>
    <Button variant="ghost" size="icon" aria-label="全屏" onClick={fullscreen}><Maximize/></Button>
    <Button variant="outline" className="pause-button" disabled={!['playing','paused'].includes(state.mode)} onClick={() => game.current?.togglePause()}>{state.mode === 'paused' ? <Play/> : <Pause/>}<span>{state.mode === 'paused' ? '继续' : '暂停'}</span><kbd>R</kbd></Button>
  </>;
  return <main ref={shell} className="game-shell">

    <div className="stage-wrap"><section className="stage" aria-label="逐夜之刃游戏区域" data-chapter={state.stage}>
      <canvas ref={canvas} width={1280} height={720} tabIndex={0} aria-label="方向键移动，A 连斩，D 闪避，S 基础防御，第二章 Q 突进，W 治疗，F 交互，R 暂停"/>
      {state.mode !== 'menu' && <>
        <div className="in-game-controls">{iconButtons}</div>

        <div className="player-hud"><div className="player-badge"><Flame/></div><div className="player-bars"><div className="player-label"><b>烬</b><strong>{Math.ceil(state.hp)}<small> / 100</small></strong></div><div className="health-track"><div style={{width: `${state.hp}%`}}/></div>{state.training&&<div className="energy-row">{[0,1,2].map(i=><span key={i} className={i < state.energy ? 'charged' : ''}/>)}<small>刃能</small></div>}</div></div>
        <div className="quest" aria-label="当前目标"><strong><span>◇</span> {state.objective}</strong></div>
        <div className="route-map" aria-label="驿道路线进度">

          {state.stage===1?<div className="village-mini" aria-label="村庄街巷地图"><svg viewBox="0 0 1600 4300" preserveAspectRatio="none" aria-hidden="true">{villageRoads.map((road,i)=><polyline key={i} points={road.points.map(p=>p.join(",")).join(" ")} fill="none" stroke="currentColor" strokeWidth={road.width} strokeLinejoin="round"/>)}</svg>{villageBuildings.map((b,i)=><i key={i} style={{left:(b.x-b.w/2)/1600*100+'%',top:(b.y-b.d/2)/4300*100+'%',width:b.w/1600*100+'%',height:b.d/4300*100+'%'}}/>)}{sitesFor(1).map(site=><span key={site.id} title={site.name} className={state.completedSites.includes(site.id)?'rescued':''} style={{left:site.x/1600*100+'%',top:site.y/4300*100+'%'}}>{site.id+1}</span>)}<b style={{left:state.playerX/1600*100+'%',top:state.playerY/4300*100+'%'}}/></div>:<div className="route-line"><i style={{height:state.progress+'%'}}/>
            {[{y:3930,label:'启程'},...sitesFor(0).map(s=>({y:s.y,label:s.name})),{y:250,label:'骑士营地'}].map(point=><span key={point.y} className={state.playerY<=point.y+50?'visited':''} style={{bottom:(3930-point.y)/3680*100+'%'}}><em/>{point.label}</span>)}
            <b className="route-position" style={{bottom:Math.min(100,Math.max(0,(3930-state.playerY)/3680*100))+'%'}}/>
          </div>}

        </div>
        <Button className="heal-button" data-held={!!heldKey.W} variant="outline" disabled={state.mode!=='playing'||state.potions===0||state.hp>=100} onClick={()=>game.current?.action('heal')}><kbd>W</kbd><Heart size={16}/><span>灯火药剂 <b>× {state.potions}</b></span></Button>
        {state.hp<30&&state.mode==='playing'&&<div className="critical-health" aria-hidden="true"/>}
        {state.bossHP !== null && <div className="boss-hud"><small>{state.bossHP < 50 ? '改变架势 · 第二阶段' : state.stage===0?'昔日的渡鸦骑士':'占领村庄的征粮军'}</small><strong>{currentChapter.boss}</strong><div><i style={{width:`${state.bossHP}%`}}/></div></div>}
        {state.guidance&&(state.time<20||state.hp<45||state.guidance.includes('军令'))&&!state.toast&&!state.interact&&state.mode==='playing'&&<div className="context-guidance">{state.guidance}</div>}
        {state.toast && <div className="game-toast" role="status">{state.toast}</div>}
        {state.interact && state.mode === 'playing' && <div className="interact-prompt"><Button className="world-interaction" data-held={!!heldKey.F} aria-keyshortcuts="F" onClick={()=>game.current?.action('interact')} variant="ghost"><kbd>F</kbd><span>{state.interact}</span><ChevronRight aria-hidden="true"/></Button></div>}
        <div className="skillbar">{[
          {key:'A', name:'三连斩', icon:<Swords/>, cd:0, action:'attack'},
          {key:'S', name:'基础防御', icon:<Shield/>, cd:game.current?.guardCD??0, action:'guard'},
          {key:'D', name:'闪避', icon:<Wind/>, cd:state.dodgeCD, action:'dodge'},
          {key:'Q', name:'突进斩', icon:<ArrowUpRight/>, cd:state.stage===0?-2:state.qCD, action:'dash'},

        ].map(skill=><Button key={skill.key} className={`skill ${skill.cd > 0 ? 'cooling' : ''} ${skill.cd < 0 ? 'skill-locked' : ''}`} data-held={!!heldKey[skill.key]} variant="ghost" aria-label={`${skill.name}${skill.cd===-2?'，第二章解锁':skill.cd>0?'，冷却中':''}`} aria-keyshortcuts={skill.key} disabled={state.mode !== 'playing' || skill.cd !== 0} onClick={()=>game.current?.action(skill.action)}>
          <kbd>{skill.key}</kbd><span className="skill-emblem">{skill.icon}
            {skill.cd>0&&<i className="skill-cooldown" aria-hidden="true" style={{transform:`scaleY(${Math.min(1,skill.cd/(skill.key==='Q'?(game.current?.powers.has(9)?4:5):skill.key==='S'?.8:(game.current?.powers.has(2)?.85:1.2)))})`}}/>}
            {skill.cd>0&&<b className="skill-countdown" aria-hidden="true">{skill.cd.toFixed(1)}</b>}
            {skill.cd<0&&<Lock className="skill-lock-mark" aria-hidden="true"/>}
          </span><span className="skill-name">{skill.cd===-2?'第二章解锁':skill.name}</span>
        </Button>)}</div>
      </>}
      {state.mode === 'menu' && <div className="splash-screen" data-motion-paused={pageHidden || chapterMenu}>
        <img className="splash-art" src="./art/title-background-v2.png" alt="白发巡灯人站在雾林石道上，遥望长夜中的灯塔" fetchPriority="high" />
        <div className="splash-shade" />
        <div className="title-atmosphere" aria-hidden="true">
          <div className="title-fog title-fog-distant" />
          <div className="title-fog title-fog-near" />
          <div className="title-lantern-haze" />
          {Array.from({length:22},(_,i)=><i key={i} className={`title-mote${i%4===0?' title-mote-cool':''}`} style={{
            left:`${7+(i*37)%87}%`,top:`${28+(i*23)%65}%`,
            '--mote-size':`${i%3===0?3:2}px`, '--mote-drift':`${(i%2===0?1:-1)*(18+i%5*9)}px`,
            '--mote-rise':`${75+i%7*17}px`, '--mote-duration':`${10+i%8*2}s`, '--mote-delay':`${-i*2.7}s`,
          } as CSSProperties}/>)}
        </div>
        <div className="title-composition"><p className="title-kicker">N I G H T W A R D</p><h1>逐夜之刃</h1><div className="title-rule" aria-hidden="true"><span/><Flame/><span/></div><p className="title-promise">循灯而行，护人归途</p><p className="title-story">一封密信，一条北行之路。<br/>长夜将至，你会为谁停下脚步？</p></div>
        <div className="splash-actions">
          {ready&&<Button variant="ghost" className="chapter-select-link" onClick={()=>setChapterMenu(true)}>选择章节 · Ⅰ — Ⅷ</Button>}
          {loadError ? <><p className="load-error">场景未能载入，请重新尝试。</p><Button className="start-button" onClick={()=>window.location.reload()}>重新加载</Button></> : ready ? <><Button className="enter-mist-button" data-held={!!heldKey.F} onClick={()=>state.hasSave?game.current?.continueCampaign():start()} aria-keyshortcuts="F" aria-describedby="enter-mist-hint"><span className="entry-ornament" aria-hidden="true"/><span>{state.hasSave ? '继续旅程' : '踏入长夜'}</span><span className="entry-ornament" aria-hidden="true"/></Button><div className="entry-key-hint" id="enter-mist-hint">点击启程<span aria-hidden="true">·</span>或按 <kbd>F</kbd></div><div className="campaign-menu"><span>雾林边境 / 灰烬村庄 · 前两章开放</span><small>新旅程难度</small><div className="difficulty-switch" aria-label="游戏难度"><button aria-pressed={state.difficulty==='story'} onClick={()=>setDifficulty('story')}>轻松</button><button aria-pressed={state.difficulty==='normal'} onClick={()=>setDifficulty('normal')}>标准</button><kbd>A / D</kbd></div>{state.hasSave&&<Button variant="ghost" className="continue-button" onClick={start}>重新启程 · 新战役</Button>}</div><p className="entry-controls">方向键移动 · A 连斩 · D 闪避 · S 防御<br/><small>第二章 Q 突进　 W 治疗　 F 交互　 R 暂停</small></p></> : <><div className="loading-track"><span style={{width:`${loading}%`}}/></div><p>正在点亮沿途灯火 <span>{loading}%</span></p></>}
        </div>
      </div>}

      {state.mode==='dialogue'&&state.dialogue&&<div className="dialogue-backdrop"><div className="story-dialogue"><small>沿途的故事</small><h2>{state.dialogue.speaker}</h2><p>{state.dialogue.text}</p><div>{state.dialogue.choices.map((label,i)=><Button key={i} variant="outline" onClick={()=>game.current?.chooseDialogue(i)}><kbd>{state.dialogue!.choices.length===1?'F':['Z','X','C'][i]}</kbd>{label}</Button>)}</div></div></div>}
      {chapterMenu&&<div className="modal-backdrop chapter-catalog"><div className="catalog-panel"><div className="eyebrow">NIGHTWARD · THE ROAD NORTH</div><h2>通往王城的八段旅程</h2><p>按 1 / 2 从对应章节重新开始；后六章敬请期待。</p><div className="catalog-grid">{[...chapters.map(c=>c.name),...futureChapters].map((name,i)=><Button key={name} variant="outline" disabled={i>=2||!ready} onClick={()=>{setChapterMenu(false);game.current?.startSelectedChapter(i);}}><small>{String(i+1).padStart(2,'0')}</small><strong>{name}</strong><span>{i<2?'重新开始本章':<><Lock size={12}/>敬请期待</>}</span></Button>)}</div><Button variant="ghost" onClick={()=>setChapterMenu(false)}>返回</Button></div></div>}
      {state.mode === 'paused' && <div className="modal-backdrop"><div className="modal pause-panel"><div className="eyebrow">{currentChapter.name} · {state.stage===0?['追踪小径','溪流哨桥','废弃哨所','骑士营地'][state.chapter]:(villageDistricts.find(d=>state.playerY>=d.from&&state.playerY<d.to)?.name??'灰烬村庄')}</div><h2>灯火为你停留</h2><p>存档在营地与强化后自动保存。准备好了就继续上路。</p><div className="pause-details"><p>{state.objective}</p><div className="pause-statistics"><span>用时 {formatTime(state.time)}</span><span>击败 {state.kills}</span><span>强化 {state.upgradeCount}</span><span>精准闪避 {state.perfectDodges}</span></div>{state.stage===1&&<div className="rescue-ledger">{sitesFor(1).map((site,i)=><div key={site.id} className={state.completedSites.includes(site.id)?'done':''}><span>{state.completedSites.includes(site.id)?'✓':'◇'}</span><p>{site.name}<small>{state.completedSites.includes(site.id)?'已完成 · 火势受控':['淬刃 · 伤害提升','村民脱险 · 生命恢复','保住粮食 · 药剂补给'][i]}</small></p></div>)}</div>}</div><Button className="start-button" onClick={()=>game.current?.togglePause()}><Play/>继续冒险 <kbd>F</kbd></Button><Button variant="ghost" onClick={restartChapter}><RotateCcw/>重新开始本章 <kbd>X</kbd></Button><div className="pause-help">↑↓←→ 移动 · A 连斩 · D 闪避 · S 防御<br/>第二章 Q 突进 · W 治疗 · F 交互 · R 暂停<br/>键盘攻击自动瞄准 · 鼠标点击切换自由瞄准</div></div></div>}
      {state.mode === 'upgrade' && <div className="modal-backdrop"><div className="upgrade-modal"><div className="eyebrow">A SPARK OF POSSIBILITY</div><h2>让火种回应你的剑</h2><p>按 Z / X / C 选择强化，本次冒险持续生效。</p><div className="upgrade-grid">{state.choices.map((id,index)=><Button className="upgrade-card" variant="outline" key={id} onClick={()=>game.current?.chooseUpgrade(id)}><Sparkles/><small>{upgrades[id].tag}</small><h3>{upgrades[id].name}</h3><p>{upgrades[id].description}</p><span><kbd>{['Z','X','C'][index]}</kbd> 选择强化 <ChevronRight/></span></Button>)}</div></div></div>}
      {state.mode==='interlude'&&<div className="modal-backdrop chapter-complete"><div className="chapter-results"><div className="eyebrow">CHAPTER COMPLETE</div><small>{currentChapter.subtitle}</small><h2>{currentChapter.name} · 灯火重燃</h2><p>{currentChapter.ending}</p><div className="journey-outcomes"><span>{state.story.hunter?'✓ 猎人获救 · 已获村庄侧巷情报':'猎人营地未调查'}</span><span>{state.story.merciful?'留下药物，让加雷斯离开':'从加雷斯手中取走军令'}</span></div><div className="chapter-record"><b>{state.records.at(-1)?.rank}</b><div><strong>{formatTime(state.time)} <span>本章用时</span></strong><span>击败 {state.kills} · 承受伤害 {state.damage} · 精准闪避 {state.perfectDodges}</span></div></div><p className="chapter-next">下一章 · {chapters[Math.min(1,state.stage+1)].name}<br/><small>强化保留 · 生命、刃能与药剂补满 · 已自动保存</small></p><Button className="start-button" onClick={()=>game.current?.nextChapter()}>继续征途 <ChevronRight/><kbd>F</kbd></Button></div></div>}
      {(state.mode === 'dead' || state.mode === 'won') && <div className="modal-backdrop"><div className="modal"><Flame className="modal-symbol"/><div className="eyebrow">{state.mode === 'won' ? 'THE LIGHT LIVES ON' : 'YOUR FLAME REMAINS'}</div><h2>{state.mode === 'won' ? '灰烬中的归途' : '长夜未尽'}</h2><p>{state.mode === 'won' ? currentChapter.ending : '你的火种还未熄灭。从最近的灯站再次出发。'}</p>{state.mode==='won'&&<div className="journey-outcomes">{sitesFor(1).map(site=><span key={site.id}>{state.completedSites.includes(site.id)?'✓':'—'} {site.name} · {state.completedSites.includes(site.id)?'搜救完成':'未完成'}</span>)}</div>}{state.mode==='won'&&<p className="coming-next">下一章 · 鸦渡要塞<br/><small>后续六章敬请期待</small></p>}{state.mode==='won'&&<div className="campaign-records">{state.records.map(r=><div key={r.stage}><b>{r.rank}</b><span>{chapters[r.stage].name}</span><small>{formatTime(r.time)} · {r.kills} 击败</small></div>)}</div>}<div className="result-stats"><span><b>{state.mode==='won'?state.records.reduce((sum,r)=>sum+r.kills,0):state.kills}</b>击败敌人</span><span><b>{formatTime(state.mode==='won'?state.records.reduce((sum,r)=>sum+r.time,0):state.time)}</b>冒险用时</span><span><b>{state.upgradeCount}</b>获得强化</span></div><Button className="start-button" onClick={()=>state.mode==='dead' ? game.current?.retry() : start()}><RotateCcw/>{state.mode === 'won' ? '再踏征途' : '从灯站重试'} <kbd>F</kbd></Button></div></div>}
      <div className="touch-controls"><div className="dpad">{[['arrowup','↑'],['arrowleft','←'],['arrowdown','↓'],['arrowright','→']].map(([key,label])=><Button key={key} variant="outline" aria-label={`移动${label}`} onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);game.current?.setKey(key,true);}} onPointerUp={()=>game.current?.setKey(key,false)} onPointerCancel={()=>game.current?.setKey(key,false)}>{label}</Button>)}</div></div>
    </section></div>

    {notice && <button className="notice" onClick={()=>setNotice('')}>{notice}</button>}
  </main>;
}
