# 📱 JONSON JARVIS AI — আইফোন (iPhone) ও ক্লাউড সেটআপ গাইড
**Founder & Owner:** Rifat Uddin (Founder of Sohoz Karbar Tech Solutions)  
**Architecture:** 24/7 Cloud Autonomous Agent (Zero PC Dependency)

---

## 🌟 এই সিস্টেম কী কী করতে পারে?
1. **১ম ভিডিও (Maya AI)-এর মতো:**
   - আইফোনে লাইভ মুখে কথা বলা (Voice In & Voice Out)।
   - শান্ত ও রাশভারী কণ্ঠে বাংলা ও ইংরেজি মিক্সড উত্তর।
   - টনি স্টার্কের আয়রন ম্যান আর্করিয়েক্টর (Arc Reactor) HUD ইন্টারফেস।
2. **২য় ভিডিও (OpenClaw / KeepClaw)-এর মতো:**
   - **পিসি অন রাখার দরকার নেই** (১০০% ফ্রি ২৪/৭ ক্লাউড সার্ভারে সচল)।
   - টেলিগ্রাম ও হোয়াটসঅ্যাপের সাথে সরাসরি ইন্টিগ্রেশন।
   - ভয়েস নোট পাঠালে স্বয়ংক্রিয়ভাবে ভয়েস শুনে ব্যাকগ্রাউন্ডে কাজ শেষ করে রিপোর্ট দেওয়া।
   - সোস্যাল মিডিয়া মার্কেটিং (Facebook/Instagram Autopilot), সহজ কারবার হিসাব ও টাস্ক রিমাইন্ডার হ্যান্ডলিং।

---

## 📲 আইফোনে (iPhone) ব্যবহারের ৩টি চমৎকার উপায়

### ১. iOS Home Screen Web App (হোলোগ্রাম HUD মোড)
1. আইফোনের **Safari** ব্রাউজার খুলুন।
2. আপনার ক্লাউড ইউআরএল-এর `/jarvis` পেজে যান (যেমন: `https://YOUR-SPACE.hf.space/jarvis`)।
3. নিচে থাকা সাফারির **Share (শেয়ার)** বাটনে ট্যাপ করুন।
4. স্ক্রল করে **"Add to Home Screen" (হোম স্ক্রিনে যোগ করুন)** সিলেক্ট করুন।
5. ব্যস! আপনার আইফোনের হোম স্ক্রিনে **JARVIS** নামে একটি অরিজিনাল অ্যাপের মতো আইকন তৈরি হয়ে যাবে।
6. ওপেন করলেই ফুলস্ক্রিন আয়রন ম্যান আর্করিয়েক্টর চালু হবে। আর্করিয়েক্টরে এক ট্যাপ করে মুখে কথা বললেই জার্ভিস উত্তর দেবে।

---

### ২. Action Button / Siri Shortcut ("Hey Siri, Jarvis")
যাদের আইফোনে **Action Button** (iPhone 15 Pro / 16) আছে, তারা এক চাপে যেকোনো স্ক্রিন থেকে জার্ভিসকে ডাকতে পারেন:

1. আইফোনে **Shortcuts (শর্টকাট)** অ্যাপটি ওপেন করুন।
2. নতুন শর্টকাট তৈরি করে নাম দিন **"Jarvis"**।
3. নিচের ৩টি অ্যাকশন ধাপে ধাপে যোগ করুন:
   - **অ্যাকশন ১:** `Dictate Text` (Language: Bengali বা English)।
   - **অ্যাকশন ২:** `Get contents of URL`
     - URL: `https://YOUR-SPACE.hf.space/api/jarvis/voice`
     - Method: `POST`
     - Request Body: `JSON`
     - Key: `message` -> Value: `Dictated Text` সিলেক্ট করুন।
   - **অ্যাকশন ৩:** `Get Dictionary Value`
     - Key: `spoken`
     - Input: `Contents of URL`
   - **অ্যাকশন ৪:** `Speak Text`
     - Text: `Dictionary Value`
4. **Action Button ম্যাপিং:** আইফোনের Settings -> Action Button -> Shortcut -> সিলেক্ট করুন **"Jarvis"**।
   *(এখন ফোন লক থাকলেও সাইড বাটন চেপে ধরলেই জার্ভিস আপনার কথা শুনবে এবং মুখে উত্তর দেবে!)*

---

### ৩. Telegram Voice Agent (হাতে ফোন না রেখে এয়ারপডস/ভয়েস নোট দিয়ে)
1. আইফোনের Telegram অ্যাপ ওপেন করুন।
2. আপনার পার্সোনাল Jonson AI বট ওপেন করুন।
3. মাইক্রোফোন চেপে ধরে বাংলায় ভয়েস নোট পাঠান:
   - *"জার্ভিস, আজকের সহজ কারবার হিসাবের কী অবস্থা?"*
   - *"ফেসবুকে একটি নতুন পোস্ট পাবলিশ করো।"*
   - *"আজকের পেন্ডিং কাজগুলো আমাকে জানাও।"*
4. জার্ভিস স্বয়ংক্রিয়ভাবে আপনার ভয়েস শুনে ক্লাউডে কাজ সম্পাদন করবে এবং আপনাকে রিপ্লাই দেবে।

---

## ☁️ ক্লাউডে ডিপ্লয়মেন্ট (পিসি বন্ধ রেখে ২৪/৭ চালানোর নিয়ম)

1. [huggingface.co/new-space](https://huggingface.co/new-space)-এ যান।
2. Space Name দিন: `jonson-ai-cloud-agent`
3. SDK সিলেক্ট করুন: **Docker** -> **Blank** (2 vCPU / 16 GB RAM ফ্রি)।
4. আপনার কম্পিউটারে `d:\Jonson AI\jonson-cloud-agent\deploy_to_hf.bat` ডাবল ক্লিক করে রান করুন অথবা গিট পুশ করুন।
5. Space-এর **Settings -> Variables and secrets**-এ গিয়ে আপনার `GEMINI_API_KEY`, `TELEGRAM_BOT_TOKEN` ইত্যাদি সিক্রেট বসিয়ে দিন।
6. ক্লাউডে ডিপ্লয় শেষ হলে আপনি একটি পার্মানেন্ট লাইভ ইউআরএল পাবেন।

**এখন আপনার পিসি বন্ধ রাখলেও আপনার পার্সোনাল JARVIS ক্লাউডে ২৪/৭ জীবন্ত থাকবে!**
