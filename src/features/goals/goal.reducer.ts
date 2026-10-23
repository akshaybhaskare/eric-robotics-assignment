
import type {
  GoalAction,
  GoalState,
} from './goal.types'

export const initialGoalState: GoalState = {
  goals: [],
  selectedGoalId: null,
}

export function goalReducer(
  state: GoalState,
  action: GoalAction
): GoalState {
  switch (action.type) {
    case 'GOAL_ADD': {
      const exists = state.goals.some(
        (goal) => goal.id === action.goal.id
      )

      if (exists) return state

      return {
        goals: [...state.goals, action.goal],
        selectedGoalId: action.goal.id,
      }
    }

    case 'GOAL_SELECT': {
      const exists = state.goals.some(
        (goal) => goal.id === action.goalId
      )

      if (!exists) return state

      return {
        ...state,
        selectedGoalId: action.goalId,
      }
    }

    case 'GOAL_UPDATE': {
      const exists = state.goals.some(
        (goal) => goal.id === action.goal.id
      )

      if (!exists) return state

      return {
        ...state,
        goals: state.goals.map((goal) =>
          goal.id === action.goal.id
            ? action.goal
            : goal
        ),
      }
    }

    case 'GOAL_REMOVE': {
      const remaining = state.goals.filter(
        (goal) => goal.id !== action.goalId
      )

      return {
        goals: remaining,
        selectedGoalId:
          state.selectedGoalId === action.goalId
            ? null
            : state.selectedGoalId,
      }
    }

    case 'GOAL_CLEAR':
      return initialGoalState

    default:
      return state
  }
}
