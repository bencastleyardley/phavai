export type SourceLink = { title: string; url: string };

export type Product = {
  brand: string;
  model: string;
  price: number;
  published: number; // 0–5
  reddit: number;    // 0–5
  youtube: number;   // 0–5
  social: number;    // 0–5
  bestPick: number;  // 0–5 (avg of above)
  badges: string[];
  links: {
    published: SourceLink[];
    reddit: SourceLink[];
    youtube: SourceLink[];
    social: SourceLink[];
  };
  lastSampled: string; // ISO date
};
