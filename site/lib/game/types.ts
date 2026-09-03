export type Tier = "T0" | "T0.5" | "T1" | "T1.5";

export type Role =
  | "DUELIST"
  | "INITIATOR"
  | "CONTROLLER"
  | "SENTINEL"
  | "FLEX";

export type PlayerId =
  | "aspas"
  | "chronicle"
  | "zmjjkk"
  | "leo"
  | "less"
  | "mako"
  | "forsaken"
  | "nobody"
  | "chichoo"
  | "boaster";

export type AgentId =
  | "ASTRA"
  | "BREACH"
  | "BRIMSTONE"
  | "CHAMBER"
  | "CYPHER"
  | "FADE"
  | "GEKKO"
  | "HARBOR"
  | "JETT"
  | "KILLJOY"
  | "NEON"
  | "OMEN"
  | "RAZE"
  | "SKYE"
  | "SOVA"
  | "VIPER"
  | "VYSE"
  | "YORU";

export type MapId =
  | "ABYSS"
  | "CORRODE"
  | "HAVEN"
  | "SPLIT"
  | "LOTUS"
  | "SUNSET"
  | "ICEBOX";

export type PeakSample = {
  event: string;
  rounds: number;
  sampleScope: "FULL_EVENT";
  evidence: string;
};

export type Attributes = {
  overall: number;
  aim: number;
  entry: number;
  utility: number;
  clutch: number;
  igl: number;
  adaptability: number;
};

export type PlayerCard = {
  id: PlayerId;
  name: string;
  region: "CN" | "EMEA" | "AMERICAS" | "PACIFIC";
  primaryRole: Role;
  secondaryRoles: Role[];
  tier: Tier;
  referencePrice: number;
  peak: PeakSample;
  attributes: Attributes;
  agents: AgentId[];
};

export type SeededRng = {
  next(): number;
  int(maxExclusive: number): number;
};

export type TeamId = "A" | "B";
export type AuctionPhase = "AUCTION" | "ZERO_BUDGET_SELECTION" | "COMPLETE";

export type AuctionTeam = {
  budget: number;
  roster: PlayerId[];
};

export type BiddingState = {
  playerId: PlayerId;
  opener: TeamId;
  actor: TeamId;
  currentBid: number | null;
  highBidder: TeamId | null;
  passed: TeamId[];
};

export type ZeroBudgetState = {
  zeroTeam: TeamId;
  solventTeam: TeamId;
  actor: TeamId;
};

export type AuctionState = {
  phase: AuctionPhase;
  order: PlayerId[];
  lotIndex: number;
  teams: Record<TeamId, AuctionTeam>;
  bidding: BiddingState | null;
  zeroBudget: ZeroBudgetState | null;
};

type PhaseAwareAction = { expectedPhase?: AuctionPhase };

export type AuctionAction = PhaseAwareAction &
  (
    | { type: "BID"; actor: TeamId; amount: number }
    | { type: "PASS"; actor: TeamId }
    | {
        type: "ZERO_CHOICE";
        actor: TeamId;
        choice: "TAKE" | "DECLINE";
      }
  );

export type AuctionEvent =
  | {
      type: "BID_PLACED";
      playerId: PlayerId;
      actor: TeamId;
      amount: number;
    }
  | { type: "BIDDER_PASSED"; playerId: PlayerId; actor: TeamId }
  | {
      type: "ZERO_BUDGET_CHOICE";
      playerId: PlayerId;
      actor: TeamId;
      choice: "TAKE" | "DECLINE";
    }
  | {
      type: "PLAYER_AWARDED";
      playerId: PlayerId;
      team: TeamId;
      price: number;
    }
  | { type: "AUCTION_PHASE_CHANGED"; phase: AuctionPhase };

export type AuctionTransition = {
  state: AuctionState;
  events: AuctionEvent[];
};
