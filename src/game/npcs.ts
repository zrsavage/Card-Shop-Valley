export type FriendshipTier = 'stranger' | 'acquaintance' | 'friend' | 'bestfriend';

export interface NpcDef {
  id: string;
  name: string;
  color: number;
  morningSpot: { x: number; y: number };
  afternoonSpot: { x: number; y: number };
  lines: Record<FriendshipTier, string[]>;
}

export const NPCS: NpcDef[] = [
  {
    id: 'mira',
    name: 'Mira',
    color: 0xff6fae,
    morningSpot: { x: 180, y: 220 },
    afternoonSpot: { x: 300, y: 420 },
    lines: {
      stranger: ["Oh — a new shopkeeper. Don't expect a discount.", 'Busy day. What do you want?'],
      acquaintance: ['Heard your shop opened. Might stop by sometime.', 'Cards, huh? Never got the appeal.'],
      friend: ["You're alright, for a card dealer.", 'Pull anything good lately?'],
      bestfriend: ['Honestly? Best thing that happened to this town.', "Save me a legendary, would you?"],
    },
  },
  {
    id: 'tobin',
    name: 'Tobin',
    color: 0x4ea8de,
    morningSpot: { x: 620, y: 420 },
    afternoonSpot: { x: 500, y: 260 },
    lines: {
      stranger: ["Name's Tobin. Don't get much foot traffic out here.", 'Watch your step, the fountain floods sometimes.'],
      acquaintance: ["My kid won't stop talking about your pack openings.", 'Any epics this week?'],
      friend: ["You should sponsor the summer festival. Just saying.", 'Good to see you, shopkeep.'],
      bestfriend: ['You know, this town needed someone like you.', "Whatever you're selling, I'm buying."],
    },
  },
  {
    id: 'gus',
    name: 'Old Gus',
    color: 0x9c6644,
    morningSpot: { x: 720, y: 180 },
    afternoonSpot: { x: 700, y: 460 },
    lines: {
      stranger: ['Back in my day, cards were just cards.', "Don't mind me, I'm just passing through."],
      acquaintance: ['That shop of yours smells like fresh paper. Good sign.', 'Prices too steep for an old man like me.'],
      friend: ["I remember when this town had a real market. You're bringing that back.", 'Got a minute to chat?'],
      bestfriend: ["You remind me of my glory days runnin' the old stalls.", "This town's lucky to have you."],
    },
  },
  {
    id: 'wren',
    name: 'Wren',
    color: 0x80ed99,
    morningSpot: { x: 260, y: 480 },
    afternoonSpot: { x: 160, y: 260 },
    lines: {
      stranger: ["I'm Wren. I collect... things. Cards, mostly.", "Careful, I'm always scouting for good deals."],
      acquaintance: ['Your shelves could use some organizing, no offense.', 'Got anything rare in stock?'],
      friend: ["I've been telling everyone about your shop.", 'You have a good eye for pricing, you know.'],
      bestfriend: ["Best shopkeep this town's ever had, hands down.", "I'd trade you my whole collection if you asked."],
    },
  },
];

export function friendshipTier(friendship: number): FriendshipTier {
  if (friendship >= 80) return 'bestfriend';
  if (friendship >= 50) return 'friend';
  if (friendship >= 20) return 'acquaintance';
  return 'stranger';
}

export const FRIENDSHIP_TIER_LABELS: Record<FriendshipTier, string> = {
  stranger: 'Stranger',
  acquaintance: 'Acquaintance',
  friend: 'Friend',
  bestfriend: 'Best Friend',
};
