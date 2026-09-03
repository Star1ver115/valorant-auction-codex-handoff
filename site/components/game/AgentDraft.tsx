import { Badge } from "@/components/ui/badge";
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress";
import { PLAYER_BY_ID } from "@/lib/game/player-pool";
import type { MapId, PublicGameSnapshot, TeamId } from "@/lib/game/types";
import { MAP_LABELS } from "./MapBpStage";

export function AgentDraft({ snapshot }: { snapshot: PublicGameSnapshot }) {
  if (!snapshot.bp || !snapshot.compositions) return null;
  return (
    <section aria-labelledby="agent-draft-title" className="broadcast-panel p-5 sm:p-7">
      <p className="eyebrow text-analysis">COMPOSITION LAB</p>
      <h2 id="agent-draft-title" className="mt-1 text-2xl font-black">逐图特工阵容</h2>
      <div className="mt-5 grid gap-5">
        {snapshot.bp.playOrder.map((map, index) => {
          const match = snapshot.compositions?.[map];
          if (!match) return null;
          return (
            <article key={map} className="border border-border bg-background/25 p-4">
              <h3 className="mb-4 font-bold">MAP {index + 1} · {MAP_LABELS[map]}</h3>
              <div className="grid gap-5 lg:grid-cols-2">
                {(["A", "B"] as const).map((team) => <TeamDraft key={team} snapshot={snapshot} team={team} map={map} />)}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function TeamDraft({ snapshot, team, map }: { snapshot: PublicGameSnapshot; team: TeamId; map: MapId }) {
  const composition = snapshot.compositions![map]![team];
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h4 className={team === "A" ? "font-bold text-team-a" : "font-bold text-team-b"}>{snapshot.players[team].nickname}</h4>
        <Badge variant="outline">{composition.score.toFixed(2)}</Badge>
      </div>
      <ul className="grid gap-1.5 sm:grid-cols-5">
        {composition.picks.map((pick) => (
          <li data-agent-pick key={pick.playerId} className="bg-muted/50 p-2 text-center">
            <span className="block truncate text-xs text-muted-foreground">{PLAYER_BY_ID[pick.playerId].name}</span>
            <strong className="mt-1 block text-sm">{pick.agent}</strong>
          </li>
        ))}
      </ul>
      <Progress value={composition.score} className="mt-3">
        <ProgressLabel>阵容适配</ProgressLabel>
        <ProgressValue>{composition.score.toFixed(2)}</ProgressValue>
      </Progress>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">{composition.explanation}</p>
    </div>
  );
}
