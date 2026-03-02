import { logger } from "../config/logger";

export interface ExtractedLeadInfo {
    isHotelEnquiry: boolean;
    name?: string;
    phone?: string;
    email?: string;
    checkInDate?: string;
    checkOutDate?: string;
    numberOfGuests?: number;
    roomCategory?: string;
    occasion?: string;
    specialRequests?: string;
}

export async function extractLeadDataWithLLM(textContent: string, source: 'EMAIL' | 'WHATSAPP'): Promise<ExtractedLeadInfo> {
    const groqApiKey = process.env.GROQ_API_KEY;
    const geminiApiKey = process.env.GEMINI_API_KEY;
    const openAiApiKey = process.env.OPENAI_API_KEY;

    const prompt = `You are a hotel CRM assistant. Your job is to analyze unstructured messages (from ${source}) and extract structured lead information.

Analyze the following text and extract the information. Return ONLY valid JSON, no markdown, no explanation:

---
${textContent.slice(0, 3000)}
---

Return this exact JSON structure (use null for any field you cannot determine):
{
  "isHotelEnquiry": true or false,
  "name": "Full name of the guest or null",
  "phone": "Phone number with country code or null",
  "email": "Email address or null",
  "checkInDate": "YYYY-MM-DD format or null",
  "checkOutDate": "YYYY-MM-DD format or null",
  "numberOfGuests": integer or null,
  "roomCategory": "e.g. Deluxe, Suite, Standard or null",
  "occasion": "e.g. Anniversary, Birthday, Honeymoon or null",
  "specialRequests": "Any special requests mentioned or null"
}

Only set isHotelEnquiry to true if this is clearly a hotel booking/stay/availability inquiry.
If it is purely spam or unrelated, set it to false.`;

    try {
        if (groqApiKey) {
            return await callGroq(prompt, groqApiKey);
        } else if (geminiApiKey) {
            return await callGemini(prompt, geminiApiKey);
        } else if (openAiApiKey) {
            return await callOpenAI(prompt, openAiApiKey);
        } else {
            logger.warn("[LLMService] No LLM API key configured. Falling back to basic regex extraction.");
            return basicExtraction(textContent);
        }
    } catch (err) {
        logger.error("[LLMService] LLM API call failed, falling back to regex", {
            error: err instanceof Error ? err.message : String(err),
        });
        return basicExtraction(textContent);
    }
}

async function callGroq(prompt: string, apiKey: string): Promise<ExtractedLeadInfo> {
    // Groq provides an OpenAI-compatible REST endpoint
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: "llama3-8b-8192", // Fast and free Llama 3 model
            messages: [{ role: "user", content: prompt }],
            temperature: 0.1,
            response_format: { type: "json_object" },
        }),
    });

    if (!response.ok) {
        throw new Error(`Groq API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as any;
    const rawText = data?.choices?.[0]?.message?.content ?? "{}";
    return JSON.parse(rawText) as ExtractedLeadInfo;
}

async function callGemini(prompt: string, apiKey: string): Promise<ExtractedLeadInfo> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 500,
                responseMimeType: "application/json",
            },
        }),
    });

    if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as any;
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    return JSON.parse(rawText) as ExtractedLeadInfo;
}

async function callOpenAI(prompt: string, apiKey: string): Promise<ExtractedLeadInfo> {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.1,
            response_format: { type: "json_object" },
        }),
    });

    if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as any;
    const rawText = data?.choices?.[0]?.message?.content ?? "{}";
    return JSON.parse(rawText) as ExtractedLeadInfo;
}

function basicExtraction(textContent: string): ExtractedLeadInfo {
    const body = textContent.toLowerCase();
    const hotelKeywords = ["check-in", "check in", "booking", "room", "stay", "nights", "reservation", "hotel", "resort"];
    const isHotelEnquiry = hotelKeywords.some((k) => body.includes(k));

    const phoneMatch = textContent.match(/(\+?\d[\d\s\-().]{7,14}\d)/);
    const dateMatch = textContent.match(/\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\b/g);

    return {
        isHotelEnquiry,
        phone: phoneMatch?.[0] ?? undefined,
        checkInDate: dateMatch?.[0] ?? undefined,
        checkOutDate: dateMatch?.[1] ?? undefined,
    };
}
