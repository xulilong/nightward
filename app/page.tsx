'use client';
import { useEffect, useRef, useState } from 'react';
import { Flame, Swords, Volume2, VolumeX, Maximize, Pause, Play, ArrowUpRight, RotateCcw, Wind, Sparkles, Crosshair, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NightGame, initialSnapshot, upgrades, type Snapshot } from '@/lib/game';

export default function Home() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const game = useRef<NightGame | null>(null);
  const shell = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<Snapshot>(initialSnapshot);
  const [muted, setMuted] = useState(false);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    if (!canvas.current) return;
    const instance = new NightGame(canvas.current, setState);
    game.current = instance;
    return () => { instance.destroy(); game.current = null; };
  }, []);
  const start = () => game.current?.start();
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
    <header className="topbar"><div className="brand"><Flame/><span>逐夜之刃</span><i> / </i><small>NIGHTWARD</small></div><div className="chapter"><span className="live-dot"/>第一章 <span>雾林驿道</span></div><div className="top-actions"><Button variant="ghost" className="aim-button" aria-label="切换自动或鼠标瞄准" onClick={()=>game.current?.toggleAim()}><Crosshair/><span>{state.aimMode === 'auto' ? '自动瞄准' : '鼠标瞄准'}</span></Button>{iconButtons}</div></header>
    <div className="stage-wrap"><section className="stage" aria-label="逐夜之刃游戏区域">
      <canvas ref={canvas} width={1280} height={720} tabIndex={0} aria-label="使用上下左右方向键移动，鼠标瞄准，Z 或左键挥剑，X 或右键剑气，C 闪避，Q 突进，E 回旋斩，F 交互，R 暂停"/>
      {state.mode !== 'menu' && <>
        <div className="player-hud"><div className="player-badge"><Flame/></div><div className="player-bars"><div className="player-label"><b>烬</b><span>巡灯人 · LV. 01</span><strong>{Math.ceil(state.hp)}<small> / 100</small></strong></div><div className="health-track"><div style={{width: `${state.hp}%`}}/></div><div className="energy-row">{[0,1,2].map(i=><span key={i} className={i < state.energy ? 'charged' : ''}/>)}<small>刃能 · 近战命中充能</small></div></div></div>
        <div className="quest"><small>当前任务 <span>0{state.chapter + 1} / 04</span></small><strong><span>◇</span> {state.objective}</strong><div className="quest-progress"><i style={{width:`${state.progress}%`}}/></div><p>已击败 {state.kills} <span>·</span> {Math.floor(state.time/60).toString().padStart(2,'0')}:{Math.floor(state.time%60).toString().padStart(2,'0')}</p></div>
        {state.bossHP !== null && <div className="boss-hud"><small>异变的守灯人</small><strong>驿站守灯者</strong><div><i style={{width:`${state.bossHP}%`}}/></div></div>}
        {state.toast && <div className="game-toast" role="status">{state.toast}</div>}
        {state.interact && state.mode === 'playing' && <div className="interact-prompt"><kbd>F</kbd>{state.interact}<Button onClick={()=>game.current?.action('interact')} variant="ghost" size="sm">交互 <ChevronRight/></Button></div>}
        <div className="skillbar">{[
          {key:'Z / LMB', name:'三连斩', icon:<Swords/>, cd:0, action:'attack'},
          {key:'X / RMB', name:'穿透剑气', icon:<Crosshair/>, cd:state.energy === 0 ? -1 : 0, action:'ranged'},
          {key:'C', name:'闪避', icon:<Wind/>, cd:state.dodgeCD, action:'dodge'},
          {key:'Q', name:'突进斩', icon:<ArrowUpRight/>, cd:state.qCD, action:'dash'},
          {key:'E', name:'回旋斩', icon:<Sparkles/>, cd:state.eCD, action:'spin'},
        ].map(skill=><Button key={skill.key} className={`skill ${skill.cd ? 'cooling' : ''}`} variant="ghost" aria-label={skill.name} disabled={state.mode !== 'playing' || skill.cd !== 0} onClick={()=>game.current?.action(skill.action)}><kbd>{skill.key}</kbd>{skill.icon}<span>{skill.cd > 0 ? skill.cd.toFixed(1)+'s' : skill.cd < 0 ? '刃能不足' : skill.name}</span></Button>)}</div>
      </>}
      {state.mode === 'menu' && <div className="intro-overlay"><div className="intro-content"><div className="eyebrow"><span/> A LIGHT AGAINST THE DARK</div><h1>逐夜之刃</h1><h2>雾林驿道</h2><p>长夜将至，最后一座城市仍在迁徙。<br/>握紧你的剑，为归途点亮下一盏灯。</p><Button className="start-button" onClick={start}><Swords/>踏入雾林<ArrowUpRight/></Button><div className="intro-keyboard"><kbd>↑ ↓ ← →</kbd> 移动 <kbd>Z</kbd> 连斩 <kbd>X</kbd> 剑气</div><div className="intro-notes"><span>单人冒险</span><i/>约 5–8 分钟<i/><span>F 开始 · 方向键移动 · 左手战斗</span></div></div><div className="intro-caption"><span>01 — THE MISTWOOD</span><p>灯火所至，即是归途。</p></div><div className="version-tag">PLAYABLE PROTOTYPE <span>v0.1</span></div></div>}
      {state.mode === 'paused' && <div className="modal-backdrop"><div className="modal"><Flame className="modal-symbol"/><div className="eyebrow">TAKE A BREATH</div><h2>灯火为你停留</h2><p>冒险已暂停。准备好了就继续上路。</p><Button className="start-button" onClick={()=>game.current?.togglePause()}><Play/>继续冒险 <kbd>F</kbd></Button><Button variant="ghost" onClick={start}><RotateCcw/>重新开始本关 <kbd>X</kbd></Button><div className="pause-help">↑↓←→ 移动 · Z 连斩 · X 剑气 · C 闪避<br/>Q 突进 · E 回旋斩 · F 交互 · R 暂停<br/>键盘攻击自动瞄准 · 鼠标点击切换自由瞄准</div></div></div>}
      {state.mode === 'upgrade' && <div className="modal-backdrop"><div className="upgrade-modal"><div className="eyebrow">A SPARK OF POSSIBILITY</div><h2>让火种回应你的剑</h2><p>按 Z / X / C 选择强化，本次冒险持续生效。</p><div className="upgrade-grid">{state.choices.map((id,index)=><Button className="upgrade-card" variant="outline" key={id} onClick={()=>game.current?.chooseUpgrade(id)}><Sparkles/><small>{upgrades[id].tag}</small><h3>{upgrades[id].name}</h3><p>{upgrades[id].description}</p><span><kbd>{['Z','X','C'][index]}</kbd> 选择强化 <ChevronRight/></span></Button>)}</div></div></div>}
      {(state.mode === 'dead' || state.mode === 'won') && <div className="modal-backdrop"><div className="modal"><Flame className="modal-symbol"/><div className="eyebrow">{state.mode === 'won' ? 'THE LIGHT LIVES ON' : 'YOUR FLAME REMAINS'}</div><h2>{state.mode === 'won' ? '灯火重燃' : '长夜未尽'}</h2><p>{state.mode === 'won' ? '远方传来城市的汽笛。今夜，归途依然明亮。' : '你的火种还未熄灭。从最近的灯站再次出发。'}</p><div className="result-stats"><span><b>{state.kills}</b>击败敌人</span><span><b>{Math.floor(state.time/60)}:{Math.floor(state.time%60).toString().padStart(2,'0')}</b>冒险用时</span><span><b>{state.upgradeCount}</b>获得强化</span></div><Button className="start-button" onClick={()=>state.mode==='dead' ? game.current?.retry() : start()}><RotateCcw/>{state.mode === 'won' ? '再踏征途' : '从灯站重试'} <kbd>F</kbd></Button></div></div>}
      <div className="touch-controls"><div className="dpad">{[['arrowup','↑'],['arrowleft','←'],['arrowdown','↓'],['arrowright','→']].map(([key,label])=><Button key={key} variant="outline" aria-label={`移动${label}`} onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);game.current?.setKey(key,true);}} onPointerUp={()=>game.current?.setKey(key,false)} onPointerCancel={()=>game.current?.setKey(key,false)}>{label}</Button>)}</div></div>
    </section></div>
    <footer className="bottom-bar"><div><span className="live-dot"/>冒险试玩版<span className="footer-divider">/</span><span>第一章 · 雾林驿道</span></div><p><kbd>↑</kbd><kbd>↓</kbd><kbd>←</kbd><kbd>→</kbd> 移动 <span>·</span> Z 连斩 / X 剑气 / C 闪避 <span>·</span> R 暂停</p><span className="footer-motto"><Flame/>循灯而行</span></footer>
    {notice && <button className="notice" onClick={()=>setNotice('')}>{notice}</button>}
  </main>;
}
