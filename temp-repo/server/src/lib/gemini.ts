import { GoogleGenerativeAI } from "@google/generative-ai";
import { mkdir, appendFile } from "node:fs/promises";
import path from "node:path";
import { NewsItem } from "../types";
import approvedSources from "../approved-sources.json";

const geminiApiKey = process.env.GEMINI_API_KEY;
if (!geminiApiKey) {
  throw new Error("Missing required environment variable: GEMINI_API_KEY");
}

const genAI = new GoogleGenerativeAI(geminiApiKey);
const createModel = (modelName: string) =>
  genAI.getGenerativeModel({
    model: modelName,
    tools: [{ googleSearch: {} } as any],
  });

const PRIMARY_MODEL = "gemini-2.5-flash";
const FALLBACK_MODEL = "gemini-2.5-flash-lite";
const RETRY_DELAYS_MS = [800, 1600, 3200];
const URL_VERIFY_TIMEOUT_MS = 5000;
const GEMINI_DEBUG_LOG = process.env.GEMINI_DEBUG_LOG === "1";
const URL_REJECTION_BLOCKLIST = new Set(["head_404", "head_410", "get_404", "get_410"]);
const countReasons = <T extends { reason: string }>(
  records: T[]
): Record<string, number> =>
  records.reduce<Record<string, number>>((acc, entry) => {
    acc[entry.reason] = (acc[entry.reason] ?? 0) + 1;
    return acc;
  }, {});

const approvedSourcesByCompany = approvedSources as Record<string, string[]>;

const appendDebugTrace = async (payload: Record<string, unknown>): Promise<void> => {
  if (!GEMINI_DEBUG_LOG) {
    return;
  }

  try {
    const logDir = path.resolve(process.cwd(), "logs");
    await mkdir(logDir, { recursive: true });
    const logPath = path.join(logDir, "generation-debug.ndjson");
    const line = `${JSON.stringify({ timestamp: new Date().toISOString(), ...payload })}\n`;
    await appendFile(logPath, line, "utf8");
  } catch (error) {
    console.error("Failed to write Gemini debug trace", error);
  }
};

const stripCodeFences = (text: string): string =>
  text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

const parseNewsItems = (raw: string): Partial<NewsItem>[] => {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as Partial<NewsItem>[] | { news?: Partial<NewsItem>[] };
    if (Array.isArray(parsed)) {
      return parsed;
    }
    if (Array.isArray(parsed.news)) {
      return parsed.news;
    }
  } catch {
    const start = raw.indexOf("[");
    const end = raw.lastIndexOf("]");
    if (start >= 0 && end > start) {
      const candidate = raw.slice(start, end + 1);
      const parsedCandidate = JSON.parse(candidate) as Partial<NewsItem>[];
      if (Array.isArray(parsedCandidate)) {
        return parsedCandidate;
      }
    }
  }

  return [];
};

const buildGenerateRequest = (prompt: string) => ({
  contents: [{ role: "user", parts: [{ text: prompt }] }],
  generationConfig: {
    temperature: 0.2,
  },
});

const generateTextWithRetry = async (
  prompt: string
): Promise<{ text: string; model: string }> => {
  const request = buildGenerateRequest(prompt);
  let lastError: unknown;
  let response:
    | Awaited<ReturnType<ReturnType<typeof createModel>["generateContent"]>>
    | undefined;
  let selectedModel: string | null = null;
  const modelOrder = [PRIMARY_MODEL, FALLBACK_MODEL];

  for (const modelName of modelOrder) {
    const activeModel = createModel(modelName);
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
      try {
        response = await activeModel.generateContent(request);
        selectedModel = modelName;
        break;
      } catch (error: any) {
        lastError = error;
        const status = error?.status;
        const retriable = status === 429 || status === 500 || status === 503;
        if (!retriable || attempt === RETRY_DELAYS_MS.length) {
          break;
        }
        await new Promise((resolve) =>
          setTimeout(resolve, RETRY_DELAYS_MS[attempt])
        );
      }
    }
    if (response) {
      break;
    }
  }

  if (!response || !selectedModel) {
    throw lastError ?? new Error("Gemini request failed");
  }

  return {
    text: stripCodeFences(response.response.text() ?? ""),
    model: selectedModel,
  };
};

const normalizeSourceUrl = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed.replace(/^\/+/, "")}`;
};

const normalizeDomainPattern = (pattern: string): string =>
  pattern
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "");

const getRootDomain = (hostOrPattern: string): string => {
  const cleaned = hostOrPattern
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .split("/")[0]
    .replace(/\/+$/, "");
  const parts = cleaned.split(".").filter(Boolean);
  if (parts.length < 2) {
    return cleaned;
  }
  return parts.slice(-2).join(".");
};

const isGroundingRedirectUrl = (urlValue: string): boolean => {
  try {
    const parsed = new URL(urlValue);
    return (
      parsed.hostname === "vertexaisearch.cloud.google.com" &&
      parsed.pathname.startsWith("/grounding-api-redirect/")
    );
  } catch {
    return false;
  }
};

const isApprovedUrlForCompany = (company: string, urlValue: string): boolean => {
  const patterns = approvedSourcesByCompany[company] ?? [];
  if (patterns.length === 0) {
    return false;
  }

  try {
    const url = new URL(urlValue);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return false;
    }

    const normalizedHostPath = `${url.hostname}${url.pathname}`
      .toLowerCase()
      .replace(/\/+$/, "");
    const urlRootDomain = getRootDomain(url.hostname);

    return patterns.some((pattern) => {
      const normalizedPattern = normalizeDomainPattern(pattern);
      const patternHost = normalizedPattern.split("/")[0];
      const patternRootDomain = getRootDomain(patternHost);
      const sameCompanyRootDomain =
        urlRootDomain === patternRootDomain ||
        url.hostname.toLowerCase().endsWith(`.${patternRootDomain}`);
      if (sameCompanyRootDomain) {
        return true;
      }
      return (
        normalizedHostPath === normalizedPattern ||
        normalizedHostPath.startsWith(`${normalizedPattern}/`)
      );
    });
  } catch {
    return false;
  }
};

const fetchWithTimeout = async (
  input: string,
  init: RequestInit
): Promise<Response> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), URL_VERIFY_TIMEOUT_MS);
  try {
    return await fetch(input, {
      ...init,
      redirect: "follow",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
};

const resolveGroundingRedirectUrl = async (urlValue: string): Promise<string> => {
  if (!isGroundingRedirectUrl(urlValue)) {
    return urlValue;
  }

  try {
    const headResponse = await fetchWithTimeout(urlValue, { method: "HEAD" });
    if (headResponse.url) {
      return normalizeSourceUrl(headResponse.url);
    }
  } catch {
    // Some endpoints can block HEAD. Try GET as fallback.
  }

  try {
    const getResponse = await fetchWithTimeout(urlValue, {
      method: "GET",
      headers: { Range: "bytes=0-1024" },
    });
    if (getResponse.url) {
      return normalizeSourceUrl(getResponse.url);
    }
  } catch {
    return urlValue;
  }

  return urlValue;
};

const verifySourceUrl = async (
  item: NewsItem
): Promise<{ valid: boolean; reason: string }> => {
  if (!isApprovedUrlForCompany(item.company, item.sourceUrl)) {
    return { valid: false, reason: "unapproved_domain" };
  }

  try {
    const headResponse = await fetchWithTimeout(item.sourceUrl, { method: "HEAD" });
    if (headResponse.status >= 200 && headResponse.status < 400) {
      return { valid: true, reason: "head_ok" };
    }
    if (headResponse.status === 404 || headResponse.status === 410) {
      return { valid: false, reason: `head_${headResponse.status}` };
    }
  } catch {
    // Some publishers block HEAD; we'll try a lightweight GET.
  }

  try {
    const getResponse = await fetchWithTimeout(item.sourceUrl, {
      method: "GET",
      headers: { Range: "bytes=0-2048" },
    });
    if (getResponse.status >= 200 && getResponse.status < 400) {
      return { valid: true, reason: "get_ok" };
    }
    if (getResponse.status === 404 || getResponse.status === 410) {
      return { valid: false, reason: `get_${getResponse.status}` };
    }
  } catch {
    return { valid: false, reason: "network_error" };
  }

  return { valid: false, reason: "unexpected_status" };
};

const validateNewsItem = (
  item: Partial<NewsItem>
): { valid: boolean; reason?: string } => {
  if (!item.company) return { valid: false, reason: "missing_company" };
  if (!item.headline) return { valid: false, reason: "missing_headline" };
  if (!item.summary) return { valid: false, reason: "missing_summary" };
  if (!item.date) return { valid: false, reason: "missing_date" };
  if (!item.sourceUrl) return { valid: false, reason: "missing_source_url" };
  if (!item.sourceLabel) return { valid: false, reason: "missing_source_label" };

  const parsedDate = new Date(item.date);
  if (Number.isNaN(parsedDate.getTime())) {
    return { valid: false, reason: "invalid_date" };
  }

  if (!isApprovedUrlForCompany(item.company, item.sourceUrl)) {
    return { valid: false, reason: "unapproved_domain" };
  }

  return { valid: true };
};

export const generateNewsForCompanies = async (
  companies: string[],
  targetDate?: string
): Promise<NewsItem[]> => {
  const todayIso = new Date().toISOString();
  const timeWindowInstruction = targetDate
    ? `Content time window: published on this date: ${targetDate} (America/New_York calendar date).`
    : "Content time window: published in the last 24 hours relative to today's date (use America/New_York as the reference timezone for what counts as \"today\").";
  const emptyResultInstruction = targetDate
    ? `If you cannot find a result on the approved domains for ${targetDate}, omit that company from the response entirely. An empty result is correct. A third-party result is not acceptable.`
    : "If you cannot find a result on the approved domains for a company within the last 24 hours, omit that company from the response entirely. An empty result is correct. A third-party result is not acceptable.";
  const approvedSourcesBlock = Object.entries(
    approvedSources as Record<string, string[]>
  )
    .map(
      ([company, domains]) =>
        `${company}:\n${domains.map((domain) => `- ${domain}`).join("\n")}`
    )
    .join("\n\n");
  const prompt = `
Today's date is ${todayIso}.
Target companies: ${companies.join(", ")}.

APPROVED SOURCES (only return results from these domains):

${approvedSourcesBlock}

IMPORTANT: Do NOT return results from any media outlet, news aggregator, analyst site, journalist publication, or any domain not listed above — even if the article is about one of the listed companies. Examples of sources to never use: Business Insider, TechCrunch, Reuters, Bloomberg, Forbes, CRN, Dark Reading, SecurityWeek, or any similar site.

${emptyResultInstruction}

If the same announcement or product launch appears on multiple approved URLs, return only one result for it. Prefer the most authoritative source in this order: press release or investor relations page first, then newsroom, then blog. Do not return the same story twice under different URLs.

${timeWindowInstruction}
Content focus: product launches, new feature announcements, product updates, release notes, platform roadmap updates, GA announcements, integration/ecosystem partner announcements, case studies and customer win stories only when they announce new capability or concrete product use, pricing updates, packaging plan updates, compliance milestones, certification milestones, engineering blog posts about newly shipped features, AI model or agent capability updates for the company's own products, and major documentation updates that announce newly available functionality. Return the actual publication date from the source article.
Output format: valid JSON array only, no markdown, no preamble, no explanation. Array of objects matching: { "company": string, "headline": string, "summary": string, "date": string, "sourceUrl": string, "sourceLabel": string }. Summary must be 2-3 plain text sentences.
`;
  const primaryResult = await generateTextWithRetry(prompt);
  const firstPassItems = parseNewsItems(primaryResult.text);
  const firstPassUrls = firstPassItems
    .map((item) => item.sourceUrl?.trim())
    .filter((value): value is string => Boolean(value));
  const firstPassHeadlines = firstPassItems
    .map((item) => item.headline?.trim())
    .filter((value): value is string => Boolean(value));

  const additionalPrompt = `
Today's date is ${todayIso}.
Target companies: ${companies.join(", ")}.

APPROVED SOURCES (only return results from these domains):

${approvedSourcesBlock}

You are doing a SECOND PASS. Find additional official announcements that are distinct from the first pass.
Do not repeat or paraphrase stories already listed below.

EXISTING URLS:
${firstPassUrls.length ? firstPassUrls.map((url) => `- ${url}`).join("\n") : "- none"}

EXISTING HEADLINES:
${firstPassHeadlines.length ? firstPassHeadlines.map((headline) => `- ${headline}`).join("\n") : "- none"}

${emptyResultInstruction}
${timeWindowInstruction}
Only include net-new announcements that are not already covered above. If none exist, return [].
Output format: valid JSON array only, no markdown, no preamble, no explanation. Array of objects matching: { "company": string, "headline": string, "summary": string, "date": string, "sourceUrl": string, "sourceLabel": string }. Summary must be 2-3 plain text sentences.
`;
  let secondaryResult: { text: string; model: string } | null = null;
  let secondPassItems: Partial<NewsItem>[] = [];
  try {
    secondaryResult = await generateTextWithRetry(additionalPrompt);
    secondPassItems = parseNewsItems(secondaryResult.text);
  } catch (error) {
    await appendDebugTrace({
      stage: "generateNewsForCompanies_second_pass_failed",
      companies,
      targetDate: targetDate ?? null,
      error: error instanceof Error ? error.message : String(error),
    });
  }
  const normalized = [...firstPassItems, ...secondPassItems];

  const prepared = await Promise.all(
    normalized.map(async (item) => {
      const normalizedSourceUrl = item.sourceUrl
        ? normalizeSourceUrl(item.sourceUrl)
        : item.sourceUrl;

      const resolvedSourceUrl = normalizedSourceUrl
        ? await resolveGroundingRedirectUrl(normalizedSourceUrl)
        : normalizedSourceUrl;

      return {
        ...item,
        sourceUrl: resolvedSourceUrl,
      };
    })
  );

  const validItems: NewsItem[] = [];
  const rejectedBySchemaOrDomain: Array<{ reason: string; item: Partial<NewsItem> }> = [];
  for (const item of prepared) {
    const validation = validateNewsItem(item);
    if (!validation.valid) {
      rejectedBySchemaOrDomain.push({
        reason: validation.reason ?? "validation_failed",
        item,
      });
      continue;
    }

    validItems.push({
      company: item.company!,
      headline: item.headline!,
      summary: item.summary!,
      date: new Date(item.date!).toISOString(),
      sourceUrl: item.sourceUrl!,
      sourceLabel: item.sourceLabel!,
    });
  }

  const verifiedItems = await Promise.all(
    validItems.map(async (item) => ({
      item,
      verification: await verifySourceUrl(item),
    }))
  );

  const keptItems = verifiedItems
    .filter((entry) => entry.verification.valid || !URL_REJECTION_BLOCKLIST.has(entry.verification.reason))
    .map((entry) => entry.item);
  const rejectedByUrl = verifiedItems
    .filter((entry) => !entry.verification.valid)
    .map((entry) => ({
      reason: entry.verification.reason,
      item: entry.item,
    }));
  const schemaOrDomainReasonCounts = countReasons(rejectedBySchemaOrDomain);
  const urlReasonCounts = countReasons(rejectedByUrl);

  await appendDebugTrace({
    stage: "generateNewsForCompanies",
    models: {
      firstPass: primaryResult.model,
      secondPass: secondaryResult?.model ?? null,
    },
    companies,
    targetDate: targetDate ?? null,
    rawText: {
      firstPass: primaryResult.text,
      secondPass: secondaryResult?.text ?? null,
    },
    parsedCount: normalized.length,
    firstPassParsedCount: firstPassItems.length,
    secondPassParsedCount: secondPassItems.length,
    preparedCount: prepared.length,
    schemaOrDomainRejectedCount: rejectedBySchemaOrDomain.length,
    schemaOrDomainReasonCounts,
    schemaOrDomainRejected: rejectedBySchemaOrDomain,
    urlRejectedCount: rejectedByUrl.length,
    urlReasonCounts,
    urlRejected: rejectedByUrl,
    keptCount: keptItems.length,
    keptItems,
  });

  return keptItems;
};

export const generateNewsForClients = generateNewsForCompanies;
