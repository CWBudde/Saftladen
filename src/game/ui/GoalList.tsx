import type { ProgressionGoal } from './progression'

export function GoalList({ goals, label }: { goals: ProgressionGoal[]; label: string }) {
  return <ul className="objective-list" aria-label={label}>
    {goals.map(goal => <li key={goal.id} className={goal.completed ? 'done' : ''}>
      <div className="objective-row"><span>{goal.title}</span>
        <strong>{goal.completed ? 'Completed · ' : ''}{goal.progress}/{goal.target}{goal.metric === 'accuracy' ? '%' : ''}</strong></div>
      <small>{goal.description}</small>
      <small>Reward: {goal.rewardXp} XP · {goal.rewardStarfruit} Starfruit{goal.completed ? ' · Awarded' : ''}</small>
    </li>)}
  </ul>
}
