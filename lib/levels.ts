export const AVAILABLE_CHAPTERS=2;
export const futureChapters=['鸦渡要塞','沉钟修道院','赤原战场','霜脊隘口','王城之夜','长夜王座'];
export type Site={id:number;x:number;y:number;name:string;detail:string};
export const forestSites:Site[]=[
 {id:0,x:1030,y:2890,name:'猎人营地',detail:'救下猎人，获知村庄侧巷'},
 {id:1,x:650,y:1880,name:'巡逻队遗物',detail:'查看渡鸦徽记与遗留军令'},
 {id:2,x:790,y:1300,name:'废弃哨所',detail:'与艾琳交谈，补充药剂并存档'},
];
export const villageSites:Site[]=[
 {id:0,x:1120,y:2780,name:'燃烧谷仓',detail:'从侧门救出铁匠'},
 {id:1,x:535,y:2050,name:'押解庭院',detail:'打开牢笼，救下村民'},
 {id:2,x:1100,y:1320,name:'北方粮仓',detail:'关闭火油阀，保住粮食'},
];
export const sitesFor=(stage:number)=>stage===1?villageSites:forestSites;
export type Building={x:number;y:number;w:number;d:number;h:number;burned:boolean;variant:0|1|2|3};
// Geometry footprints and art placements share these coordinates. South is the entrance.
export const villageBuildings:Building[]=[
 {x:340,y:3450,w:200,d:170,h:4.5,burned:false,variant:0},
 {x:1250,y:3310,w:190,d:210,h:4.2,burned:false,variant:0},
 {x:730,y:2980,w:240,d:170,h:4.2,burned:false,variant:2},
 {x:295,y:2790,w:160,d:230,h:4.3,burned:true,variant:1},
 {x:805,y:2490,w:220,d:180,h:4.5,burned:false,variant:0},
 {x:1270,y:2690,w:160,d:250,h:4.5,burned:true,variant:1},
 {x:810,y:2050,w:240,d:210,h:5,burned:false,variant:3},
 {x:290,y:2180,w:130,d:190,h:4.2,burned:false,variant:0},
 {x:1280,y:2020,w:140,d:220,h:4.1,burned:true,variant:1},
 {x:755,y:1570,w:230,d:170,h:4.3,burned:false,variant:2},
 {x:1270,y:1310,w:160,d:180,h:4.5,burned:false,variant:2},
 {x:280,y:1250,w:120,d:210,h:4.1,burned:true,variant:1},
 {x:450,y:780,w:230,d:190,h:5,burned:false,variant:3},
 {x:1160,y:750,w:230,d:210,h:5,burned:false,variant:3},
];
export type VillageProp={x:number;y:number;w:number;d:number;frame:number;solid:boolean;name:string};
export const villageProps:VillageProp[]=[
 {x:795,y:3420,w:75,d:64,frame:0,solid:true,name:'水井广场'},
 {x:990,y:3540,w:90,d:45,frame:1,solid:true,name:'遗弃木车'},
 {x:600,y:3800,w:100,d:22,frame:2,solid:true,name:'村口西墙'},
 {x:1070,y:3800,w:100,d:22,frame:2,solid:true,name:'村口东墙'},
 {x:330,y:2390,w:100,d:22,frame:2,solid:true,name:'押解院墙'},
 {x:535,y:1990,w:65,d:50,frame:3,solid:true,name:'囚笼'},
 {x:350,y:1830,w:85,d:22,frame:2,solid:true,name:'破损院墙'},
 {x:1010,y:1510,w:72,d:40,frame:4,solid:true,name:'粮仓物资'},
 {x:1160,y:1180,w:85,d:45,frame:1,solid:true,name:'运粮车'},
 {x:320,y:540,w:115,d:25,frame:2,solid:true,name:'北门西垒'},
 {x:1280,y:480,w:115,d:25,frame:2,solid:true,name:'北门东垒'},
];
export const villageDistricts=[
 {name:'雾林村口',from:3670,to:4200}, {name:'水井广场',from:3150,to:3670},
 {name:'燃烧谷仓',from:2350,to:3150}, {name:'押解庭院',from:1770,to:2350},
 {name:'北方粮仓',from:970,to:1770}, {name:'北门战场',from:150,to:970},
];
export const villageRoads=[
 {width:210,points:[[810,4190],[820,3830],[800,3560],[690,3330],[470,3110],[455,2790],[495,2490],[440,2190],[470,1900],[455,1620],[500,1260],[690,990],[800,620],[800,180]]},
 {width:195,points:[[800,3580],[1050,3360],[1100,3080],[1090,2780],[1130,2450],[1100,2160],[1080,1850],[1100,1550],[1080,1310],[1050,1040],[850,940]]},
 {width:150,points:[[430,3270],[760,3290],[1130,3270]]},
 {width:145,points:[[450,2790],[790,2790],[1120,2840]]},
 {width:155,points:[[435,2320],[800,2330],[1110,2360]]},
 {width:140,points:[[460,1810],[800,1810],[1100,1800]]},
 {width:150,points:[[490,1040],[760,1030],[1100,1050]]},
];
export function villageWalkable(x:number,y:number,padding=18){
 return x>=255&&x<=1345&&y>=170&&y<=4140
  &&!villageBuildings.some(b=>Math.abs(x-b.x)<b.w/2+padding&&Math.abs(y-b.y)<b.d/2+padding)
  &&!villageProps.some(b=>b.solid&&Math.abs(x-b.x)<b.w/2+padding&&Math.abs(y-b.y)<b.d/2+padding);
}
// A map refresh must not strand an existing checkpoint or enemy inside new scenery.
export function safeVillagePoint(x:number,y:number){
 if(villageWalkable(x,y))return {x,y};
 for(let radius=20;radius<=1600;radius+=20)for(let i=0;i<32;i++){
  const a=i*Math.PI/16,nx=x+Math.cos(a)*radius,ny=y+Math.sin(a)*radius;
  if(villageWalkable(nx,ny))return {x:nx,y:ny};
 }
 return {x:800,y:3930};
}
export const villageEncounters=[
 {at:3650,units:[['archer',500,3410],['shield',1080,3390]]},
 {at:3250,units:[['beast',430,3000],['archer',1120,3000],['shield',1090,2720]]},
 {at:2720,units:[['archer',430,2490],['shield',1120,2410]]},
 {at:2330,units:[['shield',430,2100],['archer',500,1920],['beast',1080,2140]]},
 {at:1900,units:[['archer',1120,1720],['shield',430,1600]]},
 {at:1510,units:[['elite',1100,1330],['archer',1040,1120]]},
 {at:1000,units:[['shield',750,940],['archer',930,1000]]},
] as const;

export const villageFireSites=[{x:1040,y:2840,id:0},{x:500,y:2170,id:1},{x:1020,y:1320,id:2}];
