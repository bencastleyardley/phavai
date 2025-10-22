// app/lib/types.ts
export type SourceLink = {
  title: string;
  url: string;
  domain?: string;
  lastSampled?: string; // ISO date
};

export type Product = {
  brand: string;
  model: string;
  badge?: "Best Overall" | "Best Value" | "Editor’s Choice" | null;
  priceHint?: string;
  category: "trail-running";
  gender: "men" | "women";
  image?: string;
  sku?: string;
  bestPick: number; // 0..100
  scores: {
    published: number;
    reddit: number;
    youtube: number;
    social: number;
  };
  sources?: {
    published?: SourceLink[];
    reddit?: SourceLink[];
    youtube?: SourceLink[];
    social?: SourceLink[];
  };
  affiliates?: Array<{
    retailer: string;
    url: string;
    price?: number;
    currency?: "USD";
  }>;
};
