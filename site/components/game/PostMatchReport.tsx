import { Badge } from "@/components/ui/badge";
import { PLAYER_BY_ID } from "@/lib/game/player-pool";
import type { PublicGameSnapshot } from "@/lib/game/types";

export function PostMatchReport({ snapshot }: { snapshot: PublicGameSnapshot }) {
  const series = snapshot.series;
  if (!series) return null;
  const winner = snapshot.players[series.winner].nickname;
  return (
    <section aria-labelledby="report-title" className="broadcast-panel overflow-hidden">
      <header className="relative border-b border-border bg-analysis/10 p-6 sm:p-9">
        <p className="eyebrow text-analysis">POST MATCH REPORT</p>
        <h2 id="report-title" className="mt-2 text-3xl font-black sm:text-5xl">{winner} 赢下系列赛</h2>
        <p className="mt-3 text-muted-foreground">系统仅解释已生成结果，不会因播放速度或跳过动画重新计算。</p>
      </header>
      <div className="grid gap-6 p-6 lg:grid-cols-3 sm:p-9">
        <ReportCard label="系列赛 MVP" value={PLAYER_BY_ID[series.seriesMvp.playerId].name} detail={`ACS ${series.seriesMvp.acs} · ${series.seriesMvp.kills}/${series.seriesMvp.deaths}/${series.seriesMvp.assists}`} />
        <ReportCard label="最佳购买" value={PLAYER_BY_ID[series.bestPurchase.playerId].name} detail={`${series.bestPurchase.price} 块成交 · 价值指数 ${series.bestPurchase.value.toFixed(2)}`} />
        <ReportCard label="溢价观察" value={PLAYER_BY_ID[series.overpay.playerId].name} detail={`${series.overpay.price} 块成交 · 溢价 ${series.overpay.premium.toFixed(2)}`} />
      </div>
      <div className="border-t border-border p-6 sm:p-9">
        <h3 className="text-lg font-black">胜负关键</h3>
        <ul className="mt-3 grid gap-3 md:grid-cols-3">
          {series.winningFactors.slice(0, 3).map((factor, index) => (
            <li data-win-factor key={factor} className="flex gap-3 bg-muted/30 p-4 text-sm leading-6">
              <Badge variant="outline">0{index + 1}</Badge><span>{factor}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function ReportCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <article className="border-l-2 border-analysis pl-4">
      <p className="eyebrow">{label}</p>
      <h3 className="mt-2 text-2xl font-black">{value}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
    </article>
  );
}
