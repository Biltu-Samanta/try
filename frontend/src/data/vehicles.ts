export type Vehicle = { id:string; callSign:string; type:"Ambulance"|"Rescue Vehicle"|"Medical Supply Vehicle"|"Food Supply Vehicle"|"Construction Supply Vehicle"|"Emergency Response Vehicle"; crew:number; status:"moving"|"stopped"|"delayed"|"emergency"|"offline"; fuel:number; districtId:string; destination:string; cargo:string; eta:string; lat:number; lng:number; heading:number; speed:number };
export const vehicles: Vehicle[] = [
 {id:"v-1",callSign:"NER-MED-04",type:"Medical Supply Vehicle",crew:2,status:"moving",fuel:78,districtId:"d-guwahati",destination:"Dibrugarh",cargo:"Vaccines & insulin",eta:"5h 20m",lat:26.37,lng:92.42,heading:65,speed:46},
 {id:"v-2",callSign:"AS-RSC-12",type:"Rescue Vehicle",crew:5,status:"emergency",fuel:62,districtId:"d-dibrugarh",destination:"Dhemaji",cargo:"Rescue equipment",eta:"1h 10m",lat:27.39,lng:94.71,heading:40,speed:38},
 {id:"v-3",callSign:"SK-AMB-02",type:"Ambulance",crew:3,status:"delayed",fuel:51,districtId:"d-gangtok",destination:"Mangan",cargo:"Trauma care",eta:"2h 45m",lat:27.43,lng:88.61,heading:350,speed:18},
 {id:"v-4",callSign:"ML-FOOD-07",type:"Food Supply Vehicle",crew:2,status:"moving",fuel:84,districtId:"d-shillong",destination:"Silchar",cargo:"4.8t food grains",eta:"6h 05m",lat:25.31,lng:92.15,heading:120,speed:41},
 {id:"v-5",callSign:"MZ-BLD-03",type:"Construction Supply Vehicle",crew:3,status:"stopped",fuel:69,districtId:"d-aizawl",destination:"Lunglei",cargo:"Bailey bridge parts",eta:"4h 30m",lat:23.41,lng:92.75,heading:180,speed:0},
 {id:"v-6",callSign:"MN-ERT-01",type:"Emergency Response Vehicle",crew:6,status:"moving",fuel:91,districtId:"d-imphal",destination:"Churachandpur",cargo:"Emergency supplies",eta:"2h 15m",lat:24.64,lng:93.82,heading:210,speed:32},
];
