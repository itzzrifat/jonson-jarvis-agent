/**
 * Bangla Voice Engine using official Gemini TTS
 * Supports Gemini Live voices: Puck (Natural Male), Aoede (Natural Female), Charon (Dignified Male)
 */
export async function synthesizeBanglaVoice(text, voice = 'Puck') {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !text) return null;

  // Clean markdown, symbols, and formatting for natural spoken speech
  const cleanText = text
    .replace(/<[^>]*>?/gm, '')
    .replace(/[*#`_~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Keep spoken response concise for fast sub-2-second delivery
  const speechText = cleanText.length > 180 
    ? cleanText.slice(0, 180).replace(/[,।!?][^,।!?]*$/, '') + '।'
    : cleanText;

  // Prioritize fast, high-availability TTS models
  const models = ['gemini-3.8-flash-lite-tts', 'gemini-3.1-flash-tts-preview', 'gemini-3.8-flash-tts'];

  let voicePrompt = `পড়ো একজন বন্ধুসুলভ ও স্বাভাবিক কথ্য ভঙ্গিতে:\n\n${speechText}`;
  if (voice === 'Charon') {
    voicePrompt = `পড়ো একটি শান্ত, স্পষ্ট ও রাশভারী এক্সিকিউটিভ অ্যাসিস্ট্যান্ট ভঙ্গিতে:\n\n${speechText}`;
  } else if (voice === 'Aoede') {
    voicePrompt = `পড়ো একজন অমায়িক, মিষ্টি ও প্রাণবন্ত নারীর স্বাভাবিক কথ্য ভঙ্গিতে:\n\n${speechText}`;
  }
  
  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const payload = {
      contents: [{
        parts: [{
          text: voicePrompt
        }]
      }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: voice || 'Puck'
            }
          }
        }
      }
    };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 7000);

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        const errText = await res.text();
        console.warn(`[BanglaTTS] Model ${model} returned:`, errText.slice(0, 150));
        continue;
      }

      const data = await res.json();
      const part = data.candidates?.[0]?.content?.parts?.[0];
      const inline = part?.inlineData || part?.inline_data;
      if (inline?.data) {
        return {
          base64: inline.data,
          mimeType: inline.mimeType || 'audio/wav',
          voiceUsed: voice
        };
      }
    } catch (err) {
      console.warn(`[BanglaTTS] Error with ${model}:`, err.message);
    }
  }

  return null;
}
