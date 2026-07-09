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
