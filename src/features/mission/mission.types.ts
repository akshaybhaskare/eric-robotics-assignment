
export type MissionStatus =
  | "READY"
  | "RUNNING"
  | "PAUSED"
  | "STOPPED"
  | "COMPLETED"
  | "ERROR";

export type MissionState = {
  status: MissionStatus;
  missionId: string | null;
  targetGoalId: string | null;
  error: string | null;
};

export type MissionAction =
  | {
      type: "MISSION_INITIATE";
      missionId: string;
      targetGoalId: string;
    }
  | {
      type: "MISSION_PAUSE";
    }
  | {
      type: "MISSION_RESUME";
    }
  | {
      type: "MISSION_STOP";
    }
  | {
      type: "MISSION_COMPLETE";
    }
  | {
      type: "MISSION_ERROR";
      error: string;
    }
  | {
      type: "MISSION_RESET";
    };
