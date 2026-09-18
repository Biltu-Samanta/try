export type DisasterType = "flood"|"landslide"|"heavy-rain"|"road-blockage"|"bridge-damage"|"connectivity-loss";
export type Disaster = { id:string; type:DisasterType; title:string; districtId:string; severity:1|2|3|4|5; status:"active"|"contained"|"monitoring"; startedAt:string; affected:number; evacuated:number; lat:number; lng:number };
export const disasters: Disaster[] = [
 {id:"ds-1",type:"flood",title:"Brahmaputra flood corridor",districtId:"d-dibrugarh",severity:5,status:"active",startedAt:"2026-09-15T20:20:00Z",affected:48200,evacuated:6200,lat:27.49,lng:94.95},
 {id:"ds-2",type:"landslide",title:"NH-10 landslide chain",districtId:"d-gangtok",severity:5,status:"active",startedAt:"2026-09-15T23:05:00Z",affected:8400,evacuated:940,lat:27.25,lng:88.51},
 {id:"ds-3",type:"road-blockage",title:"Sela Pass road closure",districtId:"d-tawang",severity:4,status:"active",startedAt:"2026-09-16T00:40:00Z",affected:2100,evacuated:0,lat:27.50,lng:92.10},
 {id:"ds-4",type:"bridge-damage",title:"Barak bridge load restriction",districtId:"d-silchar",severity:4,status:"monitoring",startedAt:"2026-09-15T16:15:00Z",affected:12600,evacuated:0,lat:24.87,lng:92.81},
 {id:"ds-5",type:"heavy-rain",title:"Khasi Hills rainfall warning",districtId:"d-shillong",severity:3,status:"active",startedAt:"2026-09-16T02:10:00Z",affected:5200,evacuated:180,lat:25.56,lng:91.87},
 {id:"ds-6",type:"connectivity-loss",title:"Southern Mizoram link outage",districtId:"d-lunglei",severity:2,status:"monitoring",startedAt:"2026-09-15T21:10:00Z",affected:3400,evacuated:0,lat:22.90,lng:92.75},
];
export const roadSegments = [
 {id:"r-1",name:"NH-10 Rangpo–Gangtok",status:"blocked" as const,points:[[26.99,88.49],[27.17,88.50],[27.34,88.61]] as [number,number][]},
 {id:"r-2",name:"NH-13 Sela corridor",status:"blocked" as const,points:[[27.42,92.21],[27.50,92.10],[27.58,91.94]] as [number,number][]},
 {id:"r-3",name:"NH-6 Shillong–Silchar",status:"critical" as const,points:[[25.58,91.89],[25.23,92.34],[24.83,92.78]] as [number,number][]},
 {id:"r-4",name:"NH-2 Imphal–Kohima",status:"critical" as const,points:[[24.82,93.94],[25.22,94.01],[25.67,94.11]] as [number,number][]},
];
