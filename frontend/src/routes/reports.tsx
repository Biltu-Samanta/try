import {useState,useEffect} from "react";import {createFileRoute} from "@tanstack/react-router";import {BadgeCheck,MapPin,Send,Plus} from "lucide-react";import {AppShell} from "@/components/AppShell";import {fieldReports,type FieldReport} from "@/data/fieldReports";import {districts} from "@/data/districts";import {useRole} from "@/lib/role";import {cn} from "@/lib/utils";import {useI18n} from "@/lib/i18n";import {api} from "@/lib/api";
export const Route=createFileRoute("/reports")({head:()=>({meta:[{title:"Field Intelligence Reports — NER Access"},{name:"description",content:"Geo-tagged accessibility reports from remote North East locations."},{property:"og:title",content:"Field Intelligence Reports — NER Access"},{property:"og:description",content:"Geo-tagged road and logistics intelligence from the field."},{property:"og:type",content:"website"},{name:"twitter:card",content:"summary_large_image"}]}),component:Reports});function Reports(){const{isAdmin}=useRole();const {t}=useI18n();const[items,setItems]=useState<FieldReport[]>(fieldReports);

useEffect(()=>{
  api.getFieldReports().then(data=>{
    if(data?.reports && data.reports.length > 0){
      const mapped: FieldReport[] = data.reports.map((r, i) => {
        const dist = districts.find(d => d.lat && Math.abs(d.lat - r.lat) < 1.0) || districts[0];
        return {
          id: r.id || `fr-live-${i}`,
          reporter: r.reporter_id || "Field Officer",
          role: "Civil Defense Volunteer",
          incidentType: r.incident_type as any || "Landslide",
          summary: r.description || "Active road hazard reported.",
          priority: (r.severity?.toLowerCase() === "critical" ? "high" : r.severity?.toLowerCase() === "high" ? "medium" : "low") as any,
          accessibility: "blocked",
          districtId: dist.id,
          verified: r.status === "Verified",
          image: r.photo_url || "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=1200&auto=format&fit=crop&q=80",
          lat: r.lat || dist.lat,
          lng: r.lon || dist.lng
        };
      });
      setItems(prev => [...mapped, ...prev.filter(p => !mapped.some(m => m.id === p.id))]);
    }
  });
}, []);

return <AppShell title="Field Intelligence Reports" description="Geo-tagged observations synced in real time with backend /api/field-reports."><div className="space-y-3">{items.map(r=><article key={r.id} className={cn("group overflow-hidden rounded-2xl border bg-secondary/50 backdrop-blur-xl transition-all duration-200 hover:bg-card hover:shadow-lg sm:grid sm:grid-cols-[150px_1fr]",r.priority==="high"?"glow-critical":r.priority==="medium"?"glow-warning":"glow-primary")}><div className="relative overflow-hidden"><img src={r.image} alt={`${r.incidentType} field report`} loading="lazy" width={1200} height={800} className="h-32 w-full object-cover transition-transform duration-300 group-hover:scale-[1.03] sm:h-full"/><div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent to-secondary/50"/></div><div className="p-3"><div className="flex items-start justify-between"><div><h2 className="text-sm font-semibold">{r.reporter}</h2><p className="text-[10px] text-muted-foreground">{t(r.role)} · {t(r.incidentType)}</p></div><span className={cn("flex items-center gap-1.5 text-[10px] uppercase",r.priority==="high"?"text-critical":r.priority==="medium"?"text-warning":"text-primary")}><i className="h-1.5 w-1.5 rounded-full bg-current"/>{t(r.priority)}</span></div><p className="mt-2 text-xs text-muted-foreground">{t(r.summary)}</p><div className="mt-3 flex flex-wrap items-center gap-3 text-[10px]"><span className="flex items-center gap-1 text-primary/90"><MapPin size={11}/>{districts.find(d=>d.id===r.districtId)?.name}</span><span>{t("Road")}: {t(r.accessibility)}</span>{r.verified?<span className="flex items-center gap-1 text-safe"><BadgeCheck size={11}/>{t("Verified")}</span>:isAdmin&&<button onClick={()=>setItems(p=>p.map(x=>x.id===r.id?{...x,verified:true}:x))} className="rounded-lg border border-primary/20 bg-card px-2 py-1 text-primary shadow-sm transition-all hover:bg-primary hover:text-primary-foreground">{t("Verify report")}</button>}</div></div></article>)}</div></AppShell>}