export const DUNGEON_STAGE_1_PLAYERS = "dungeons-stage-1-players";
export const DUNGEON_STAGE_2_PLAYERS = "dungeons-stage-2-players";
export const DUNGEON_STAGE_2_CLUES = "dungeons-stage-2-clues";
export const DUNGEON_STAGE_5_SUBMISSIONS = "dungeons-stage-5-submissions";
export const DUNGEON_STATE_COLLECTION = "dungeons-state";
export const DUNGEON_BATTLE_PATH = "dungeons/battle-4";
export const DUNGEON_PUBLIC_ORIGIN = "https://talks-amber.vercel.app";

export const DUNGEON_ROLES = ["warrior", "mage", "archer"] as const;
export const DUNGEON_BATTLE_ROLES = ["mage", "warrior", "archer"] as const;

export type DungeonRole = (typeof DUNGEON_ROLES)[number];
export type QuestStatus = "waiting" | "ready" | "checking" | "passed" | "failed";

export type DungeonPlayer = {
  id: string;
  name: string;
  role: DungeonRole;
  status: QuestStatus;
  intent?: string;
  feedback?: string;
  clue?: string;
};

export type DungeonClue = {
  id: string;
  playerName: string;
  role: DungeonRole | "elder";
  text: string;
  artifact: string;
};

export type CelebrationBoard = {
  moodMeter: number;
  moodLabel: string;
  happinessIndex: number;
  lyrics: string;
  lookAndFeel: string;
  songPrompt: string;
  revision: number;
};

export const DEFAULT_CELEBRATION_BOARD: CelebrationBoard = {
  moodMeter: 0,
  moodLabel: "",
  happinessIndex: 0,
  lyrics: "",
  lookAndFeel: "",
  songPrompt: "",
  revision: 0,
};

export const CELEBRATION_GROUND_FINDINGS = [
  "a warm dragon scale that hums when held near music",
  "a bent silver spoon engraved with the words sing louder",
  "three blue feathers tied together with a golden thread",
  "a scorched festival ribbon that still smells like cinnamon",
  "a tiny brass bell that rings without being touched",
  "a page from the bard's notebook containing only a drawing of the moon",
  "a smooth black stone marked with a dancing footprint",
  "a cracked goblet reflecting the colors of sunrise",
  "a wooden dragon toy missing one heroic-looking wing",
] as const;

function celebrationScore(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value))) : fallback;
}

function celebrationText(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export function normalizeCelebrationBoard(value: Record<string, unknown> | undefined): CelebrationBoard {
  const revision = typeof value?.revision === "number" && Number.isFinite(value.revision) ? Math.max(0, Math.round(value.revision)) : 0;
  if (revision === 0) return DEFAULT_CELEBRATION_BOARD;
  return {
    moodMeter: celebrationScore(value?.moodMeter, DEFAULT_CELEBRATION_BOARD.moodMeter),
    moodLabel: celebrationText(value?.moodLabel, DEFAULT_CELEBRATION_BOARD.moodLabel),
    happinessIndex: celebrationScore(value?.happinessIndex, DEFAULT_CELEBRATION_BOARD.happinessIndex),
    lyrics: celebrationText(value?.lyrics, DEFAULT_CELEBRATION_BOARD.lyrics),
    lookAndFeel: celebrationText(value?.lookAndFeel, DEFAULT_CELEBRATION_BOARD.lookAndFeel),
    songPrompt: celebrationText(value?.songPrompt, DEFAULT_CELEBRATION_BOARD.songPrompt),
    revision,
  };
}

export const ROLE_DETAILS: Record<
  DungeonRole,
  {
    title: string;
    glyph: string;
    color: string;
    artifact: string;
    action: string;
    lore: string;
  }
> = {
  warrior: {
    title: "Warrior",
    glyph: "⚔",
    color: "#d97746",
    artifact: "weathered scrolls",
    action: "check the scrolls",
    lore: "You read battle marks, broken defenses, and the trails left by retreating armies.",
  },
  mage: {
    title: "Mage",
    glyph: "✦",
    color: "#8c7ae6",
    artifact: "charred spellbook",
    action: "check the book",
    lore: "You recognize magical residue, old wards, and memories trapped in ink.",
  },
  archer: {
    title: "Archer",
    glyph: "➶",
    color: "#6f9f74",
    artifact: "scout notes",
    action: "check the notes",
    lore: "You notice tracks, sightlines, distant movement, and signs others overlook.",
  },
};

export const ROLE_CLUE_SEEDS: Record<DungeonRole, readonly string[]> = {
  warrior: [
    "The eastern barricade was crushed inward by something enormous.",
    "The city guard abandoned their posts after the bells rang three times.",
    "A trail of black scales leads from the square toward the northern mountain.",
  ],
  mage: [
    "The protective ward failed when a hidden sigil beneath the well was broken.",
    "A burst of ancient fire magic passed over the rooftops before dawn.",
    "The town archive mentions a dragon awakened by a stolen crystal seal.",
  ],
  archer: [
    "Wing shadows crossed the moon while villagers fled through the western gate.",
    "Claw prints and scorched tracks continue toward the northern mountain.",
    "A scout saw a wounded dragon carrying a glowing crystal in its talons.",
  ],
};

export const DRAGON_CLUE: DungeonClue = {
  id: "dragon-omen",
  playerName: "The Last Town Crier",
  role: "elder",
  artifact: "sealed proclamation",
  text: "The scattered evidence agrees on one final truth: the town will not be safe until the adventurers climb the northern mountain and slay the dragon guarding the stolen crystal seal.",
};

export const ELDERS = [
  {
    id: "batt",
    name: "Batt",
    title: "Keeper of the Watch",
    voice: "Charon",
    glyph: "♜",
    personality: "blunt, disciplined, suspicious of embellishment, and focused on defenses and battle facts",
  },
  {
    id: "arto",
    name: "Arto",
    title: "Archivist of Ash",
    voice: "Kore",
    glyph: "⌘",
    personality: "measured, scholarly, compassionate, and careful to separate evidence from speculation",
  },
  {
    id: "durst",
    name: "Durst",
    title: "Master of the Forge",
    voice: "Fenrir",
    glyph: "⚒",
    personality: "gruff, practical, darkly humorous, and attentive to physical traces and damaged objects",
  },
  {
    id: "sbor",
    name: "Sbor",
    title: "Listener in the Reeds",
    voice: "Aoede",
    glyph: "☾",
    personality: "soft-spoken, uncanny, poetic but concise, and especially attentive to witnesses and distant signs",
  },
] as const;

export function isDungeonRole(value: unknown): value is DungeonRole {
  return typeof value === "string" && DUNGEON_ROLES.includes(value as DungeonRole);
}

export function roleForIndex(index: number): DungeonRole {
  return DUNGEON_ROLES[Math.abs(index) % DUNGEON_ROLES.length];
}

export function battleRoleForIndex(index: number): DungeonRole {
  return DUNGEON_BATTLE_ROLES[Math.abs(index) % DUNGEON_BATTLE_ROLES.length];
}

export function roleClueSeed(role: DungeonRole, index: number) {
  const seeds = ROLE_CLUE_SEEDS[role];
  return seeds[Math.abs(index) % seeds.length];
}
