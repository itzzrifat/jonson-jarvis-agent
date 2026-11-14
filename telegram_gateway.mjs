/**
 * Telegram Gateway for Jonson JARVIS Cloud Agent
 * Delivers plans, notes, ideas, marketing campaigns, and alerts directly
 * to Founder Rifat Uddin's personal Telegram chat.
 */

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8251961572:AAGUddQiFE67EoUBXH9PbkMzxwi1aEKHRmo';
const OWNER_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '8656634699';

export async function sendTelegram(chatId = OWNER_CHAT_ID, text, photoPath = null) {
  if (!BOT_TOKEN || !text) return false;

  try {
    if (photoPath) {
      const fs = await import('fs');
      if (fs.existsSync(photoPath)) {
        const buf = fs.readFileSync(photoPath);
        const formData = new FormData();
        formData.append('chat_id', chatId);
        formData.append('caption', text.slice(0, 1024));
        formData.append('photo', new Blob([buf], { type: 'image/png' }), 'proof.png');
        const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
          method: 'POST',
          body: formData
        });
        return res.ok;
      }
    }

    // Telegram message character limit is 4096. Split into chunks if necessary.
    const chunks = splitText(text, 3800);
    for (const chunk of chunks) {
      const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: chunk,
          parse_mode: 'HTML',
          disable_web_page_preview: true
        })
      });
      if (!res.ok) {
        // Fallback without HTML parse mode if tags were malformed
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: chunk.replace(/<[^>]*>?/gm, ''),
            disable_web_page_preview: true
          })
        });
      }
    }
    return true;
  } catch (err) {
    console.error('[TelegramGateway] Error:', err.message);
    return false;
  }
}

export async function sendTelegramReport(title, content, category = 'plan', chatId = OWNER_CHAT_ID) {
  const catIcons = {
    plan: '📋 <b>[নতুন পরিকল্পনা / STRATEGY PLAN]</b>',
    idea: '💡 <b>[নতুন আইডিয়া / CREATIVE IDEA]</b>',
    note: '📝 <b>[সেভ করা নোট / PERSONAL NOTE]</b>',
    marketing: '🚀 <b>[মার্কেটিং ক্যাম্পেইন / MARKETING]</b>',
    task: '✅ <b>[টাস্ক ও কর্মতালিকা / TO-DO LIST]</b>'
  };

  const header = catIcons[category] || '⚡ <b>[J.A.R.V.I.S. ইন্টেলিজেন্স রিপোর্ট]</b>';
  const cleanTitle = title.replace(/<[^>]*>?/gm, '').trim();

  // Escape HTML characters in content to prevent parse errors
  const safeContent = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '\n');

  const formattedMsg = `${header}
━━━━━━━━━━━━━━━━━━━━
🎯 <b>বিষয়:</b> ${cleanTitle}

${safeContent}
━━━━━━━━━━━━━━━━━━━━
🤖 <i>Jonson AI • 24/7 Cloud Assistant</i>
🕒 <i>${new Date().toLocaleTimeString('bn-BD', { timeZone: 'Asia/Dhaka' })} (Dhaka)</i>`;

  return await sendTelegram(chatId, formattedMsg);
}

function splitText(str, maxLength) {
  if (str.length <= maxLength) return [str];
  const parts = [];
  let remaining = str;
  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      parts.push(remaining);
      break;
    }
    let idx = remaining.lastIndexOf('\n', maxLength);
    if (idx === -1) idx = maxLength;
    parts.push(remaining.slice(0, idx));
    remaining = remaining.slice(idx).trim();
  }
  return parts;
}
