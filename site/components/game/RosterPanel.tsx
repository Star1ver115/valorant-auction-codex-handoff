import { PLAYER_BY_ID } from "@/lib/game/player-pool";
import type { GamePlayers, TeamId } from "@/lib/game/types";

export function RosterPanel({
  team,
  nickname,
  budget,
  roster,
}: {
  team: TeamId;
  nickname: GamePlayers[TeamId]["nickname"];
  budget: number;
  roster: readonly (keyof typeof PLAYER_BY_ID)[];
}) {
  return (
    <section aria-label={`${nickname}阵容`} className="broadcast-panel p-4">
      <div className="flex items-end justify-between border-b border-border pb-3">
        <div>
          <p className={`eyebrow ${team === "A" ? "text-team-a" : "text-team-b"}`}>
            TEAM {team}
          </p>
          <h2 className="mt-1 text-xl font-black">{nickname}</h2>
        </div>
        <p className="text-right text-sm font-bold">{nickname}预算 · {budget} 块</p>
      </div>
      <ol className="mt-3 grid gap-2">
        {Array.from({ length: 5 }, (_, index) => {
          const player = roster[index] ? PLAYER_BY_ID[roster[index]] : null;
          return (
            <li key={index} className="flex min-h-10 items-center justify-between border-b border-border/60 py-2 last:border-0">
              <span className={player ? "font-semibold" : "text-muted-foreground"}>
                {player?.name ?? `席位 ${index + 1}`}
              </span>
              {player ? null : <span className="text-xs text-muted-foreground">待定</span>}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
