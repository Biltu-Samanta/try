import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Bell, Check, ChevronLeft, ChevronRight, CircleAlert, Clock3, FileText, Languages, LayoutDashboard, Map, MapPin, Maximize2, Moon, Mountain, Navigation, Route as RouteIcon, Search, Settings2, ShieldCheck, Siren, Sun, Truck, User, X } from "lucide-react";
import { MapPanel } from "@/components/MapPanel";
import { Button } from "@/components/ui/button";
import { useRole } from "@/lib/role";
import { languages, useI18n } from "@/lib/i18n";
import { useSimulation } from "@/hooks/useSimulation";
import { useMapMode } from "@/hooks/useMapMode";
import { clockString } from "@/lib/format";
import { cn } from "@/lib/utils";

const nav: Array<{to:"/dashboard"|"/map"|"/route-planning"|"/fleet"|"/alerts"|"/reports"|"/emergency";label:string;icon:any;admin?:boolean}> = [
 {to:"/dashboard",label:"Dashboard",icon:LayoutDashboard},{to:"/map",label:"GIS Map",icon:Map},{to:"/route-planning",label:"Route Planning",icon:RouteIcon},{to:"/fleet",label:"Vehicle Tracking",icon:Truck,admin:true},{to:"/alerts",label:"Alerts",icon:CircleAlert},{to:"/reports",label:"Field Reports",icon:FileText},{to:"/emergency",label:"Emergency",icon:Siren},
] as const;

const colorThemes = [
 {id:"blue",label:"Ocean blue",className:"bg-primary"},
 {id:"teal",label:"Signal teal",className:"bg-theme-teal"},
 {id:"coral",label:"Rescue coral",className:"bg-theme-coral"},
 {id:"amber",label:"Safety amber",className:"bg-theme-amber"},
] as const;
type ColorTheme = (typeof colorThemes)[number]["id"];

export function AppShell({
  title,
  description,
  children,
  routePoints = [],
  altRoutePoints = [],
  hazardPoints = [],
  routeType = "safest",
  onSelectRouteType,
}: {
  title: string;
  description: string;
  children: ReactNode;
  routePoints?: [number, number][];
  altRoutePoints?: [number, number][];
  hazardPoints?: any[];
  routeType?: "safest" | "shortest";
  onSelectRouteType?: (type: "safest" | "shortest") => void;
}) {
  const [collapsed, setCollapsed] = useState(true);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mode, setMode] = useMapMode();
  const [query, setQuery] = useState("");
  const [notify, setNotify] = useState<"all" | "critical" | "muted">("all");
  const [panelOpen, setPanelOpen] = useState(true);
  const [glassOpacity, setGlassOpacity] = useState(58);
  const [colorTheme, setColorTheme] = useState<ColorTheme>("blue");
  const [mounted, setMounted] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const { role, setRole, isAdmin } = useRole();
  const { now, liveAlerts } = useSimulation();
  const { lang, setLang, t } = useI18n();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const unread = useMemo(() => liveAlerts.filter((a) => !a.acknowledged).length, [liveAlerts]);

  useEffect(() => {
    setMounted(true);
    const storedOpacity = Number(window.localStorage.getItem("ner-glass-opacity"));
    const storedTheme = window.localStorage.getItem("ner-color-theme") as ColorTheme | null;
    const storedMode = window.localStorage.getItem("ner-theme-mode");
    if (storedOpacity >= 0 && storedOpacity <= 95) setGlassOpacity(storedOpacity);
    if (colorThemes.some((theme) => theme.id === storedTheme)) setColorTheme(storedTheme as ColorTheme);
    if (storedMode === "dark") setDarkMode(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    window.localStorage.setItem("ner-glass-opacity", String(glassOpacity));
    window.localStorage.setItem("ner-color-theme", colorTheme);
    window.localStorage.setItem("ner-theme-mode", darkMode ? "dark" : "light");
  }, [glassOpacity, colorTheme, darkMode, mounted]);

  useEffect(() => {
    if (!isAdmin && pathname === "/fleet") window.location.assign("/dashboard");
  }, [isAdmin, pathname]);

  useEffect(() => {
    setPanelOpen(true);
  }, [pathname]);

  const visibleNav = nav.filter((n) => !n.admin || isAdmin);

  return (
    <div
      style={{ "--glass-opacity": `${glassOpacity}%` } as CSSProperties}
      className={cn(
        "relative h-dvh w-screen overflow-hidden bg-background",
        `ui-theme-${colorTheme}`,
        darkMode && "theme-dark",
        mode === "Terrain" && "map-terrain",
        mode === "3D" && "map-three-d"
      )}
    >
      <div className="absolute inset-0 z-0 map-wrapper-3d">
        <MapPanel
          routePoints={routePoints}
          altRoutePoints={altRoutePoints}
          hazardPoints={hazardPoints}
          routeType={routeType}
          onSelectRouteType={onSelectRouteType}
          mapMode={mode}
        />
      </div>
      <div className="map-vignette pointer-events-none absolute inset-0 z-[400]" />
      {mode === "3D" && (
        <div className="pointer-events-none absolute bottom-4 right-4 z-[500] hidden items-center gap-2 rounded-2xl border border-primary/40 bg-background/85 px-3.5 py-2 text-xs font-semibold text-primary shadow-2xl backdrop-blur-md sm:flex">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75"></span>
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary"></span>
          </span>
          🛰️ {t("3D Satellite View Active")}
        </div>
      )}
    <aside className={cn("glass-strong absolute bottom-4 left-3 top-3 z-[600] hidden flex-col rounded-3xl transition-[width] duration-300 md:flex",collapsed?"w-16":"w-56")}>
      <div className="flex h-16 items-center gap-3 border-b border-border px-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20"><Navigation size={18}/></span>{!collapsed&&<div><p className="font-display text-sm font-semibold">{t("NER Access")}</p><p className="text-[10px] text-muted-foreground">{t("LOGISTICS INTELLIGENCE")}</p></div>}</div>
       <nav className="flex flex-1 flex-col gap-1 p-2">{visibleNav.map(({to,label,icon:Icon})=><Link key={to} to={to} activeOptions={{exact:to==="/"}} title={collapsed?t(label):undefined} className="sidebar-interactive group flex h-10 items-center gap-3 rounded-xl px-3 text-muted-foreground" activeProps={{className:"sidebar-interactive-active bg-secondary text-primary shadow-sm"}}><Icon className="sidebar-interactive-icon" size={17}/>{!collapsed&&<span className="text-sm">{t(label)}</span>}</Link>)}</nav>
      <div className="mt-auto grid gap-1 p-2">
        <Button variant="ghost" size="sm" aria-label="Interface settings" title={t("Interface settings")} onClick={()=>setSettingsOpen(v=>!v)} className={cn("sidebar-interactive group h-9 justify-start rounded-xl px-3 text-muted-foreground",settingsOpen&&"sidebar-interactive-active bg-secondary text-primary")}><Settings2 className="sidebar-interactive-icon" size={16}/>{!collapsed&&<span>{t("Appearance")}</span>}</Button>
       <Button variant="outline" size="sm" aria-label={collapsed?"Expand navigation":"Collapse navigation"} onClick={()=>setCollapsed(v=>!v)} className="sidebar-interactive group h-9 rounded-xl bg-secondary/60 px-3 text-muted-foreground"><span className="sidebar-interactive-icon">{collapsed?<ChevronRight size={16}/>:<ChevronLeft size={16}/>}</span></Button>
     </div>
   </aside>
    {settingsOpen&&<section aria-label="Interface settings" className={cn("glass-strong absolute bottom-4 z-[750] hidden w-72 rounded-2xl p-4 md:block",collapsed?"left-24":"left-[15rem]")}>
      <div className="mb-4 flex items-center justify-between"><div><p className="text-sm font-semibold">{t("Interface")}</p><p className="text-[10px] text-muted-foreground">{t("Personalize your workspace")}</p></div><Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={()=>setSettingsOpen(false)} aria-label="Close settings"><X size={15}/></Button></div>
      <label htmlFor="glass-opacity" className="mb-2 flex items-center justify-between text-xs font-medium"><span>{t("Glass transparency")}</span><span className="font-mono text-primary">{glassOpacity}%</span></label>
      <input id="glass-opacity" type="range" min="0" max="95" step="1" value={glassOpacity} onChange={event=>setGlassOpacity(Number(event.target.value))} className="ui-range mb-5 w-full"/>
      <p className="mb-2 text-xs font-medium">{t("Theme")}</p>
      <div className="mb-5 grid grid-cols-2 gap-2 rounded-xl bg-secondary/50 p-1">{([{id:"light",label:"Light",icon:Sun},{id:"dark",label:"Dark",icon:Moon}] as const).map(option=><button key={option.id} onClick={()=>setDarkMode(option.id==="dark")} aria-pressed={darkMode===(option.id==="dark")} className={cn("flex h-8 items-center justify-center gap-1.5 rounded-lg text-xs transition-all",darkMode===(option.id==="dark")?"bg-primary text-primary-foreground shadow-sm":"text-muted-foreground hover:text-foreground")}><option.icon size={13}/>{t(option.label)}</button>)}</div>
      <p className="mb-2 flex items-center gap-1.5 text-xs font-medium"><Languages size={13} className="text-primary"/>{t("Language")}</p>
      <div className="mb-5 grid grid-cols-2 gap-2">{languages.map(option=><button key={option.id} onClick={()=>setLang(option.id)} aria-pressed={lang===option.id} className={cn("flex h-9 flex-col items-start justify-center rounded-xl border border-border px-2.5 text-left transition-all",lang===option.id?"bg-primary text-primary-foreground shadow-sm":"bg-secondary/50 text-muted-foreground hover:text-foreground")}><span className="text-[11px] font-medium leading-none">{option.native}</span><span className="mt-0.5 text-[9px] leading-none opacity-70">{option.label}</span></button>)}</div>
      <p className="mb-2 text-xs font-medium">{t("Interface color")}</p>
      <div className="grid grid-cols-4 gap-2">{colorThemes.map(theme=><Button key={theme.id} variant="ghost" size="icon" title={theme.label} aria-label={theme.label} aria-pressed={colorTheme===theme.id} onClick={()=>setColorTheme(theme.id)} className={cn("relative h-10 w-full rounded-xl border border-border bg-secondary/50",colorTheme===theme.id&&"ring-2 ring-primary")}><span className={cn("h-5 w-5 rounded-full shadow-sm",theme.className)}/>{colorTheme===theme.id&&<Check className="absolute h-3 w-3 text-primary-foreground"/>}</Button>)}</div>
    </section>}
   <div className="absolute left-3 right-3 top-3 z-[650] flex items-start gap-2 md:left-24">
     <div className="glass glass-glow flex h-12 min-w-0 max-w-2xl flex-1 items-center gap-1 rounded-2xl p-1.5">
      <Search size={16} className="ml-2 shrink-0 text-muted-foreground"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={t("Search district, road, location...")} className="min-w-0 flex-1 bg-transparent px-2 text-sm outline-none placeholder:text-muted-foreground"/>
      <div className="flex items-center rounded-xl bg-secondary/80 p-0.5 shadow-sm border border-border/40">
        {(["2D", "3D", "Terrain"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={cn(
              "rounded-lg px-2.5 py-1 text-xs font-medium transition-all duration-200",
              mode === m
                ? "bg-primary text-primary-foreground shadow-md"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {m === "3D" ? `🛰️ ${t("3D")}` : m === "Terrain" ? `⛰️ ${t("Terrain")}` : `🗺️ ${t("2D")}`}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1 rounded-xl bg-secondary/80 px-2 py-1 shadow-sm border border-border/40">
        <Languages size={13} className="text-primary shrink-0" />
        <select
          value={lang}
          onChange={(e) => setLang(e.target.value as any)}
          aria-label={t("Language")}
          className="bg-transparent text-xs font-semibold text-foreground outline-none cursor-pointer pr-1"
        >
          {languages.map((l) => (
            <option key={l.id} value={l.id} className="bg-popover text-popover-foreground">
              {l.native}
            </option>
          ))}
        </select>
      </div>
    </div>
     <div className="ml-auto flex items-start gap-2">
      <div className="glass luminous-control hidden h-12 items-center gap-2 rounded-2xl px-3 lg:flex"><Clock3 size={15} className="text-primary"/><div><p className="font-mono text-xs tabular-nums">{mounted?clockString(now):"--:--:--"}</p><p className="text-[9px] text-muted-foreground">{mounted?now.toLocaleDateString(lang === "en" ? "en-IN" : "en-IN",{day:"2-digit",month:"short",year:"numeric",timeZone:"Asia/Kolkata"}):t("Live clock")}</p></div></div>
      <div className="glass luminous-control flex h-12 items-center gap-1 rounded-2xl p-1.5"><button onClick={()=>setNoticeOpen(v=>!v)} aria-label={t("Notifications")} className="toolbar-button relative"><Bell size={16}/>{unread>0&&<span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-critical"/>}</button><div className="flex rounded-xl bg-secondary/70 p-0.5">{(["admin","user"] as const).map(r=><button key={r} title={r==="admin"?t("Switch to admin"):t("Switch to user")} onClick={()=>setRole(r)} className={cn("grid h-7 w-7 place-items-center rounded-lg transition-all",role===r?"bg-primary text-primary-foreground shadow-md shadow-primary/15":"text-muted-foreground")}>{r==="admin"?<ShieldCheck size={14}/>:<User size={14}/>}</button>)}</div></div>
     </div>
   </div>
   {noticeOpen&&<div className="glass-strong absolute right-3 top-[4.4rem] z-[700] w-[min(22rem,calc(100vw-1.5rem))] rounded-xl p-3"><div className="mb-2 flex items-center justify-between"><p className="text-sm font-semibold">{t("Notifications")}</p><span className="text-xs text-primary">{notify==="muted"?t("Muted"):`${unread} ${t("unread")}`}</span></div><div className="mb-2 grid grid-cols-3 rounded-lg bg-secondary/60 p-1">{(["all","critical","muted"] as const).map(n=><button key={n} onClick={()=>setNotify(n)} className={cn("rounded-md px-2 py-1.5 text-[10px] capitalize",notify===n&&"bg-primary text-primary-foreground")}>{t(n)}</button>)}</div>{notify!=="muted"&&liveAlerts.filter(a=>notify==="all"||a.level==="critical").slice(0,3).map(a=><div key={a.id} className="border-t border-border py-2"><p className="text-xs font-medium">{t(a.title)}</p><p className="mt-0.5 text-[10px] text-muted-foreground">{t(a.category)}</p></div>)}</div>}
   {panelOpen?<main className="absolute bottom-3 left-3 right-3 top-[4.4rem] z-[500] overflow-y-auto md:left-24 md:right-auto md:w-[min(760px,calc(100vw-7rem))]">
     <div className="glass relative rounded-3xl p-4 sm:p-5"><header className="mb-4"><div className="flex items-center gap-2 text-[10px] uppercase text-primary"><MapPin size={11}/> {t("North Eastern Region · Live simulation")}</div><h1 className="mt-1 font-display text-xl font-semibold sm:text-2xl">{t(title)}</h1><p className="mt-1 max-w-2xl text-xs text-muted-foreground">{t(description)}</p></header>{children}<Button variant="ghost" size="icon" aria-label="Close panel" title={t("Close panel")} onClick={()=>setPanelOpen(false)} className="absolute right-3 top-3 h-8 w-8 rounded-xl text-muted-foreground hover:bg-secondary hover:text-foreground"><X size={15}/></Button></div>
   </main>:<button aria-label="Show panel" title={`${t("Show")} ${t(title)}`} onClick={()=>setPanelOpen(true)} className="glass-strong absolute bottom-20 left-3 z-[500] flex h-11 items-center gap-2 rounded-2xl px-3.5 text-xs font-medium text-muted-foreground shadow-sm transition-all hover:text-foreground md:bottom-3 md:left-24"><Maximize2 size={14}/><span>{t("Show")} {t(title)}</span></button>}
   <nav className="glass absolute bottom-3 left-3 right-3 z-[800] flex h-14 items-center justify-around rounded-xl md:hidden">{visibleNav.slice(0,6).map(({to,label,icon:Icon})=><Link key={to} to={to} aria-label={t(label)} className="grid h-10 w-10 place-items-center rounded-lg text-muted-foreground" activeProps={{className:"bg-primary text-primary-foreground"}}><Icon size={18}/></Link>)}</nav>
 </div>
  );
}