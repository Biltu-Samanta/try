export type Risk = "critical" | "high" | "moderate" | "low";
export type District = { id: string; name: string; state: string; lat: number; lng: number; population: number; risk: Risk; shelters: number; responders: number };
export const districts: District[] = [
  { id:"d-guwahati", name:"Guwahati", state:"Assam", lat:26.1445, lng:91.7362, population:1116267, risk:"high", shelters:18, responders:126 },
  { id:"d-dibrugarh", name:"Dibrugarh", state:"Assam", lat:27.4728, lng:94.9120, population:1326335, risk:"critical", shelters:12, responders:98 },
  { id:"d-tawang", name:"Tawang", state:"Arunachal Pradesh", lat:27.5861, lng:91.8594, population:49977, risk:"high", shelters:5, responders:34 },
  { id:"d-imphal", name:"Imphal West", state:"Manipur", lat:24.8170, lng:93.9368, population:517992, risk:"moderate", shelters:9, responders:68 },
  { id:"d-shillong", name:"East Khasi Hills", state:"Meghalaya", lat:25.5788, lng:91.8933, population:825922, risk:"high", shelters:8, responders:72 },
  { id:"d-aizawl", name:"Aizawl", state:"Mizoram", lat:23.7271, lng:92.7176, population:400309, risk:"moderate", shelters:7, responders:48 },
  { id:"d-kohima", name:"Kohima", state:"Nagaland", lat:25.6751, lng:94.1086, population:270063, risk:"moderate", shelters:6, responders:42 },
  { id:"d-gangtok", name:"Gangtok", state:"Sikkim", lat:27.3389, lng:88.6065, population:281293, risk:"critical", shelters:10, responders:88 },
  { id:"d-agartala", name:"West Tripura", state:"Tripura", lat:23.8315, lng:91.2868, population:917534, risk:"low", shelters:11, responders:61 },
  { id:"d-silchar", name:"Cachar", state:"Assam", lat:24.8333, lng:92.7789, population:1736617, risk:"high", shelters:14, responders:81 },
  { id:"d-churachandpur", name:"Churachandpur", state:"Manipur", lat:24.3333, lng:93.6833, population:274143, risk:"moderate", shelters:6, responders:37 },
  { id:"d-lunglei", name:"Lunglei", state:"Mizoram", lat:22.8925, lng:92.7471, population:161428, risk:"low", shelters:4, responders:24 },
];
