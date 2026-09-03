"use client";

import { GameShell } from "@/components/game/GameShell";
import { useLocalGame } from "@/hooks/useLocalGame";
import { useOnlineRoom } from "@/hooks/useOnlineRoom";

export default function Home() {
  const local = useLocalGame();
  const online = useOnlineRoom();
  const usingOnline = Boolean(online.snapshot);
  return (
    <GameShell
      snapshot={online.snapshot ?? local.snapshot}
      notice={online.message ?? local.notice}
      onAction={usingOnline ? online.submit : local.dispatch}
      onReset={local.reset}
      online={{
        connection: online.connection,
        code: online.code,
        role: online.role,
        spectatorCount: online.spectatorCount,
        spectatorsOpen: online.spectatorsOpen,
        playerReady: online.snapshot?.players.B.nickname !== "等待加入",
        onCreate: online.create,
        onJoin: online.join,
        onLeave: online.leave,
        onAction: online.submit,
        onSpectatorsOpenChange: online.setSpectatorsOpen,
      }}
    />
  );
}
