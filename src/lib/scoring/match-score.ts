type ScoreInput = {
  sameCity: boolean;
  sameDistrict: boolean;
  hasMarketplaceExperience: boolean;
  hasGeneralPvzExperience: boolean;
  ratingAvg: number;
  completedAssignmentsCount: number;
  isUrgent: boolean;
  lastActiveWithinDays: number;
};

export function calculateMatchScore(input: ScoreInput) {
  const city = input.sameCity ? 30 : 0;
  const district = input.sameDistrict ? 15 : 0;
  const marketplaceExp = input.hasMarketplaceExperience
    ? 20
    : input.hasGeneralPvzExperience
      ? 10
      : 0;
  const rating = Math.min(15, input.ratingAvg * 3);
  const completed = Math.min(10, input.completedAssignmentsCount / 5);
  const urgency = input.isUrgent ? 5 : 0;
  const activity = input.lastActiveWithinDays <= 7 ? 5 : 0;

  return Math.round(city + district + marketplaceExp + rating + completed + urgency + activity);
}
