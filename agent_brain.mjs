import { exec } from 'child_process';
import util from 'util';
import path from 'path';
import { fileURLToPath } from 'url';
import { runFacebookCloudCycle, publishFacebookPostCloud, verifyFacebookCloudSession, launchBrowser } from './marketing/facebook_cloud.mjs';
import { runInstagramCloudCycle, verifyInstagramCloudSession } from './marketing/instagram_cloud.mjs';
import { generateMarketingCampaign, generateViralDiscussionPost, askGemini } from './marketing/marketing_engine.mjs';
import { addTask, listTasks, completeTask, addNote, listNotes, addTransaction, getExpenseSummary } from './storage.mjs';

const execPromise = util.promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const AGENT_TOOLS = [
  // 1. Social Media & Marketing
  {
    name: 'facebook_publish_post',
    description: 'Publishes a new post to Rifat Uddin\'s Facebook profile with a caption and optional image.',
    parameters: {
      type: 'OBJECT',
      properties: {
        caption: { type: 'STRING', description: 'The exact post text/caption' }
      },
      required: ['caption']
    }
  },
  {
    name: 'facebook_growth_cycle',
    description: 'Runs Facebook inbound growth cycle (likes targeted business/feed posts).',
    parameters: {
      type: 'OBJECT',
      properties: {
        max_likes: { type: 'INTEGER', description: 'Number of posts to like (1-6)' }
      }
    }
  },
  {
    name: 'instagram_growth_cycle',
    description: 'Runs Instagram inbound growth cycle (zero-following strategy).',
    parameters: {
      type: 'OBJECT',
      properties: {
        max_likes: { type: 'INTEGER', description: 'Number of posts to like (1-6)' }
      }
    }
  },
  {
    name: 'generate_marketing_campaign',
    description: 'Generates ad copy, viral reel scripts, marketing strategy for any product/topic.',
    parameters: {
      type: 'OBJECT',
      properties: {
        topic: { type: 'STRING', description: 'Product or business topic' }
      },
      required: ['topic']
    }
  },

  // 2. Personal Assistant & Memory
  {
    name: 'add_task_reminder',
    description: 'Adds a to-do task or reminder for Rifat.',
    parameters: {
      type: 'OBJECT',
      properties: {
        text: { type: 'STRING', description: 'Task description or reminder note' },
        due_time: { type: 'STRING', description: 'Optional due time or date' }
      },
      required: ['text']
    }
  },
  {
    name: 'list_tasks',
    description: 'Lists active or pending to-do tasks and reminders.',
    parameters: {
      type: 'OBJECT',
      properties: {}
    }
  },
  {
    name: 'save_note',
    description: 'Saves an idea, note, meeting summary, or information to cloud storage.',
    parameters: {
      type: 'OBJECT',
      properties: {
        title: { type: 'STRING', description: 'Title or subject of the note' },
        content: { type: 'STRING', description: 'Body text or details' }
      },
      required: ['title', 'content']
    }
  },
  {
    name: 'search_notes',
    description: 'Searches saved notes and memories.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: { type: 'STRING', description: 'Search term or keyword' }
      }
    }
  },

  // 3. Finance & Expense Tracker (SohozKarbar Hisab)
  {
    name: 'record_transaction',
    description: 'Records an income or expense transaction.',
    parameters: {
      type: 'OBJECT',
      properties: {
        type: { type: 'STRING', description: '"income" or "expense"' },
        amount: { type: 'NUMBER', description: 'Amount in BDT' },
        category: { type: 'STRING', description: 'Category (e.g. "Food", "Marketing", "Server", "Office", "Sales")' },
        note: { type: 'STRING', description: 'Details or description' }
      },
      required: ['type', 'amount']
    }
  },
  {
    name: 'get_financial_summary',
    description: 'Retrieves total income, expenses, and net balance.',
    parameters: {
      type: 'OBJECT',
      properties: {}
    }
  },

  // 4. Web & Cloud Tools
  {
    name: 'browse_website',
    description: 'Navigates to a website using cloud Google Chrome and takes a screenshot.',
    parameters: {
      type: 'OBJECT',
      properties: {
        url: { type: 'STRING', description: 'The website URL to visit' }
      },
      required: ['url']
    }
  },
  {
    name: 'run_cloud_command',
    description: 'Executes a Linux bash command inside the cloud container.',
    parameters: {
      type: 'OBJECT',
      properties: {
        command: { type: 'STRING', description: 'The bash command to run' }
      },
      required: ['command']
    }
  }
];

export async function executeTool(toolName, args) {
  console.log(`[AgentBrain] Executing tool: ${toolName}`, args);

  switch (toolName) {
    case 'facebook_publish_post':
      return await publishFacebookPostCloud(args.caption);

    case 'facebook_growth_cycle':
      return await runFacebookCloudCycle({ maxLikes: args.max_likes || 4 });

    case 'instagram_growth_cycle':
      return await runInstagramCloudCycle({ maxLikes: args.max_likes || 4 });

    case 'generate_marketing_campaign': {
      const campaign = await generateMarketingCampaign(args.topic);
      return { campaign };
    }

    case 'add_task_reminder': {
      const task = addTask(args.text, args.due_time);
      return { success: true, task };
    }

    case 'list_tasks': {
      const tasks = listTasks(true);
      return { count: tasks.length, tasks };
    }

    case 'save_note': {
      const note = addNote(args.title, args.content);
      return { success: true, note };
    }

    case 'search_notes': {
      const notes = listNotes(args.query || '');
      return { count: notes.length, notes };
    }

    case 'record_transaction': {
      const tx = addTransaction({
        type: args.type,
        amount: args.amount,
        category: args.category || 'General',
        note: args.note || ''
      });
      return { success: true, transaction: tx };
    }

    case 'get_financial_summary': {
      const summary = getExpenseSummary();
      return summary;
    }

    case 'browse_website': {
      let browser = null;
      try {
        browser = await launchBrowser();
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36');
        await page.goto(args.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        const title = await page.title();
        const shotPath = path.join(__dirname, 'public', 'latest_web_browse.png');
        await page.screenshot({ path: shotPath });
        return { title, url: page.url(), screenshotPath: shotPath };
      } catch (err) {
        return { error: err.message };
      } finally {
        if (browser) await browser.close();
      }
    }

    case 'run_cloud_command': {
      try {
        const { stdout, stderr } = await execPromise(args.command, { timeout: 30000 });
        return { output: stdout || stderr || 'Command executed successfully.' };
      } catch (err) {
        return { error: err.message };
      }
    }

    default:
      return { error: `Tool ${toolName} not found` };
  }
}

export async function processAgentMessage(userText, history = []) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { reply: '⚠️ GEMINI_API_KEY কনফিগার করা হয়নি।' };
  }

  const systemInstruction = `You are Jonson JARVIS, the personal AI companion and voice assistant for Founder Rifat Uddin (Founder of Sohoz Karbar Tech Solutions & Creator of SohozKarbar ERP).
Vision: "Simple Technology. Smarter Business."
User: Rifat Uddin (Founder & Product Creator, Nabinagar, Brahmanbaria, Bangladesh).

CRITICAL CONVERSATIONAL RULES (SPEAK EXACTLY LIKE GEMINI LIVE):
1. Talk like a real, lively, warm, and highly intelligent human companion on a live voice call (Gemini Live conversational style).
2. Keep responses natural, short, and conversational (1 to 3 concise spoken sentences).
3. NEVER output markdown symbols (no asterisks **, no bullet points *, no # headers, no tables). Speak directly as natural spoken Bengali with English technical words.
4. Address him respectfully and warmly: "জি রিফাত ভাই", "হ্যাঁ ভাই", "অবশ্যই", "আমি দেখছি".
5. When reporting business, tasks, or accounts, state the facts smoothly as spoken dialogue.
6. When the user asks to perform an action (posts, tasks, finances, web), invoke the matching tool immediately!`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`;
  const payload = {
    contents: [
      ...history,
      { role: 'user', parts: [{ text: userText }] }
    ],
    systemInstruction: { parts: [{ text: systemInstruction }] },
    tools: [{
      functionDeclarations: AGENT_TOOLS
    }]
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn('[AgentBrain] Gemini API fallback:', errText);
      const fallbackText = await askGemini(`${systemInstruction}\n\nUser: ${userText}`);
      return { reply: fallbackText };
    }

    const data = await res.json();
    const candidate = data.candidates?.[0];
    const functionCall = candidate?.content?.parts?.find(p => p.functionCall)?.functionCall;

    if (functionCall) {
      const toolResult = await executeTool(functionCall.name, functionCall.args || {});

      // Formulate natural, executive response in Bengali
      const summarizePrompt = `${systemInstruction}\n\nUser asked: "${userText}"\nSystem tool "${functionCall.name}" executed with result: ${JSON.stringify(toolResult)}.\nProvide a calm, dignified, executive response in natural Bengali for Founder Rifat Uddin clearly presenting the result without raw JSON.`;

      const naturalReply = await askGemini(summarizePrompt);
      return { 
        reply: naturalReply || 'কাজটি সফলভাবে সম্পন্ন হয়েছে রিফাত ভাই!', 
        toolResult 
      };
    }

    const replyText = candidate?.content?.parts?.[0]?.text;
    return { reply: replyText || 'দুঃখিত, কোনো উত্তর পাওয়া যায়নি।' };
  } catch (err) {
    console.error('[AgentBrain] Error processing message:', err.message);
    return { reply: `ত্রুটি: ${err.message}` };
  }
}
