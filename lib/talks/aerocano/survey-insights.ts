export type SurveyInsights = Partial<{
  archetype_leaderboard: Record<string, number>;
  hot_vs_iced: { hot: number; iced: number };
  purist_vs_mixologist: { plain: number; mixed: number };
  sweetness_target: number;
  vibe_check_emoji: string;
  hugot_detector: boolean;
  tito_tita_energy: number;
  kahit_ano_counter: number;
  weirdest_order: string;
  the_why_cloud: string[];
}>;
