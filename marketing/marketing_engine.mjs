export async function askGemini(prompt, apiKey = process.env.GEMINI_API_KEY) {
  if (!apiKey) {
    return 'Gemini API key is not configured.';
  }

  const models = ['gemini-3.5-flash-lite', 'gemini-3-flash-preview', 'gemini-3.5-flash'];
  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const payload = {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 500 }
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!res.ok) continue;
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return text.trim();
    } catch (e) {
      console.warn(`[Gemini] Error with model ${model}:`, e.message);
    }
  }

  return 'এআই রেসপন্স তৈরিতে সমস্যা হয়েছে। দয়া করে কিছুক্ষণ পর আবার চেষ্টা করুন।';
}

export async function generateMarketingCampaign(topic, audience = 'Business Owners, Shopkeepers, Retailers') {
  const prompt = `You are a high-level Creative Growth Strategist for "SohozKarbar ERP" (by Founder Rifat Uddin - Sohoz Karbar Tech Solutions).
Mission: "Simple Technology. Smarter Business."

Target Topic: "${topic}"
Target Audience: "${audience}"

Generate a complete marketing set in natural, engaging Bengali with English technical terms:
1. 🔥 3 Viral Attention Hooks
2. 📢 Facebook & LinkedIn Conversion Ad Copy
3. 🎬 30-second Short Reel/TikTok Script (with visual cues & audio guidance)
4. 🏷️ Top 10 High-Reach Bengali & Global Hashtags`;

  return await askGemini(prompt);
}

export async function generateViralDiscussionPost(topic = '') {
  const prompt = `You are an expert social media manager writing a high-engagement, comment-magnet Facebook post in natural conversational Bengali for Founder Rifat Uddin.
Topic: "${topic || 'ব্যবসার বাকির হিসাব খাতা বনাম মোবাইল সফটওয়্যার'}"

Rules:
1. Start with a relatable real-life business situation in Bangladesh.
2. Ask an open-ended question at the end that forces entrepreneurs to comment their personal experience.
3. Keep tone authentic, humble, and professional.
4. Add 2-3 relevant hashtags at the end.`;

  return await askGemini(prompt);
}
