import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cron from 'node-cron';
import dotenv from 'dotenv';
import { processAgentMessage } from './agent_brain.mjs';
import { runFacebookCloudCycle, publishFacebookPostCloud, verifyFacebookCloudSession } from './marketing/facebook_cloud.mjs';
import { runInstagramCloudCycle, verifyInstagramCloudSession } from './marketing/instagram_cloud.mjs';
import { addTask, listTasks, completeTask, addNote, listNotes, addTransaction, getExpenseSummary, loadStorage } from './storage.mjs';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 7860;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8251961572:AAGUddQiFE67EoUBXH9PbkMzxwi1aEKHRmo';
const OWNER_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '8656634699';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// In-memory action logs
const activityLogs = [];
function addLog(msg) {
  const entry = { time: new Date().toLocaleTimeString('bn-BD', { timeZone: 'Asia/Dhaka' }), message: msg };
  activityLogs.unshift(entry);
  if (activityLogs.length > 100) activityLogs.pop();
  console.log(`[JonsonCloud] ${msg}`);
}

// 1. Health & Dashboard Stats API
app.get('/api/health', (req, res) => {
  const mem = process.memoryUsage();
  const storage = loadStorage();
  const financial = getExpenseSummary();

  res.json({
    status: 'online',
    uptime: process.uptime(),
    memoryMb: Math.round(mem.rss / 1024 / 1024),
    timestamp: new Date().toISOString(),
    tasksCount: storage.tasks.filter(t => !t.completed).length,
    notesCount: storage.notes.length,
    financial,
    logs: activityLogs.slice(0, 15)
  });
});

// 1.1 JARVIS Voice Interface & iOS Web App Route
app.get('/jarvis', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'jarvis.html'));
});

// 1.2 JARVIS Voice API Endpoint (For iPhone Siri Shortcuts, Action Button & Web HUD)
app.post('/api/jarvis/voice', async (req, res) => {
  const userQuery = (req.body.message || req.body.prompt || req.body.text || req.body.query || '').trim();
  if (!userQuery) {
    return res.status(400).json({ error: 'Message or text is required.' });
  }

  addLog(`[JARVIS Voice Request] "${userQuery}"`);
  try {
    const agentResponse = await processAgentMessage(userQuery);
    const reply = agentResponse.reply || 'কাজ সম্পন্ন হয়েছে!';
    // Clean reply for Siri / TTS text speech
    const spoken = reply
      .replace(/<[^>]*>?/gm, '')
      .replace(/[*#`_]/g, '')
      .replace(/\n+/g, '. ')
      .trim();

    res.json({
      success: true,
      query: userQuery,
      reply,
      spoken,
      toolResult: agentResponse.toolResult || null
    });
  } catch (err) {
    addLog(`[JARVIS Voice Error] ${err.message}`);
    res.status(500).json({ error: err.message, spoken: 'দুঃখিত, কোনো ত্রুটি হয়েছে।' });
  }
});

// 2. Action Triggers from Web Dashboard
app.post('/api/trigger/fb-growth', async (req, res) => {
  addLog('Manual Facebook growth triggered from dashboard.');
  try {
    const result = await runFacebookCloudCycle({ maxLikes: 4 });
    addLog(`Facebook cycle: ${result.status} (Liked: ${result.likesDone || 0})`);
    res.json(result);
  } catch (err) {
    addLog(`Facebook cycle error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/trigger/ig-growth', async (req, res) => {
  addLog('Manual Instagram growth triggered from dashboard.');
  try {
    const result = await runInstagramCloudCycle({ maxLikes: 4 });
    addLog(`Instagram cycle: ${result.status} (Liked: ${result.likesDone || 0})`);
    res.json(result);
  } catch (err) {
    addLog(`Instagram cycle error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// 3. Telegram Messaging Helper
async function sendTelegram(chatId, text, photoPath = null) {
  if (!BOT_TOKEN) return;
  try {
    if (photoPath) {
      const fs = await import('fs');
      if (fs.existsSync(photoPath)) {
        const buf = fs.readFileSync(photoPath);
        const formData = new FormData();
        formData.append('chat_id', chatId);
        formData.append('caption', text.slice(0, 1024));
        formData.append('photo', new Blob([buf], { type: 'image/png' }), 'proof.png');
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, { method: 'POST', body: formData });
        return;
      }
    }

    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' })
    });
  } catch (e) {
    console.error('[Telegram] Error sending message:', e.message);
  }
}

// Helper: Transcribe Audio using Gemini Multimodal API
async function transcribeAudioWithGemini(audioBuffer, mimeType = 'audio/ogg') {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return '';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const base64Data = audioBuffer.toString('base64');
  const payload = {
    contents: [{
      role: 'user',
      parts: [
        { inlineData: { mimeType, data: base64Data } },
        { text: 'Please transcribe this audio accurately. Output ONLY the transcribed text in Bengali or English as spoken, with no additional explanation.' }
      ]
    }]
  };
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) return '';
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
  } catch (err) {
    console.error('[TranscribeError]', err.message);
    return '';
  }
}

// 4. Telegram Webhook Endpoint
app.post('/api/telegram-webhook', async (req, res) => {
  res.status(200).send('OK');
  const update = req.body;
  if (!update || !update.message) return;

  const msg = update.message;
  const chatId = msg.chat?.id;
  let text = (msg.text || '').trim();

  // If user sent a Voice Note (ভয়েস মেসেজ)
  if (!text && msg.voice) {
    try {
      addLog(`[Telegram Voice] Receiving voice note from ${chatId}...`);
      await sendTelegram(chatId, '🎙️ <i>আপনার ভয়েস শুনছি... প্রসেস করা হচ্ছে...</i>');

      const fileId = msg.voice.file_id;
      const fRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`);
      const fData = await fRes.json();
      const filePath = fData.result?.file_path;
      if (filePath) {
        const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`;
        const audioBuf = Buffer.from(await (await fetch(fileUrl)).arrayBuffer());
        text = await transcribeAudioWithGemini(audioBuf, msg.voice.mime_type || 'audio/ogg');
        addLog(`[Telegram Voice Transcribed] "${text}"`);
        if (text) {
          await sendTelegram(chatId, `🗣️ <i>"${text}"</i>`);
        }
      }
    } catch (vErr) {
      console.error('[VoiceHandlerError]', vErr.message);
    }
  }

  if (!chatId || !text) return;
  addLog(`Telegram: "${text}" from ${chatId}`);

  // (A) Help & Overview
  if (text === '/start' || text === '/help') {
    const welcome = `👑 <b>স্বাগতম রিফাত ভাই! আমি আপনার ২৪/৭ ক্লাউড এক্সিকিউটিভ অ্যাসিস্ট্যান্ট — Jonson AI</b>\n\n` +
      `⚡ <b>ক্লাউড ইঞ্জিন:</b> Hugging Face Spaces (2 vCPU / 16 GB RAM)\n` +
      `🕒 <b>অবস্থা:</b> আপনার পিসি ছাড়াই ২৪/৭ ক্লাউডে স্বয়ংক্রিয়ভাবে সচল\n\n` +
      `📱 <b>সোশ্যাল মিডিয়া ও মার্কেটিং:</b>\n` +
      `• <code>/fb grow</code> — ফেসবুক ইনবাউন্ড গ্রোথ সাইকেল\n` +
      `• <code>/fb post &lt;ক্যাপশন&gt;</code> — সরাসরি ফেসবুকে পোস্ট পাবলিশ\n` +
      `• <code>/ig grow</code> — ইনস্টাগ্রাম জিরো-ফলোয়িং গ্রোথ\n` +
      `• <code>/marketing &lt;টপিক&gt;</code> — ভাইরাল ক্যাম্পেইন ও রিল স্ক্রিপ্ট\n\n` +
      `💼 <b>ব্যক্তিগত সহকারী ও হিসাব (Personal Assistant):</b>\n` +
      `• <code>/todo &lt;কাজ&gt;</code> — নতুন টাস্ক বা রিমাইন্ডার যোগ\n` +
      `• <code>/tasks</code> — চলমান সব পেন্ডিং কাজের তালিকা\n` +
      `• <code>/note &lt;লেখা&gt;</code> — আইডিয়া বা জরুরি নোট সংরক্ষণ\n` +
      `• <code>/hisab &lt;টাকার পরিমাণ&gt; &lt;বিবরণ&gt;</code> — খরচ বা আয়ের হিসাব সংরক্ষণ\n` +
      `• <code>/status</code> — ক্লাউড সার্ভারের লাইভ স্ট্যাটাস\n\n` +
      `<i>(আপনি কমান্ড ছাড়া সাধারণ বাংলায় যেকোনো প্রশ্ন, কোড বা আলোচনার জন্যও লিখতে পারেন)</i>`;
    return await sendTelegram(chatId, welcome);
  }

  // (B) System Status
  if (text === '/status' || text === '/health') {
    const uptimeHrs = (process.uptime() / 3600).toFixed(1);
    const memMb = Math.round(process.memoryUsage().rss / 1024 / 1024);
    const tasks = listTasks(true);
    const fin = getExpenseSummary();

    const reply = `📊 <b>Jonson AI Cloud Status:</b>\n\n` +
      `🟢 <b>সার্ভার:</b> 24/7 Cloud Online\n` +
      `⏳ <b>আপটাইম:</b> ${uptimeHrs} ঘণ্টা\n` +
      `🧠 <b>র‍্যাম ব্যবহার:</b> ${memMb} MB / 16 GB\n` +
      `📋 <b>পেন্ডিং টাস্ক:</b> ${tasks.length} টি\n` +
      `💰 <b>হিসাব ব্যালেন্স:</b> ৳${fin.balance.toLocaleString('en-US')}\n` +
      `🌐 <b>হেডলেস ক্রোম:</b> সচল ও প্রস্তুত`;
    return await sendTelegram(chatId, reply);
  }

  // (C) Facebook Growth & Posting
  if (text.startsWith('/fb post')) {
    const caption = text.replace(/^\/fb\s*post\s*/i, '').trim();
    if (!caption) {
      return await sendTelegram(chatId, `⚠️ পোস্টের ক্যাপশন লিখুন। যেমন:\n<code>/fb post সহজকারবার ইআরপি নিয়ে নতুন আপডেট আসছে!</code>`);
    }
    await sendTelegram(chatId, `✍️ <b>ফেসবুক প্রোফাইলে পোস্ট পাবলিশ করা হচ্ছে...</b>`);
    const pRes = await publishFacebookPostCloud(caption);
    if (pRes.status === 'success' || pRes.status === 'submitted') {
      return await sendTelegram(chatId, `✅ <b>ফেসবুক পোস্ট সফলভাবে পাবলিশ হয়েছে!</b>\n\n📝 <i>"${caption}"</i>`, pRes.proofPath);
    } else {
      return await sendTelegram(chatId, `❌ পোস্ট পাবলিশে সমস্যা: ${pRes.message}`);
    }
  }

  if (text.startsWith('/fb grow') || text === '/fb') {
    await sendTelegram(chatId, `🚀 <b>ক্লাউড ফেসবুক গ্রোথ সাইকেল শুরু হচ্ছে...</b>\n<i>(টার্গেটেড পোস্টে স্বয়ংক্রিয় লাইক ও এনগেজমেন্ট চলছে)</i>`);
    const fbRes = await runFacebookCloudCycle({ maxLikes: 4 });
    if (fbRes.status === 'success') {
      const report = `🎉 <b>ফেসবুক ক্লাউড সাইকেল সম্পন্ন!</b>\n\n` +
        `🏷️ <b>ক্যাটাগরি:</b> #${fbRes.topic}\n` +
        `❤️ <b>লাইক দেওয়া হয়েছে:</b> ${fbRes.likesDone} টি মূল পোস্টে\n` +
        `🔒 <b>ফ্রেন্ড রিকোয়েস্ট:</b> ০ টি (অ্যাকাউন্ট ১০০% নিরাপদ)`;
      return await sendTelegram(chatId, report, fbRes.proofPath);
    } else {
      return await sendTelegram(chatId, `⚠️ ফেসবুক সাইকেলে সমস্যা: ${fbRes.message}`);
    }
  }

  // (D) Instagram Growth
  if (text.startsWith('/ig grow') || text === '/ig') {
    await sendTelegram(chatId, `🚀 <b>ইনস্টাগ্রাম জিরো-ফলোয়িং গ্রোথ সাইকেল শুরু হচ্ছে...</b>`);
    const igRes = await runInstagramCloudCycle({ maxLikes: 4 });
    if (igRes.status === 'success') {
      const report = `🎉 <b>ইনস্টাগ্রাম ইনবাউন্ড সাইকেল সম্পন্ন!</b>\n\n` +
        `🏷️ <b>ক্যাটাগরি:</b> #${igRes.tag}\n` +
        `❤️ <b>লাইক দেওয়া হয়েছে:</b> ${igRes.likesDone} টি পোস্টে\n` +
        `🔒 <b>ফলো কাউন্ট:</b> ০ টি (Following অপরিবর্তিত)`;
      return await sendTelegram(chatId, report, igRes.proofPath);
    } else {
      return await sendTelegram(chatId, `⚠️ ইনস্টাগ্রাম সাইকেলে সমস্যা: ${igRes.message}`);
    }
  }

  // (E) Tasks & Reminders
  if (text.startsWith('/todo') || text.startsWith('/task')) {
    const taskText = text.replace(/^\/(?:todo|task)\s*/i, '').trim();
    if (!taskText) {
      return await sendTelegram(chatId, `💡 টাস্ক লিখতে পারেন: <code>/todo বিকেল ৪টায় নতুন ক্লায়েন্টের সাথে মিটিং</code>`);
    }
    const t = addTask(taskText);
    return await sendTelegram(chatId, `✅ <b>টাস্ক যুক্ত হয়েছে:</b>\n📌 "${t.text}"`);
  }

  if (text === '/tasks') {
    const tasks = listTasks(true);
    if (tasks.length === 0) {
      return await sendTelegram(chatId, `🎉 <b>মাশাআল্লাহ! কোনো পেন্ডিং কাজ নেই।</b> সব কাজ সম্পন্ন!`);
    }
    let listMsg = `📋 <b>আপনার চলমান পেন্ডিং কাজসমূহ (${tasks.length}টি):</b>\n\n`;
    tasks.forEach((t, i) => {
      listMsg += `${i + 1}. 📌 ${t.text}\n`;
    });
    return await sendTelegram(chatId, listMsg);
  }

  // (F) Quick Note
  if (text.startsWith('/note')) {
    const noteText = text.replace(/^\/note\s*/i, '').trim();
    if (!noteText) {
      const notes = listNotes();
      let nMsg = `📝 <b>সংরক্ষিত সাম্প্রতিক নোট (${notes.length}টি):</b>\n\n`;
      notes.forEach((n, i) => {
        nMsg += `${i + 1}. <b>${n.title}</b>: ${n.content}\n`;
      });
      return await sendTelegram(chatId, nMsg);
    }
    const n = addNote('নোট - ' + new Date().toLocaleDateString('bn-BD'), noteText);
    return await sendTelegram(chatId, `💾 <b>নোট সংরক্ষিত হয়েছে:</b>\n<i>"${n.content}"</i>`);
  }

  // (G) Expense & Hisab
  if (text.startsWith('/hisab') || text.startsWith('/expense')) {
    const parts = text.replace(/^\/(?:hisab|expense)\s*/i, '').trim().split(' ');
    const amt = parseFloat(parts[0]);
    if (isNaN(amt)) {
      const fin = getExpenseSummary();
      return await sendTelegram(chatId, `💰 <b>হিসাব বইয়ের বর্তমান অবস্থা:</b>\n\n` +
        `📈 মোট আয়: ৳${fin.totalIncome.toLocaleString('en-US')}\n` +
        `📉 মোট ব্যয়: ৳${fin.totalExpense.toLocaleString('en-US')}\n` +
        `💵 নেট ক্যাশ ব্যালেন্স: ৳${fin.balance.toLocaleString('en-US')}\n\n` +
        `💡 খরচ যোগ করতে: <code>/hisab 500 দুপুরের লাঞ্চ</code>`);
    }
    const note = parts.slice(1).join(' ') || 'সাধারণ খরচ';
    const tx = addTransaction({ type: 'expense', amount: amt, note });
    return await sendTelegram(chatId, `🧾 <b>খরচ রেকর্ড করা হয়েছে:</b>\n\n💸 <b>পরিমাণ:</b> ৳${tx.amount}\n📝 <b>বিবরণ:</b> ${tx.note}`);
  }

  // (H) Autonomous Gemini Agent Brain for general conversation & smart tools
  const agentResponse = await processAgentMessage(text);
  await sendTelegram(chatId, agentResponse.reply);
});

// 5. Automated 24/7 Cloud Schedulers (Cron in UTC, Dhaka is UTC+6)

// Daily Morning Executive Briefing at 8:30 AM Dhaka (2:30 AM UTC)
cron.schedule('30 2 * * *', async () => {
  addLog('[Cron] Sending Daily Morning Executive Briefing...');
  if (!OWNER_CHAT_ID) return;

  const tasks = listTasks(true);
  const fin = getExpenseSummary();
  const dateStr = new Date().toLocaleDateString('bn-BD', { timeZone: 'Asia/Dhaka', weekday: 'long', month: 'long', day: 'numeric' });

  const morningBrief = `🌅 <b>শুভ সকাল রিফাত ভাই!</b>\n\n` +
    `📅 <b>আজ:</b> ${dateStr}\n` +
    `📋 <b>আজকের পেন্ডিং টাস্ক:</b> ${tasks.length} টি\n` +
    `💰 <b>হিসাব ক্যাশ ব্যালেন্স:</b> ৳${fin.balance.toLocaleString('en-US')}\n` +
    `🚀 <b>সোশ্যাল মিডিয়া অটোপাইলট:</b> ক্লাউডে সক্রিয় (সারাদিনে ১০টি সাইকেল চলবে)\n\n` +
    `<i>"কঠিন পরিস্থিতিই নতুন সফলতার সুযোগ তৈরি করে। আজকের দিনটি আপনার জন্য সফল ও ফলপ্রসূ হোক!"</i>`;

  await sendTelegram(OWNER_CHAT_ID, morningBrief);
});

// Facebook Growth: 5 times daily (10:30 AM, 1:30 PM, 4:30 PM, 7:30 PM, 10:30 PM Dhaka)
cron.schedule('30 4,7,10,13,16 * * *', async () => {
  addLog('[Cron] Running scheduled Facebook Growth...');
  const res = await runFacebookCloudCycle({ maxLikes: 4 });
  if (res.status === 'success' && OWNER_CHAT_ID) {
    await sendTelegram(OWNER_CHAT_ID, `🤖 <b>ফেসবুক অটো-গ্রোথ আপডেট:</b> ${res.likesDone} টি পোস্টে লাইক সম্পন্ন।`, res.proofPath);
  }
});

// Instagram Growth: 5 times daily (10:00 AM, 1:00 PM, 4:00 PM, 7:00 PM, 10:00 PM Dhaka)
cron.schedule('0 4,7,10,13,16 * * *', async () => {
  addLog('[Cron] Running scheduled Instagram Growth...');
  const res = await runInstagramCloudCycle({ maxLikes: 4 });
  if (res.status === 'success' && OWNER_CHAT_ID) {
    await sendTelegram(OWNER_CHAT_ID, `📸 <b>ইনস্টাগ্রাম অটো-গ্রোথ আপডেট:</b> #${res.tag} টার্গেটে ${res.likesDone} টি পোস্টে লাইক সম্পন্ন।`, res.proofPath);
  }
});

// Self Keep-Alive Ping (Runs every 10 minutes)
cron.schedule('*/10 * * * *', () => {
  addLog('[Heartbeat] Jonson AI Cloud Agent alive and active.');
});

// 6. Start Server (Only listen if not in serverless environment)
if (!process.env.VERCEL) {
  app.listen(PORT, '0.0.0.0', () => {
    addLog(`Jonson AI Cloud Agent live on port ${PORT}!`);
    console.log(`========================================================`);
    console.log(`  Jonson AI 24/7 Cloud Assistant — Port ${PORT}`);
    console.log(`========================================================`);
  });
}

export default app;
