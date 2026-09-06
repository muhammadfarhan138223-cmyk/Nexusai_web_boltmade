const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

export async function sendChatMessage(prompt: string) {
  if (!API_KEY) {
    throw new Error("Gemini API Key missing! Check Vercel Environment Variables.");
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    }
  );

  const data = await response.json();
  if (data.error) throw new Error(data.error.message);

  return data.candidates[0].content.parts[0].text;
}
