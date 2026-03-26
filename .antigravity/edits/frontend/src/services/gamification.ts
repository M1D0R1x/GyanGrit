// services.gamification
import { apiGet } from "./api";

export type Badge = {
  code:      string;
  label:     string;
  emoji:     string;
  earned_at: string;
};

export type MySummary = {
  total_points:   number;
  current_streak: number;
  longest_streak: number;
  badge_count:    number;
  badges:         Badge[];
  class_rank:     number | null;
};

export type LeaderboardEntry = {
  rank:         number;
  user_id:      number;
  display_name: string;
  total_points: number;
  is_me:        boolean;
};

export type ClassLeaderboard = {
  class_id:   number;
  class_name: string;
  entries:    LeaderboardEntry[];
};

export type SchoolLeaderboard = {
  institution_name: string;
  entries:          LeaderboardEntry[];
};

export const getMySummary = () =>
  apiGet<MySummary>("/gamification/me/");

export const getClassLeaderboard = (classId?: number) =>
  apiGet<ClassLeaderboard>(
    classId
      ? `/gamification/leaderboard/class/?class_id=${classId}`
      : "/gamification/leaderboard/class/"
  );

export const getSchoolLeaderboard = (institutionId?: number) =>
  apiGet<SchoolLeaderboard>(
    institutionId
      ? `/gamification/leaderboard/school/?institution_id=${institutionId}`
      : "/gamification/leaderboard/school/"
  );