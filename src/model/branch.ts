export interface Branch {
  name: string;
  commit: string;
  label: string;
  linkedWorkingDirectory?: string;
}

export interface BranchSummary {
  all: Branch[];
  branches: Record<string, Branch>;
  current: string;
  detached: boolean;
}
