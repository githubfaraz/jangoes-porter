import { GoogleGenAI, Type } from "@google/genai";

/**
 * Logistics support assistant using Gemini 3 Flash.
 * Concisely answers logistics-related queries.
 */
export const getLogisticsSupport = async (query: string) => {
  try {
    // Create instance right before call as per guidelines
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: query,
      config: {
        systemInstruction: "You are a helpful logistics support assistant for Jangoes. Answer questions about shipping, tracking, vehicle capacities, and parcel safety. Be concise and professional.",
      },
    });
    return response.text || "I'm not sure how to answer that right now.";
  } catch (error) {
    console.error("Gemini support error:", error);
    return "I'm sorry, I'm having trouble connecting to support right now.";
  }
};

/**
 * Classifies a parcel based on description and optional images.
 * Uses structured output (JSON) for category, fragility, and weight.
 */
export const classifyParcel = async (description: string, imageBase64s?: string[]) => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Multi-modal content preparation
    const parts: any[] = [{ text: `Classify this parcel: "${description}"` }];
    
    if (imageBase64s && imageBase64s.length > 0) {
      imageBase64s.forEach(img => {
        // Extract base64 data and mime type from Data URL
        const [header, data] = img.includes(';base64,') ? img.split(';base64,') : [null, img];
        const mimeType = header ? header.split(':')[1] : 'image/jpeg';
        
        parts.push({
          inlineData: {
            data: data || img,
            mimeType: mimeType
          }
        });
      });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            category: { type: Type.STRING, description: "Category like Electronics, Furniture, Food, etc." },
            fragile: { type: Type.BOOLEAN },
            estimatedWeight: { type: Type.NUMBER, description: "Estimated weight in kg" }
          },
          required: ["category", "fragile"]
        }
      }
    });
    
    const text = response.text || '{"category": "General", "fragile": false, "estimatedWeight": 5}';
    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini classification error:", error);
    return { category: "General", fragile: false, estimatedWeight: 5 };
  }
};

/**
 * Searches for places using Google Maps grounding.
 * Returns grounded results with map URIs.
 */
export const searchPlaces = async (query: string, lat?: number, lng?: number) => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `Find locations matching: "${query}"${lat && lng ? ` near coordinates ${lat}, ${lng}` : ''}. Return a list of place names and their addresses.`;
    
    const response = await ai.models.generateContent({
      model: "gemini-flash-lite-latest",
      contents: prompt,
      config: {
        tools: [{ googleMaps: {} }],
        toolConfig: {
          retrievalConfig: {
            latLng: lat && lng ? { latitude: lat, longitude: lng } : undefined
          }
        }
      },
    });

    const results = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    // Transform chunks into a cleaner format for the UI, extracting maps URLs
    return results.map((chunk: any, index: number) => ({
      id: `place-${index}`,
      title: chunk.maps?.title || "Found Location",
      address: chunk.maps?.uri || "No address provided",
      uri: chunk.maps?.uri || "#"
    }));
  } catch (error) {
    console.error("Gemini Maps Error:", error);
    return [];
  }
};