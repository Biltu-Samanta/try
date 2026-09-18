import { lazy, Suspense } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";
const LiveMap = lazy(() => import("./LiveMap"));
 function MapSkeleton({className=""}:{className?:string|undefined}) { const {t}=useI18n(); return <div className={`flex h-full w-full items-center justify-center bg-background text-sm text-muted-foreground ${className}`}>{t("Loading regional map…")}</div>; }
export function MapPanel({
  className = "",
  routePoints = [],
  altRoutePoints = [],
  hazardPoints = [],
  routeType = "safest",
  onSelectRouteType,
  mapMode = "2D",
}: {
  className?: string | undefined;
  routePoints?: [number, number][];
  altRoutePoints?: [number, number][];
  hazardPoints?: any[];
  routeType?: "safest" | "shortest";
  onSelectRouteType?: (type: "safest" | "shortest") => void;
  mapMode?: "2D" | "3D" | "Terrain";
}) {
  return (
    <ClientOnly fallback={<MapSkeleton className={className} />}>
      <Suspense fallback={<MapSkeleton className={className} />}>
        <LiveMap
          className={className}
          routePoints={routePoints}
          altRoutePoints={altRoutePoints}
          hazardPoints={hazardPoints}
          routeType={routeType}
          onSelectRouteType={onSelectRouteType}
          mapMode={mapMode}
        />
      </Suspense>
    </ClientOnly>
  );
}