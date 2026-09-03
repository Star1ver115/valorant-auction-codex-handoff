import { Badge } from "@/components/ui/badge";

export function SpectatorBadge({ count }: { count: number }) {
  return <Badge variant="outline">只读观战 · {count}/3</Badge>;
}
