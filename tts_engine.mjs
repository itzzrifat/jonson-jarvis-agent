/**
 * Bangla Voice Engine using official Gemini TTS
 * Based on the Bangla Voice Skill (bangla-voice) specifications
 * Supported Voices:
 *   - Kore: Safest, firm, natural Bengali (Female default)
 *   - Puck: Friendly, lively, conversational (Male)
 *   - Aoede: Breezy, warm, lifestyle (Female)
 *   - Charon: Dignified, executive, documentary (Male default)
 *   - Sulafat: Warm, compassionate narration (Female)
 */

export function getGeminiApiKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  if (process.env.GOOGLE_API_KEY) return process.env.GOOGLE_API_KEY;
  for (const k of Object.keys(process.env)) {
    if (k.startsWith('AQ.') || k.startsWith('AIzaSy')) return k;
    const val = process.env[k];
    if (typeof val === 'string' && (val.startsWith('AQ.') || val.startsWith('AIzaSy'))) return val;
  }
  return '';
}

/**
 * Prepend a standard 44-byte RIFF/WAVE header to raw linear PCM
 * so that any browser (Safari, iOS, Chrome, Firefox) can play it in <audio>
 */
export function pcmToWav(pcmBuffer, sampleRate = 24000, channels = 1, bytesPerSample = 2) {
  const byteRate = sampleRate * channels * bytesPerSample;
  const blockAlign = channels * bytesPerSample;
  const header = Buffer.alloc(44);

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcmBuffer.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // SubChunk1Size (16 for PCM)
  header.writeUInt16LE(1, 20);  // AudioFormat (1 for PCM)
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bytesPerSample * 8, 34); // BitsPerSample
  header.write('data', 36);
  header.writeUInt32LE(pcmBuffer.length, 40);

  return Buffer.concat([header, pcmBuffer]);
}

export async function synthesizeBanglaVoice(text, voice = 'Kore') {
  const apiKey = getGeminiApiKey();
  if (!apiKey || !text) return null;

  // Clean markdown, symbols, and formatting for natural spoken speech
  // NEVER leak prompt instructions into spoken audio!
  const cleanText = text
    .replace(/<[^>]*>?/gm, '')
    .replace(/[*#`_~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleanText) return null;

  // Keep spoken response concise for fast delivery
  const speechText = cleanText.length > 200 
    ? cleanText.slice(0, 200).replace(/[,।!?][^,।!?]*$/, '') + '।'
    : cleanText;

  // Prioritize verified working Gemini TTS models
  const models = [
    'gemini-2.5-flash-preview-tts',
    'gemini-3.8-flash-lite-tts',
    'gemini-3.1-flash-tts-preview',
    'gemini-3.8-flash-tts'
  ];
  
  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const payload = {
      contents: [{
        parts: [{
          // Text ONLY - no prompt instructions here so model never reads instructions aloud
          text: speechText
        }]
      }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: voice || 'Kore'
            }
          }
        }
      }
    };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

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
        let rawBuf = Buffer.from(inline.data, 'base64');
        let sampleRate = 24000;

        // Parse rate from mimeType if provided e.g. "audio/L16;codec=pcm;rate=24000"
        const mimeStr = inline.mimeType || inline.mime_type || '';
        for (const token of mimeStr.split(';')) {
          const trimmed = token.trim();
          if (trimmed.startsWith('rate=')) {
            const parsedRate = parseInt(trimmed.split('=')[1], 10);
            if (!isNaN(parsedRate) && parsedRate > 0) sampleRate = parsedRate;
          }
        }

        // If raw PCM without RIFF header, wrap in 44-byte WAV header
        if (rawBuf.subarray(0, 4).toString() !== 'RIFF') {
          rawBuf = pcmToWav(rawBuf, sampleRate, 1, 2);
        }

        return {
          base64: rawBuf.toString('base64'),
          mimeType: 'audio/wav',
          voiceUsed: voice,
          seconds: Math.round((rawBuf.length - 44) / (sampleRate * 2) * 10) / 10
        };
      }
    } catch (err) {
      console.warn(`[BanglaTTS] Error with ${model}:`, err.message);
    }
  }

  return null;
}
