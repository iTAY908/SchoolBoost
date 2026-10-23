// Worker 5 — shared type contracts across all modules
export interface HousingCosts {
  rent: number;
  arnona: number;
  utilities: number;
  houseCommittee: number;
}

export interface Profile {
  age: number;
  employed: boolean;
  monthlyIncome: number;
  livesWithParents: boolean;
  housing?: HousingCosts;
  initialBalance: number;
}

export interface Cube {
  key: string;
  name: string;
  color: string;
  icon: string;
  percentage: number;
  monthlyContribution: number;
  balance: number;
  fixed?: boolean;
  note?: string;
  math?: string;
  // custom (user-created) goal cubes
  custom?: boolean;
  priority?: number;
  aiExplanation?: string;
}

export interface Alert {
  level: 'critical' | 'warning';
  key: string;
  name: string;
  message: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// Raw onboarding answers as strings (lives in the persisted store so a user
// who abandons registration and returns hours later resumes the same step).
export interface OnboardingDraft {
  age: string;
  employed: boolean | null;
  monthlyIncome: string;
  livesWithParents: boolean | null;
  rent: string;
  arnona: string;
  utilities: string;
  houseCommittee: string;
  initialBalance: string;
}

export const EMPTY_DRAFT: OnboardingDraft = {
  age: '',
  employed: null,
  monthlyIncome: '',
  livesWithParents: null,
  rent: '',
  arnona: '',
  utilities: '',
  houseCommittee: '',
  initialBalance: '',
};
