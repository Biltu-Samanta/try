export type AlertLevel="critical"|"warning"|"watch"|"info";
export type Alert={id:string;level:AlertLevel;title:string;message:string;districtId:string;issuedAt:string;channel:"SMS"|"Radio"|"App Push"|"Control Room";acknowledged:boolean;category:string;lat?:number;lon?:number};
export const alerts:Alert[]=[
 {id:"al-1",level:"critical",title:"NH-10 closed at multiple points",message:"Landslides have blocked the primary Gangtok corridor. Divert essential loads via Pakyong.",districtId:"d-gangtok",lat:27.3389,lon:88.6065,issuedAt:"2026-09-16T04:18:00Z",channel:"Control Room",acknowledged:false,category:"Road Blockage"},
 {id:"al-2",level:"critical",title:"Brahmaputra level rising rapidly",message:"Freight movement near Dibrugarh river approaches suspended until inspection.",districtId:"d-dibrugarh",lat:27.4728,lon:94.9120,issuedAt:"2026-09-16T03:42:00Z",channel:"SMS",acknowledged:false,category:"Flood"},
 {id:"al-6",level:"critical",title:"NH-37 Imphal-Jiribam Landslide Blockage",message:"Heavy rockfall debris closed both lanes at km 48. Diversion recommended via Bishnupur.",districtId:"d-imphal",lat:24.7831,lon:93.6890,issuedAt:"2026-09-16T03:15:00Z",channel:"Control Room",acknowledged:false,category:"Landslide"},
 {id:"al-7",level:"critical",title:"NH-150 Senapati Mudslide Warning",message:"Flash mudflow near mountain cutting. Heavy trucks strictly prohibited.",districtId:"d-imphal",lat:25.0097,lon:93.9503,issuedAt:"2026-09-16T02:50:00Z",channel:"Control Room",acknowledged:false,category:"Landslide"},
 {id:"al-3",level:"warning",title:"Bridge restricted to light vehicles",message:"Barak crossing is operating under a five-tonne load restriction.",districtId:"d-silchar",lat:24.8333,lon:92.7789,issuedAt:"2026-09-16T02:30:00Z",channel:"Radio",acknowledged:true,category:"Bridge Damage"},
 {id:"al-4",level:"watch",title:"Heavy rainfall across Khasi Hills",message:"Visibility below 100 metres on exposed sections. Convoys advised to hold.",districtId:"d-shillong",lat:25.5788,lon:91.8933,issuedAt:"2026-09-16T01:45:00Z",channel:"App Push",acknowledged:false,category:"Heavy Rainfall"},
 {id:"al-5",level:"info",title:"Medical convoy cleared",message:"NER-MED-04 cleared Jorabat checkpoint and remains on schedule.",districtId:"d-guwahati",lat:26.1445,lon:91.7362,issuedAt:"2026-09-15T23:05:00Z",channel:"App Push",acknowledged:true,category:"Vehicle Delay"},
];
export const alertTemplates:Array<Pick<Alert,"level"|"title"|"message"|"channel"|"category">>=[
 {level:"warning",title:"New landslide reported",message:"Field team reports debris across one lane. Heavy vehicles should hold.",channel:"Control Room",category:"Landslide"},
 {level:"watch",title:"Corridor speed restriction",message:"Reduced visibility and standing water reported on the approach road.",channel:"App Push",category:"Heavy Rainfall"},
 {level:"info",title:"Essential goods convoy moving",message:"Food and medicine convoy passed the latest logistics checkpoint.",channel:"Radio",category:"Vehicle Delay"},
 {level:"critical",title:"Bridge movement suspended",message:"Structural inspection required before any further freight movement.",channel:"SMS",category:"Bridge Damage"},
];
