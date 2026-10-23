
export type GoalStatus = 'PENDING' | 'ACTIVE' | 'REACHED' | 'FAILED'

export type NavigationGoal = {
  id: string
  name: string

  // Goal position in the selected map frame
  x: number
  y: number

  // Desired robot heading in radians
  heading: number

  status: GoalStatus
  createdAt: number
}

export type GoalDraft = {
  name: string
  x: number
  y: number
  heading: number
}

export type GoalState = {
  goals: NavigationGoal[]
  selectedGoalId: string | null
}

export type GoalAction =
  | {
      type: 'GOAL_ADD'
      goal: NavigationGoal
    }
  | {
      type: 'GOAL_SELECT'
      goalId: string
    }
  | {
      type: 'GOAL_UPDATE'
      goal: NavigationGoal
    }
  | {
      type: 'GOAL_REMOVE'
      goalId: string
    }
  | {
      type: 'GOAL_CLEAR'
    }
