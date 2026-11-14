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
  const speechText = cleanText.length > 200 
    ? cleanText.slice(0, 200).replace(/[,।!?][^,।!?]*$/, '') + '।'
    : cleanText;

  const models = ['gemini-3.8-flash-tts', 'gemini-2.5-flash-preview-tts'];
  
  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const payload = {
      contents: [{
        parts: [{
          text: `পড়ো একজন বন্ধুসুলভ, চটপটে ও প্রাণবন্ত মানুষের স্বাভাবিক কথ্য ভঙ্গিতে, ঠিক যেমন ফোনে সরাসরি কথা বলে:\n\n${speechText}`
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
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errText = await res.text();
        console.warn(`[BanglaTTS] Model ${model} returned:`, errText);
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
