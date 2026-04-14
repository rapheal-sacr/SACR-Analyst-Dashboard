import { GoogleGenAI } from "@google/genai";
import fs from 'fs';

let aiClient: GoogleGenAI | null = null;

export function getAIClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey.trim() === "") {
      throw new Error("A valid GEMINI_API_KEY environment variable is required. Please set it in your environment or AI Studio settings.");
    }
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
}

const TAG_TAXONOMY = `
Use ONLY the following tags to categorize the items. Use the exact abbreviated terms listed below:
Identity Security: IASM, IGA, ISPM, ITDR, NHI, PAM, AM, IAM, CIAM, MFA, SSO, JIT, RBAC, ABAC, General Identity Security.
Cloud & App Security: AST, SAST, IAST, DAST, CDR, CSPM, CNAPP, VM, CTEM, CWPP, KSPM, ASPM, RASP, IaC, General Cloud & App Security.
Data & AI Security: AI-SPM, DLP, DSPM, DDR, IRM, PETs, AI TRiSM, General Data & AI Security.
SOC: AISOC, SOAR, EDR, XDR, MDR, NDR, SDDP, ETL, SIEM, UADP, CTI, BAS, DFIR, ASM, EASM, General SOC.
General Cybersecurity: SASE, SSPM, WAF, NGFW, FWaaS, Email Security, Enterprise Browser Security, ZTNA, CASB, SBOM, DRP, SD-WAN, General Cybersecurity.
`;

export interface BriefingResult {
  markdown: string;
  trendingTopics: string[];
  promotedToWatchlist: string[];
}

export async function generateDailyBriefing(clients: string[], watchlist: string[]): Promise<BriefingResult> {
  const ai = getAIClient();
  
  const prompt = `
You are an elite cybersecurity intelligence analyst. Your job is to provide a high-signal, zero-fluff daily briefing for a C-level executive.
Today's date is ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.

Focus your research and briefing on the following:
CLIENT COMPANIES: ${clients.join(', ') || 'None specified'}
WATCHLIST COMPANIES: ${watchlist.join(', ') || 'None specified'}

${TAG_TAXONOMY}

Instructions:

1. You MUST use the googleSearch tool to search for the absolute latest news, vulnerabilities, research, and market movements related to the specific companies listed above.
2. If the lists are large, pick at least 3-5 prominent companies from EACH list and explicitly search for their recent news.
3. Synthesize the findings into a highly readable, opinionated briefing.
4. CRITICAL: You are strictly forbidden from outputting "No significant updates" if companies are provided. You MUST find and include updates for them. If there is no news in the last 48 hours, expand your search to the last 7 days.
5. CRITICAL: You MUST embed actual URLs as inline markdown links directly within the text of your updates (e.g., "According to a [new report from Mandiant](https://url)..."). Do NOT just list URLs at the end.
6. CRITICAL: You MUST ONLY use real, working URLs that you found via the googleSearch tool. Do NOT hallucinate or make up URLs. If you cannot find a specific article URL, link to the company's official blog or newsroom, or omit the link.
7. Identify any new companies (not currently in Clients or Watchlist) that are trending or relevant in cybersecurity today. List them in the \`promotedToWatchlist\` field so they can be tracked.
8. Format the output strictly in Markdown. Include tags from the taxonomy at the bottom of EACH individual company update, research insight, and market signal.
9. CRITICAL: For tags, output them on a new line exactly like this, with NO bolding or markdown formatting on the word TAGS:
TAGS: TAG1, TAG2, TAG3
10. CRITICAL: When writing company updates under headers like "### Company Name", DO NOT repeat the company name at the very beginning of the paragraph (e.g., avoid "### Apple\n**Apple:** announced today..."). Just start the sentence naturally.

Structure the briefing exactly as follows:

# Executive Summary
[2-3 bullet points of the most critical developments across the entire landscape. Why does it matter today?]

# Company Updates

## Clients
[CRITICAL: You MUST include a section for Clients. List updates for 3-5 companies from the CLIENT COMPANIES list provided above. Group by company name using ### headers. Include news, product launches, customer wins, leadership changes.]

## Watchlist
[CRITICAL: You MUST include a section for Watchlist. List updates for 3-5 companies from the WATCHLIST COMPANIES list provided above. Group by company name using ### headers. Include strategic moves, funding, partnerships.]

# Research & Technical Insights
[Deep dives into new research papers, novel attack techniques, defensive innovations, or AI+security intersections. Explain the strategic implication of each.]

# Market Signals
[Emerging trends, M&A activity, or shifts in the vendor landscape. What changes how we think about the market?]

Tone: Analytical, concise, authoritative. Do not use generic filler language. Provide context on why something matters.
`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        temperature: 0.2,
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            markdown: { type: "STRING", description: "The full markdown formatted briefing." },
            trendingTopics: { 
              type: "ARRAY", 
              items: { type: "STRING" },
              description: "3-5 overarching trending topics in cybersecurity today."
            },
            promotedToWatchlist: {
              type: "ARRAY",
              items: { type: "STRING" },
              description: "New trending/relevant companies to add to the watchlist."
            }
          },
          required: ["markdown", "trendingTopics", "promotedToWatchlist"]
        }
      },
    });
    
    const text = response.text || "{}";
    return JSON.parse(text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()) as BriefingResult;
  } catch (error) {
    console.error("Error generating briefing:", error);
    throw error;
  }
}

export interface NewsItem {
  company: string;
  title: string;
  summary: string;
  url: string;
  date: string;
  tags?: string[];
}

export async function generateStructuredFeed(clients: string[], watchlist: string[]): Promise<NewsItem[]> {
  const ai = getAIClient();
  
  const prompt = `
You are an elite cybersecurity intelligence analyst.
Today's date is ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.

Search the web for the latest news, vulnerabilities, research, and market movements related to the following companies:
CLIENTS: ${clients.join(', ') || 'None specified'}
WATCHLIST: ${watchlist.join(', ') || 'None specified'}

CRITICAL INSTRUCTIONS:
1. You MUST use the googleSearch tool to find these updates.
2. The \`url\` field MUST contain the exact, real, working URL returned by the search tool. Do not hallucinate URLs.
3. Return a list of 8-12 of the most important news items across these companies from the last 7 days.
4. Use the following tags:
${TAG_TAXONOMY}
`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        temperature: 0.2,
        responseMimeType: "application/json",
        responseSchema: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              company: { type: "STRING", description: "The name of the company this news is about" },
              title: { type: "STRING", description: "Headline of the news" },
              summary: { type: "STRING", description: "A concise 2-3 sentence summary of the news" },
              url: { type: "STRING", description: "The exact, real URL to the news article or source" },
              date: { type: "STRING", description: "Date published, e.g., 2024-05-20" },
              tags: { type: "ARRAY", items: { type: "STRING" }, description: "1-3 tags from the provided taxonomy" }
            },
            required: ["company", "title", "summary", "url", "date"]
          }
        }
      },
    });
    
    const text = response.text || "[]";
    return JSON.parse(text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()) as NewsItem[];
  } catch (error) {
    console.error("Error generating structured feed:", error);
    return [];
  }
}

export async function generateTrendingTopics(): Promise<string[]> {
  const ai = getAIClient();
  
  const prompt = `
Search the web for the absolute latest top cybersecurity news, vulnerabilities, research, and market movements over the last 24 hours.
Identify 3-5 overarching trending topics in cybersecurity today.
Return ONLY a JSON array of strings representing these topics.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        temperature: 0.2,
        responseMimeType: "application/json",
        responseSchema: {
          type: "ARRAY",
          items: { type: "STRING" },
          description: "3-5 overarching trending topics in cybersecurity today."
        }
      },
    });
    
    const text = response.text || "[]";
    return JSON.parse(text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()) as string[];
  } catch (error) {
    console.error("Error generating trending topics:", error);
    return [];
  }
}

export async function generateSemanticSearch(query: string, clients: string[], watchlist: string[]): Promise<string> {
  const ai = getAIClient();
  
  const prompt = `
You are an elite cybersecurity intelligence analyst. The user has requested a semantic search for the following query:
"${query}"

CLIENT COMPANIES: ${clients.join(', ') || 'None specified'}
WATCHLIST COMPANIES: ${watchlist.join(', ') || 'None specified'}

Instructions:
1. Search the web for the latest and most relevant information regarding the user's query.
2. If the query relates to specific companies, vulnerabilities, or trends, prioritize high-signal, authoritative sources.
3. Cross-reference the findings with the provided Client and Watchlist companies if relevant.
4. Synthesize the findings into a highly readable, concise summary.
5. Format the output strictly in Markdown.

Structure the response:
# Search Results: ${query}
[Provide a comprehensive but concise summary of the findings, highlighting key takeaways, affected technologies, and strategic implications.]
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        temperature: 0.2,
      },
    });
    
    return response.text || "No results found.";
  } catch (error) {
    console.error("Error generating semantic search:", error);
    throw error;
  }
}

export interface CVEItem {
  id: string;
  severity: string;
  cvss: number;
  vendor: string;
  product: string;
  description: string;
  implication: string;
  dateDisclosed: string;
}

export interface CVEFeedResult {
  cves: CVEItem[];
  trendingAcronyms: string[];
}

export async function generateCVEFeed(clients: string[], watchlist: string[]): Promise<CVEFeedResult> {
  const ai = getAIClient();
  
  const prompt = `
Search the web for the latest critical and high-severity CVEs (Common Vulnerabilities and Exposures) disclosed in the last 14 days.
Pay special attention to vulnerabilities affecting these companies or their typical tech stacks:
CLIENTS: ${clients.join(', ') || 'None specified'}
WATCHLIST: ${watchlist.join(', ') || 'None specified'}

Note: The list of companies may be very large. Do not search for them individually. Search for the top 5-8 most critical recent CVEs globally, and if they affect any of the listed companies, note it in the implication.

${TAG_TAXONOMY}

Return a list of the most important 5-8 CVEs, and also identify 3-5 trending cybersecurity category acronyms (e.g., ITDR, IAM, CNAPP, ASPM) that are currently highly relevant based on recent vulnerabilities.
`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        temperature: 0.2,
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            cves: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  id: { type: "STRING", description: "CVE ID, e.g., CVE-2024-12345" },
                  severity: { type: "STRING", description: "CRITICAL, HIGH, or MEDIUM" },
                  cvss: { type: "NUMBER", description: "CVSS score, e.g., 9.8" },
                  vendor: { type: "STRING", description: "Affected vendor" },
                  product: { type: "STRING", description: "Affected product" },
                  description: { type: "STRING", description: "Short description of the vulnerability" },
                  implication: { type: "STRING", description: "Why this matters to our tracked companies or the broader landscape" },
                  dateDisclosed: { type: "STRING", description: "Date disclosed, e.g., 2024-05-20" },
                  tags: { type: "ARRAY", items: { type: "STRING" }, description: "1-3 tags from the provided taxonomy" }
                },
                required: ["id", "severity", "cvss", "vendor", "product", "description", "implication", "dateDisclosed", "tags"]
              }
            },
            trendingAcronyms: {
              type: "ARRAY",
              items: { type: "STRING" },
              description: "3-5 trending cybersecurity category acronyms (e.g., ITDR, IAM, CNAPP)"
            }
          },
          required: ["cves", "trendingAcronyms"]
        }
      },
    });
    
    const text = response.text || "{}";
    const jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("Error generating CVE feed:", error);
    throw error;
  }
}

export interface ResearchItem {
  title: string;
  source: string;
  url: string;
  category: string;
  summary: string;
  keyTakeaway: string;
  date: string;
}

export async function generateResearchFeed(): Promise<ResearchItem[]> {
  const ai = getAIClient();
  
  const prompt = `
Search the web for the latest cybersecurity research papers, deep technical blog posts, and threat intelligence reports published in the last 14 days.
Focus on novel attack techniques, defensive innovations, and AI+security intersections.

CRITICAL INSTRUCTIONS FOR URLs:
1. You MUST use the googleSearch tool to find these research papers and articles.
2. The \`url\` field MUST contain the exact, real, working URL returned by the search tool.
3. DO NOT hallucinate, guess, or construct URLs. If you cannot verify the exact URL via search, do not include that research item.

${TAG_TAXONOMY}

Return a list of the 5-8 most insightful pieces of research.
`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        temperature: 0.2,
        responseMimeType: "application/json",
        responseSchema: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              title: { type: "STRING", description: "Title of the research or blog post" },
              source: { type: "STRING", description: "Organization or Researcher Name" },
              url: { type: "STRING", description: "The actual, real URL to the research paper or blog post. MUST be a valid, working link found via search." },
              category: { type: "STRING", description: "e.g., Novel Attack, Defensive Innovation, AI + Security, Threat Intel" },
              summary: { type: "STRING", description: "A 2-3 sentence summary of the findings" },
              keyTakeaway: { type: "STRING", description: "One sentence on why this changes how we think about security" },
              date: { type: "STRING", description: "Date published, e.g., 2024-05-20" },
              tags: { type: "ARRAY", items: { type: "STRING" }, description: "1-3 tags from the provided taxonomy" }
            },
            required: ["title", "source", "url", "category", "summary", "keyTakeaway", "date", "tags"]
          }
        }
      },
    });
    
    const text = response.text || "[]";
    const jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("Error generating research feed:", error);
    throw error;
  }
}
