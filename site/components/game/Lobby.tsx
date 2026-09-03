import { Button } from "@/components/ui/button";

export function Lobby({ onStart }: { onStart: () => void }) {
  return (
    <section className="mx-auto grid w-full max-w-5xl gap-6 px-5 py-10 lg:grid-cols-[1.25fr_.75fr] lg:py-20">
      <div className="broadcast-panel relative overflow-hidden p-7 sm:p-10">
        <div className="absolute right-0 top-0 h-full w-2 bg-team-b" />
        <p className="eyebrow">UNOFFICIAL STRATEGY SIMULATOR</p>
        <h1 aria-label="巅峰选手拍卖" className="mt-5 max-w-3xl text-4xl font-black uppercase leading-[.94] tracking-[-.05em] sm:text-7xl">
          巅峰选手
          <span className="block text-team-a">拍卖</span>
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
          两名玩家各持 20 块虚拟预算，公开竞价组建五人阵容。随后由同一确定性引擎完成地图 BP、特工分配与 BO5。
        </p>
        <Button onClick={onStart} size="lg" className="mt-8 h-12 px-7 text-base font-bold">
          开始同机双人
        </Button>
      </div>

      <aside className="broadcast-panel grid content-between gap-8 p-7">
        <div>
          <p className="eyebrow text-analysis">MATCH DESK</p>
          <h2 className="mt-3 text-2xl font-bold">赛前须知</h2>
        </div>
        <dl className="grid gap-3">
          <Seat label="玩家 A" color="bg-team-a" />
          <Seat label="玩家 B" color="bg-team-b" />
        </dl>
        <p className="border-l-2 border-analysis pl-4 text-sm leading-6 text-muted-foreground">
          无真钱、奖品、兑换或转让价值。拍卖没有倒计时，轮到谁就由谁决定。
        </p>
      </aside>
    </section>
  );
}

function Seat({ label, color }: { label: string; color: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border py-3">
      <dt className="font-semibold">{label}</dt>
      <dd className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className={`size-2 rounded-full ${color}`} />20 块
      </dd>
    </div>
  );
}
