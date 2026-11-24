import { useEffect, useState } from 'react';
import { getJson } from '../api/client.js';

type Entry = { teamName: string; totalPoints: number; rank: number };
type LeaderboardResponse = { leaderboard: Entry[] };

export default function Leaderboard() {
  const [leaderboard, setLeaderboard] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    getJson<LeaderboardResponse>('/api/leaderboard')
      .then(({ leaderboard: result }) => {
        if (active) setLeaderboard(result);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Unable to load the leaderboard.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  return <section className="card"><div className="card-body">
    <h2 className="h4">Leaderboard</h2>
    <p>Compare team point totals.</p>
    {loading ? <p role="status">Loading leaderboard...</p> : error ? <p role="alert">Unable to load leaderboard: {error}</p> : leaderboard.length === 0 ? <p>No leaderboard scores yet.</p> : <ol>
      {leaderboard.map((entry) => <li key={entry.teamName}>{entry.teamName}: {entry.totalPoints} points (rank {entry.rank})</li>)}
    </ol>}
  </div></section>;
}
