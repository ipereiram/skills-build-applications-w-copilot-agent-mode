import { useEffect, useState } from 'react';
import { getJson } from '../api/client.js';

type Workout = { title: string; focus: string; minutes?: number; difficulty?: string; reason: string };
type WorkoutResponse = { suggestions: Workout[] };
const userEmail = 'mona@example.com';

export default function Workouts() {
  const [suggestions, setSuggestions] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    getJson<WorkoutResponse>(`/api/workouts/suggestions/${encodeURIComponent(userEmail)}`)
      .then(({ suggestions: result }) => {
        if (active) setSuggestions(result);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Unable to load workout suggestions.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  return <section className="card"><div className="card-body">
    <h2 className="h4">Workout suggestions</h2>
    <p>Recommend workouts from activity patterns.</p>
    {loading ? <p role="status">Loading workout suggestions...</p> : error ? <p role="alert">Unable to load workout suggestions: {error}</p> : suggestions.length === 0 ? <p>No workout suggestions yet.</p> : <ul>
      {suggestions.map((workout) => <li key={workout.title}><strong>{workout.title}</strong> — {workout.focus}. {workout.reason}</li>)}
    </ul>}
  </div></section>;
}
