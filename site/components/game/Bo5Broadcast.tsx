import { Badge } from "@/components/ui/badge";
import { PLAYER_BY_ID } from "@/lib/game/player-pool";
import type { PlayedMapResult, PublicGameSnapshot, TeamId } from "@/lib/game/types";
import { MAP_LABELS } from "./MapBpStage";

export function Bo5Broadcast({ snapshot }: { snapshot: PublicGameSnapshot }) {
  if (!snapshot.series) return null;
  return (
    <section aria-labelledby="bo5-title" className="broadcast-panel p-5 sm:p-7">
      <header className="grid gap-4 border-b border-border pb-5 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
        <TeamScore snapshot={snapshot} team="A" />
        <div className="text-center">
          <p className="eyebrow">BEST OF FIVE</p>
          <h2 id="bo5-title" className="mt-1 font-mono text-4xl font-black">{snapshot.series.score.A} : {snapshot.series.score.B}</h2>
        </div>
        <TeamScore snapshot={snapshot} team="B" right />
      </header>
      <div className="mt-5 grid grid-cols-5 gap-1" aria-label="五图比分进程">
        {snapshot.series.maps.map((map, index) => (
          <div key={map.map} className="border border-border bg-muted/30 p-2 text-center">
            <span className="block text-[10px] text-muted-foreground">M{index + 1}</span>
            <strong className="block truncate text-xs">{MAP_LABELS[map.map]}</strong>
            <span className="mt-1 block font-mono text-sm">
              {map.status === "PLAYED" ? `${map.score.A}:${map.score.B}` : "—"}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-5 grid gap-4">
        {snapshot.series.maps.map((map, index) => map.status === "PLAYED" ? (
          <MapCard key={map.map} result={map} index={index} snapshot={snapshot} />
        ) : (
          <article key={map.map} className="flex items-center justify-between border border-dashed border-border p-4 text-muted-foreground">
            <span>MAP {index + 1} · {MAP_LABELS[map.map]}</span>
            <Badge variant="outline">无需进行</Badge>
          </article>
        ))}
      </div>
    </section>
  );
}

function TeamScore({ snapshot, team, right = false }: { snapshot: PublicGameSnapshot; team: TeamId; right?: boolean }) {
  return (
    <div className={right ? "sm:text-right" : ""}>
      <p className={team === "A" ? "eyebrow text-team-a" : "eyebrow text-team-b"}>TEAM {team}</p>
      <p className="mt-1 text-xl font-black">{snapshot.players[team].nickname}</p>
    </div>
  );
}

function MapCard({ result, index, snapshot }: { result: PlayedMapResult; index: number; snapshot: PublicGameSnapshot }) {
  return (
    <article className="border border-border bg-background/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow">MAP {index + 1}</p>
          <h3 className="text-lg font-black">{MAP_LABELS[result.map]} · {result.score.A}:{result.score.B}</h3>
        </div>
        <Badge>地图 MVP · {PLAYER_BY_ID[result.mvp.playerId].name}</Badge>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[650px] border-collapse text-left text-xs">
          <thead className="text-muted-foreground">
            <tr className="border-b border-border">
              <th className="py-2">选手</th><th>队伍</th><th>ACS</th><th>K / D / A</th><th>首杀</th><th>残局</th>
            </tr>
          </thead>
          <tbody>
            {[...result.playerLines].sort((a, b) => b.acs - a.acs).map((line) => (
              <tr key={line.playerId} className="border-b border-border/50 last:border-0">
                <th className="py-2 font-semibold">{PLAYER_BY_ID[line.playerId].name}</th>
                <td className={line.team === "A" ? "text-team-a" : "text-team-b"}>{snapshot.players[line.team].nickname}</td>
                <td className="font-mono">{line.acs}</td>
                <td className="font-mono">{line.kills} / {line.deaths} / {line.assists}</td>
                <td className="font-mono">{line.firstKills}</td>
                <td className="font-mono">{line.clutches}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {result.highlights.slice(0, 2).map((highlight) => <p key={highlight} className="border-l-2 border-analysis pl-3 text-xs leading-5 text-muted-foreground">{highlight}</p>)}
      </div>
    </article>
  );
}
