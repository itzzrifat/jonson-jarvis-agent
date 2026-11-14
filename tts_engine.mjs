/**
 * Bangla Voice Engine using official Gemini TTS
 * Following the bangla-voice skill specification (Charon voice, executive assistant tone)
 */
export async function synthesizeBanglaVoice(text, voice = 'Charon') {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !text) return null;

  // Clean markdown, symbols, and formatting for crystal-clear pronunciation
  const cleanText = text
    .replace(/<[^>]*>?/gm, '')
    .replace(/[*#`_]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // If text is too long for real-time response, take first 250 characters for immediate speech
  const speechText = cleanText.length > 300 
    ? cleanText.slice(0, 300) + '... বিস্তারিত নিচে দেখুন।'
    : cleanText;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash-tts:generateContent?key=${apiKey}`;
  const payload = {
    contents: [{
      parts: [{
        text: `পড়ো একটি শান্ত, স্পষ্ট, ধীর-স্থির ও রাশভারী এক্সিকিউটিভ অ্যাসিস্ট্যান্ট ভঙ্গিতে, স্বাভাবিক বাংলাদেশি পেসিংয়ে:\n\n${speechText}`
      }]
    }],
    generationConfig: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: voice
          }
        }
      }
    }
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn('[BanglaTTS] API error:', errText);
      return null;
    }

    const data = await res.json();
    const part = data.candidates?.[0]?.content?.parts?.[0];
    const inline = part?.inlineData || part?.inline_data;
    if (inline?.data) {
      return {
        base64: inline.data,
        mimeType: inline.mimeType || 'audio/wav'
      };
    }
  } catch (err) {
    console.error('[BanglaTTS] Error:', err.message);
  }
  return null;
}
