"use client";

import { GameShell } from "@/components/game/GameShell";
import { useLocalGame } from "@/hooks/useLocalGame";

export default function Home() {
  const game = useLocalGame();
  return <GameShell {...game} onAction={game.dispatch} onReset={game.reset} />;
}
