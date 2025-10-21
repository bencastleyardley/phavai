export type SourceLink = { title: string; url: string };

export type Product = {
  brand: string;
  model: string;
  price: number;
  published: number;
  reddit: number;
  youtube: number;
  social: number;
  bestPick: number;
  badges: string[];
  links: {
    published: SourceLink[];
    reddit: SourceLink[];
    youtube: SourceLink[];
    social: SourceLink[];
  };
  lastSampled: string; // ISO date
};
