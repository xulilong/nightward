import { villageBuildings, villageSites, forestSites, villageProps, villageRoads, villageFireSites } from './levels';
import * as T from 'three';
import { type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { NightGame, GameView } from './game';

const S=.035, TAU=Math.PI*2;
const wx=(x:number)=>(x-800)*S, wz=(y:number)=>(y-2100)*S;
const pathX=(y:number)=>800+Math.sin(y*.0024)*105;
function rng(seed:number){return()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return(seed>>>0)/4294967296;};}
type ArtFrame={x:number;y:number;w:number;h:number;anchorX:number;anchorY:number};
type ArtSheet={width:number;height:number;frames:ArtFrame[][]};
type Actor={skillPose?:{kind:'cast'|'spin'|'dash';progress:number};heroRig?:{waist:T.Group;body:T.Group;torso:T.Group;head:T.Group;arms:{shoulder:T.Group;elbow:T.Group;hand:T.Group;side:number}[];legs:{hip:T.Vector3;upper:T.Mesh;lower:T.Mesh;paw:T.Group;side:number}[];cape:T.Mesh;ribbons:T.Mesh[];sword:T.Group};desiredHeading?:number;beastCrouch?:number;beastRig?:{body:T.Group;head:T.Group;jaw:T.Group;tail:T.Group;limbs:{hip:T.Vector3;upper:T.Mesh;lower:T.Mesh;paw:T.Group;front:boolean;side:number}[]};lastHP?:number;recoil?:number;attackLean?:number;previousPose?:T.Mesh;poseKey?:string;poseBlend?:number;visualAngle?:number;visualColumn?:number;stride?:number;motionWeight?:number;billboard?:T.Mesh;billboardHeight?:number;atlas?:T.Texture;atlasRow?:number;root:T.Group;mixer?:T.AnimationMixer;actions:Map<string,T.AnimationAction>;current:string;until:number;lastAtk:number;lastX:number;lastY:number;legs:T.Object3D[];bar?:T.Group;fill?:T.Mesh;kind:string;deadAt?:number;materials:T.MeshStandardMaterial[]};
type Lamp={group:T.Group;fire:T.Mesh;light:T.PointLight;kind:'route'|'camp'|'end';stage?:number};

/** WebGL presentation shares the tested world coordinates and combat simulation. */
export class NightView implements GameView {
  scene=new T.Scene();camera=new T.OrthographicCamera(-20,20,11,-11,.1,180);
  renderer:T.WebGLRenderer;composer:EffectComposer;sun:T.DirectionalLight;environment:T.WebGLRenderTarget;
  art=new Map<string,T.Texture>();frames:Record<string,ArtSheet>={};paintedTrees:T.Mesh[]=[];models=new Map<string,GLTF>();textures:T.Texture[]=[];actors=new Map<number,Actor>();hero:Actor|null=null;
  village=new T.Group();villageChunks:T.Group[]=[];villageFires:{mesh:T.Mesh;id:number}[]=[];villagers:{root:T.Group;id:number}[]=[];forestPeople:{root:T.Group;id:number}[]=[];
  siteMarkers:{mesh:T.Mesh;stage:number;id:number;x:number;y:number}[]=[];
  villageSmoke:{mesh:T.Points;id:number}[]=[];
  actorReserve=new Map<string,Actor[]>();
  themedStage=-1;chapterStructures:T.Group[]=[];relayMarkers:T.Mesh[]=[];weather?:T.Points;
  worldChunks:{group:T.Group;min:number;max:number}[]=[];
  routeLights:T.PointLight[]=[];
  renderScale=1;frameAverage=16.7;frameSampleAt=0;scaleChangedAt=0;frameSamples=0;
  qualitySample?:T.Group;sampleTime={value:0};
  terrain=new T.Group();effects=new T.Group();lamps:Lamp[]=[];grass:T.InstancedMesh|null=null;water:T.Mesh|null=null;
  targetRing:T.Mesh;heroRing:T.Mesh;heroLight:T.PointLight;fireflies:T.Points;
  lastPlayer?:NightGame['player'];size={w:0,h:0};needsRender=true;lastClock=0;lastMode='';disposed=false;frame=0;
  geometries=new Set<T.BufferGeometry>();materials=new Set<T.Material>();colliders:{x:number;y:number;r:number}[]=[];
  particleGeometry=new T.BufferGeometry();particlePositions=new Float32Array(1200*3);particleColors=new Float32Array(1200*3);particles:T.Points;
  swordTrail:{near:T.Vector3;far:T.Vector3;time:number}[]=[];numberLabels=new Map<object,T.Sprite>();effectPool:T.Mesh[]=[];poolIndex=0;
  raycaster=new T.Raycaster();plane=new T.Plane(new T.Vector3(0,1,0),0);observer:ResizeObserver;
  constructor(public canvas:HTMLCanvasElement){
    this.renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
    this.renderScale=Math.min(window.devicePixelRatio||1,1.25);this.renderer.setPixelRatio(this.renderScale);this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFSoftShadowMap;
    this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.02;this.renderer.outputColorSpace=T.SRGBColorSpace;
    this.scene.background=new T.Color('#1c343c');this.scene.fog=new T.Fog('#284852',24,76);
    this.scene.add(new T.HemisphereLight('#99bfcc','#263b35',1.25));
    this.sun=new T.DirectionalLight('#bddeec',1.7);this.sun.position.set(-14,27,9);this.sun.castShadow=true;this.sun.shadow.mapSize.set(1024,1024);Object.assign(this.sun.shadow.camera,{left:-23,right:23,top:23,bottom:-23,near:1,far:80});this.sun.shadow.bias=-.00025;this.sun.shadow.normalBias=.045;this.sun.shadow.radius=3;this.scene.add(this.sun,this.sun.target);
    const rim=new T.DirectionalLight('#548b9d',.7);rim.position.set(13,14,-13);this.scene.add(rim);
    const pmrem=new T.PMREMGenerator(this.renderer),room=new RoomEnvironment();this.environment=pmrem.fromScene(room,.04);this.scene.environment=this.environment.texture;this.scene.environmentIntensity=.15;room.dispose();pmrem.dispose();
    this.scene.add(this.terrain,this.effects);
    const target=new T.WebGLRenderTarget(1,1,{samples:2,type:T.HalfFloatType});this.composer=new EffectComposer(this.renderer,target);this.composer.addPass(new RenderPass(this.scene,this.camera));this.composer.addPass(new UnrealBloomPass(new T.Vector2(1024,768),.13,.28,1.55));this.composer.addPass(new OutputPass());
    this.targetRing=this.ring(1,.028,'#e8c875',.8);this.heroRing=this.ring(.58,.035,'#8bded7',.65);this.scene.add(this.targetRing,this.heroRing);
    this.heroLight=new T.PointLight('#ffca80',4,5,2);this.scene.add(this.heroLight);for(let i=0;i<3;i++){const light=new T.PointLight('#ffd090',0,9,2);this.routeLights.push(light);this.scene.add(light);}
    const fireflyGeo=new T.BufferGeometry(),positions=new Float32Array(320*3),r=rng(66);for(let i=0;i<320;i++){positions[i*3]=(r()-.5)*48;positions[i*3+1]=.4+r()*4;positions[i*3+2]=(r()-.5)*150;}fireflyGeo.setAttribute('position',new T.BufferAttribute(positions,3));this.fireflies=new T.Points(fireflyGeo,new T.PointsMaterial({color:'#e1eaba',size:.065,transparent:true,opacity:.7,blending:T.AdditiveBlending,depthWrite:false}));this.scene.add(this.fireflies);
    this.particleGeometry.setAttribute('position',new T.BufferAttribute(this.particlePositions,3).setUsage(T.DynamicDrawUsage));this.particleGeometry.setAttribute('color',new T.BufferAttribute(this.particleColors,3).setUsage(T.DynamicDrawUsage));this.particles=new T.Points(this.particleGeometry,new T.PointsMaterial({size:.075,vertexColors:true,transparent:true,opacity:.9,blending:T.AdditiveBlending,depthWrite:false}));this.particles.frustumCulled=false;this.scene.add(this.particles);
    this.camera.position.set(0,27,22);this.camera.lookAt(0,0,0);this.camera.updateMatrixWorld();
    this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(canvas);this.resize();
  }
  resize(){if(this.disposed)return;const {width,height}=this.canvas.getBoundingClientRect();const w=Math.max(1,Math.round(width)),h=Math.max(1,Math.round(height));if(w===this.size.w&&h===this.size.h)return;this.size={w,h};this.needsRender=true;this.renderer.setSize(w,h,false);this.composer.setSize(w,h);const half=10.2;this.camera.left=-half*w/h;this.camera.right=half*w/h;this.camera.top=half;this.camera.bottom=-half;this.camera.updateProjectionMatrix();}
  async load(progress:(value:number)=>void){
    const metadata=await fetch('./art/frames.json');if(!metadata.ok)throw new Error('画面素材信息加载失败');this.frames=await metadata.json();
    const loader=new T.TextureLoader();let count=0;const advance=()=>progress(Math.round(++count/10*88));
    const artPromise=Promise.all(['forest','enemies','village-buildings-v2','village-props-v2'].map(async name=>{const t=await loader.loadAsync('./art/'+name+'.png');t.colorSpace=T.SRGBColorSpace;t.anisotropy=4;this.textures.push(t);this.art.set(name,t);advance();}));
    const texturePromise=Promise.all(['forest_ground_04_diff','forest_ground_04_nor_gl','mossy_cobblestone_diff','mossy_cobblestone_nor_gl'].map(async name=>{const t=await loader.loadAsync('./textures/'+name+'.jpg');t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=Math.min(8,this.renderer.capabilities.getMaxAnisotropy());if(name.endsWith('diff'))t.colorSpace=T.SRGBColorSpace;this.textures.push(t);advance();return t;}));
    const roofPromise=loader.loadAsync('./textures/burned-oak-v1.png').then(t=>{t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;this.textures.push(t);advance();return t;});
    const villageGroundPromise=loader.loadAsync('./textures/village-wet-stone-v2.png').then(t=>{t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=4;this.textures.push(t);this.art.set('village-wet-stone-v2',t);advance();});
    const [,maps,roof]=await Promise.all([artPromise,texturePromise,roofPromise,villageGroundPromise]);if(this.disposed)return;this.buildWorld(maps);this.buildCampaignScenery();this.buildVillage(maps,roof);this.hero=this.createActor('hero');this.scene.add(this.hero.root);
    const warmActors:Actor[]=[];
    for(const kind of ['beast','beast','archer','shield','elite','boss']){
      const actor=this.createActor(kind);warmActors.push(actor);this.scene.add(actor.root);
      await new Promise<void>(resolve=>setTimeout(resolve,0));if(this.disposed)return;
    }
    // Upload shared art and compile materials before entering gameplay.
    for(const texture of this.textures){if(this.disposed)return;this.renderer.initTexture(texture);await new Promise<void>(resolve=>setTimeout(resolve,0));}
    await this.renderer.compileAsync(this.scene,this.camera);if(this.disposed)return;
    for(const actor of warmActors){actor.root.removeFromParent();if(!this.actorReserve.has(actor.kind))this.actorReserve.set(actor.kind,[]);this.actorReserve.get(actor.kind)!.push(actor);}
    this.partitionWorld();this.updateWorldChunks(wz(3930));progress(100);
  }
  civilian(parent:T.Group,x:number,y:number,color:string){
    const root=new T.Group();root.position.set(wx(x),.1,wz(y));parent.add(root);
    const cloth=this.mat(color,.98),skin=this.mat('#bca98c',.9),boot=this.mat('#302b25',1);
    this.mesh(new T.ConeGeometry(.3,1.05,8),cloth,root,0,.75,0);this.sphere(root,skin,0,1.46,0,.17,.21,.17);
    this.box(root,boot,-.14,.13,0,.17,.3,.27);this.box(root,boot,.14,.13,0,.17,.3,.27);
    return root;
  }
  buildCampaignScenery(){
    this.chapterStructures=[];this.relayMarkers=[];this.forestPeople=[];this.siteMarkers=[];this.addSiteMarkers(0,this.terrain);
    this.forestPeople.push({root:this.civilian(this.terrain,1050,2910,'#665640'),id:0});
    this.civilian(this.terrain,840,1340,'#455970').name='aelin-at-camp';
    const leather=this.mat('#542c28',.97),wood=this.mat('#574b3c');
    const tent=new T.Group();tent.position.set(wx(1090),0,wz(2900));this.terrain.add(tent);
    const cover=this.mesh(new T.ConeGeometry(1.35,1.65,4,1,true),leather,tent,0,.95,0);cover.rotation.y=Math.PI/4;cover.scale.z=1.6;
    this.box(tent,wood,0,.85,-1.8,.06,1.7,.08);this.box(tent,wood,0,.85,1.8,.06,1.7,.08);
    const clue=this.terrain.getObjectByName('fire-shard') as T.Mesh;if(clue){clue.material=this.mat('#b4a47c',.8,.2);clue.scale.set(.7,.18,.7);clue.position.y=.22;clue.name='patrol-medallion';}
    const groundMat=this.mat('#502622',1);
    for(const [x,y] of [[790,3640],[830,3480],[995,3020],[670,1920]]){const stain=this.mesh(new T.CircleGeometry(.13,8),groundMat,this.terrain,wx(x),.04,wz(y));stain.rotation.x=-Math.PI/2;stain.scale.x=1.7;}
  }
  buildVillage(maps:T.Texture[],roofTexture:T.Texture){
    this.village=new T.Group();this.village.name='ash-village-independent-map';this.scene.add(this.village);this.villageChunks=[];this.villageFires=[];this.villagers=[];this.villageSmoke=[];
    const ground=this.mat('#718077',.96);ground.map=maps[0];ground.normalMap=maps[1];ground.normalScale.set(.4,.4);
    const floor=this.mesh(new T.PlaneGeometry(70,172),ground,this.village,0,-.14,1);floor.rotation.x=-Math.PI/2;
    this.buildVillageRoads(maps[2]);
    const wood=new T.MeshStandardMaterial({map:roofTexture,color:'#807461',roughness:.94});this.materials.add(wood);
    const stone=this.mat('#82948a',.85);
    for(const b of villageBuildings){
      const g=new T.Group();g.position.set(wx(b.x),0,wz(b.y));g.name='village-house';g.userData.building=b;this.village.add(g);this.villageChunks.push(g);
      this.buildVillageHouse(g,b);
    }
    for(const prop of villageProps){
      const g=new T.Group();g.name='village-prop-'+prop.name;g.position.set(wx(prop.x),0,wz(prop.y));g.userData.building=prop;
      this.village.add(g);this.villageChunks.push(g);
      const sprite=this.villageSprite('village-props-v2',prop.frame,prop.w*S*1.05,g,0,prop.d*S/2);g.userData.fadeMaterials=[sprite.material];
      this.villageContactShadow(g,prop.w*S,prop.d*S);
    }
    this.buildVillageBorders(stone);this.addSiteMarkers(1,this.village);
    const metal=this.mat('#66695c',.62,.65);
    const fireMaterial=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,uniforms:{time:this.sampleTime},vertexShader:'varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`varying vec2 v;uniform float time;void main(){float x=v.x-.5+sin(v.y*9.-time*7.)*.09*v.y+sin(v.y*21.+time*4.)*.025;float width=(1.-v.y)*.43;float edge=1.-smoothstep(width*.55,width+.025,abs(x));float flicker=.78+.22*sin(v.y*23.-time*11.);float a=edge*smoothstep(0.,.12,v.y)*(1.-smoothstep(.68,1.,v.y))*flicker;vec3 c=mix(vec3(.95,.56,.12),vec3(.65,.095,.012),v.y);gl_FragColor=vec4(c,a*.72);}`});this.materials.add(fireMaterial);
    for(const site of villageSites){
      const g=new T.Group();g.name='village-rescue-'+site.id;g.position.set(wx(site.x),0,wz(site.y));this.village.add(g);this.villageChunks.push(g);
      this.villagers.push({root:this.civilian(g,800,2100,site.id===0?'#795943':'#7d7666'),id:site.id});
      if(site.id!==1){this.mesh(new T.CylinderGeometry(.3,.3,.55,12),wood,g,-.9,.28,.5);const valve=this.mesh(new T.TorusGeometry(.24,.045,6,16),metal,g,-.9,.79,.5);valve.rotation.x=-.4;}
    }
    // Animated fire sits in the ruined architecture, not on every rescue NPC.
    const smokeMat=new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{time:this.sampleTime},vertexShader:`uniform float time;varying float fade;void main(){float phase=fract(time*.13+position.x);vec3 p=vec3(sin(position.x*12.+time*.4)*phase*.6,1.1+phase*3.3,phase*.3);gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);gl_PointSize=24.+phase*44.;fade=sin(phase*3.14159)*.08;}`,fragmentShader:`varying float fade;void main(){float d=length(gl_PointCoord-.5)*2.;gl_FragColor=vec4(.30,.34,.33,(1.-smoothstep(.1,1.,d))*fade);}`});this.materials.add(smokeMat);
    for(const [x,y,id] of [[1260,2780,0],[292,2840,0],[1260,2070,1],[310,1290,2],...villageFireSites.map(f=>[f.x,f.y,f.id])]){
      const g=new T.Group();g.position.set(wx(x),0,wz(y));this.village.add(g);this.villageChunks.push(g);
      for(let i=0;i<5;i++){const height=[.65,1.15,.85,1.35,.7][i];const fire=this.mesh(new T.PlaneGeometry(.36+height*.25,height),fireMaterial,g,(i-2)*.24,height*.5,.08*(i%2));fire.userData.phase=i*1.73+x*.01;fire.quaternion.copy(this.camera.quaternion);fire.castShadow=false;this.villageFires.push({mesh:fire,id});}
      const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(Array.from({length:24},(_,i)=>i%3===0?i/24:0),3));this.geometries.add(geo);const smoke=new T.Points(geo,smokeMat);smoke.frustumCulled=false;smoke.name='drifting-barn-smoke';g.add(smoke);this.villageSmoke.push({mesh:smoke,id});
    }
    const r=rng(742),geometry=new T.BufferGeometry(),positions=new Float32Array(100*3);
    for(let i=0;i<100;i++){positions[i*3]=(r()-.5)*38;positions[i*3+1]=r()*8;positions[i*3+2]=(r()-.5)*30;}
    geometry.setAttribute('position',new T.BufferAttribute(positions,3));this.weather=new T.Points(geometry,new T.PointsMaterial({color:'#cbbd9b',size:.025,transparent:true,opacity:.28,depthWrite:false}));this.weather.frustumCulled=false;this.scene.add(this.weather);
  }
  villageSprite(sheet:'village-buildings-v2'|'village-props-v2',frame:number,width:number,parent:T.Group,x=0,z=0){
    // Crop the original atlas on the GPU; source artwork stays untouched on disk.
    const crops=sheet==='village-buildings-v2'
      ? [[24,40,582,557],[660,80,570,510],[24,700,593,470],[670,635,548,595]]
      : [[110,0,465,460],[645,55,523,365],[87,459,520,337],[755,419,350,397],[79,824,492,381],[638,832,564,405]];
    const [cx,cy,cw,ch]=crops[frame],base=this.art.get(sheet);
    if(!base)throw new Error('村庄场景素材尚未加载：'+sheet);
    const material=this.atlasMaterial(base,1,1,0,0,true) as T.MeshStandardMaterial;
    material.map!.repeat.set(cw/1254,ch/1254);material.map!.offset.set(cx/1254,1-(cy+ch)/1254);
    material.roughness=.92;material.envMapIntensity=.08;material.color.set('#aeb9b4');material.emissiveIntensity=0;
    const height=width*ch/cw,geo=new T.PlaneGeometry(width,height),mesh=new T.Mesh(geo,material);this.geometries.add(geo);
    const up=new T.Vector3(0,1,0).applyQuaternion(this.camera.quaternion);
    mesh.position.set(x,.04,z);const anchor=sheet==='village-buildings-v2'?[.9623,.9431,.9362,.9412][frame]:[.99,.9808,.9852,.9798,.9816,.96][frame];mesh.position.addScaledVector(up,height*(anchor-.5));mesh.userData.anchor=anchor;mesh.quaternion.copy(this.camera.quaternion);mesh.receiveShadow=true;
    mesh.name='painted-'+sheet+'-'+frame;mesh.userData.crop={x:cx,y:cy,w:cw,h:ch};mesh.userData.width=width;mesh.userData.height=height;
    parent.add(mesh);return mesh;
  }
  villageContactShadow(parent:T.Group,w:number,d:number){
    const mat=new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{},vertexShader:'varying vec2 v;void main(){v=uv*2.-1.;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 v;void main(){float a=1.-smoothstep(.25,1.,length(v));gl_FragColor=vec4(.025,.045,.043,a*.48);}'});this.materials.add(mat);
    const shadow=this.mesh(new T.PlaneGeometry(w*1.18,d*1.3),mat,parent,0,-.015,0);shadow.rotation.x=-Math.PI/2;shadow.castShadow=shadow.receiveShadow=false;shadow.name='soft-contact-shadow';shadow.renderOrder=2;
  }
  buildVillageHouse(g:T.Group,b:typeof villageBuildings[number]){
    const sprite=this.villageSprite('village-buildings-v2',b.variant,b.w*S*1.12,g,0,b.d*S/2);
    g.userData.fadeMaterials=[sprite.material];g.userData.artVariant=b.variant;g.userData.artHeight=sprite.userData.height;
    this.villageContactShadow(g,b.w*S,b.d*S);
    this.dressVillageHouse(g,b);
  }
  dressVillageHouse(g:T.Group,b:typeof villageBuildings[number]){
    const w=b.w*S,d=b.d*S,r=rng(b.x+b.y);
    const map=this.art.get('village-wet-stone-v2')?.clone();if(map){map.repeat.set((w+1.6)/3,(d+1.6)/3);map.needsUpdate=true;this.textures.push(map);}
    const soil=new T.MeshStandardMaterial({map,color:'#6c7360',roughness:.98,transparent:true,depthWrite:false});this.materials.add(soil);
    soil.onBeforeCompile=shader=>{shader.vertexShader='varying vec2 apronUV;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\napronUV=uv;');shader.fragmentShader='varying vec2 apronUV;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <dithering_fragment>',`vec2 edge=abs(apronUV-.5)*2.;float irregular=.025*sin(apronUV.x*47.)*sin(apronUV.y*39.);gl_FragColor.a*=1.-smoothstep(.64,1.,max(edge.x,edge.y)+irregular);\n#include <dithering_fragment>`);};soil.customProgramCacheKey=()=> 'village-weathered-apron-v1';
    const apron=this.mesh(new T.PlaneGeometry(w+1.6,d+1.6),soil,g,0,-.018,0);apron.rotation.x=-Math.PI/2;apron.castShadow=false;apron.renderOrder=1;apron.name='weathered-house-apron';
    // Soft vegetation follows foundations; all roots stay within the existing footprint.
    for(const side of [-1,1])for(let i=0;i<2;i++){
      const foliage=this.villageSprite('village-props-v2',5,.8+r()*.5,g,side*(w*.42),d*(.15+i*.23));
      g.userData.fadeMaterials.push(foliage.material);
    }
    const source=this.qualitySample?.getObjectByName('bevelled-wet-flagstones') as T.InstancedMesh|undefined;
    if(source){const rubble=new T.InstancedMesh(source.geometry,source.material,22),dummy=new T.Object3D();rubble.name='foundation-rubble';
      for(let i=0;i<22;i++){dummy.position.set((r()-.5)*w,.025,d*.44+(r()-.5)*.28);dummy.rotation.set(0,r()*TAU,0);dummy.scale.set(.15+r()*.16,.35,.12+r()*.13);dummy.updateMatrix();rubble.setMatrixAt(i,dummy.matrix);}rubble.receiveShadow=true;g.add(rubble);}
  }
  buildVillageRoads(fallback:T.Texture){
    const map=this.art.get('village-wet-stone-v2')??fallback;
    const material=new T.MeshStandardMaterial({map,color:'#a2ada5',roughness:.74,metalness:.035,transparent:true,depthWrite:false});this.materials.add(material);
    material.onBeforeCompile=shader=>{
      shader.vertexShader='attribute float verge;varying float vVerge;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvVerge=verge;');
      shader.fragmentShader='varying float vVerge;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <dithering_fragment>','gl_FragColor.a *= smoothstep(0.,.15,vVerge);\n#include <dithering_fragment>');
    };material.customProgramCacheKey=()=> 'village-soft-road-v2';
    let layer=0;
    for(const road of villageRoads){
      const curve=new T.CatmullRomCurve3(road.points.map(([x,y])=>new T.Vector3(wx(x),0,wz(y))),false,'centripetal');
      const n=Math.ceil(curve.getLength()/.45),positions:number[]=[],uvs:number[]=[],verge:number[]=[],indices:number[]=[];
      for(let row=0;row<=n;row++){
        const t=row/n,p=curve.getPoint(t),dir=curve.getTangent(t),side=new T.Vector3(dir.z,0,-dir.x),waviness=1+Math.sin(t*37+layer)*.035;
        for(let col=0;col<5;col++){const f=(col-2)/2,point=p.clone().addScaledVector(side,f*road.width*S/2*waviness);positions.push(point.x,0,point.z);uvs.push(point.x/3,point.z/3);verge.push(col===0||col===4?0:1);}
        if(row>0)for(let col=0;col<4;col++){const i=row*5+col;indices.push(i-5,i,i-4,i-4,i,i+1);}
      }
      const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));geo.setAttribute('verge',new T.Float32BufferAttribute(verge,1));geo.setIndex(indices);geo.computeVertexNormals();
      const mesh=this.mesh(geo,material,this.village,0,-.035+layer++*.001,0);mesh.name='winding-village-lane';mesh.castShadow=false;
    }
    for(const [x,y,w,d] of [[800,3450,880,440],[1060,2790,380,330],[465,2080,350,380],[1080,1300,340,310],[800,450,770,570]]){
      const geo=new T.PlaneGeometry(w*S,d*S,12,10),pos=geo.getAttribute('position'),uv=geo.getAttribute('uv'),verge:number[]=[];
      for(let i=0;i<pos.count;i++){uv.setXY(i,(pos.getX(i)+wx(x))/3,(-pos.getY(i)+wz(y))/3);const u=(pos.getX(i)/(w*S)+.5),v=pos.getY(i)/(d*S)+.5;verge.push(Math.min(u,1-u,v,1-v)*2);}
      geo.setAttribute('verge',new T.Float32BufferAttribute(verge,1));const plaza=this.mesh(geo,material,this.village,wx(x),-.022+layer++*.001,wz(y));plaza.rotation.x=-Math.PI/2;plaza.castShadow=false;plaza.name='village-courtyard';
    }
  }
  buildVillageBorders(stone:T.MeshStandardMaterial){
    const r=rng(831),sources=[...this.paintedTrees];
    if(sources.length)for(let i=0;i<62;i++){
      const source=sources[i%sources.length],tree=source.clone(),y=250+i/62*3830,x=i%2?1450+r()*140:150-r()*140;
      const group=new T.Group();group.name='village-forest-edge';group.position.set(wx(x),0,wz(y));tree.position.x-=source.userData.foot.x;tree.position.z-=source.userData.foot.z;tree.userData.foot={x:wx(x),z:wz(y)};
      group.add(tree);this.village.add(group);this.villageChunks.push(group);this.paintedTrees.push(tree);
    }
    const bronze=this.mat('#a78e5f',.4,.65);
    for(const [x,y] of [[710,3860],[960,3640],[550,3290],[1165,3020],[385,2540],[1190,2330],[350,1830],[1190,1550],[610,980],[1040,520]]){
      this.makeLamp(x,y,'route',stone,bronze,.75);const lamp=this.lamps[this.lamps.length-1];lamp.stage=1;this.village.add(lamp.group);this.villageChunks.push(lamp.group);
    }
    const entry=new T.Group();entry.name='forest-to-village-threshold';entry.position.z=wz(3940);this.village.add(entry);this.villageChunks.push(entry);
    for(const side of [-1,1])for(let i=0;i<3;i++)this.villageSprite('village-props-v2',5,2.5+i*.15,entry,side*(6.6+i*.85),(i-1)*1.7);
    const water=new T.MeshPhysicalMaterial({color:'#506a68',roughness:.15,metalness:.15,clearcoat:1,transparent:true,opacity:.4,depthWrite:false});this.materials.add(water);
    for(let section=0;section<8;section++){
      const group=new T.Group();group.name='village-street-dressing';group.position.z=wz(420+section*470);this.village.add(group);this.villageChunks.push(group);
      for(let i=0;i<9;i++){
        const side=i%2?1:-1,x=side*(17.6+r()*4),z=(r()-.5)*16;
        this.villageSprite('village-props-v2',5,1.7+r()*1.5,group,x,z);
      }
      for(let i=0;i<3;i++){const patch=this.mesh(new T.CircleGeometry(.8,22),water,group,wx(i%2?1110:460),-.009,(r()-.5)*13);patch.rotation.x=-Math.PI/2;patch.rotation.z=r()*TAU;patch.scale.set(1+r(),.24+r()*.3,1);patch.castShadow=false;}
      const mistSource=this.qualitySample?.getObjectByName('drifting-ground-mist');if(mistSource){const mist=mistSource.clone();mist.position.set(0,.18,0);group.add(mist);}
    }
  }
  addSiteMarkers(stage:number,parent:T.Group){
    this.siteMarkers??=[];
    for(const site of stage===0?forestSites:villageSites){const marker=this.ring(.5,.018,'#bca776',.55);marker.name='story-site-'+stage+'-'+site.id;marker.position.set(wx(site.x),.07,wz(site.y));parent.add(marker);this.siteMarkers.push({mesh:marker,stage,id:site.id,x:site.x,y:site.y});}
  }
  updateChapterScenery(game:NightGame,target:T.Vector3){
    const village=game.stage===1;this.terrain.visible=!village;this.village.visible=village;this.fireflies.visible=!village;
    if(this.themedStage!==game.stage){this.themedStage=game.stage;const colors=village?['#20383e','#304b51','#c1dce5']:['#1c343c','#284852','#bddeec'];(this.scene.background as T.Color).set(colors[0]);(this.scene.fog as T.Fog).color.set(colors[1]);this.sun.color.set(colors[2]);}
    for(const group of this.villageChunks){
      group.visible=Math.abs(group.position.z-target.z)<38;
      const b=group.userData.building;if(b){const hidden=game.player.y<b.y+b.d/2&&game.player.y>b.y-b.d/2-180&&Math.abs(game.player.x-b.x)<b.w/2+50;for(const m of group.userData.fadeMaterials)m.opacity+=((hidden?.28:1)-m.opacity)*.15;}
    }
    for(const f of this.villageFires){f.mesh.visible=!game.used.has(f.id);f.mesh.scale.set(1+Math.sin(game.clock*7+(f.mesh.userData.phase??f.id))*.16,1+Math.sin(game.clock*9+(f.mesh.userData.phase??0))*.23,1);}
    for(const f of this.villageSmoke)f.mesh.visible=!game.used.has(f.id);
    for(const npc of this.villagers){npc.root.visible=true;if(game.used.has(npc.id))npc.root.rotation.y=-.35;else npc.root.rotation.y=0;}
    for(const marker of this.siteMarkers??[]){const distance=Math.hypot(game.player.x-marker.x,game.player.y-marker.y),done=game.used.has(marker.id);marker.mesh.visible=game.stage===marker.stage&&distance<280;const m=marker.mesh.material as T.MeshBasicMaterial;m.color.set(done?'#8eaf9a':'#c6ab78');m.opacity=done?.3:.45+Math.sin(game.clock*2)*.08;}
    if(this.weather){this.weather.visible=village;this.weather.position.set(target.x,0,target.z);const p=this.weather.geometry.getAttribute('position');for(let i=0;i<p.count;i++)p.setY(i,8-((game.clock*.35+i*.347)%8));p.needsUpdate=true;}
  }
  disposeActor(actor:Actor){
    const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>(),textures=new Set<T.Texture>();
    actor.root.traverse(o=>{if(o instanceof T.Mesh){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material]){materials.add(m);const map=(m as T.MeshStandardMaterial).map;if(map)textures.add(map);}}});
    for(const g of geometries){g.dispose();this.geometries.delete(g);}for(const m of materials){m.dispose();this.materials.delete(m);}
    for(const t of textures){t.dispose();const i=this.textures.indexOf(t);if(i>=0)this.textures.splice(i,1);}actor.root.removeFromParent();
  }
  partitionWorld(){
    this.worldChunks=[];
    // Split long instance batches: a single world-sized bound defeats frustum culling.
    const batches:T.InstancedMesh[]=[];this.terrain.traverse(o=>{if(o instanceof T.InstancedMesh)batches.push(o);});
    const matrix=new T.Matrix4(),color=new T.Color();
    for(const source of batches){
      const bins=new Map<number,number[]>();
      for(let i=0;i<source.count;i++){source.getMatrixAt(i,matrix);const key=Math.floor(matrix.elements[14]/20);if(!bins.has(key))bins.set(key,[]);bins.get(key)!.push(i);}
      if(bins.size<2)continue;
      for(const indices of bins.values()){
        const mesh=new T.InstancedMesh(source.geometry,source.material,indices.length);mesh.name=source.name;mesh.position.copy(source.position);mesh.quaternion.copy(source.quaternion);mesh.scale.copy(source.scale);mesh.castShadow=source.castShadow;mesh.receiveShadow=source.receiveShadow;
        indices.forEach((original,i)=>{source.getMatrixAt(original,matrix);mesh.setMatrixAt(i,matrix);if(source.instanceColor){source.getColorAt(original,color);mesh.setColorAt(i,color);}});
        mesh.computeBoundingSphere();source.parent!.add(mesh);
      }
      source.removeFromParent();source.dispose();
    }
    // Group nearby scenery by bounds; leave long ground/road surfaces continuous.
    this.terrain.updateMatrixWorld(true);const bins=new Map<number,T.Group>();
    for(const object of [...this.terrain.children]){
      const box=new T.Box3().setFromObject(object);if(box.isEmpty()||box.max.z-box.min.z>35)continue;
      const key=Math.floor((box.min.z+box.max.z)/40);
      let group=bins.get(key);if(!group){group=new T.Group();group.name='map-sector-'+key;bins.set(key,group);this.terrain.add(group);}
      group.add(object);
    }
    for(const group of bins.values()){const bounds=new T.Box3().setFromObject(group);this.worldChunks.push({group,min:bounds.min.z,max:bounds.max.z});}
  }
  updateWorldChunks(z:number){
    // Camera sees ~13 world units of ground each way. Keep >1 sector ahead ready.
    for(const chunk of this.worldChunks)chunk.group.visible=chunk.max>z-38&&chunk.min<z+38;
  }
  updateRenderBudget(now:number,playing:boolean){
    const elapsed=now-this.frameSampleAt;this.frameSampleAt=now;
    if(!playing||elapsed<=0||elapsed>100){this.frameSamples=0;return;}
    this.frameAverage=this.frameAverage*.95+elapsed*.05;this.frameSamples++;
    if(this.frameSamples<90||now-this.scaleChangedAt<5000)return;
    const ceiling=Math.min(window.devicePixelRatio||1,1.25);
    const next=this.frameAverage>23?Math.max(.75,this.renderScale-.125):this.frameAverage<17.5?Math.min(ceiling,this.renderScale+.125):this.renderScale;
    if(next===this.renderScale)return;
    this.renderScale=next;this.scaleChangedAt=now;this.frameSamples=0;
    this.renderer.setPixelRatio(next);this.composer.setPixelRatio(next);
  }
  atlasMaterial(base:T.Texture,columns:number,rows:number,column=0,row=0,lit=false){
    const map=base.clone();map.repeat.set(1/columns,1/rows);map.offset.set(column/columns,1-(row+1)/rows);map.needsUpdate=true;this.textures.push(map);
    const options={map,transparent:true,alphaTest:.18,side:T.DoubleSide,depthWrite:true};const mat=lit?new T.MeshStandardMaterial({...options,roughness:.84,metalness:0,envMapIntensity:.2}):new T.MeshBasicMaterial({...options,toneMapped:false});
    mat.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
      // Key raw texels before tint or lighting; filtering mixes magenta into dark foliage.
      float spill = max(0.0, min(sampledDiffuseColor.r, sampledDiffuseColor.b) - sampledDiffuseColor.g);
      float brightness = max(0.12, max(sampledDiffuseColor.r, max(sampledDiffuseColor.g, sampledDiffuseColor.b)));
      float keyed = smoothstep(0.018, 0.22, spill / brightness);
      diffuseColor.a *= 1.0 - keyed;
      diffuseColor.rgb = max(vec3(0.0), diffuseColor.rgb - diffuse * vec3(spill, 0.0, spill));
    `);};mat.customProgramCacheKey=()=> 'nightward-painted-chroma-v3-'+lit;mat.userData.chromaKey=true;this.materials.add(mat);return mat;
  }
  applyArtFrame(texture:T.Texture,name:string,column:number,row:number){const sheet=this.frames[name],frame=sheet.frames[row][column];texture.repeat.set(frame.w/sheet.width,frame.h/sheet.height);texture.offset.set(frame.x/sheet.width,1-(frame.y+frame.h)/sheet.height);return frame;}
  attachPaintedActor(actor:Actor,kind:string){
    const hero=kind==='hero',wolf=kind==='beast',height=hero?3.3:wolf?2.25:kind==='boss'?5.5:kind==='elite'?4.1:2.95,base=this.art.get(hero?'hero':wolf?'wolf':'enemies')!;
    const mat=this.atlasMaterial(base,4,hero?4:wolf?3:2,0,hero?0:kind==='archer'?1:0,true);const geo=new T.PlaneGeometry(height,height);this.geometries.add(geo);const mesh=new T.Mesh(geo,mat);mesh.receiveShadow=true;actor.root.add(mesh);actor.billboard=mesh;actor.atlas=mat.map!;actor.billboardHeight=height;actor.atlasRow=kind==='archer'?1:0;
    if(!hero){const bar=new T.Group(),bgMat=new T.MeshBasicMaterial({color:'#131c1b',transparent:true,opacity:.8,depthTest:false}),fillMat=new T.MeshBasicMaterial({color:kind==='boss'?'#d88778':'#ddbd82',depthTest:false});this.materials.add(bgMat);this.materials.add(fillMat);this.mesh(new T.PlaneGeometry(1.35,.09),bgMat,bar);actor.fill=this.mesh(new T.PlaneGeometry(1.3,.055),fillMat,bar,0,0,.01);bar.position.y=height*(wolf?.98:.8);actor.root.add(bar);actor.bar=bar;}
    const shadowMaterial=new T.ShaderMaterial({transparent:true,depthWrite:false,vertexShader:'varying vec2 shadowUv;void main(){shadowUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 shadowUv;void main(){float d=length(shadowUv-.5)*2.;float a=(1.-smoothstep(.1,1.,d))*.32;gl_FragColor=vec4(.015,.04,.045,a);}'});this.materials.add(shadowMaterial);const shadow=this.mesh(new T.CircleGeometry(hero?.62:kind==='boss'?1.2:.7,32),shadowMaterial,actor.root,0,-.06,0);shadow.rotation.x=-Math.PI/2;shadow.scale.y=.6;shadow.castShadow=false;
  }
  updatePaintedActor(actor:Actor,angle:number,row:number,bob=0,dt=0,moving=false){
    if(!actor.billboard||!actor.atlas)return;
    const step=Math.min(.05,Math.max(0,dt)),height=actor.billboardHeight||3;
    if(actor.visualAngle===undefined||!step)actor.visualAngle=angle;
    const delta=Math.atan2(Math.sin(angle-actor.visualAngle),Math.cos(angle-actor.visualAngle));
    // Shortest-path turning, independent of refresh rate. Combat turns faster.
    actor.visualAngle+=Math.sign(delta)*Math.min(Math.abs(delta),step*(row===3?24:14));
    const directions=actor.kind==='hero'&&this.art.has('hero_diagonal')?8:4,sector=TAU/directions;
    let col=((Math.round((actor.visualAngle+Math.PI/2)/sector)%directions)+directions)%directions;
    if(step&&actor.visualColumn!==undefined){const centre=actor.visualColumn*sector-Math.PI/2;
      const distance=Math.abs(Math.atan2(Math.sin(actor.visualAngle-centre),Math.cos(actor.visualAngle-centre)));
      if(distance<sector/2+(directions===8?.055:.12))col=actor.visualColumn;
    }
    actor.visualColumn=col;
    actor.motionWeight=(actor.motionWeight||0)+(Number(moving)-(actor.motionWeight||0))*(1-Math.exp(-step*16));
    actor.stride=(actor.stride||0)+step*8*(actor.motionWeight||0);
    if((actor.kind==='hero'||actor.kind==='beast')&&row!==3&&step)row=(actor.motionWeight||0)>.12?1+Math.floor(actor.stride)%2:0;
    const key=col+':'+row,mat=actor.billboard.material as T.MeshBasicMaterial;
    if(step&&actor.poseKey!==undefined&&actor.poseKey!==key){
      if(!actor.previousPose){const pm=mat.clone();pm.map=mat.map!.clone();pm.onBeforeCompile=mat.onBeforeCompile;pm.customProgramCacheKey=mat.customProgramCacheKey;pm.depthWrite=false;this.textures.push(pm.map);this.materials.add(pm);actor.previousPose=new T.Mesh(actor.billboard.geometry,pm);actor.previousPose.receiveShadow=true;actor.root.add(actor.previousPose);}
      const previous=actor.previousPose,pm=previous.material as T.MeshBasicMaterial;
      if(pm.map!.source!==actor.atlas.source){pm.map!.source=actor.atlas.source;pm.map!.needsUpdate=true;}pm.map!.repeat.copy(actor.atlas.repeat);pm.map!.offset.copy(actor.atlas.offset);previous.position.copy(actor.billboard.position);previous.quaternion.copy(actor.billboard.quaternion);previous.scale.copy(actor.billboard.scale);
      previous.userData.frame=actor.billboard.userData.frame;previous.visible=true;actor.poseBlend=0;
    }
    actor.poseKey=key;actor.poseBlend=Math.min(1,(actor.poseBlend??1)+step/.085);
    const sheet=actor.kind==='hero'?(directions===8&&col%2?'hero_diagonal':'hero'):actor.kind==='beast'?'wolf':'enemies';
    const base=this.art.get(sheet)!;if(actor.atlas.source!==base.source){actor.atlas.source=base.source;actor.atlas.needsUpdate=true;}
    const inverse=actor.root.quaternion.clone().invert(),frame=this.applyArtFrame(actor.atlas,sheet,directions===8?Math.floor(col/2):col,row);
    actor.billboard.userData.frame=frame;
    // Both poses rotate and lean around their own foot anchor, so transitions don't slide.
    const lean=(actor.recoil||0)+(actor.attackLean||0)+(step?Math.sin(actor.stride!*Math.PI)*.025*actor.motionWeight!+Math.max(-.055,Math.min(.055,delta*.035)):0);
    const orient=this.camera.quaternion.clone().multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,0,1),lean));
    const place=(mesh:T.Mesh,f:ArtFrame)=>{mesh.quaternion.copy(inverse).multiply(orient);mesh.scale.x=f.w/f.h;
      const offset=new T.Vector3((.5-f.anchorX)*height*f.w/f.h,(f.anchorY-.5)*height,0).applyQuaternion(orient);
      mesh.position.copy(offset).applyQuaternion(inverse);mesh.position.y+=bob+(step?Math.abs(Math.sin(actor.stride!*Math.PI))*.035*actor.motionWeight!:0);
    };
    place(actor.billboard,frame);mat.opacity=actor.poseBlend;mat.depthWrite=actor.poseBlend>=1;
    if(actor.previousPose){const previous=actor.previousPose;previous.visible=actor.poseBlend<1;if(previous.visible){place(previous,previous.userData.frame);(previous.material as T.MeshBasicMaterial).opacity=1-actor.poseBlend;}}
  }
  mat(color:T.ColorRepresentation,roughness=.85,metalness=0){const m=new T.MeshStandardMaterial({color,roughness,metalness});this.materials.add(m);return m;}
  mesh(geo:T.BufferGeometry,mat:T.Material,parent:T.Object3D,x=0,y=0,z=0){this.geometries.add(geo);const m=new T.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
  box(parent:T.Object3D,mat:T.Material,x:number,y:number,z:number,sx:number,sy:number,sz:number){return this.mesh(new T.BoxGeometry(sx,sy,sz),mat,parent,x,y,z);}
  sphere(parent:T.Object3D,mat:T.Material,x:number,y:number,z:number,sx:number,sy:number,sz:number){const m=this.mesh(new T.SphereGeometry(1,12,8),mat,parent,x,y,z);m.scale.set(sx,sy,sz);return m;}
  ring(radius:number,width:number,color:string,opacity:number){const mat=new T.MeshBasicMaterial({color,transparent:true,opacity,side:T.DoubleSide,depthWrite:false});this.materials.add(mat);const geo=new T.RingGeometry(radius-width,radius+width,80);this.geometries.add(geo);const m=new T.Mesh(geo,mat);m.rotation.x=-Math.PI/2;return m;}
  buildWorld(maps:T.Texture[]){
    const r=rng(934);const [groundMap,groundNormal,stoneMap,stoneNormal]=maps;groundMap.repeat.set(18,49);groundNormal.repeat.copy(groundMap.repeat);stoneMap.repeat.set(3,3);stoneNormal.repeat.copy(stoneMap.repeat);
    const groundMat=new T.MeshStandardMaterial({map:groundMap,normalMap:groundNormal,color:'#718077',roughness:.96,normalScale:new T.Vector2(.65,.65)});this.materials.add(groundMat);
    const ground=this.mesh(new T.PlaneGeometry(70,172,1,1),groundMat,this.terrain,0,-.12,1.75);ground.rotation.x=-Math.PI/2;
    const sharedStone=this.art?.get('village-wet-stone-v2');
    const pathMaterial=new T.MeshStandardMaterial({map:sharedStone??stoneMap,normalMap:sharedStone?null:stoneNormal,normalScale:new T.Vector2(.35,.35),roughness:.8,color:'#a2ada5'});this.materials.add(pathMaterial);
    // A curved, textured road with continuous world-space UVs, raised above the forest floor.
    const vertices:number[]=[],uv:number[]=[],indices:number[]=[];for(let y=150;y<=4200;y+=30){const x=pathX(y);for(const side of [-1,1]){vertices.push(wx(x+side*190),-.035,wz(y));uv.push(wx(x+side*190)/3,wz(y)/3);}const i=vertices.length/3-2;if(i>=2)indices.push(i-2,i,i-1,i-1,i,i+1);}
    const roadGeo=new T.BufferGeometry();roadGeo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));roadGeo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));roadGeo.setIndex(indices);roadGeo.computeVertexNormals();this.mesh(roadGeo,pathMaterial,this.terrain);
    const rockMat=this.mat('#78837b',.94),rockDark=this.mat('#46594f'),bark=this.mat('#665446');const bronze=this.mat('#b5965d',.38,.65),stone=this.mat('#87928b',.86),moss=this.mat('#405e42');
    const rockSource=new T.IcosahedronGeometry(1,2),rockPositions=rockSource.getAttribute('position');
    for(let i=0;i<rockPositions.count;i++){const x=rockPositions.getX(i),y=rockPositions.getY(i),z=rockPositions.getZ(i),f=.92+.085*Math.sin(x*5+y*3)*Math.cos(z*4-y*2);rockPositions.setXYZ(i,x*f,y*f,z*f);}rockSource.deleteAttribute('normal');rockSource.deleteAttribute('uv');const rockGeo=mergeVertices(rockSource);rockSource.dispose();rockGeo.computeVertexNormals();const rockUV=new Float32Array(rockGeo.getAttribute('position').count*2);for(let i=0;i<rockUV.length/2;i++){rockUV[i*2]=rockGeo.getAttribute('position').getX(i)*.5+.5;rockUV[i*2+1]=rockGeo.getAttribute('position').getZ(i)*.5+.5;}rockGeo.setAttribute('uv',new T.BufferAttribute(rockUV,2));this.geometries.add(rockGeo);
    const rockTexture=(sharedStone??stoneMap).clone();rockTexture.repeat.set(1,1);rockTexture.needsUpdate=true;this.textures.push(rockTexture);rockMat.map=rockTexture;rockMat.color.set('#a5aca0');stone.map=rockTexture;stone.color.set('#8e968b');
    const rocks=new T.InstancedMesh(rockGeo,rockMat,540),dummy=new T.Object3D();for(let i=0;i<540;i++){const y=180+r()*4000;const side=r()>.5?1:-1,x=pathX(y)+side*(215+r()*420);dummy.position.set(wx(x),r()*.2-.12,wz(y));dummy.rotation.set(r()*.6,r()*TAU,r()*.3);const s=.18+r()*.9;dummy.scale.set(s*(1+r()),s*.8,s);dummy.updateMatrix();rocks.setMatrixAt(i,dummy.matrix);rocks.setColorAt(i,new T.Color().setHSL(.22+r()*.1,.08+r()*.1,.28+r()*.16));}rocks.castShadow=true;rocks.receiveShadow=true;this.terrain.add(rocks);
    // Road edges: weathered curbstones, tufts and occasional broken flagstones.
    const curbGeo=new T.BoxGeometry(.42,.13,.72),curbs=new T.InstancedMesh(curbGeo,stone,330);this.geometries.add(curbGeo);for(let i=0;i<330;i++){const y=160+Math.floor(i/2)*24.5,side=i%2?1:-1;dummy.position.set(wx(pathX(y)+side*(199+r()*8)),.02,wz(y));dummy.rotation.set(0,Math.cos(y*.0024)*.22+(r()-.5)*.09,0);dummy.scale.set(1,.7+r()*.4,.8+r()*.25);dummy.updateMatrix();curbs.setMatrixAt(i,dummy.matrix);}curbs.castShadow=true;curbs.receiveShadow=true;this.terrain.add(curbs);
    this.buildVegetation(r,bark);
    // Weathered stone pylons and ruined archways give the route architectural scale.
    for(const y of [3700,3100,2570,1750,1080]){for(const side of [-1,1]){const x=pathX(y)+side*255,g=new T.Group();g.position.set(wx(x),0,wz(y));this.terrain.add(g);this.box(g,stone,0,.12,0,1.5,.25,1.5);this.box(g,rockDark,0,.37,0,1.15,.22,1.15);this.mesh(new T.CylinderGeometry(.39,.5,2.7,8),stone,g,0,1.85,0);this.mesh(new T.CylinderGeometry(.64,.6,.28,8),stone,g,0,3.35,0);this.box(g,bronze,0,2,0,.85,.1,.85);this.sphere(g,moss,.3,.56,.2,.58,.15,.4);}}
    this.buildBridge(stone,bronze);
    for(let y=450;y<4200;y+=470){const side=Math.floor(y/470)%2===0?1:-1;this.makeLamp(pathX(y)+side*239,y,'route',stone,bronze);}
    this.makeLamp(790,1300,'camp',stone,bronze,1.3);this.makeLamp(800,250,'end',stone,bronze,2.1);
    this.buildArena(pathMaterial,stone,bronze);
    if(this.art?.has('forest'))this.buildQualitySample(sharedStone??stoneMap,stoneNormal);
    // Supply wagon and fire shard are real objects, matching the interaction positions.
    const wagon=new T.Group();wagon.position.set(wx(1030),.05,wz(2890));wagon.rotation.y=-.25;this.terrain.add(wagon);const wood=this.mat('#766345');this.box(wagon,wood,0,.58,0,2.9,.23,1.5);for(let i=0;i<7;i++)this.box(wagon,wood,-1.22+i*.4,.73,0,.34,.16,1.45);for(const x of [-1,1])for(const z of [-.8,.8]){const wheel=this.mesh(new T.TorusGeometry(.46,.08,8,24),rockDark,wagon,x,.4,z);for(let i=0;i<6;i++){const spoke=this.box(wagon,wood,x,.4,z,.06,.86,.07);spoke.rotation.z=i*Math.PI/3;}wheel.castShadow=true;}this.box(wagon,wood,-.5,1,.05,.72,.65,.72);this.box(wagon,wood,.55,.97,.1,.9,.55,.8);
    const crystalMat=this.mat('#8ededa',.16,.35);crystalMat.emissive.set('#69f0d8');crystalMat.emissiveIntensity=1.6;const shard=this.mesh(new T.OctahedronGeometry(.4),crystalMat,this.terrain,wx(650),1.1,wz(1880));shard.name='fire-shard';this.mesh(new T.CylinderGeometry(.9,1,.3,12),rockDark,this.terrain,wx(650),.1,wz(1880));
    // Low masonry around the resting place.
    for(let i=0;i<9;i++){const a=i/9*TAU,x=790+Math.cos(a)*100,y=1300+Math.sin(a)*100;if(y>1340)continue;const m=this.box(this.terrain,stone,wx(x),.18,wz(y),1,.4,.6);m.rotation.y=-a;}
  }
  buildQualitySample(stoneMap:T.Texture,stoneNormal:T.Texture){
    const group=new T.Group();group.name='mistwood-quality-sample';this.terrain.add(group);this.qualitySample=group;
    const time=this.sampleTime??={value:0},r=rng(4627),dummy=new T.Object3D();
    // Raised, bevelled stones catch grazing light; gaps retain the original wet road.
    const shape=new T.Shape();shape.moveTo(-.46,-.32);shape.lineTo(.32,-.35);shape.lineTo(.47,-.22);shape.lineTo(.44,.3);shape.lineTo(-.35,.34);shape.lineTo(-.48,.19);shape.closePath();
    const geo=new T.ExtrudeGeometry(shape,{depth:.07,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.035,bevelThickness:.025});geo.rotateX(-Math.PI/2);this.geometries.add(geo);
    const stone=new T.MeshStandardMaterial({map:stoneMap,normalMap:this.art?.has('village-wet-stone-v2')?null:stoneNormal,normalScale:new T.Vector2(.25,.25),color:'#a2ada5',roughness:.8,metalness:.035});this.materials.add(stone);
    const slabs=new T.InstancedMesh(geo,stone,330);slabs.name='bevelled-wet-flagstones';let index=0;
    for(let row=0;row<33;row++)for(let col=0;col<10;col++){const y=3430+row*20.3,x=pathX(y)+(col-4.5)*29+(row%2?8:0);dummy.position.set(wx(x),-.005+r()*.016,wz(y));dummy.rotation.set((r()-.5)*.012,(r()-.5)*.8,(r()-.5)*.018);dummy.scale.set(.42+r()*.17,.55,.38+r()*.2);dummy.updateMatrix();slabs.setMatrixAt(index,dummy.matrix);slabs.setColorAt(index++,new T.Color().setHSL(.15+r()*.07,.045+r()*.08,.66+r()*.2));}
    slabs.receiveShadow=true;slabs.castShadow=true;group.add(slabs);
    const water=new T.MeshPhysicalMaterial({color:'#496567',roughness:.13,metalness:.18,clearcoat:1,clearcoatRoughness:.08,transparent:true,opacity:.24,depthWrite:false,envMapIntensity:.6});this.materials.add(water);
    for(let i=0;i<11;i++){const y=3460+r()*615,x=pathX(y)+(i%2?1:-1)*(160+r()*38),outline=new T.Shape();for(let j=0;j<=32;j++){const a=j/32*TAU,rad=.85+Math.sin(a*5+i)*.1+Math.sin(a*9)*.06;const px=Math.cos(a)*rad,py=Math.sin(a)*rad;j?outline.lineTo(px,py):outline.moveTo(px,py);}const puddle=this.mesh(new T.ShapeGeometry(outline),water,group,wx(x),.015,wz(y));puddle.name='rain-puddle';puddle.rotation.x=-Math.PI/2;puddle.rotation.z=r()*TAU;puddle.scale.set(.65+r()*.75,.3+r()*.45,1);puddle.castShadow=false;}
    // Curved tapered blades use one draw call; only their tips bend in the breeze.
    const blade=new T.PlaneGeometry(.065,.52,1,4),positions=blade.getAttribute('position');for(let i=0;i<positions.count;i++){const h=(positions.getY(i)+.26)/.52;positions.setXYZ(i,positions.getX(i)*(1-h*.92)+h*h*.1,h*.52,h*h*.075);}blade.computeVertexNormals();this.geometries.add(blade);
    const grassMat=new T.MeshStandardMaterial({color:'#69835d',roughness:.94,side:T.DoubleSide});this.materials.add(grassMat);
    grassMat.onBeforeCompile=shader=>{shader.uniforms.sampleTime=time;shader.vertexShader='uniform float sampleTime;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      float phase = instanceMatrix[3].x * 1.7 + instanceMatrix[3].z * 0.65;
      transformed.x += sin(sampleTime * 1.3 + phase) * position.y * position.y * 0.22;
      transformed.z += cos(sampleTime * 0.9 + phase) * position.y * position.y * 0.13;
    `);};grassMat.customProgramCacheKey=()=> 'mistwood-sample-grass-v1';
    const grass=new T.InstancedMesh(blade,grassMat,3600);grass.name='wind-swept-verge';
    for(let i=0;i<3600;i++){const y=3410+r()*720,side=i%2?1:-1,x=pathX(y)+side*(212+r()*105);dummy.position.set(wx(x),-.025,wz(y));dummy.rotation.set(0,r()*TAU,0);const scale=.35+r()*1.15;dummy.scale.set(scale,scale,scale);dummy.updateMatrix();grass.setMatrixAt(i,dummy.matrix);grass.setColorAt(i,new T.Color().setHSL(.19+r()*.1,.16+r()*.22,.44+r()*.28));}grass.receiveShadow=true;group.add(grass);
    // Fallen leaves have a raised centre, a real surface normal and varied autumn colour.
    const leafGeo=new T.BufferGeometry();leafGeo.setAttribute('position',new T.Float32BufferAttribute([0,0,-.14,-.065,0,0,0,.025,0,.065,0,0,0,0,.14],3));leafGeo.setIndex([0,2,1,0,3,2,1,2,4,2,3,4]);leafGeo.computeVertexNormals();this.geometries.add(leafGeo);const leafMat=this.mat('#a58c55',.92);leafMat.side=T.DoubleSide;const leaves=new T.InstancedMesh(leafGeo,leafMat,440);leaves.name='scattered-autumn-leaves';
    for(let i=0;i<440;i++){const y=3420+r()*700,x=pathX(y)+(r()-.5)*450;dummy.position.set(wx(x),.13,wz(y));dummy.rotation.set(0,r()*TAU,0);const scale=.6+r()*1.2;dummy.scale.setScalar(scale);dummy.updateMatrix();leaves.setMatrixAt(i,dummy.matrix);leaves.setColorAt(i,new T.Color().setHSL(.07+r()*.11,.22+r()*.2,.38+r()*.2));}leaves.receiveShadow=true;group.add(leaves);
    // Soft ground fog stays translucent enough to keep enemy telegraphs readable.
    const mistMat=new T.ShaderMaterial({uniforms:{sampleTime:time},transparent:true,depthWrite:false,side:T.DoubleSide,vertexShader:'varying vec2 fogUv; void main(){fogUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:`uniform float sampleTime;varying vec2 fogUv;
      void main(){vec2 p=fogUv;float edge=sin(p.x*3.14159)*sin(p.y*3.14159);float waves=.5+.25*sin(p.x*18.+p.y*9.+sampleTime*.24)+.25*sin(p.y*24.-p.x*7.-sampleTime*.18);gl_FragColor=vec4(.43,.60,.61,edge*edge*waves*.075);}`});this.materials.add(mistMat);
    for(const y of [3500,3740,3990]){const mist=this.mesh(new T.PlaneGeometry(25,9),mistMat,group,wx(pathX(y)),.24,wz(y));mist.name='drifting-ground-mist';mist.rotation.x=-Math.PI/2;mist.castShadow=false;mist.receiveShadow=false;}
    const masonry=this.mat('#6d7e78',.91),brass=this.mat('#a78e5f',.4,.65);this.makeLamp(pathX(3910)+205,3910,'route',masonry,brass,1.12);this.makeLamp(pathX(3550)-215,3550,'route',masonry,brass,1.05);
  }
  buildVegetation(r:()=>number,bark:T.MeshStandardMaterial){
    if(this.art?.has('forest')){this.buildPaintedForest(r);return;}
    const dummy=new T.Object3D();
    const trunkGeo=new T.CylinderGeometry(.17,.32,1,9,3),branchGeo=new T.CylinderGeometry(.025,.09,1,7),leafGeo=new T.IcosahedronGeometry(1,1);this.geometries.add(trunkGeo);this.geometries.add(branchGeo);this.geometries.add(leafGeo);
    const canopy=this.mat('#53724d',.92),count=150;const trunks=new T.InstancedMesh(trunkGeo,bark,count),branches=new T.InstancedMesh(branchGeo,bark,count*5),leaves=new T.InstancedMesh(leafGeo,canopy,count*12);
    for(let i=0;i<count;i++){let y=220+r()*3900,x=pathX(y)+(r()>.5?1:-1)*(340+r()*310);if(y<1000)x=800+(x>800?1:-1)*(500+r()*180);this.colliders.push({x,y,r:20});const height=3.7+r()*3.1;const base=new T.Vector3(wx(x),0,wz(y));dummy.position.copy(base).y=height/2;dummy.rotation.set((r()-.5)*.13,r()*TAU,(r()-.5)*.1);dummy.scale.set(.75+r()*.6,height,.75+r()*.6);dummy.updateMatrix();trunks.setMatrixAt(i,dummy.matrix);
      for(let j=0;j<5;j++){const a=j*2.4+r(),end=base.clone().add(new T.Vector3(Math.cos(a)*1.6,height*.63+j*.22,Math.sin(a)*1.6)),begin=base.clone().add(new T.Vector3(0,height*.43,0)),direction=end.clone().sub(begin);dummy.position.copy(begin).addScaledVector(direction,.5);dummy.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),direction.clone().normalize());dummy.scale.set(1,direction.length(),1);dummy.updateMatrix();branches.setMatrixAt(i*5+j,dummy.matrix);}
      for(let j=0;j<12;j++){const a=j*2.4,rad=j<4?.7:1.2;dummy.position.copy(base).add(new T.Vector3(Math.cos(a)*rad,height-1+(j%3)*.55,Math.sin(a)*rad));dummy.rotation.set(r(),r()*TAU,r());dummy.scale.set(.9+r()*.6,.75+r()*.5,.9+r()*.6);dummy.updateMatrix();leaves.setMatrixAt(i*12+j,dummy.matrix);leaves.setColorAt(i*12+j,new T.Color().setHSL(.24+r()*.08,.24+r()*.2,.3+r()*.2));}}
    for(const m of [trunks,branches,leaves]){m.castShadow=true;m.receiveShadow=true;this.terrain.add(m);}
    // Thousands of thin curved grass blades, rendered in a single instanced draw.
    const blade=new T.PlaneGeometry(.07,.48,1,3);const positions=blade.getAttribute('position');for(let i=0;i<positions.count;i++){const h=(positions.getY(i)+.24)/.48;positions.setXYZ(i,positions.getX(i)*(1-h*.9)+h*h*.1,positions.getY(i)+.24,h*h*.12);}blade.computeVertexNormals();this.geometries.add(blade);
    const grassMat=this.mat('#748a4b',.95);grassMat.side=T.DoubleSide;const grass=new T.InstancedMesh(blade,grassMat,13000);
    for(let i=0;i<13000;i++){const y=180+r()*4050,x=pathX(y)+(r()>.5?1:-1)*(207+r()*265);dummy.position.set(wx(x),-.04,wz(y));dummy.rotation.set(0,r()*TAU,0);const scale=.5+r()*1.2;dummy.scale.set(scale,scale,scale);dummy.updateMatrix();grass.setMatrixAt(i,dummy.matrix);grass.setColorAt(i,new T.Color().setHSL(.2+r()*.11,.25+r()*.2,.32+r()*.18));}grass.receiveShadow=true;this.terrain.add(grass);this.grass=grass;
  }
  buildPaintedForest(r:()=>number){
    const base=this.art.get('forest')!,up=new T.Vector3(0,1,0).applyQuaternion(this.camera.quaternion),leafMats=[0,1,2,3].map(i=>{const mat=this.atlasMaterial(base,2,2,i%2,Math.floor(i/2),true),key=mat.onBeforeCompile,clock=this.sampleTime??={value:0},frame=this.frames.forest.frames[Math.floor(i/2)][i%2];mat.onBeforeCompile=(shader,renderer)=>{key(shader,renderer);shader.uniforms.forestTime=clock;shader.uniforms.rootV={value:1-frame.anchorY};shader.vertexShader='uniform float forestTime;uniform float rootV;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
float crown=max(0.,uv.y-rootV);
transformed.x+=sin(forestTime*.65+modelMatrix[3].x*.4+modelMatrix[3].z*.25)*crown*crown*.09;`);};mat.customProgramCacheKey=()=> 'nightward-real-forest-v2';return mat;});
    for(let i=0;i<130;i++){let y=200+r()*3990,x=pathX(y)+(r()>.5?1:-1)*(350+r()*350);if(y<950)x=800+(x>800?1:-1)*(520+r()*170);const h=7.5+r()*3.2;this.colliders.push({x,y,r:23});const frame=this.applyArtFrame(leafMats[i%4].map!,'forest',i%2,Math.floor((i%4)/2));const geo=new T.PlaneGeometry(h*frame.w/frame.h,h);this.geometries.add(geo);const tree=new T.Mesh(geo,leafMats[i%4]);tree.receiveShadow=true;tree.position.set(wx(x),.04,wz(y));tree.position.addScaledVector(up,h*(frame.anchorY-.5));tree.position.x+=(.5-frame.anchorX)*h*frame.w/frame.h;tree.quaternion.copy(this.camera.quaternion);tree.userData.foot={x:wx(x),z:wz(y)};this.terrain.add(tree);this.paintedTrees.push(tree);
      const shadeMat=new T.MeshBasicMaterial({color:'#051b23',transparent:true,opacity:.16,depthWrite:false});this.materials.add(shadeMat);const shade=this.mesh(new T.CircleGeometry(h*.27,28),shadeMat,this.terrain,wx(x)+.5,-.075,wz(y)+.3);shade.rotation.x=-Math.PI/2;shade.scale.y=.65;shade.castShadow=false;
    }
  }
  buildBridge(stone:T.MeshStandardMaterial,bronze:T.MeshStandardMaterial){
    const g=new T.Group();g.position.set(wx(802),0,wz(2290));this.terrain.add(g);const wood=this.mat('#817454',.82);
    const waterMat=new T.MeshPhysicalMaterial({color:'#396e77',metalness:.38,roughness:.21,transparent:true,opacity:.85,clearcoat:1,clearcoatRoughness:.2});this.materials.add(waterMat);this.water=this.mesh(new T.PlaneGeometry(63,5.7,35,12),waterMat,this.terrain,0,-.065,wz(2285));this.water.rotation.x=-Math.PI/2;
    for(let i=0;i<13;i++){const z=(i-6)*.49;this.box(g,wood,0,.12,z,12.2,.28,.44);this.box(g,bronze,-5.4,.29,z,.14,.035,.12);this.box(g,bronze,5.4,.29,z,.14,.035,.12);}
    for(const side of [-1,1]){for(const z of [-3,0,3])this.box(g,stone,side*6,.75,z,.42,1.5,.5);this.box(g,wood,side*6,1.2,0,.22,.23,6.5);this.box(g,wood,side*6,.58,0,.15,.13,6.5);}
  }
  makeLamp(x:number,y:number,kind:Lamp['kind'],stone:T.Material,bronze:T.Material,scale=1){
    const group=new T.Group();group.position.set(wx(x),0,wz(y));group.scale.setScalar(scale);this.terrain.add(group);
    this.mesh(new T.CylinderGeometry(.36,.43,.19,16),stone,group,0,.12,0);this.mesh(new T.CylinderGeometry(.10,.15,1.9,16),stone,group,0,1.13,0);this.mesh(new T.CylinderGeometry(.33,.28,.10,12),bronze,group,0,2.1,0);
    for(let i=0;i<4;i++){const a=i*Math.PI/2+.78;this.box(group,bronze,Math.cos(a)*.24,2.55,Math.sin(a)*.24,.055,.8,.055);}this.mesh(new T.ConeGeometry(.43,.28,4),bronze,group,0,3.1,0);
    const m=this.mat('#ffe7ae',.3,.1);m.emissive.set('#ffc270');m.emissiveIntensity=1.25;const fire=this.mesh(new T.SphereGeometry(.085,16,12),m,group,0,2.52,0);fire.scale.y=1.6;fire.castShadow=false;
    const light=new T.PointLight('#ffd090',14,9,2);light.position.set(0,2.55,0);this.lamps.push({group,fire,light,kind});
  }
  buildArena(floor:T.Material,stone:T.Material,bronze:T.Material){
    const z=wz(530),c=new T.Group();c.position.set(0,0,z);this.terrain.add(c);const slab=this.mesh(new T.CylinderGeometry(14.5,14.7,.17,80),floor,c,0,-.025,0);slab.receiveShadow=true;
    for(const radius of [5,9.5,13.8]){const ring=this.mesh(new T.TorusGeometry(radius,.055,6,96),bronze,c,0,.08,0);ring.rotation.x=Math.PI/2;}
    for(let i=0;i<12;i++){const a=i/12*TAU;if(Math.sin(a)>.65)continue;const x=Math.cos(a)*14.4,zz=Math.sin(a)*14.4;this.box(c,stone,x,.2,zz,1.5,.4,1.5);this.mesh(new T.CylinderGeometry(.38,.5,3.5,10),stone,c,x,2,zz);this.mesh(new T.CylinderGeometry(.67,.61,.26,10),bronze,c,x,3.82,zz);}
  }
  createActor(kind:string):Actor{
    const prepared=this.actorReserve?.get(kind)?.pop();if(prepared)return prepared;
    const root=new T.Group(),actor:Actor={root,actions:new Map(),current:'',until:0,lastAtk:0,lastX:0,lastY:0,legs:[],kind,materials:[]};
    if(kind==='hero'){this.makeHero(actor);return actor;}
    if(kind==='beast'){this.makeWolf(actor);return actor;}
    if(this.art?.has(kind==='hero'?'hero':'enemies')){this.attachPaintedActor(actor,kind);return actor;}
    const data=this.models.get(kind==='archer'?'Rogue_Hooded':'Knight')!;const model=clone(data.scene);root.add(model);const boss=kind==='boss',elite=kind==='elite',hero=kind==='hero';model.scale.setScalar(boss?2.05:elite?1.55:hero?1.17:1.04);
    const keep=new Set(hero||boss||elite?['1H_Sword']:kind==='archer'?['1H_Crossbow']:['1H_Sword','Badge_Shield']);
    model.traverse(object=>{if(!(object instanceof T.Mesh))return;const n=object.name;if(/Sword|Shield|Crossbow|Knife|Throwable|Spellbook|Wand|Staff/.test(n)&&!keep.has(n)){object.visible=false;return;}
      object.castShadow=true;object.receiveShadow=true;const old=(Array.isArray(object.material)?object.material[0]:object.material) as T.MeshStandardMaterial;const mat=new T.MeshStandardMaterial({map:old.map||null,color:boss?'#a5a9a7':elite?'#c9bdae':'#ffffff',roughness:.55,metalness:.3});
      if(n.includes('Cape')){mat.map=null;mat.color.set(hero?'#8b2832':boss?'#42282d':'#374a40');mat.roughness=.93;mat.metalness=0;mat.side=T.DoubleSide;}
      if(n.includes('Sword')){mat.name='weapon';mat.map=null;mat.color.set(boss?'#997366':'#dce9e5');mat.metalness=.8;mat.roughness=.19;mat.emissive.set(boss?'#df581f':'#82d1db');mat.emissiveIntensity=boss?.45:.28;}
      if(boss&&n.includes('Helmet')){mat.emissive.set('#b74123');mat.emissiveIntensity=.15;}
      object.material=mat;actor.materials.push(mat);this.materials.add(mat);
    });
    actor.mixer=new T.AnimationMixer(model);for(const clip of data.animations)actor.actions.set(clip.name,actor.mixer.clipAction(clip));this.animate(actor,'Idle',0);
    if(!hero){const bar=new T.Group();const bg=new T.Mesh(new T.PlaneGeometry(1.35,.09),new T.MeshBasicMaterial({color:'#131c1b',transparent:true,opacity:.8,depthTest:false}));const fill=new T.Mesh(new T.PlaneGeometry(1.3,.055),new T.MeshBasicMaterial({color:boss?'#d88778':'#ddbd82',depthTest:false}));fill.position.z=.01;bar.add(bg,fill);bar.position.y=boss?5.2:elite?3.8:2.7;root.add(bar);actor.bar=bar;actor.fill=fill;}
    return actor;
  }
  makeHero(actor:Actor){
    const body=new T.Group(),head=new T.Group();body.name='hero-body';head.name='hero-head';actor.root.add(body);body.add(head);head.position.y=2.23;
    const leather=this.mat('#29373b',.78),cloth=this.mat('#174851',.92),red=this.mat('#792b35',.93),steel=this.mat('#607777',.4,.62),brass=this.mat('#a88b52',.4,.65),boot=this.mat('#192b30',.9),skin=this.mat('#bea68d',.82),hair=this.mat('#c9d0ca',.85),dark=this.mat('#344449',.87);
    actor.materials.push(leather,cloth,steel,brass,boot,skin,hair);
    for(const material of [leather,cloth,red]){material.onBeforeCompile=shader=>{shader.vertexShader='varying vec3 heroSurface;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nheroSurface=position;');shader.fragmentShader='varying vec3 heroSurface;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
      float grain=sin(heroSurface.x*173.)*sin(heroSurface.y*191.+heroSurface.z*127.);
      float folds=sin(heroSurface.x*39.+heroSurface.y*2.5)*.5+.5;
      float detail=1.-smoothstep(.025,.12,max(length(dFdx(heroSurface)),length(dFdy(heroSurface))));
      diffuseColor.rgb*=.93+grain*.035*detail+folds*.055;
    `);};material.customProgramCacheKey=()=> 'hero-worn-material-v1';}

    const torso=new T.Group();torso.name='hero-torso';body.add(torso);
    const profile=[new T.Vector2(.22,1.12),new T.Vector2(.24,1.28),new T.Vector2(.27,1.55),new T.Vector2(.35,1.81),new T.Vector2(.3,1.95),new T.Vector2(.16,2.01)];const chest=this.mesh(new T.LatheGeometry(profile,24),leather,torso);chest.scale.z=.66;
    this.sphere(torso,cloth,0,1.25,-.005,.25,.2,.19);const neck=this.mesh(new T.CylinderGeometry(.1,.12,.17,14),skin,body,0,2.05,0);
    // Human-sized head, subtle face planes and swept silver hair.
    this.sphere(head,skin,0,0,.02,.155,.205,.155);this.sphere(head,skin,0,-.105,.073,.113,.095,.108);
    this.sphere(head,skin,0,-.017,.168,.025,.055,.04);
    for(const side of [-1,1]){this.sphere(head,skin,side*.155,-.005,0,.026,.06,.04);this.sphere(head,dark,side*.061,.024,.152,.032,.01,.014);const brow=this.box(head,dark,side*.06,.056,.146,.067,.014,.018);brow.rotation.z=-side*.12;}
    const cap=this.mesh(new T.SphereGeometry(.17,20,14,0,TAU,0,Math.PI*.61),hair,head,0,.04,-.012);cap.scale.set(1,1.1,1);
    const lock=(start:T.Vector3,mid:T.Vector3,end:T.Vector3,radius:number)=>{const curve=new T.QuadraticBezierCurve3(start,mid,end),g=new T.TubeGeometry(curve,8,radius,6,false),p=g.getAttribute('position'),uv=g.getAttribute('uv');for(let i=0;i<p.count;i++){const t=uv.getX(i),centre=curve.getPointAt(t),factor=.12+.88*Math.pow(1-t,.6);p.setXYZ(i,centre.x+(p.getX(i)-centre.x)*factor,centre.y+(p.getY(i)-centre.y)*factor,centre.z+(p.getZ(i)-centre.z)*factor);}g.computeVertexNormals();this.mesh(g,hair,head);};
    for(let i=0;i<11;i++){const a=i/11*TAU;lock(new T.Vector3(Math.cos(a)*.09,.18,Math.sin(a)*.09),new T.Vector3(Math.cos(a)*.19,.15,Math.sin(a)*.17),new T.Vector3(Math.cos(a)*.16,-.04,Math.sin(a)*.15-.025),.035);}
    for(let i=0;i<7;i++){const x=-.12+i*.038;lock(new T.Vector3(x,.17,.055),new T.Vector3(x+.035,.16,.18),new T.Vector3(x-.035,.01-i%3*.015,.17),.026);}
    const scarf=this.mesh(new T.TorusGeometry(.155,.067,8,24),red,body,0,2.04,0);scarf.rotation.x=Math.PI/2;scarf.scale.x=1.16;
    const belt=this.mesh(new T.CylinderGeometry(.255,.25,.105,20),boot,torso,0,1.28,0);belt.scale.z=.78;this.box(torso,brass,0,1.28,.21,.12,.095,.027);
    for(const side of [-1,1]){for(let i=0;i<3;i++){const plate=this.box(torso,side<0?cloth:leather,side*(.13+i*.045),1.04-i*.065,.12,.115,.25,.045);plate.rotation.z=side*-.12;}
      this.sphere(torso,steel,side*.335,1.86,0,.155,.11,.2);this.box(torso,brass,side*.29,1.7,.18,.024,.17,.025);}
    const seamMat=this.mat('#927e54',.55,.4);
    const seam=(points:T.Vector3[],radius=.009)=>this.mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points),14,radius,5,false),seamMat,torso);
    for(const side of [-1,1]){seam([new T.Vector3(side*.27,1.91,.13),new T.Vector3(side*.2,1.7,.192),new T.Vector3(side*.16,1.34,.175)]);for(let i=0;i<4;i++){this.sphere(torso,brass,side*.21,1.4+i*.12,.19,.012,.012,.014);}for(let i=0;i<3;i++){const plate=this.box(torso,leather,side*.13,1.48+i*.13,.189,.23,.095,.034);plate.rotation.z=-side*.075;}}
    const baldric=this.mesh(new T.TubeGeometry(new T.CatmullRomCurve3([new T.Vector3(-.24,1.92,.15),new T.Vector3(-.04,1.65,.224),new T.Vector3(.2,1.3,.17)]),18,.028,8,false),boot,torso);baldric.name='hero-cross-body-strap';this.box(torso,brass,-.045,1.64,.25,.074,.1,.021).rotation.z=-.48;
    const arms:{shoulder:T.Group;elbow:T.Group;hand:T.Group;side:number}[]=[];
    for(const side of [-1,1]){const shoulder=new T.Group(),elbow=new T.Group(),hand=new T.Group();shoulder.position.set(side*.355,1.83,0);elbow.position.y=-.38;hand.position.y=-.36;torso.add(shoulder);shoulder.add(elbow);elbow.add(hand);
      this.mesh(new T.CapsuleGeometry(.089,.24,5,12),leather,shoulder,0,-.19,0);this.sphere(elbow,steel,0,0,0,.095,.085,.09);this.mesh(new T.CylinderGeometry(.087,.066,.29,12),steel,elbow,0,-.18,0);this.sphere(hand,boot,0,-.015,0,.073,.09,.07);this.mesh(new T.TorusGeometry(.08,.013,5,14),brass,elbow,0,-.1,0).rotation.x=Math.PI/2;for(const y of [-.13,-.26]){const strap=this.mesh(new T.TorusGeometry(.083,.014,5,14),boot,elbow,0,y,0);strap.rotation.x=Math.PI/2;this.box(elbow,brass,0,y,.085,.043,.034,.019);}arms.push({shoulder,elbow,hand,side});}
    const sword=new T.Group();sword.name='hero-long-sword';arms[1].hand.add(sword);sword.rotation.x=-.42;
    this.mesh(new T.CylinderGeometry(.027,.027,.17,10),boot,sword,0,.06,0);this.box(sword,brass,0,-.05,0,.29,.034,.053);this.sphere(sword,brass,0,.16,0,.04,.04,.04);
    const blade=new T.Shape();blade.moveTo(-.048,-.075);blade.lineTo(.048,-.075);blade.lineTo(.032,-.94);blade.lineTo(0,-1.12);blade.lineTo(-.032,-.94);blade.closePath();const edge=this.mat('#c6dfdf',.2,.85);edge.name='weapon';this.mesh(new T.ExtrudeGeometry(blade,{depth:.022,bevelEnabled:true,bevelSegments:1,bevelSize:.009,bevelThickness:.004,steps:1}),edge,sword,0,0,-.011);
    const rune=this.mat('#89bdbb',.28,.5);rune.emissive.set('#5daba9');rune.emissiveIntensity=.4;sword.userData.runeMaterial=rune;this.box(sword,rune,0,-.5,.018,.009,.72,.008);
    const legs:{hip:T.Vector3;upper:T.Mesh;lower:T.Mesh;paw:T.Group;side:number}[]=[];
    for(const side of [-1,1]){const hip=new T.Vector3(side*.145,1.15,0),upper=this.mesh(new T.CylinderGeometry(.12,.087,1,12),leather,body),lower=this.mesh(new T.CylinderGeometry(.08,.065,1,12),boot,body),paw=new T.Group();body.add(paw);this.sphere(paw,boot,0,.08,.045,.095,.115,.18);this.box(paw,brass,0,.12,.04,.13,.024,.15);legs.push({hip,upper,lower,paw,side});}
    // Cloth is an actual subdivided surface, attached at the shoulders.
    const clothMesh=(mat:T.Material,width:number,length:number,x:number,y:number,z:number)=>{const g=new T.PlaneGeometry(width,length,10,14),p=g.getAttribute('position');for(let i=0;i<p.count;i++){const t=(length/2-p.getY(i))/length;const edge=p.getX(i);p.setXYZ(i,edge*(.5+t*.5)+x,y-t*length-Math.pow(t,10)*(.025+.045*Math.sin(edge*29)+.018*Math.sin(edge*71)),z-t*.28+Math.sin(edge*21)*.018*t);}g.computeVertexNormals();const m=this.mesh(g,mat,body);m.userData.rest=Array.from(p.array);return m;};
    cloth.side=T.DoubleSide;red.side=T.DoubleSide;const capeMat=cloth.clone(),weave=cloth.onBeforeCompile;capeMat.onBeforeCompile=(shader,renderer)=>{weave(shader,renderer);shader.vertexShader='varying vec2 capeUV;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\ncapeUV=uv;');shader.fragmentShader='varying vec2 capeUV;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
float hem=min(min(capeUV.x,1.-capeUV.x),capeUV.y);float trim=1.-smoothstep(.008,.015,hem);diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.29,.24,.13),trim*.75);`);};capeMat.customProgramCacheKey=()=> 'hero-embroidered-cape-v1';this.materials.add(capeMat);const cape=clothMesh(capeMat,1.08,1.58,0,1.98,-.21);cape.name='hero-teal-cape';const ribbons=[clothMesh(red,.14,.74,-.09,2.08,-.25),clothMesh(red,.1,.6,.06,2.07,-.27)];
    const lamp=new T.Group();lamp.position.set(-.29,1.16,.12);lamp.scale.setScalar(1.12);torso.add(lamp);this.box(lamp,brass,0,.01,0,.14,.22,.12);const glow=this.mat('#ebc886',.3);glow.emissive.set('#ffc777');glow.emissiveIntensity=1.5;this.box(lamp,glow,0,.015,.065,.085,.15,.012);this.mesh(new T.TorusGeometry(.047,.01,5,12),brass,lamp,0,.16,0);
    const waist=new T.Group();waist.name='hero-waist-pivot';waist.position.y=1.2;body.add(waist);waist.add(torso);torso.position.y=-1.2;for(const part of [head,cape,...ribbons,scarf,neck])torso.add(part);
    actor.heroRig={waist,body,torso,head,arms,legs,cape,ribbons,sword};
  }
  updateHeroRig(actor:Actor,angle:number,dt:number,distance:number,moving:boolean,time:number,attack:{progress:number;combo:number}|null,dead=false){
    const rig=actor.heroRig;if(!rig)return;const step=Math.min(.05,Math.max(0,dt));actor.visualAngle??=angle;const delta=Math.atan2(Math.sin(angle-actor.visualAngle),Math.cos(angle-actor.visualAngle));actor.visualAngle+=Math.sign(delta)*Math.min(Math.abs(delta),step*(attack?18:10));actor.root.rotation.y=Math.PI/2-actor.visualAngle;
    actor.motionWeight=(actor.motionWeight||0)+(Number(moving&&!attack&&!actor.skillPose&&!dead)-(actor.motionWeight||0))*(1-Math.exp(-step*14));actor.stride=(actor.stride||0)+Math.min(.2,distance)*TAU/2.4;
    const phase=actor.stride,weight=actor.motionWeight,halfCycle=((phase/Math.PI)%1+1)%1,flight=halfCycle>.72?Math.sin((halfCycle-.72)/.28*Math.PI)*.065:0,combat=attack?Math.sin(attack.progress*Math.PI):actor.skillPose?.kind==='cast'?Math.sin(actor.skillPose.progress*Math.PI):0,bob=(-.1+flight)*weight-combat*.065,pulse=attack?Math.sin(attack.progress*Math.PI):0,sweep=attack?Math.sin(attack.progress*TAU)*(attack.combo===1?-1:1):0;
    rig.body.position.y=bob;rig.body.rotation.z=(actor.recoil||0)*.7;rig.body.rotation.x=dead?Math.PI*.42:0;rig.waist.rotation.x=weight*.28;rig.torso.rotation.y=sweep*(attack?.combo===2?.55:.32);rig.head.rotation.y=Math.max(-.18,Math.min(.18,delta*.15))-rig.torso.rotation.y*.35;rig.head.rotation.x=-weight*.17-pulse*.045;
    for(const arm of rig.arms){const run=Math.sin(phase+(arm.side>0?Math.PI:0));arm.shoulder.rotation.set(-.08+(arm.side>0?.22+run*.23:run*.7-.2)*weight,0,-arm.side*(.075+weight*.12));arm.elbow.rotation.set(-.18-weight*(arm.side>0?.65:1.05),0,0);arm.hand.rotation.set(0,0,0);}
    rig.sword.rotation.set(-.42-weight*.12,0,-weight*.16);
    // Keyframe channels: shoulder x/y/z, elbow x, wrist x/z, torso yaw, body lean.
    type Pose=number[];
    const idle:Pose=[-.08,0,-.075,-.18,-.42,0,0,0];
    const sample=(keys:{at:number;pose:Pose}[],p:number)=>{let i=1;while(i<keys.length-1&&p>keys[i].at)i++;const a=keys[i-1],b=keys[i],u=Math.max(0,Math.min(1,(p-a.at)/(b.at-a.at))),t=u*u*(3-2*u);return a.pose.map((v,j)=>v+(b.pose[j]-v)*t);};
    const apply=(pose:Pose)=>{const arm=rig.arms[1];arm.shoulder.rotation.set(pose[0],pose[1],pose[2]);arm.elbow.rotation.x=pose[3];rig.sword.rotation.set(pose[4],0,pose[5]);rig.torso.rotation.y=pose[6];rig.waist.rotation.x=pose[7];};
    if(attack){const plans:Pose[][]=[
      [[-2.1,-.35,-.7,-.75,.3,-.4,-.62,-.025],[-1.3,.5,.95,-.18,-.25,.65,.7,.19],[-.5,.25,.55,-.3,-.4,.25,.3,.1]],
      [[-1.35,.6,.95,-.6,-.1,.6,.65,.04],[-1.55,-.55,-1.05,-.18,-.2,-.55,-.75,.16],[-.45,-.25,-.5,-.35,-.35,-.1,-.3,.07]],
      [[-2.65,-.3,-.32,-.7,.55,-.2,-.45,-.09],[-1.15,.3,.2,-.1,-.4,.2,.48,.28],[-.3,.18,.12,-.25,-.35,.1,.2,.14]]
    ];const poses=plans[attack.combo];apply(sample([{at:0,pose:idle},{at:.19,pose:poses[0]},{at:.34,pose:poses[1]},{at:.7,pose:poses[2]},{at:1,pose:idle}],attack.progress));
      rig.arms[0].shoulder.rotation.x=-.2-pulse*.6;rig.arms[0].shoulder.rotation.z=.1+pulse*.55;rig.arms[0].elbow.rotation.x=-.3-pulse*.8;
    }
    const skill=actor.skillPose;if(skill){const swing=Math.sin(skill.progress*Math.PI);if(skill.kind==='spin'){rig.torso.rotation.y=skill.progress*TAU;for(const arm of rig.arms){arm.shoulder.rotation.z=-arm.side*(.4+swing*.8);arm.shoulder.rotation.x=-.65;arm.elbow.rotation.x=-.25;}}else if(skill.kind==='cast'){
      apply(sample([{at:0,pose:idle},{at:.2,pose:[-1.65,-.65,-1.1,-.65,-.1,-.7,-.75,-.03]},{at:.29,pose:[-1.45,.7,1.05,-.12,-.15,.65,.78,.2]},{at:.58,pose:[-.85,.45,.7,-.3,-.25,.4,.4,.1]},{at:1,pose:idle}],skill.progress));
      rig.arms[0].shoulder.rotation.x=-swing*.9;rig.arms[0].elbow.rotation.x=-.2-swing*.9;
    }else{rig.waist.rotation.x=.2*swing;rig.arms[1].shoulder.rotation.x=-.8;}}
    const charge=skill?.kind==='cast'?(skill.progress<.27?skill.progress/.27:Math.exp(-(skill.progress-.27)*10)):0;(rig.sword.userData.runeMaterial as T.MeshStandardMaterial).emissiveIntensity=.4+charge*1.7;
    const segment=(mesh:T.Mesh,from:T.Vector3,to:T.Vector3)=>{const d=to.clone().sub(from);mesh.position.copy(from).addScaledVector(d,.5);mesh.scale.y=d.length();mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());};
    for(const leg of rig.legs){const cycle=((phase+(leg.side>0?Math.PI:0))/TAU%1+1)%1,swing=cycle>.36,t=swing?(cycle-.36)/.64:cycle/.36,u=t*t*(3-2*t);const foot=new T.Vector3(leg.hip.x+leg.side*combat*.055,.04-bob+(swing?Math.pow(Math.sin(t*Math.PI),1.1)*.4*weight:0),(swing?-.432+.864*u:.432-.864*t)*weight+(leg.side<0?.25:-.2)*combat);
      const hip=leg.hip,dy=foot.y-hip.y,dz=foot.z-hip.z,d=Math.min(1.149,Math.hypot(dy,dz)),l=.575,along=d/2,bend=Math.sqrt(Math.max(0,l*l-along*along)),len=Math.hypot(dy,dz);const knee=new T.Vector3(hip.x,hip.y+dy/len*along+dz/len*bend,hip.z+dz/len*along-dy/len*bend);segment(leg.upper,hip,knee);segment(leg.lower,knee,foot);leg.paw.position.copy(foot);leg.paw.rotation.x=swing?Math.sin(t*Math.PI)*.6:0;}
    for(const cloth of [rig.cape,...rig.ribbons]){const p=cloth.geometry.getAttribute('position'),rest=cloth.userData.rest as number[],length=cloth===rig.cape?1.58:cloth===rig.ribbons[0]?.74:.6,top=cloth===rig.cape?1.98:2.08;for(let i=0;i<p.count;i++){const x=rest[i*3],y=rest[i*3+1],z=rest[i*3+2],t=Math.max(0,Math.min(1,(top-y)/length));p.setXYZ(i,x+Math.sin(time*3-t*4+x*3)*t*t*.035+delta*t*t*.055,y+weight*t*t*.22+Math.sin(time*4-t*5)*t*.014,z-(weight*.64+combat*.2)*t*t+Math.sin(time*5-t*6+x*4)*t*t*(.025+weight*.075));}p.needsUpdate=true;cloth.geometry.computeVertexNormals();}
  }
  makeWolf(actor:Actor){
    const root=actor.root,body=new T.Group(),head=new T.Group(),jaw=new T.Group(),tail=new T.Group();root.add(body);body.add(head,tail);head.add(jaw);
    const fur=this.mat('#35494a',.88),mane=this.mat('#23363b',.92),ridge=this.mat('#62726c',.8),nose=this.mat('#15272b',.7),tooth=this.mat('#b4b5a0',.64);
    actor.materials.push(fur,mane,ridge);head.position.set(0,1.16,.61);jaw.position.set(0,-.12,.2);tail.position.set(0,1,-.8);
    // Elliptical cross-sections make a continuous, tapered silhouette rather than stacked spheres.
    const loft=(parent:T.Group,mat:T.Material,rings:number[][])=>{const points:number[]=[],indices:number[]=[],segments=14;for(const[z,y,rx,ry]of rings)for(let j=0;j<=segments;j++){const a=j/segments*TAU;points.push(Math.cos(a)*rx,y+Math.sin(a)*ry,z);}for(let i=0;i<rings.length-1;i++)for(let j=0;j<segments;j++){const a=i*(segments+1)+j,b=a+segments+1;indices.push(a,a+1,b,a+1,b+1,b);}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(points,3));g.setIndex(indices);g.computeVertexNormals();return this.mesh(g,mat,parent);};
    loft(body,fur,[[-.98,.96,.015,.03],[-.77,1.02,.25,.29],[-.43,1.03,.25,.24],[-.08,1.08,.29,.3],[.28,1.13,.36,.43],[.57,1.19,.25,.34],[.75,1.26,.02,.06]]);
    loft(head,fur,[[-.25,0,.015,.02],[-.12,.025,.22,.25],[.16,.015,.23,.23],[.3,-.04,.16,.15],[.66,-.13,.095,.085],[.74,-.13,.035,.045]]);
    loft(jaw,mane,[[0,0,.13,.045],[.36,-.025,.095,.035],[.5,-.02,.02,.025]]);
    loft(tail,mane,[[0,0,.14,.13],[-.2,-.05,.17,.16],[-.5,-.22,.14,.15],[-.83,-.35,.055,.08],[-1,-.3,.003,.01]]);
    const earGeo=new T.BufferGeometry();earGeo.setAttribute('position',new T.Float32BufferAttribute([-.12,0,0,.12,0,0,.025,.38,-.07,0,.04,-.12],3));earGeo.setIndex([0,1,2,0,2,3,1,3,2,0,3,1]);earGeo.computeVertexNormals();
    for(const side of [-1,1]){const ear=this.mesh(earGeo,mane,head,side*.17,.19,-.04);ear.rotation.z=-side*.14;const eyeMat=this.mat('#bc9562',.45);eyeMat.name='weapon-eye';eyeMat.emissive.set('#825227');eyeMat.emissiveIntensity=.55;this.sphere(head,eyeMat,side*.186,.045,.28,.039,.025,.045);const fang=this.mesh(new T.ConeGeometry(.026,.115,7),tooth,head,side*.095,-.17,.5);fang.rotation.z=Math.PI;}
    this.sphere(head,nose,0,-.115,.706,.09,.063,.054);
    for(let i=0;i<11;i++){const tuft=this.mesh(new T.ConeGeometry(.13-i*.004,.33,5),i%3?mane:ridge,body,(i%2?1:-1)*(.18-i*.01),1.42-i*.023,.43-i*.11);tuft.rotation.x=-.8;tuft.rotation.z=(i%2?1:-1)*.35;}
    const limbs:{hip:T.Vector3;upper:T.Mesh;lower:T.Mesh;paw:T.Group;front:boolean;side:number}[]=[];
    for(const front of [true,false])for(const side of [-1,1]){const hip=new T.Vector3(side*(front?.27:.22),front?1.07:.93,front?.34:-.68);const upper=this.mesh(new T.CylinderGeometry(front?.095:.12,.07,1,9),fur,body),lower=this.mesh(new T.CylinderGeometry(.057,.042,1,8),mane,body),paw=new T.Group();body.add(paw);this.sphere(paw,fur,0,.055,.04,.082,.072,.14);for(let toe=0;toe<3;toe++){const claw=this.mesh(new T.ConeGeometry(.014,.062,5),tooth,paw,(toe-1)*.043,.036,.162);claw.rotation.x=Math.PI/2;}limbs.push({hip,upper,lower,paw,front,side});actor.legs.push(paw);}
    actor.beastRig={body,head,jaw,tail,limbs};this.updateWolf(actor,0,0,0,false,0,Infinity);actor.visualAngle=undefined;
  }
  updateWolf(actor:Actor,angle:number,dt:number,distance:number,moving:boolean,wind:number,sinceBite:number){
    const rig=actor.beastRig;if(!rig)return;const step=Math.min(.05,Math.max(0,dt));actor.visualAngle??=angle;
    const delta=Math.atan2(Math.sin(angle-actor.visualAngle),Math.cos(angle-actor.visualAngle));actor.visualAngle+=Math.sign(delta)*Math.min(Math.abs(delta),step*8);actor.root.rotation.y=Math.PI/2-actor.visualAngle;
    actor.motionWeight=(actor.motionWeight||0)+(Number(moving&&wind<=0)-(actor.motionWeight||0))*(1-Math.exp(-step*14));actor.stride=(actor.stride||0)+Math.min(.3,distance)*TAU/.81;
    actor.beastCrouch=(actor.beastCrouch||0)+((wind>0?(1-Math.min(1,wind/.48))*.2:0)-(actor.beastCrouch||0))*(1-Math.exp(-step*18));
    const phase=actor.stride,weight=actor.motionWeight,crouch=actor.beastCrouch,bite=sinceBite>=0&&sinceBite<.3?Math.sin(sinceBite/.3*Math.PI):0;
    rig.body.position.set(0,Math.sin(phase*2)*.025*weight-crouch+bite*.13,bite*.28);rig.body.rotation.set(-bite*.08,Math.sin(phase)*.025*weight,(actor.recoil||0)*.5);
    rig.head.rotation.x=-crouch*.7-bite*.25;rig.head.rotation.y=Math.max(-.16,Math.min(.16,delta*.15));const jawTarget=.045+(wind>0?(1-Math.min(1,wind/.48))*.2:0)+bite*.48;rig.jaw.rotation.x+=(jawTarget-rig.jaw.rotation.x)*(1-Math.exp(-step*22));
    rig.tail.rotation.y=Math.sin(phase*.5)*.13*weight+Math.max(-.25,Math.min(.25,delta*.2));rig.tail.rotation.x=crouch*.7-bite*.16;
    const segment=(mesh:T.Mesh,from:T.Vector3,to:T.Vector3)=>{const d=to.clone().sub(from);mesh.position.copy(from).addScaledVector(d,.5);mesh.scale.y=d.length();mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());};
    for(const limb of rig.limbs){const cycle=((phase+(limb.front?(limb.side>0?0:Math.PI):(limb.side>0?Math.PI:0)))/TAU%1+1)%1;
      const swing=cycle>.62,t=swing?(cycle-.62)/.38:cycle/.62;const travel=(swing?-.25+.5*t:.25-.5*t)*weight,lift=swing?Math.sin(t*Math.PI)*.16*weight:0;
      const foot=new T.Vector3(limb.hip.x,.04+lift+crouch-Math.sin(phase*2)*.025*weight,limb.hip.z+travel+(limb.front?.07:-.06));const hip=limb.hip.clone(),dy=foot.y-hip.y,dz=foot.z-hip.z,len=Math.hypot(dy,dz),upper=.55,lower=.57,d=Math.min(upper+lower-.002,Math.max(.01,len)),along=(upper*upper-lower*lower+d*d)/(2*d),bend=Math.sqrt(Math.max(0,upper*upper-along*along))*(limb.front?1:-1);
      const knee=new T.Vector3(hip.x,hip.y+dy/len*along-dz/len*bend,hip.z+dz/len*along+dy/len*bend);segment(limb.upper,hip,knee);segment(limb.lower,knee,foot);limb.paw.position.copy(foot);limb.paw.rotation.x=swing?Math.sin(t*Math.PI)*.32:0;
    }
  }
  animate(actor:Actor,name:string,time:number,duration?:number){if(actor.current===name&&!duration)return;const next=actor.actions.get(name);if(!next)return;const old=actor.actions.get(actor.current);if(old!==next)old?.fadeOut(.12);next.reset().fadeIn(.12);if(duration){next.setLoop(T.LoopOnce,1);next.clampWhenFinished=true;next.setEffectiveTimeScale(next.getClip().duration/duration);actor.until=time+duration;}else{next.setLoop(T.LoopRepeat,Infinity);next.clampWhenFinished=false;next.setEffectiveTimeScale(name.startsWith('Running')?1.3:1);actor.until=0;}next.play();actor.current=name;}
  canWalk(x:number,y:number){return !this.colliders.some(t=>Math.hypot(x-t.x,y-t.y)<t.r+14);}
  pointerWorld(x:number,y:number){this.raycaster.setFromCamera(new T.Vector2(x,y),this.camera);const p=this.raycaster.ray.intersectPlane(this.plane,new T.Vector3());return p?{x:p.x/S+800,y:p.z/S+2100}:null;}
  render(game:NightGame){
    if(this.disposed||!this.hero)return;if(game.mode!=='playing'&&this.lastMode===game.mode&&!this.needsRender)return;this.needsRender=false;this.frame++;const dt=Math.min(.05,Math.max(0,game.clock-this.lastClock));this.lastClock=game.clock;
    if(this.sampleTime)this.sampleTime.value=game.clock;if(this.qualitySample)this.qualitySample.visible=game.cam.y>3000;
    const p=game.player,freshPlayer=this.lastPlayer!==p;this.lastPlayer=p;
    if(freshPlayer){this.swordTrail=[];this.hero.desiredHeading=p.a;this.hero.visualAngle=p.a;this.hero.visualColumn=undefined;this.hero.poseKey=undefined;this.hero.poseBlend=1;this.hero.motionWeight=0;this.hero.stride=0;this.hero.lastX=p.x;this.hero.lastY=p.y;if(this.hero.previousPose)this.hero.previousPose.visible=false;}
    this.updateRenderBudget(performance.now(),game.mode==='playing');const target=new T.Vector3(wx(game.cam.x),0,wz(game.cam.y));this.updateWorldChunks(target.z);this.updateChapterScenery(game,target);this.camera.position.set(target.x,27,target.z+22);this.camera.lookAt(target.x,0,target.z);this.camera.updateMatrixWorld();this.sun.position.set(target.x-14,27,target.z+9);this.sun.target.position.copy(target);
    this.hero.root.position.set(wx(p.x),.12,wz(p.y));this.hero.root.rotation.y=Math.PI/2-p.a;
    const travelX=p.x-this.hero.lastX,travelY=p.y-this.hero.lastY;
    const travelling=p.moving&&Math.hypot(travelX,travelY)>.01;
    if(travelling&&p.atk<=0)this.hero.desiredHeading=Math.atan2(travelY,travelX);else if(p.atk>0||game.aimMode==='mouse')this.hero.desiredHeading=p.a;
    const facing=this.hero.desiredHeading??p.a;
    if(this.hero.lastHP!==undefined&&p.hp<this.hero.lastHP)this.hero.recoil=.1;this.hero.lastHP=p.hp;this.hero.recoil=(this.hero.recoil||0)*Math.exp(-dt*14);
    const strike=game.strike,progress=strike?Math.min(1,(game.clock-strike.time)/strike.duration):1;
    const attacking=!!strike&&progress<1&&p.atk>0;
    this.hero.attackLean=attacking?Math.sin(progress*Math.PI*2)*(strike.combo===2?.12:.065)*(strike.combo===1?-1:1):0;
    const ability=game.abilityPose;this.hero.skillPose=p.atk>0&&!attacking&&ability?{kind:ability.kind,progress:Math.max(0,Math.min(1,(game.clock-ability.time)/ability.duration))}:undefined;
    this.updateHeroRig(this.hero,attacking?strike.angle:this.hero.skillPose&&ability?ability.angle:facing,dt,travelling?Math.hypot(travelX,travelY)*S:0,p.moving,game.clock,attacking?{progress,combo:strike.combo}:null,game.mode==='dead');
    if(this.hero.heroRig&&!game.skillUnlocked('ranged'))(this.hero.heroRig.sword.userData.runeMaterial as T.MeshStandardMaterial).emissiveIntensity=.08;
    if(game.guard>0&&this.hero.heroRig){const rig=this.hero.heroRig;rig.arms[1].shoulder.rotation.set(-1.25,.2,.6);rig.arms[1].elbow.rotation.x=-.85;rig.sword.rotation.z=-.9;}
    if(attacking){const reach=Math.sin(progress*Math.PI)*(strike.combo===2?.16:.08);this.hero.root.position.x+=Math.cos(strike.angle)*reach;this.hero.root.position.z+=Math.sin(strike.angle)*reach;}
    this.hero.lastX=p.x;this.hero.lastY=p.y;
    if(p.atk>this.hero.lastAtk+.06){this.animate(this.hero,p.e>7.6?'2H_Melee_Attack_Spin':p.q>4.7?'1H_Melee_Attack_Stab':['1H_Melee_Attack_Slice_Horizontal','1H_Melee_Attack_Slice_Diagonal','1H_Melee_Attack_Chop'][p.combo],game.clock,Math.max(.3,p.atk));}
    if(this.hero.until<=game.clock)this.animate(this.hero,p.moving?'Running_A':game.mode==='won'?'Cheer':game.mode==='dead'?'Death_A_Pose':'Idle',game.clock);this.hero.lastAtk=p.atk;this.hero.mixer?.update(dt);
    this.heroRing.position.set(wx(p.x),.03,wz(p.y));this.heroLight.position.set(wx(p.x),1.5,wz(p.y));this.heroLight.intensity=4+(attacking&&strike.combo===2?Math.sin(progress*Math.PI)*3:0);this.heroRing.visible=game.mode!=='menu';
    // Entity IDs reset on retry; discard obsolete visual instances with the run.
    if(freshPlayer){for(const a of this.actors.values())this.disposeActor(a);this.actors.clear();}
    this.lastMode=game.mode;let nearest=600,selected:NightGame['enemies'][number]|undefined;
    const ids=new Set<number>();for(const e of game.enemies){ids.add(e.id);let a=this.actors.get(e.id);if(!a&&(e.dead||Math.abs(e.y-game.cam.y)>1100))continue;if(!a){a=this.createActor(e.kind);this.actors.set(e.id,a);this.scene.add(a.root);a.lastX=e.x;a.lastY=e.y;}
      a.root.visible=Math.abs(e.y-game.cam.y)<950;if(!a.root.visible)continue;
      if(e.dead){if(a.deadAt===undefined){a.deadAt=game.clock;this.animate(a,'Death_A',game.clock,.75);}const t=game.clock-a.deadAt;if(a.beastRig){a.beastRig.body.rotation.z=Math.min(1,t/.35)*1.35;a.beastRig.body.position.y=-Math.min(.65,t*1.8);}if(a.billboard){const m=a.billboard.material as T.MeshBasicMaterial;m.opacity=e.kind==='boss'?.65:Math.max(0,1-t/1.1);m.depthWrite=false;if(a.previousPose)a.previousPose.visible=false;}a.root.position.y=e.kind==='boss'?.08:.12-Math.max(0,t-.35)*.7;if(e.kind==='boss')a.root.rotation.z=-.25;if(t>1.4&&e.kind!=='boss'){this.disposeActor(a);this.actors.delete(e.id);continue;}a.mixer?.update(dt);if(a.bar)a.bar.visible=false;continue;}
      if(e.hp<(a.lastHP??e.max))a.recoil=(Math.cos(e.aim)>0?1:-1)*(e.kind==='boss'?.055:.14);a.lastHP=e.hp;a.recoil=(a.recoil||0)*Math.exp(-dt*13);
      a.root.position.set(wx(e.x),.12,wz(e.y));a.root.rotation.y=Math.PI/2-e.aim;a.root.rotation.z=a.billboard?0:(a.recoil||0)*.7;a.attackLean=e.wind>0?Math.sin(Math.min(1,e.wind)*Math.PI)*.06*(Math.cos(e.aim)>0?1:-1):0;const moving=Math.hypot(e.x-a.lastX,e.y-a.lastY)>.04;this.updatePaintedActor(a,e.aim,a.atlasRow||0,0,dt,moving);
      if(e.wind>0&&a.current!=='1H_Melee_Attack_Chop'&&a.current!=='1H_Ranged_Shooting')this.animate(a,e.kind==='archer'?'1H_Ranged_Shooting':'1H_Melee_Attack_Chop',game.clock,e.wind+.2);
      if(a.until<=game.clock)this.animate(a,moving?'Running_A':'Idle',game.clock);a.mixer?.update(dt);if(e.kind==='beast')this.updateWolf(a,e.aim,dt,Math.hypot(e.x-a.lastX,e.y-a.lastY)*S,moving,e.wind,e.strikeTime===undefined?Infinity:game.clock-e.strikeTime);
      if(a.billboard)(a.billboard.material as T.MeshBasicMaterial).color.set(e.flash>0?'#ffccaa':'#ffffff');
      for(const m of a.materials){if(e.flash>0){m.emissive.set('#bbdbcb');m.emissiveIntensity=.8;}else if(!m.name.includes('weapon')){m.emissive.set(e.kind==='boss'?'#381b10':'#000000');m.emissiveIntensity=e.kind==='boss'?.2:0;}}
      if(a.bar){a.bar.visible=e.hp<e.max;a.bar.quaternion.copy(a.root.quaternion).invert().multiply(this.camera.quaternion);a.fill!.scale.x=Math.max(0,e.hp/e.max);a.fill!.position.x=-(1-e.hp/e.max)*.65;}
      a.lastX=e.x;a.lastY=e.y;const distance=Math.hypot(e.x-p.x,e.y-p.y);if(distance<nearest){nearest=distance;selected=e;}
    }
    for(const[id,a]of this.actors)if(!ids.has(id)){this.disposeActor(a);this.actors.delete(id);}
    for(const tree of this.paintedTrees){const f=tree.userData.foot;tree.visible=Math.abs(f.z-target.z)<28;}
    this.targetRing.visible=!!selected&&game.aimMode==='auto'&&game.mode==='playing';if(selected){this.targetRing.position.set(wx(selected.x),.035,wz(selected.y));this.targetRing.scale.setScalar(selected.r*S+ .18);}
    const litLamps=this.lamps.filter(lamp=>(lamp.stage??0)===game.stage&&(lamp.kind==='route'||lamp.kind==='camp'&&game.used.has(2)||lamp.kind==='end'&&(game.mode==='won'||game.mode==='interlude'))).sort((a,b)=>Math.abs(a.group.position.z-target.z)-Math.abs(b.group.position.z-target.z));
    for(const lamp of this.lamps){lamp.fire.visible=litLamps.includes(lamp);lamp.fire.scale.y=1.5+Math.sin(game.clock*10)*.15;}
    // Stable light count avoids shader variants recompiling at lamp boundaries.
    const lightSources=litLamps.map(lamp=>({position:lamp.group.localToWorld(new T.Vector3(0,2.55,0)),strength:10}));
    if(game.stage===1)for(const f of this.villageFires){if(!f.mesh.visible||f.mesh.parent?.children[0]!==f.mesh)continue;lightSources.push({position:f.mesh.getWorldPosition(new T.Vector3()).add(new T.Vector3(0,.6,0)),strength:15});}
    lightSources.sort((a,b)=>a.position.distanceToSquared(target)-b.position.distanceToSquared(target));
    this.routeLights.forEach((light,i)=>{const source=lightSources[i];if(!source){light.intensity=0;return;}light.position.copy(source.position);const distance=Math.abs(light.position.z-target.z),fade=Math.max(0,Math.min(1,(23-distance)/5));light.intensity=source.strength*fade*(.95+Math.sin(game.clock*8+light.position.z)*.05);});
    const shard=this.terrain.getObjectByName('patrol-medallion');if(shard)shard.visible=!game.used.has(1);
    if(this.water){const mat=this.water.material as T.MeshPhysicalMaterial;mat.roughness=.18+Math.sin(game.clock*.6)*.035;}
    const swingActive=attacking&&progress>.17&&progress<.7||!!this.hero.skillPose&&(this.hero.skillPose.kind==='spin'||this.hero.skillPose.kind==='cast'&&this.hero.skillPose.progress>.19&&this.hero.skillPose.progress<.6);this.sampleSwordTrail(this.hero,game.clock,swingActive);
    this.drawEffects(game);this.composer.render(dt);
  }
  sampleSwordTrail(actor:Actor,time:number,active:boolean){
    this.swordTrail??=[];this.swordTrail=this.swordTrail.filter(p=>time-p.time<.14);
    if(!active||!actor.heroRig||this.swordTrail.at(-1)?.time===time)return;
    const sword=actor.heroRig.sword;sword.updateWorldMatrix(true,false);this.swordTrail.push({near:sword.localToWorld(new T.Vector3(0,-.22,0)),far:sword.localToWorld(new T.Vector3(0,-1.12,0)),time});if(this.swordTrail.length>12)this.swordTrail.shift();
  }
  private effectScratch?:T.BufferGeometry;
  effectArc(inner:number,outer:number,segments:number,start=0,length=TAU){
    const geometry=this.effectScratch??=new T.BufferGeometry();
    if(!geometry.getAttribute('position'))geometry.setAttribute('position',new T.BufferAttribute(new Float32Array(60*6*3),3));
    const p=geometry.getAttribute('position') as T.BufferAttribute;let n=0;
    for(let i=0;i<segments;i++){const a=start+length*i/segments,b=start+length*(i+1)/segments;
      for(const [r,t] of [[inner,a],[outer,a],[outer,b],[inner,a],[outer,b],[inner,b]])p.setXYZ(n++,Math.cos(t)*r,Math.sin(t)*r,0);
    }
    geometry.setDrawRange(0,n);return geometry;
  }
  pooled(geometry:T.BufferGeometry,color:string,opacity:number){
    let mesh=this.effectPool[this.poolIndex++];
    if(!mesh){mesh=new T.Mesh(new T.BufferGeometry(),new T.MeshBasicMaterial({color,transparent:true,opacity,side:T.DoubleSide,depthWrite:false}));mesh.frustumCulled=false;this.effects.add(mesh);this.effectPool.push(mesh);}
    const target=mesh.geometry,position=geometry.getAttribute('position'),needed=Number.isFinite(geometry.drawRange.count)?geometry.drawRange.count:position.count;
    let buffer=target.getAttribute('position') as T.BufferAttribute|undefined;
    if(!buffer||buffer.count<needed){target.dispose();buffer=new T.BufferAttribute(new Float32Array(Math.max(256,needed)*3),3).setUsage(T.DynamicDrawUsage);target.setAttribute('position',buffer);}
    (buffer.array as Float32Array).set((position.array as Float32Array).subarray(0,needed*3));buffer.needsUpdate=true;
    const index=geometry.getIndex();
    if(index){let dest=target.getIndex();if(!dest||dest.count<index.count){target.dispose();dest=new T.BufferAttribute(new Uint16Array(Math.max(768,index.count)),1).setUsage(T.DynamicDrawUsage);target.setIndex(dest);}(dest.array as Uint16Array).set(index.array);dest.needsUpdate=true;target.setDrawRange(0,index.count);}
    else{target.setIndex(null);target.setDrawRange(0,needed);}
    if(geometry!==this.effectScratch)geometry.dispose();
    const m=mesh.material as T.MeshBasicMaterial;m.color.set(color);m.opacity=opacity;
    mesh.visible=true;mesh.position.set(0,.05,0);mesh.rotation.set(-Math.PI/2,0,0);mesh.scale.set(1,1,1);return mesh;
  }
  drawEffects(game:NightGame){this.poolIndex=0;
    for(let i=1;i<this.swordTrail.length;i++){const a=this.swordTrail[i-1],b=this.swordTrail[i];if(b.time-a.time>.06)continue;const vertices=[...a.near.toArray(),...a.far.toArray(),...b.near.toArray(),...a.far.toArray(),...b.far.toArray(),...b.near.toArray()],g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));const m=this.pooled(g,game.strike?.combo===2?'#f4e1b7':'#e9e2d3',Math.max(0,1-(game.clock-b.time)/.14)*.42);m.position.set(0,0,0);m.rotation.set(0,0,0);}

    for(const e of game.enemies){if(e.dead||e.wind<=0)continue;const x=wx(e.x),z=wz(e.y),radius=(e.kind==='boss'?e.attack===2?165:215:e.kind==='elite'?150:85)*S;let m:T.Mesh;
      if(e.kind==='archer'||e.kind==='boss'&&e.attack===1){const length=(e.kind==='archer'?410:330)*S,width=e.kind==='archer'?.23:3.5;m=this.pooled(new T.PlaneGeometry(length,width),'#ef726e',.32);m.position.set(x+Math.cos(e.aim)*length/2,.06,z+Math.sin(e.aim)*length/2);m.rotation.z=-e.aim;}
      else{const full=e.kind==='boss'&&e.attack===2;m=this.pooled(this.effectArc(0,radius,60,full?0:-e.aim-1.3,full?TAU:2.6),'#ee7668',.27);m.position.set(x,.055,z);const ring=this.pooled(this.effectArc(radius-.04,radius,60,full?0:-e.aim-1.3,full?TAU:2.6),'#ffac87',.72);ring.position.set(x,.07,z);}}
    for(const s of game.slashes){const a=1-s.life/s.max,heavy=s.combo===2,r=s.radius*S*(.82+a*.18),sweep=s.combo===1?-1:1;
      const arc=s.spin?TAU*.85:heavy?2.6:1.65,start=s.spin?a*TAU:-s.angle-arc/2+sweep*(a-.5)*.85;
      const m=this.pooled(this.effectArc(r-(heavy?.24:.12),r+.035,60,start,arc),heavy?'#ffe5b5':'#e9e2d3',s.life/s.max*.95);m.position.set(wx(s.x),.75,wz(s.y));m.rotation.x=-Math.PI/2+(s.combo===0?.22:s.combo===1?-.12:.08);
      const m2=this.pooled(this.effectArc(r-(heavy?.72:.4),r-.12,48,start,arc),heavy?'#dca356':'#aca28f',s.life/s.max*.32);m2.position.copy(m.position);m2.rotation.copy(m.rotation);
    }
    for(const s of game.shots){if(s.delay&&s.delay>0)continue;const a=Math.atan2(s.vy,s.vx);const m=this.pooled(this.effectArc(s.enemy?.25:.7,s.enemy?.31:.83,24,-a-.9,1.8),s.enemy?'#fb8ca4':'#b5ffea',.98);m.position.set(wx(s.x),.8,wz(s.y));}
    for(const h of game.hazards){const m=this.pooled(this.effectArc(0,h.r*S,48),h.delay>0?'#e7a883':'#ec743e',h.delay>0?.25:.46);m.position.set(wx(h.x),.06,wz(h.y));}
    for(let i=this.poolIndex;i<this.effectPool.length;i++)this.effectPool[i].visible=false;
    let count=0;const color=new T.Color();const activeLabels=new Set<object>();for(const f of game.fx){if(f.text){activeLabels.add(f);let label=this.numberLabels.get(f);if(!label){const canvas=document.createElement('canvas');canvas.width=256;canvas.height=64;const ctx=canvas.getContext('2d')!;ctx.font='bold 30px Arial';ctx.textAlign='center';ctx.strokeStyle='#122b2d';ctx.lineWidth=5;ctx.strokeText(f.text,128,42);ctx.fillStyle=f.color;ctx.fillText(f.text,128,42);const texture=new T.CanvasTexture(canvas);label=new T.Sprite(new T.SpriteMaterial({map:texture,transparent:true,depthTest:false}));label.scale.set(3.4,.85,1);this.numberLabels.set(f,label);this.scene.add(label);}label.position.set(wx(f.x),2.4,wz(f.y));label.material.opacity=Math.max(0,f.life/f.max);continue;}if(count>=1200)break;this.particlePositions[count*3]=wx(f.x);this.particlePositions[count*3+1]=.4+(1-f.life/f.max)*1.6;this.particlePositions[count*3+2]=wz(f.y);color.set(f.color).multiplyScalar(f.life/f.max*1.5);color.toArray(this.particleColors,count*3);count++;}
    for(const[f,label]of this.numberLabels)if(!activeLabels.has(f)){this.scene.remove(label);label.material.map?.dispose();label.material.dispose();this.numberLabels.delete(f);}this.particleGeometry.setDrawRange(0,count);this.particleGeometry.getAttribute('position').needsUpdate=true;this.particleGeometry.getAttribute('color').needsUpdate=true;
  }
  destroy(){if(this.disposed)return;this.disposed=true;this.observer.disconnect();for(const pool of this.actorReserve.values())for(const actor of pool)this.disposeActor(actor);this.actorReserve.clear();this.scene.traverse(object=>{if(object instanceof T.Mesh||object instanceof T.Points){object.geometry.dispose();for(const m of Array.isArray(object.material)?object.material:[object.material])m.dispose();}});for(const t of this.textures)t.dispose();for(const g of this.geometries)g.dispose();for(const m of this.materials)m.dispose();for(const model of this.models.values())model.scene.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();const mats=Array.isArray(o.material)?o.material:[o.material];for(const m of mats){m.map?.dispose();m.dispose();}}});this.effectScratch?.dispose();this.environment.dispose();for(const pass of this.composer.passes)pass.dispose?.();this.composer.dispose();this.renderer.dispose();this.renderer.forceContextLoss();}
}
