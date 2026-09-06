export async function sendChatMessage(prompt: string) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

  if (!apiKey || apiKey === 'undefined') {
    throw new Error("Gemini API Key missing! Check Vercel Environment Variables.");
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );

    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error.message || "API Error");
    }

    return data.candidates[0].content.parts[0].text;
  } catch (error: any) {
    console.error("Gemini Fetch Error:", error);
    throw error;
  }
}
