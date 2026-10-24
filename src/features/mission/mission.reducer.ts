
import type {
  MissionAction,
  MissionState,
} from "./mission.types";

export const initialMissionState: MissionState = {
  status: "READY",
  missionId: null,
  targetGoalId: null,
  error: null,
};

export function missionReducer(
  state: MissionState,
  action: MissionAction
): MissionState {
  switch (action.type) {
    case "MISSION_INITIATE": {
      if (
        state.status !== "READY" &&
        state.status !== "STOPPED" &&
        state.status !== "COMPLETED"
      ) {
        return state;
      }

      return {
         ...state,
        status: "RUNNING",
        missionId: action.missionId,
        targetGoalId: action.targetGoalId,
        error: null,
      };
    }

    case "MISSION_PAUSE": {
      if (state.status !== "RUNNING") {
        return state;
      }

      return {
        ...state,
        status: "PAUSED",
      };
    }

    case "MISSION_RESUME": {
      if (state.status !== "PAUSED") {
        return state;
      }

      return {
        ...state,
        status: "RUNNING",
        error: null,
      };
    }

    case "MISSION_STOP": {
      if (
        state.status !== "RUNNING" &&
        state.status !== "PAUSED"
      ) {
        return state;
      }

      return {
        ...state,
        status: "STOPPED",
      };
    }

    case "MISSION_COMPLETE": {
      if (state.status !== "RUNNING") {
        return state;
      }

      return {
        ...state,
        status: "COMPLETED",
      };
    }

    case "MISSION_ERROR": {
      return {
        ...state,
        status: "ERROR",
        error: action.error,
      };
    }

    case "MISSION_RESET": {
      return initialMissionState;
    }

    default: {
      return state;
    }
  }
}
