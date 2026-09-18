import landslideImage from "@/assets/field-landslide.jpg";
import floodImage from "@/assets/field-flood.jpg";
import medicalImage from "@/assets/field-medical.jpg";

export type FieldReport={id:string;reporter:string;role:"Volunteer"|"Officer"|"Medic"|"Citizen";districtId:string;summary:string;needs:string[];submittedAt:string;verified:boolean;priority:"high"|"medium"|"low";incidentType:string;accessibility:string;image:string;lat:number;lng:number};
export const fieldReports:FieldReport[]=[
 {id:"fr-1",reporter:"Rinchen Dorjee",role:"Officer",districtId:"d-gangtok",summary:"Fresh slide near 9th Mile. One lane buried; excavator team is approaching from Rangpo.",needs:["Earth mover","Traffic control"],submittedAt:"2026-09-16T04:10:00Z",verified:true,priority:"high",incidentType:"Landslide",accessibility:"Blocked",image:landslideImage,lat:27.25,lng:88.52},
 {id:"fr-2",reporter:"Mitali Gogoi",role:"Volunteer",districtId:"d-dibrugarh",summary:"Approach road inundated near the ferry point. Small boats remain operational.",needs:["Rescue boats","Medicines"],submittedAt:"2026-09-16T03:32:00Z",verified:true,priority:"high",incidentType:"Flood",accessibility:"Restricted",image:floodImage,lat:27.48,lng:94.93},
 {id:"fr-3",reporter:"Dr. M. Sangma",role:"Medic",districtId:"d-shillong",summary:"Mobile clinic received the delayed medicine consignment. Oxygen stock remains limited.",needs:["Oxygen","Insulin"],submittedAt:"2026-09-16T01:58:00Z",verified:false,priority:"medium",incidentType:"Delivery Delay",accessibility:"Open",image:medicalImage,lat:25.57,lng:91.88},
];
