const requireEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

export const DEFAULT_COMPANIES = [
  "CrowdStrike",
  "Microsoft",
  "Palo Alto Networks",
  "Orca",
  "Mitiga",
  "Wiz",
  "Cyera",
  "Okta",
  "Silverfort",
  "1Password",
  "Apono",
  "Teleport",
  "Swimlane",
  "Cribl",
  "Anomali",
  "Abnormal Security",
  "Netskope",
  "Acalvio",
  "Stifel",
];

export const PORT = Number(process.env.PORT ?? 4000);
export const CRON_SECRET = requireEnv("CRON_SECRET");
export const GOOGLE_SHEETS_ID = requireEnv("GOOGLE_SHEETS_ID");
