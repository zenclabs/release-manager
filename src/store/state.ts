export interface State {
  releaseBranches: ReleaseBranchesState;
}

export type ReleaseBranchesState =
  | IncompleteReleaseBranchesState
  | LoadedReleaseBranchesState;

export interface IncompleteReleaseBranchesState {
  status: Loading | Failed;
}

export interface LoadedReleaseBranchesState {
  status: Loaded;
  names: string[];
  selectedBranchName?: string;
}

export type LoadingStatus = Loading | Loaded | Failed;

export type Loading = "loading";

export type Loaded = "loaded";

export type Failed = "failed";
