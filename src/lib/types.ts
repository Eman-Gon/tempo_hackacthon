export interface AgentEvent {
  type:
    | "search"
    | "enrich"
    | "analyze"
    | "contact"
    | "complete"
    | "error"
    | "spend";
  message: string;
  data?: any;
  cost?: number;
}

export interface Candidate {
  name: string;
  title: string;
  company: string;
  linkedinUrl?: string;
  email?: string;
  emailVerified?: boolean;
  outreachSent?: boolean;
  summary: string;
  score: number;
  reasoning: string;
  scoreBreakdown: {
    skills: number;
    experience: number;
    location: number;
    activity: number;
  };
  sources: string[];
}
