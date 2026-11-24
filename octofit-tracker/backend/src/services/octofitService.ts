import { Activity, Team, User, Workout } from '../models/index.js';
import mongoose, { Types } from 'mongoose';

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function badRequest(message: string) {
  return Object.assign(new Error(message), { status: 400 });
}

export async function listActivities() {
  return Activity.find().lean();
}

export async function createActivity(input: unknown) {
  if (!isRecord(input)) throw badRequest('Activity details are required');

  const { userId, teamId, type, minutes } = input;
  if (
    typeof userId !== 'string' ||
    !mongoose.isValidObjectId(userId) ||
    typeof teamId !== 'string' ||
    !mongoose.isValidObjectId(teamId) ||
    typeof type !== 'string' ||
    !type.trim() ||
    typeof minutes !== 'number' ||
    !Number.isFinite(minutes) ||
    minutes < 1
  ) {
    throw badRequest('A valid user, team, activity type, and positive duration are required');
  }

  const [user, team] = await Promise.all([User.findById(userId), Team.findById(teamId)]);
  if (!user || !team) throw badRequest('The selected user and team must exist');

  return Activity.create({
    user: user._id,
    team: team._id,
    type: type.trim(),
    minutes,
    points: minutes,
    occurredAt: new Date(),
  });
}

export async function listTeams() {
  return Team.find().lean();
}

export async function createTeam(input: unknown) {
  if (!isRecord(input)) throw badRequest('Team details are required');

  const { name, mascot } = input;
  if (typeof name !== 'string' || !name.trim()) throw badRequest('A team name is required');
  if (typeof mascot !== 'string' || !mascot.trim()) throw badRequest('A team mascot is required');

  const memberIds = input.members ?? [];
  if (
    !Array.isArray(memberIds) ||
    memberIds.some((memberId) => typeof memberId !== 'string' || !mongoose.isValidObjectId(memberId))
  ) {
    throw badRequest('Team members must be valid user IDs');
  }
  const members = await User.find({ _id: { $in: memberIds } }).select('_id').lean();
  if (members.length !== memberIds.length) throw badRequest('Every team member must exist');

  return Team.create({
    name: name.trim(),
    mascot: mascot.trim(),
    members: members.map((member) => member._id),
  });
}

export async function getLeaderboard() {
  const [teams, totals] = await Promise.all([
    Team.find().lean(),
    Activity.aggregate<{ _id: Types.ObjectId; totalPoints: number }>([
      { $group: { _id: '$team', totalPoints: { $sum: '$points' } } },
    ]),
  ]);
  const pointsByTeam = new Map(totals.map(({ _id, totalPoints }) => [_id.toString(), totalPoints]));
  return teams
    .map((team) => ({
      teamName: team.name,
      totalPoints: pointsByTeam.get(team._id.toString()) ?? 0,
    }))
    .sort((left, right) => right.totalPoints - left.totalPoints || left.teamName.localeCompare(right.teamName))
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

const activityFocus: Record<string, string> = {
  cycle: 'endurance',
  run: 'endurance',
  strength: 'strength',
  walk: 'endurance',
  yoga: 'flexibility',
};

export async function suggestWorkouts(userEmail: string) {
  const user = await User.findOne({ email: userEmail.trim().toLowerCase() }).lean();
  if (!user) throw Object.assign(new Error('No user found for that email address'), { status: 404 });

  const [activities, workouts] = await Promise.all([
    Activity.find({ user: user._id }).sort({ occurredAt: -1 }).limit(10).lean(),
    Workout.find().lean(),
  ]);
  const recentType = activities[0]?.type.toLowerCase();
  const recentFocus = recentType ? activityFocus[recentType] : undefined;
  const preferredFocus = user.fitnessGoal || recentFocus;
  const orderedWorkouts = [...workouts].sort((left, right) => {
    const leftMatches = left.focus.toLowerCase() === preferredFocus?.toLowerCase() ? 1 : 0;
    const rightMatches = right.focus.toLowerCase() === preferredFocus?.toLowerCase() ? 1 : 0;
    return rightMatches - leftMatches || left.title.localeCompare(right.title);
  });
  const reason = recentType
    ? `Matches your ${user.fitnessGoal} goal and recent ${recentType} activity.`
    : `Matches your ${user.fitnessGoal} fitness goal.`;
  return orderedWorkouts.map((workout) => ({ ...workout, reason }));
}

export { User };
