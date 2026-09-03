import { Badge } from "@/components/ui/badge";
import type { MapId, PublicGameSnapshot } from "@/lib/game/types";

export const MAP_LABELS: Record<MapId, string> = {
  ABYSS: "亚海悬城",
  CORRODE: "源工重镇",
  HAVEN: "隐世修所",
  SPLIT: "霓虹町",
  LOTUS: "莲华古城",
  SUNSET: "日落之城",
  ICEBOX: "森寒冬港",
};

const STEP_LABEL = { BAN: "禁用", PICK: "选择", DECIDER: "决胜" } as const;

export function MapBpStage({ snapshot }: { snapshot: PublicGameSnapshot }) {
  if (!snapshot.bp) return null;
  return (
    <section aria-labelledby="map-bp-title" className="broadcast-panel p-5 sm:p-7">
      <header className="flex items-end justify-between gap-4 border-b border-border pb-4">
        <div>
          <p className="eyebrow text-analysis">AI TACTICAL DESK</p>
          <h2 id="map-bp-title" className="mt-1 text-2xl font-black">七图 BP</h2>
        </div>
        <Badge variant="outline">{snapshot.players[snapshot.bp.firstTeam].nickname} 先手</Badge>
      </header>
      <ol className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {snapshot.bp.steps.map((step, index) => (
          <li data-bp-step key={`${step.kind}-${step.map}`} className="border-l-2 border-analysis/70 bg-muted/30 p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs text-muted-foreground">0{index + 1}</span>
              <Badge variant={step.kind === "BAN" ? "destructive" : "secondary"}>{STEP_LABEL[step.kind]}</Badge>
            </div>
            <h3 className="mt-4 text-lg font-bold">{MAP_LABELS[step.map]}</h3>
            <p className="mt-1 text-xs font-semibold text-muted-foreground">
              {step.actor ? snapshot.players[step.actor].nickname : "系统自动"}
            </p>
            <p className="mt-3 text-sm leading-6 text-muted-foreground"><span className="font-semibold text-foreground">理由：</span>{step.reason}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
