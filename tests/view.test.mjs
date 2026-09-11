import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const levelCode=ts.transpileModule(fs.readFileSync(new URL('../lib/levels.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const levelUrl='data:text/javascript;base64,'+Buffer.from(levelCode).toString('base64');

import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Decode glTF buffers/rigs in Node. GPU image upload is outside these structural tests.
globalThis.self=globalThis;
globalThis.createImageBitmap=async()=>({width:1024,height:1024,close(){}});
globalThis.ProgressEvent=class extends Event {constructor(type,options){super(type);Object.assign(this,options);}};
let code=ts.transpileModule(fs.readFileSync(new URL('../lib/game-view.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
code=code.replace(/from (['"])(three[^'"]*)\1/g,(_,q,name)=>'from '+JSON.stringify(import.meta.resolve(name)));
code=code.replace(/from ['"]\.\/levels['"]/g,'from '+JSON.stringify(levelUrl));
const {NightView}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const models=new Map();
for(const name of ['Knight','Rogue_Hooded']){const file=fs.readFileSync(new URL('../public/models/'+name+'.glb',import.meta.url));const gltf=await new GLTFLoader().parseAsync(file.buffer.slice(file.byteOffset,file.byteOffset+file.byteLength),'');models.set(name,gltf);}
function view(){return Object.assign(Object.create(NightView.prototype),{scene:new T.Scene(),terrain:new T.Group(),effects:new T.Group(),geometries:new Set(),materials:new Set(),textures:[],models,lamps:[],colliders:[],camera:new T.OrthographicCamera(-18,18,10,-10,.1,180),raycaster:new T.Raycaster(),plane:new T.Plane(new T.Vector3(0,1,0),0)});}

function spriteHero(v){const a={root:new T.Group(),actions:new Map(),current:'',until:0,lastAtk:0,lastX:0,lastY:0,legs:[],kind:'hero',materials:[]};v.attachPaintedActor(a,'hero');return a;}
test('bundled character rigs load with sword, running and combat animations',()=>{for(const model of models.values()){assert.ok(model.animations.some(a=>a.name==='Running_A'));assert.ok(model.animations.some(a=>a.name==='1H_Melee_Attack_Chop'));let skinned=0;model.scene.traverse(o=>{if(o.isSkinnedMesh){skinned++;assert.ok(o.skeleton.bones.length>10);for(const x of o.geometry.getAttribute('position').array)assert.ok(Number.isFinite(x));}});assert.ok(skinned>=4);}});
test('road faces upward, vegetation matches collision data, and bridge assets build',()=>{const v=view();v.buildWorld([new T.Texture(),new T.Texture(),new T.Texture(),new T.Texture()]);const road=v.terrain.children.find(o=>o.isMesh&&o.geometry.getAttribute('position').count===272);assert.ok(road,'road geometry');const normal=road.geometry.getAttribute('normal');assert.ok(normal.getY(0)>.99,'road must face the camera, not be back-face culled');assert.equal(v.colliders.length,150);assert.equal(v.canWalk(v.colliders[0].x,v.colliders[0].y),false);assert.equal(v.canWalk(800,3930),true);assert.ok(v.water);assert.ok(v.lamps.some(l=>l.kind==='end'));});
test('3D ground picking preserves world aim at wide and narrow viewport ratios',()=>{const v=view();for(const aspect of [16/9,21/9,4/3]){v.camera.left=-10*aspect;v.camera.right=10*aspect;v.camera.position.set(0,27,22);v.camera.lookAt(0,0,0);v.camera.updateProjectionMatrix();v.camera.updateMatrixWorld();const original=new T.Vector3(3,0,-4),screen=original.clone().project(v.camera),picked=v.pointerWorld(screen.x,screen.y);assert.ok(Math.abs(picked.x-(3/.035+800))<1e-6);assert.ok(Math.abs(picked.y-(-4/.035+2100))<1e-6);}});

const frames=JSON.parse(fs.readFileSync(new URL('../public/art/frames.json',import.meta.url),'utf8'));
function paintedView(){const v=view();Object.assign(v,{textures:[],art:new Map(['hero','forest','enemies','wolf','village-buildings-v2','village-props-v2','village-wet-stone-v2'].map(name=>[name,new T.Texture()])),frames,paintedTrees:[]});v.camera.position.set(0,27,22);v.camera.lookAt(0,0,0);v.camera.updateMatrixWorld();return v;}
test('painted animation frames stay inside their atlases and feet stay planted across directions',()=>{const v=paintedView();for(const sheet of Object.values(frames))for(const row of sheet.frames)for(const f of row){assert.ok(f.x>=0&&f.y>=0&&f.x+f.w<=sheet.width&&f.y+f.h<=sheet.height);assert.ok(f.anchorX>=0&&f.anchorX<=1&&f.anchorY>=0&&f.anchorY<=1);}const hero=spriteHero(v);for(let row=0;row<4;row++)for(let col=0;col<4;col++){const angle=-Math.PI/2+col*Math.PI/2;hero.root.rotation.y=Math.PI/2-angle;v.updatePaintedActor(hero,angle,row);hero.root.updateMatrixWorld(true);const f=frames.hero.frames[row][col],h=hero.billboardHeight;const foot=new T.Vector3((f.anchorX-.5)*h,(.5-f.anchorY)*h,0);hero.billboard.localToWorld(foot);assert.ok(foot.length()<1e-6,'direction/animation changes must not move the contact point');assert.ok(Math.abs(hero.atlas.offset.x-f.x/frames.hero.width)<1e-8);}});
test('painted forest preserves traversable route and enemies preserve damage bars',()=>{const v=paintedView();v.buildWorld([new T.Texture(),new T.Texture(),new T.Texture(),new T.Texture()]);assert.equal(v.paintedTrees.length,130);assert.equal(v.canWalk(800,3930),true);for(const kind of ['boss','archer','elite']){const a=v.createActor(kind);v.updatePaintedActor(a,0,a.atlasRow);assert.ok(a.billboard&&a.bar&&a.fill);assert.equal(a.atlasRow,kind==='archer'?1:0);}const mat=v.atlasMaterial(new T.Texture(),4,4);const shader={fragmentShader:'#include <map_fragment>\n#include <alphatest_fragment>'};mat.onBeforeCompile(shader);assert.ok(shader.fragmentShader.includes('diffuseColor.a *= 1.0 - keyed'));assert.ok(shader.fragmentShader.indexOf('float keyed')<shader.fragmentShader.indexOf('alphatest_fragment'));});

test('painted turns use shortest path, stable direction boundaries and finish pose transitions',()=>{const v=paintedView(),a=spriteHero(v);v.updatePaintedActor(a,Math.PI-.02,0);const initial=a.visualAngle;v.updatePaintedActor(a,-Math.PI+.02,0,0,1/60);assert.ok(Math.abs(a.visualAngle-initial)<.05,'wraparound must not turn a full circle');v.updatePaintedActor(a,-Math.PI/2,0);for(let i=0;i<30;i++)v.updatePaintedActor(a,0,0,0,1/60);assert.equal(a.visualColumn,1);assert.equal(a.poseBlend,1);assert.equal(a.previousPose.visible,false);assert.equal(a.billboard.material.opacity,1);assert.equal(a.billboard.material.depthWrite,true);v.updatePaintedActor(a,-Math.PI/2,0);for(let i=0;i<30;i++)v.updatePaintedActor(a,-Math.PI/4+(i%2?.04:-.04),0,0,1/60);assert.equal(a.visualColumn,0,'diagonal jitter must not flap between poses');});
test('turn timing is refresh-rate independent and locomotion settles back to idle',()=>{const v=paintedView();const run=hz=>{const a=spriteHero(v);v.updatePaintedActor(a,-Math.PI/2,0);for(let i=0;i<hz/2;i++)v.updatePaintedActor(a,Math.PI/2,1,0,1/hz,true);return a;};const a=run(30),b=run(120);assert.ok(Math.abs(a.visualAngle-b.visualAngle)<1e-6);assert.ok(Math.abs(a.motionWeight-b.motionWeight)<1e-6);for(let i=0;i<60;i++)v.updatePaintedActor(a,Math.PI/2,0,0,1/60,false);assert.ok(a.motionWeight<.001);assert.equal(a.poseKey,'2:0');assert.equal(a.poseBlend,1);});

test('west running frames keep the torso aligned instead of snapping between alternating boots',()=>{const v=paintedView(),a=spriteHero(v),positions=[];
  // Atlas landmarks: pelvis centre sits at x=1072 in both west stride drawings.
  // Test the visible body, not the anchor itself (which always maps to the origin).
  for(const row of [1,2]){v.updatePaintedActor(a,Math.PI,row);a.root.updateMatrixWorld(true);const f=frames.hero.frames[row][3];const pelvis=new T.Vector3(((1072-f.x)/f.w-.5)*a.billboardHeight,(.5-.5)*a.billboardHeight,0);a.billboard.localToWorld(pelvis);positions.push(pelvis);}
  assert.ok(Math.abs(positions[0].x-positions[1].x)<.02,'alternating west strides must not displace the torso horizontally');
  assert.ok(Math.abs(frames.hero.frames[1][3].anchorX-frames.hero.frames[0][3].anchorX)<.03,'starting west run must preserve body alignment');
});

test('attack follow-through and hit recoil pivot around the contact point',()=>{const v=paintedView(),a=spriteHero(v);a.recoil=.14;a.attackLean=-.06;v.updatePaintedActor(a,Math.PI,3);a.root.updateMatrixWorld(true);const f=frames.hero.frames[3][3],h=a.billboardHeight;const foot=new T.Vector3((f.anchorX-.5)*h,(.5-f.anchorY)*h,0);a.billboard.localToWorld(foot);assert.ok(foot.length()<1e-6);assert.ok(Math.abs(a.billboard.quaternion.dot(v.camera.quaternion))<.9999,'body must visibly lean while the contact stays fixed');});

test('quality sample adds solid road detail in the opening area without blocking the route',()=>{const v=paintedView();v.buildWorld([new T.Texture(),new T.Texture(),new T.Texture(),new T.Texture()]);const sample=v.qualitySample;assert.ok(sample);const slabs=sample.getObjectByName('bevelled-wet-flagstones');assert.equal(slabs.count,330);assert.ok(slabs.receiveShadow&&slabs.castShadow);const matrix=new T.Matrix4(),position=new T.Vector3();for(let i=0;i<slabs.count;i++){slabs.getMatrixAt(i,matrix);position.setFromMatrixPosition(matrix);assert.ok(position.z>45&&position.z<71);assert.ok(Array.from(matrix.elements).every(Number.isFinite));}assert.equal(sample.children.filter(o=>o.name==='rain-puddle').length,11);assert.equal(sample.getObjectByName('wind-swept-verge').count,3600);assert.equal(sample.children.filter(o=>o.name==='drifting-ground-mist').length,3);for(let y=3440;y<4100;y+=40){const x=800+Math.sin(y*.0024)*105;assert.equal(v.canWalk(x,y),true);}});
test('painted actors receive scene lighting and both transition poses share keyed transparency',()=>{const v=paintedView(),a=spriteHero(v);assert.ok(a.billboard.material.isMeshStandardMaterial);assert.ok(a.billboard.receiveShadow);v.updatePaintedActor(a,-Math.PI/2,0);for(let i=0;i<8;i++)v.updatePaintedActor(a,0,0,0,1/60);assert.ok(a.previousPose.material.isMeshStandardMaterial);assert.equal(a.previousPose.material.onBeforeCompile,a.billboard.material.onBeforeCompile);assert.ok(a.previousPose.receiveShadow);const shader={fragmentShader:'#include <map_fragment>'};a.billboard.material.onBeforeCompile(shader);assert.ok(shader.fragmentShader.includes('diffuseColor.a *= 1.0 - keyed'));});

test('replacement atlas metadata matches the actual bundled PNG dimensions',()=>{for(const [name,sheet]of Object.entries(frames)){const png=fs.readFileSync(new URL('../public/art/'+name+'.png',import.meta.url));assert.equal(png.readUInt32BE(16),sheet.width,name+' width');assert.equal(png.readUInt32BE(20),sheet.height,name+' height');}});
test('realistic trees preserve chroma gaps, receive light and bend only above their roots',()=>{const v=paintedView();v.buildPaintedForest(()=>.45);const tree=v.paintedTrees[0];assert.ok(tree.material.isMeshStandardMaterial&&tree.receiveShadow);const shader={uniforms:{},vertexShader:'#include <begin_vertex>',fragmentShader:'#include <map_fragment>'};tree.material.onBeforeCompile(shader);assert.ok(shader.vertexShader.includes('max(0.,uv.y-rootV)'));assert.ok(shader.uniforms.rootV.value>=0&&shader.uniforms.rootV.value<=1);assert.ok(shader.fragmentShader.includes('diffuseColor.a *= 1.0 - keyed'));});

test('game hound uses articulated 3D geometry even when the rejected photo atlas is available',()=>{const v=paintedView(),a=v.createActor('beast');assert.ok(a.beastRig);assert.equal(a.billboard,undefined);assert.equal(a.beastRig.limbs.length,4);let shadowMeshes=0;a.root.traverse(o=>{if(o.isMesh){if(o.castShadow)shadowMeshes++;for(const n of o.geometry.getAttribute('position').array)assert.ok(Number.isFinite(n));}});assert.ok(shadowMeshes>20);});
test('hound feet remain near the ground during stance and articulated joints stay continuous',()=>{const v=paintedView(),a=v.createActor('beast');let previous=null;for(let i=0;i<180;i++){v.updateWolf(a,Math.PI/2,1/60,.03,true,0,Infinity);a.root.updateMatrixWorld(true);const feet=a.beastRig.limbs.map(l=>l.paw.getWorldPosition(new T.Vector3()));for(const p of feet){assert.ok(p.y>=.03&&p.y<.22);assert.ok(Number.isFinite(p.x));}if(previous)for(let j=0;j<4;j++)assert.ok(feet[j].distanceTo(previous[j])<.17,'no pose snapping at frame '+i+': '+feet[j].distanceTo(previous[j]));previous=feet;}v.updateWolf(a,Math.PI/2,1/60,0,false,.12,Infinity);a.root.updateMatrixWorld(true);assert.ok(a.beastRig.body.position.y<0);for(let i=1;i<=10;i++)v.updateWolf(a,Math.PI/2,.015,0,false,0,i*.015);assert.ok(a.beastRig.body.position.z>.25);assert.ok(a.beastRig.jaw.rotation.x>.3);for(let i=0;i<120;i++)v.updateWolf(a,Math.PI/2,1/60,0,false,0,Infinity);assert.ok(a.motionWeight<.001);assert.ok(Math.abs(a.beastRig.body.position.y)<.001);});

function eightDirectionView(){const v=paintedView();v.art.set('hero_diagonal',new T.Texture());return v;}
test('hero selects eight distinct headings with genuine diagonal frames for idle, run and attack',()=>{const v=eightDirectionView(),a=spriteHero(v);for(let row=0;row<4;row++)for(let direction=0;direction<8;direction++){v.updatePaintedActor(a,-Math.PI/2+direction*Math.PI/4,row);const name=direction%2?'hero_diagonal':'hero',f=frames[name].frames[row][Math.floor(direction/2)];assert.equal(a.visualColumn,direction);assert.equal(a.atlas.source,v.art.get(name).source);assert.equal(a.billboard.userData.frame,f);a.root.updateMatrixWorld(true);const h=a.billboardHeight,foot=new T.Vector3((f.anchorX-.5)*h,(.5-f.anchorY)*h,0);a.billboard.localToWorld(foot);assert.ok(foot.length()<1e-6);}});
test('cardinal to diagonal blending retains both atlas sources and settles without boundary flapping',()=>{const v=eightDirectionView(),a=spriteHero(v);v.updatePaintedActor(a,-Math.PI/2,0);let crossed=false;for(let i=0;i<30;i++){v.updatePaintedActor(a,-Math.PI/4,0,0,1/60);if(a.visualColumn===1&&!crossed){crossed=true;assert.equal(a.previousPose.material.map.source,v.art.get('hero').source);assert.equal(a.atlas.source,v.art.get('hero_diagonal').source);}}assert.ok(crossed);assert.equal(a.visualColumn,1);assert.equal(a.poseBlend,1);assert.equal(a.previousPose.visible,false);for(let i=0;i<30;i++)v.updatePaintedActor(a,-Math.PI/8+(i%2?.02:-.02),0,0,1/60);assert.equal(a.visualColumn,1);});

test('live hero is a lit articulated 3D character with silver hair, cape and one equipped sword',()=>{const v=paintedView(),a=v.createActor('hero');assert.ok(a.heroRig);assert.equal(a.billboard,undefined);assert.equal(a.heroRig.arms.length,2);assert.equal(a.heroRig.legs.length,2);assert.equal(a.root.getObjectByName('hero-long-sword'),a.heroRig.sword);assert.equal(a.heroRig.sword.parent,a.heroRig.arms[1].hand);a.root.updateMatrixWorld(true);const size=new T.Box3().setFromObject(a.root).getSize(new T.Vector3());assert.ok(size.y>2.3&&size.y<3.2);a.root.traverse(o=>{if(o.isMesh){assert.ok(o.castShadow&&o.receiveShadow);for(const n of o.geometry.getAttribute('position').array)assert.ok(Number.isFinite(n));}});});
test('3D hero resolves arbitrary headings, keeps feet grounded, and animates sword and anchored cloth',()=>{const v=paintedView(),a=v.createActor('hero'),target=.297;for(let i=0;i<120;i++)v.updateHeroRig(a,target,1/60,.035,true,i/60,null);assert.ok(Math.abs(a.root.rotation.y-(Math.PI/2-target))<1e-6);assert.ok(a.motionWeight>.99);a.root.updateMatrixWorld(true);for(const l of a.heroRig.legs){const p=l.paw.getWorldPosition(new T.Vector3());assert.ok(p.y>=.025&&p.y<.46);}const swordBefore=a.heroRig.sword.getWorldPosition(new T.Vector3());v.updateHeroRig(a,target,1/60,0,false,2.1,{progress:.5,combo:2});a.root.updateMatrixWorld(true);assert.ok(a.heroRig.sword.getWorldPosition(new T.Vector3()).distanceTo(swordBefore)>.3);const cloth=a.heroRig.cape,points=cloth.geometry.getAttribute('position'),rest=cloth.userData.rest;for(let i=0;i<points.count;i++)if(Math.abs(rest[i*3+1]-1.98)<1e-5){assert.ok(Math.abs(points.getX(i)-rest[i*3])<1e-6);assert.ok(Math.abs(points.getZ(i)-rest[i*3+2])<1e-6);}for(let i=0;i<120;i++)v.updateHeroRig(a,-Math.PI+.01,1/60,0,false,3+i/60,null);assert.ok(a.motionWeight<.001);assert.ok(Math.abs(a.heroRig.body.position.y)<.001);});

test('3D hero has distinct sword-wave, spin and dash poses and returns to neutral',()=>{const v=paintedView(),a=v.createActor('hero');a.skillPose={kind:'cast',progress:.5};v.updateHeroRig(a,0,.016,0,false,1,null);assert.ok(a.heroRig.arms[1].shoulder.rotation.z>.6);a.skillPose={kind:'spin',progress:.5};v.updateHeroRig(a,0,.016,0,false,1.1,null);assert.ok(Math.abs(a.heroRig.torso.rotation.y-Math.PI)<1e-6);a.skillPose={kind:'dash',progress:.5};v.updateHeroRig(a,0,.016,0,false,1.2,null);assert.ok(a.heroRig.waist.rotation.x>.15);a.skillPose=undefined;v.updateHeroRig(a,0,.016,0,false,1.3,null);assert.equal(a.heroRig.torso.rotation.y,0);assert.equal(a.heroRig.waist.rotation.x,0);});

test('Z slash and X thrust have distinct weapon paths and recover to the same guard',()=>{const v=paintedView(),a=v.createActor('hero');const tip=()=>{a.root.updateMatrixWorld(true);return a.heroRig.sword.localToWorld(new T.Vector3(0,-1.12,0));};const paths=[];for(let combo=0;combo<3;combo++){a.skillPose=undefined;v.updateHeroRig(a,0,.016,0,false,1,{progress:.36,combo});paths.push(tip());}assert.ok(paths[0].distanceTo(paths[1])>.2);assert.ok(paths[0].distanceTo(paths[2])>.2);a.skillPose={kind:'cast',progress:.29};v.updateHeroRig(a,0,.016,0,false,1,null);assert.ok(tip().distanceTo(paths[0])>.2);assert.ok(a.heroRig.sword.userData.runeMaterial.emissiveIntensity>1);a.skillPose={kind:'cast',progress:1};v.updateHeroRig(a,0,.016,0,false,1,null);const rest=tip();a.skillPose=undefined;v.updateHeroRig(a,0,.016,0,false,1,{progress:1,combo:0});assert.ok(tip().distanceTo(rest)<1e-6);assert.ok(a.root.getObjectByName('hero-cross-body-strap'));});

test('running uses a forward waist lean, high recovery steps and genuine airborne phases',()=>{const v=paintedView(),a=v.createActor('hero');a.motionWeight=1;let airborne=0,grounded=0,maxLift=0;for(let i=0;i<120;i++){v.updateHeroRig(a,0,1/120,2.4/120,true,i/120,null);a.root.updateMatrixWorld(true);const feet=a.heroRig.legs.map(l=>l.paw.getWorldPosition(new T.Vector3()).y);if(feet.every(y=>y>.08))airborne++;if(feet.some(y=>Math.abs(y-.04)<.005))grounded++;maxLift=Math.max(maxLift,...feet);assert.ok(feet.every(y=>y>=.035));}assert.ok(airborne>10,'run must include flight between contacts');assert.ok(grounded>50);assert.ok(maxLift>.35);assert.ok(a.heroRig.waist.rotation.x>.25);assert.ok(a.heroRig.arms[0].elbow.rotation.x< -1);assert.equal(a.heroRig.head.parent,a.heroRig.torso);assert.equal(a.heroRig.cape.parent,a.heroRig.torso);});
test('sword ribbon follows actual blade endpoints and expires after the swing',()=>{const v=paintedView(),a=v.createActor('hero');for(let i=0;i<5;i++){v.updateHeroRig(a,0,.016,0,false,1+i*.016,{progress:.2+i*.05,combo:0});v.sampleSwordTrail(a,1+i*.016,true);const last=v.swordTrail.at(-1);const actual=a.heroRig.sword.localToWorld(new T.Vector3(0,-1.12,0));assert.ok(last.far.distanceTo(actual)<1e-6);}assert.equal(v.swordTrail.length,5);v.sampleSwordTrail(a,1.064,true);assert.equal(v.swordTrail.length,5);v.sampleSwordTrail(a,1.3,false);assert.equal(v.swordTrail.length,0);});

test('map sectors retain all instances and collision while culling distant scenery in either direction',()=>{
  const v=paintedView();v.buildWorld([new T.Texture(),new T.Texture(),new T.Texture(),new T.Texture()]);
  const count=()=>{let n=0;v.terrain.traverse(o=>{if(o.isInstancedMesh)n+=o.count;});return n;};
  const before=count(),collision=JSON.stringify(v.colliders);v.partitionWorld();
  assert.equal(count(),before);assert.equal(JSON.stringify(v.colliders),collision);
  assert.ok(v.worldChunks.length>4);
  for(const z of [64,-55,64]){v.updateWorldChunks(z);assert.ok(v.worldChunks.some(c=>!c.group.visible));assert.ok(v.worldChunks.some(c=>c.group.visible));for(const c of v.worldChunks)if(c.min<=z+15&&c.max>=z-15)assert.ok(c.group.visible,'viewport sectors must remain ready');}
});
test('combat arcs reuse GPU geometry and buffers across radius and sweep changes',()=>{
  const v=view();v.effectPool=[];v.poolIndex=0;
  const first=v.pooled(v.effectArc(.8,1,60,0,2),'#ffffff',1),geometry=first.geometry,buffer=geometry.getAttribute('position');
  for(let i=0;i<100;i++){v.poolIndex=0;const mesh=v.pooled(v.effectArc(.5,2,48,i*.02,3),'#ffffff',.5);assert.equal(mesh.geometry,geometry);assert.equal(mesh.geometry.getAttribute('position'),buffer);assert.equal(mesh.geometry.drawRange.count,288);}
  for(const n of buffer.array)assert.ok(Number.isFinite(n));
});
test('adaptive resolution is bounded and ignores pauses or long background frames',()=>{
  const v=view();let changes=0;globalThis.window??={};window.devicePixelRatio=2;
  Object.assign(v,{renderScale:1.25,frameAverage:16.7,frameSampleAt:0,scaleChangedAt:0,frameSamples:0,renderer:{setPixelRatio(){changes++;}},composer:{setPixelRatio(){}}});
  for(let t=33;t<25000;t+=33)v.updateRenderBudget(t,true);
  assert.ok(v.renderScale<1.25&&v.renderScale>=.75);const scale=v.renderScale,before=changes;
  v.updateRenderBudget(40000,true);v.updateRenderBudget(40016,false);assert.equal(changes,before);assert.equal(v.renderScale,scale);
});

test('village uses its own houses and ground, hides forest and restores it when returning',()=>{
 const v=paintedView(),maps=[new T.Texture(),new T.Texture(),new T.Texture(),new T.Texture()];
 v.buildWorld(maps);v.buildCampaignScenery();v.buildVillage(maps,new T.Texture());v.fireflies=new T.Points();v.sun=new T.DirectionalLight();v.scene.background=new T.Color();v.scene.fog=new T.Fog('#000000',24,76);
 for(const stage of [0,1,0]){v.updateChapterScenery({stage,clock:2,used:new Set(),player:{x:800,y:3930}},new T.Vector3());assert.equal(v.terrain.visible,stage===0);assert.equal(v.village.visible,stage===1);assert.equal(v.fireflies.visible,stage===0);}
 assert.equal(v.villageChunks.filter(g=>g.name==='village-house').length,14);assert.ok(v.village.getObjectByName('painted-village-buildings-v2-0'));assert.equal(v.villagers.length,3);
});

test('retired actors release geometry, material and atlas registrations instead of accumulating per chapter',()=>{
 const v=paintedView(),before={g:v.geometries.size,m:v.materials.size,t:v.textures.length};
 for(let i=0;i<8;i++){const a=v.createActor('archer');v.scene.add(a.root);v.disposeActor(a);}
 assert.equal(v.geometries.size,before.g);assert.equal(v.materials.size,before.m);assert.equal(v.textures.length,before.t);
});

test('village art shares forest assets while keeping roofs, fading and chunk culling coherent',()=>{
 const v=paintedView(),maps=Array.from({length:4},()=>new T.Texture());v.buildWorld(maps);const source=v.paintedTrees[0];v.buildVillage(maps,new T.Texture());
 const edge=v.village.getObjectByName('village-forest-edge').children[0];assert.equal(edge.geometry,source.geometry);assert.equal(edge.material,source.material);assert.ok(v.village.getObjectByName('forest-to-village-threshold'));
 const houses=v.villageChunks.filter(g=>g.name==='village-house');
 for(const house of houses){const art=house.children.find(o=>o.name.startsWith('painted-village-buildings'));assert.ok(art);assert.equal(art.material.map.source,v.art.get('village-buildings-v2').source);assert.ok(house.userData.fadeMaterials.includes(art.material));assert.ok(house.getObjectByName('soft-contact-shadow'));const {x,y,w,h}=art.userData.crop;assert.ok(x>=0&&y>=0&&x+w<=1254&&y+h<=1254);}
 const lamps=v.lamps.filter(l=>l.stage===1);assert.equal(lamps.length,10);for(const lamp of lamps)assert.equal(lamp.group.parent,v.village);
 v.fireflies=new T.Points();v.sun=new T.DirectionalLight();v.scene.background=new T.Color();v.scene.fog=new T.Fog('#000',24,76);
 const b=houses[0].userData.building;v.updateChapterScenery({stage:1,clock:1,used:new Set(),player:{x:b.x,y:b.y-b.d/2-20}},houses[0].position);
 for(const m of houses[0].userData.fadeMaterials)assert.ok(m.opacity<1);
 v.updateChapterScenery({stage:1,clock:1,used:new Set(),player:{x:800,y:3930}},new T.Vector3(0,0,1000));for(const g of v.villageChunks)assert.equal(g.visible,false);
});

test('new village atlases stay local, use keyed edges and keep scenery feet on the ground',()=>{
 const v=paintedView();
 for(const [sheet,count] of [['village-buildings-v2',4],['village-props-v2',6]]){
  const png=fs.readFileSync(new URL('../public/art/'+sheet+'.png',import.meta.url));assert.equal(png.readUInt32BE(16),1254);assert.equal(png.readUInt32BE(20),1254);
  for(let i=0;i<count;i++){const group=new T.Group(),sprite=v.villageSprite(sheet,i,5,group,2,3);group.updateMatrixWorld(true);const foot=sprite.localToWorld(new T.Vector3(0,sprite.userData.height*(.5-sprite.userData.anchor),0));assert.ok(foot.distanceTo(new T.Vector3(2,.04,3))<1e-7);assert.equal(sprite.material.userData.chromaKey,true);const shader={fragmentShader:'#include <map_fragment>\n#include <alphatest_fragment>'};sprite.material.onBeforeCompile(shader);assert.ok(shader.fragmentShader.indexOf('float keyed')<shader.fragmentShader.indexOf('alphatest_fragment'));}
 }
});

test('cohesion pass shares road material source and closes the former cracked rock mesh',()=>{
 const v=paintedView(),maps=Array.from({length:4},()=>new T.Texture());v.buildWorld(maps);v.buildVillage(maps,new T.Texture());
 const road=v.terrain.children.find(o=>o.isMesh&&o.geometry.getAttribute('position').count===272),lane=v.village.getObjectByName('winding-village-lane');assert.equal(road.material.map.source,lane.material.map.source);
 const rocks=v.terrain.children.find(o=>o.isInstancedMesh&&o.count===540),geo=rocks.geometry,indices=geo.index.array,edges=new Map();assert.ok(indices.length>0);
 for(let i=0;i<indices.length;i+=3)for(let j=0;j<3;j++){const a=indices[i+j],b=indices[i+(j+1)%3],key=Math.min(a,b)+','+Math.max(a,b);edges.set(key,(edges.get(key)||0)+1);}for(const count of edges.values())assert.equal(count,2,'closed rock edges');
 for(const house of v.villageChunks.filter(g=>g.name==='village-house')){assert.ok(house.getObjectByName('weathered-house-apron'));assert.ok(house.getObjectByName('foundation-rubble'));for(const material of house.userData.fadeMaterials){assert.equal(material.emissiveMap,null,'unkeyed source must not reappear through emission');}}
});

test('prisoners occupy the actual cage and exit through its opened door after rescue',()=>{
 const v=paintedView(),maps=Array.from({length:4},()=>new T.Texture());v.buildWorld(maps);v.buildCampaignScenery();v.buildVillage(maps,new T.Texture());
 v.fireflies=new T.Points();v.sun=new T.DirectionalLight();v.scene.background=new T.Color();v.scene.fog=new T.Fog('#000',24,76);
 const cage=v.village.getObjectByName('village-prop-囚笼');const door=cage.getObjectByName('rescue-cage-door');assert.ok(door);
 const captives=v.villagers.filter(n=>n.root.name==='captive-villager');assert.equal(captives.length,2);
 v.scene.updateMatrixWorld(true);const before=captives.map(n=>n.root.getWorldPosition(new T.Vector3()));
 const center=cage.getWorldPosition(new T.Vector3());for(const position of before){assert.ok(Math.abs(position.x-center.x)<.7);assert.ok(Math.abs(position.z-center.z)<.5);}
 const game={stage:1,clock:1,used:new Set(),player:{x:535,y:2050}};v.updateChapterScenery(game,center);assert.equal(door.rotation.y,0);
 game.used.add(1);for(let i=0;i<120;i++)v.updateChapterScenery(game,center);
 assert.ok(door.rotation.y < -1);v.scene.updateMatrixWorld(true);
 captives.forEach((n,i)=>assert.ok(n.root.getWorldPosition(new T.Vector3()).z-before[i].z>2.8));
 game.used.clear();for(let i=0;i<120;i++)v.updateChapterScenery(game,center);assert.equal(door.rotation.y,0);
 assert.ok(v.terrain.getObjectByName('patrol-orders'));assert.ok(v.terrain.getObjectByName('camp-supplies'));
 for(const marker of v.siteMarkers){assert.ok(marker.mesh.getObjectByName('interaction-beacon'));}
});
