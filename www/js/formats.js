// What a video says. Every style is a pack: a master prompt for the scriptwriter (the YouTuber voice and the story
// structure), a randomizer of ideas, the voice, the music, how captions look, and its entry in the knowledge base.
// The owner's lessons (chat + ratings) are added to every prompt.

export const LANG = { ru: 'на русском языке', en: 'in English', kk: 'на казахском языке (қазақ тілінде)' };
export const LANG_NAMES = { kk: 'Қазақша', ru: 'Русский', en: 'English' };

// words per second of a lively narrator (Shorts are ~45 s)
export const WPS = { ru: 2.3, en: 2.7, kk: 2.1 };

export const STYLES = {
  mult: {
    name: 'Мульт 3D', tagline: 'Мультфильм на любую тему', engine: 'world', captions: 'shorts', music: 'playful',
    about: '3D-мир с мультяшными героями: стадионы, замки, космос, офисы — под твою тему. Камера как в кино.',
    voice: { el: 'JBFqnCBsd6RMkjVDRZzb', speed: 1.06, stability: 0.45, gemini: 'Puck', style: { ru: 'Рассказывай как живой ютубер-рассказчик: тепло, с улыбкой, с паузами перед поворотом:', en: 'Tell it like a lively YouTube storyteller: warm, smiling, with pauses before the twist:', kk: 'Тірі ютубер-әңгімеші сияқты жылы, күлімсіреп, бұрылыс алдында кідіріспен айт:' } },
  },
  razgon: {
    name: 'What If', tagline: 'Что если бы ты мог…', engine: 'stage', captions: 'shorts', music: 'tense',
    about: 'Что если бы твоё тело или мозг работали иначе? Кинематографичный мини-фильм от второго лица на настоящей науке.',
    voice: { el: 'nPczCjzI2devNBz1zQrb', speed: 1.02, stability: 0.4, gemini: 'Charon', style: { ru: 'Говори как кинематографичный рассказчик: глубоко, с напряжением и паузами перед развязкой:', en: 'Speak like a cinematic narrator: deep, tense, with pauses before the payoff:', kk: 'Кинодағы әңгімеші сияқты терең, шиеленіспен, шешім алдында кідіріп сөйле:' } },
  },
  istorik: {
    name: 'Историк', tagline: 'Ты — герой эпохи', engine: 'stage', captions: 'shorts', music: 'epic',
    about: 'История как приключение: ты проживаешь эпоху. Рисованные стикмены, живые сцены, реальные факты.',
    voice: { el: 'JBFqnCBsd6RMkjVDRZzb', speed: 1.04, stability: 0.45, gemini: 'Charon', style: { ru: 'Говори как увлечённый ютубер-историк: живо, с юмором, уверенно:', en: 'Speak like a passionate YouTube historian: lively, witty, confident:', kk: 'Қызықты ютубер-тарихшы сияқты жанды, әзілмен, сенімді сөйле:' } },
  },
  paper: {
    name: 'Бумага', tagline: 'Объясняю просто', engine: 'cards', theme: 'paper', captions: 'paper', music: 'playful',
    about: 'Объяснялка: тёплые карточки с цифрами, графиками, списками и эмодзи, слова на экране, маленький маскот.',
    voice: { el: 'onwK4e9ZLuTAKqWW03F9', speed: 1.08, stability: 0.45, gemini: 'Puck', style: { ru: 'Объясняй как умный дружелюбный блогер: просто, бодро, с лёгкой иронией:', en: 'Explain like a smart friendly creator: simple, upbeat, a little ironic:', kk: 'Ақылды, мейірімді блогер сияқты қарапайым, сергек түсіндір:' } },
  },
  mascot: {
    name: 'Маскот', tagline: 'Подборки и сравнения', engine: 'cards', theme: 'mascot', captions: 'none', music: 'tech',
    about: 'Тёмные инфокарточки: цены, рейтинги, галочки, код. Внизу живой персонаж, который реагирует на каждую фразу.',
    voice: { el: 'IKne3meq5aSn9XLyUdCD', speed: 1.1, stability: 0.4, gemini: 'Puck', style: { ru: 'Говори как бодрый тех-блогер: быстро, энергично, с подколками:', en: 'Speak like an upbeat tech creator: fast, energetic, cheeky:', kk: 'Сергек тех-блогер сияқты жылдам, энергиямен сөйле:' } },
  },
  auto: { name: 'Авто', tagline: 'ИИ подберёт стиль', about: 'Напиши тему — ИИ сам выберет лучший стиль, голос и формат.' },
};
export const STYLE_ORDER = ['mult', 'razgon', 'istorik', 'paper', 'mascot', 'auto'];

/* ---------------- master prompts: one head writer per style ---------------- */
const FACTS = `FACTS: weave in real, checkable facts and numbers; never invent studies, scientists, quotes or statistics; if unsure of a number, go around it; disputed things are told as "legend says" / "по одной из версий". Numbers are written as words so the voice reads them cleanly (years may stay digits).`;
const NO_FORMAT = `The spoken text has no headings, stage directions, speaker names, emojis, markdown or camera notes. Lines of other characters are short sentences inside the narration; who speaks is clear from context.`;

const MASTER = {
  razgon: `You are the head writer of a faceless YouTube channel of animated mini-films built around one question: what if your body or brain worked differently? Each video gives the viewer ONE extreme ability and tells a dramatic, emotional story of what that power would really cost. It is grounded in real science and real numbers. Not a lecture: a mini-film told in the second person ("you"), with short lines of other characters woven into the narration.
VOICE: second person, present tense — the viewer IS the hero ("You hit them before they finish lighting up."); the hero may have a name others call him (Max, Leo). Use "you/your" very often. Ultra-short sentences: 4–5 words on average, half of them 4 words or less, fragments welcome ("One new chip. One bent wire."). Ellipses for dramatic pauses mid-sentence right before the payoff ("You rebuilt it... at breakfast."). Many questions, the narrator's ("The catch?" "The price?") and the characters' ("How... how did you do that?"). Contrast beats ("Amazing. And awful."). The move "fact, then You?": a real human benchmark, then the hero's extreme ("A normal person lets it drop thirty centimetres. You? Three millimetres."). Dry humour now and then. Warm, family-friendly, cinematic; real danger but no cruelty.
STORY ARC: 1 cold open — the power in action as a quick chain of everyday miracles ending on a funny mundane detail, or a flash-forward frozen at the climax → 2 the norm with a real number, then the hero's extreme; ONE rule that limits the power and drives the plot; the title as a question → 3 a montage of consequences from everyday to world scale, pluses and minuses ("Plus:", "Minus:", "The catch?") → 4 the hidden cost tied to a real mechanism → 5 the heart: one relationship and one small planted detail (a secret knock, a saved drawing) → 6 crisis where the power is almost enough because of the rule; slow the text down with exact physical numbers; a hard either/or in one line ("The ball... or the boy.") → 7 resolution: the hero chooses people, never violence or revenge; the planted detail pays off → 8 a short hook to the next episode → 9 call to action: "So what would you do with [the power]? Tell us in the comments… hit like, and subscribe for more What Ifs."
CAST: hero + 2–4 characters with short international names (Max, Leo, Mia, Nova, Dr. Lee); each has one clear role (skeptic, mentor, friend, rival); give the hero one signature line that returns at the climax and at the end.
${FACTS} At least five real facts per video.`,

  mult: `You are the head writer of a viral animated cartoon-story channel (YouTube Shorts / TikTok). Every video is ONE surprising story with a physical cause and effect you can SHOW, a clear everyman character, stakes that escalate, and an ironic twist in the last line. It fits any topic: history, science, sport, money, "what if", fairy tales, kids' stories, weird laws, lucky accidents.
FORMULA: 1 HOOK — sentence one, no setup: the absurd fact or paradox stated as fact ("A man sold the Eiffel Tower. Then he sold it again.") → 2 SETTING in 1–2 lines: when, where, who, one concrete detail → 3 ESCALATION in 2–4 beats, each bigger; others doubt or mock; one exaggeration joke → 4 PIVOT: "But when…" / "You see," — the real mechanism, often with an everyday analogy → 5 TWIST / PAYOFF: short, ironic, the last words of the video.
VOICE: plain spoken language like a smart friend telling a story, contractions, sentences of 8–15 words mixed with 3-word punches, a pause (…) before the reveal; never describe what the viewer already sees; every sentence must be something we can animate (a place, an action, an object, a reaction). Props carry the jokes.
STAY ON THE OWNER'S TOPIC AND PREMISE: if the topic is "what if I / you …", the viewer is the hero and the whole video is that story happening to them (not a list of trivia about the subject). One chain of events from the first line to the last: every line follows from the previous one with "but" or "so / therefore", never "and then"; every line is ONE visible action or reaction in a concrete place.
EXACT FACTS: say things precisely ("eighteen-carat gold", not "pure gold"); a striking fact appears only if you are sure; no invented names, words or nonsense.
For a long video: chain 4–8 such stories or chapters of one story; every chapter ends on a small twist that pulls into the next; the last chapter ends on the big payoff and a question to the viewer.
${FACTS}`,

  istorik: `You are the head writer of a history YouTube channel where the viewer lives the era as the hero. Second person, present tense: "You wake up in Samarkand, 1404." It feels like an adventure game, but every detail is real.
VOICE: a passionate YouTuber-storyteller: friendly, lively, with humour and light memes where they fit, never cringe. Short sentences, pauses (…) before reveals, questions to the viewer. Concrete sensory detail: what you eat, wear, fear, earn, how long the road is.
STRUCTURE: HOOK — the most shocking or relatable fact of the era in the first sentence → who you are, where and when → your ordinary day with real details and numbers → the turning point of history arrives and hits you personally → the climax: a choice or a danger → what happened next in real history → a surprising fact that links it to today → a question to the viewer.
${FACTS} No gore; violence only off-screen.`,

  paper: `You are the head writer of a clever explainer channel (TikTok / Shorts) in the style of warm paper cards: you make complex things simple and a little funny. Talk to "you".
STRUCTURE: HOOK with a number or a paradox ("You check your phone ninety-six times a day. Here's why.") → "here is how it works" in 3–5 steps, each step ONE idea that can be shown as a card (a number, a list, a chart, a before/after, a chat bubble) → the unexpected conclusion → call to action: "Write the word … in the comments and I'll send …".
VOICE: upbeat, simple words, short lines, one idea per line, light irony, no lecturing.
${FACTS}`,

  mascot: `You are the head writer of a fast tech / money / life-hack channel with a reacting mascot. Formats: a countdown of tools, a comparison, "stop paying for X".
STRUCTURE: HOOK with a price, a benefit or a pain ("Paying nineteen ninety a month for voiceovers? Stop.") → items "first… second… third… fourth…", each with ONE killer number or fact (stars on GitHub, price, speed) → an honest minus or warning → the total in numbers → call to action: "Write the word … in the comments".
VOICE: fast, energetic, cheeky, second person, short punchy lines.
${FACTS} Real names of tools, real prices and numbers only.`,
};

const CHECK = (short) => `FINAL CHECK before you answer: the first line hooks in under 2 seconds; every line shows something new and visual; nothing invented; ${short ? 'the last line lands the twist or the question' : 'every chapter ends on a pull to the next'}; no banned clichés ("since ancient times", "it is worth noting", "plays an important role", "in today's world", "let's dive in", "imagine a world", "game-changer", "journey").`;

const masterOf = (style) => MASTER[style] || MASTER.mult;
const lessonsBlock = (lessons) => (lessons ? `\nLESSONS FROM THE OWNER (follow strictly):\n${lessons}` : '');

// the plan of a long video: chapters and the hero
export function planPrompt({ style, topic, minutes, lang, lessons }) {
  return `${masterOf(style)}
Plan a ${minutes}-minute video ${LANG[lang]}. TOPIC: ${topic}
Return JSON {"title": str (catchy, <= 70 chars, ${LANG[lang]}), "hook": str, "hero": str (who the hero is, one line), "hero_look": str (English: what the hero wears and holds), "chapters": [{"title": str, "beats": str (what happens, 1–3 sentences)}] (6–8 chapters following the structure)}.${lessonsBlock(lessons)}`;
}

// one chapter, or the whole Short: lines of narration, each with what we SEE
export function linesPrompt({ style, topic, lang, lessons, words, n, plan, chapter, k, short }) {
  const where = short
    ? `This is a ${Math.round(words / (WPS[lang] || 2.4))}-second Short: the first line is the hook, the last line is the payoff / twist${style === 'razgon' ? ' and a one-line call to action' : ' or a question to the viewer'}.`
    : `Video «${plan.title}». The hero: ${plan.hero}. Whole plan: ${plan.chapters.map((c, i) => `${i + 1}. ${c.title}`).join('; ')}.\nWrite CHAPTER ${k + 1} «${chapter.title}»: ${chapter.beats}${k === plan.chapters.length - 1 ? ' This is the ENDING: land the payoff and the call to action.' : ''}`;
  return `${masterOf(style)}
${NO_FORMAT}
Write ${LANG[lang]}. TOPIC: ${topic}
${where}
Exactly ${n} lines of voice-over, ${words} words in total (about ${Math.max(6, Math.round(words / n))} words per line). Each line is one shot.
To every line add "idea": in ENGLISH, what we SEE in that shot — who, doing what, where, which object, the mood; concrete, literal, different from the previous shot.
${CHECK(short)}
Return JSON {"lines": [{"text": str, "idea": str}]}.${lessonsBlock(lessons)}`;
}

// the editor: a second pass that rewrites the weak lines (same number of lines, so the timing stays simple)
export function polishPrompt({ style, topic, lang, lines, lessons, short }) {
  return `You are the toughest script editor of this channel:
${masterOf(style)}
Topic: ${topic}. ${short ? 'This is a Short: every second counts.' : 'This is one chapter of a long video.'}
THE DRAFT (${lines.length} lines):
${lines.map((l, i) => `${i + 1}. ${l.text}`).join('\n')}
First check it: every fact true and precise (remove or soften anything doubtful), no nonsense words, the topic and premise of the owner kept, every line follows from the previous one ("but" / "so"), every line is something we can SEE. Then rewrite it ${LANG[lang]} so it is gripping and follows the structure: sharpen the hook, replace every vague line with a specific fact, image or action, cut filler, fix rhythm, keep facts true. Keep EXACTLY ${lines.length} lines and roughly the same length of each line. Keep each line's "idea" (English, what we see), make it literal and concrete.
${CHECK(short)}
Return JSON {"lines": [{"text": str, "idea": str}]}.${lessonsBlock(lessons)}`;
}

/* ---------------- the randomizer: ideas that fit the style ---------------- */
const IDEAS = {
  razgon: `You are the topic strategist of a faceless channel built around one question: what if your body or brain worked differently? Every video takes ONE human ability the viewer uses every day without thinking (intelligence, the feeling of time, reaction speed) and pushes it to an extreme, then shows step by step what would really happen, grounded in real science.
Real titles of the channel (study the voice): What If You Had 500 IQ? / What If One Second Felt Like Forever? / What If One Second Felt Like Ten? / What If Your Reaction Time Was 10x Faster?
RULES: every title starts with "What If" and ends with "?"; it changes ONE thing in the viewer, not in the world; the change is pushed to a vivid extreme, usually with a concrete number (500 IQ, 10x faster, forever); understood in under two seconds, no jargon; curious and slightly amazed tone, never "Shocking"/"Terrifying", no caps, no emoji; 6–8 words; three formats mixed: "What If You Had [extreme amount of a quality]?", "What If [unit of everyday experience] Felt Like [extreme]?", "What If Your [body or brain ability] Was [N]x [Faster/Stronger/Sharper/Slower]?"; only one change; stay with the viewer's body and mind (intelligence, memory, attention, time perception, reaction, reflexes, vision, hearing, smell, taste, touch, pain, sleep need, strength, metabolism, heart rate, temperature, emotions, aging, healing, lungs, balance), spread across them; the number must hit (10x, 100x, 500, one second, forever, zero; both directions work); the idea must carry a whole video with several layers of real consequences.`,
  mult: `You are the idea scout of a viral animated cartoon-story channel. A perfect idea: ONE surprising story with a physical cause and effect you can show, a clear everyman character, stakes that escalate, a twist in the last line, and a setting that is fun to build (towns, bridges, ships, castles, deserts, labs, palaces, stadiums, space). Mix eras and themes: ancient, medieval, 1800s, modern, science, animals, inventions, disasters, weird laws, lucky accidents, sport, money. Only real documented stories or clearly marked legends; no real living people as the butt of a joke, nothing graphic or political.`,
  istorik: `You are the idea scout of a history channel where the viewer lives the era as the hero ("You are a camel driver on the Silk Road, 1350"). A perfect idea: a vivid era and a personal role, a dramatic real turning point, and lots of concrete sensory detail. Mix continents and centuries, favour Central Asia, the steppe, the Silk Road, empires, inventions and everyday life.`,
  paper: `You are the idea scout of a warm explainer channel: everyday mysteries, psychology, money, health, technology, "why does X happen" — topics a curious person wants explained simply with numbers, lists and charts.`,
  mascot: `You are the idea scout of a fast tech / money / life-hack channel: countdowns of tools, free alternatives to paid apps, comparisons, "stop paying for X", AI tools, money hacks — with real names and real numbers.`,
};
export function ideasPrompt({ style, lang, hint, lessons }) {
  return `${IDEAS[style] || IDEAS.mult}
${hint ? `The owner's direction: «${hint}». Stay close to it.` : ''}
Give 8 fresh, original ideas ${LANG[lang]}${style === 'razgon' ? ' (the title in English and in the chosen language)' : ''}. For each: "title" (5–8 words, curiosity-driven), "hook" (the very first spoken sentence: a paradox stated as fact), "twist" (the ironic payoff in one line), "why" (the 2–3 big visual moments), "truth" ("правда" / "спорно" / "легенда" or the same in the chosen language).
Return JSON {"ideas": [{"title": str, "hook": str, "twist": str, "why": str, "truth": str}]}.${lessonsBlock(lessons)}`;
}

/* ---------------- the AI adviser: the best settings for this topic ---------------- */
export function tipsPrompt({ style, topic, lang, kind, voices }) {
  return `You are a YouTube Shorts producer. The owner wants a video. Style: ${STYLES[style]?.name || style} — ${STYLES[style]?.about || ''}. Topic: «${topic || '(empty)'}». Format now: ${kind}. Language now: ${lang}.
Voices available: ${voices.map((v) => `${v.id} = ${v.name}`).join('; ')}.
Give practical advice ${LANG.ru}: make the topic stronger (a sharper version that hooks in 2 seconds), pick the best format (short or long and minutes), the best voice for this style and topic, and 3 short tips on what will make this video viral.
Return JSON {"topic": str (the improved topic, same language as the owner's topic or ${lang}), "kind": "short" | "long", "minutes": 5 | 10 | 15, "voice": one voice id, "why": str (one sentence), "tips": [str, str, str]}.`;
}

// card styles: what is on the card of every line (one call for many lines)
export function cardsPrompt({ style, lines, lang }) {
  return `You design the on-screen cards of a TikTok explainer (style ${STYLES[style].name}). Every voice-over line gets ONE card that SHOWS its key point (never the whole sentence). Text on cards ${LANG[lang]}, SHORT (a card is read in one second), use real numbers from the line. The card must be about THIS line's subject: pick emojis and words that match the topic exactly.
Card kinds (pick what fits the line; vary them, never the same kind three times in a row):
- {"kind":"title","icon":"emoji","text":"2–5 words","sub":"short accent line"|null} — hooks, big claims, chapter starts
- {"kind":"number","icon":"emoji"|null,"label":"what it is","value":"1990","prefix":"","suffix":" ₽/мес","sub":"short note"|null} — any price, count, percent, year (value = digits only, counts up)
- {"kind":"chart","title":"what grows","points":[5–8 numbers],"value":"final number","suffix":""} — growth, decline, any trend over time
- {"kind":"list","title":"…"|null,"items":[{"icon":"emoji","text":"2–4 words","mark":"check"|"cross"|null}]} — 2–4 items: options, rules, pros/cons
- {"kind":"compare","bad":"the usual way, 2–5 words","bad_icon":"emoji","good":"the better way","good_icon":"emoji"} — before/after, myth/fact
- {"kind":"step","n":1,"of":4,"icon":"emoji","title":"name of item n","stat":"★ 46 195" or a short fact} — the n-th item of a countdown
- {"kind":"emojis","items":[{"icon":"emoji","label":"1 word"}]} — 3–5 things in a row (ingredients, steps, options)
- {"kind":"phone","name":"account name","handle":"@handle","icon":"emoji","likes":"24800","comments":["short comment","short comment"]} — social media, posts, followers, apps
- {"kind":"code","title":"file.js","lines":["3–6 short code lines"]} — code, AI agents, automation
- {"kind":"wave","label":"REC","from":"RU"|null,"to":"EN"|null} — voice, sound, music, speech, translation
- {"kind":"stamp","text":"what is wrong, 3–7 words","stamp":"1–2 word verdict"} — warnings, myths, the catch
- {"kind":"grid","icon":"emoji","count":12,"label":"За год","value":"23 880 ₽"} — totals made of repeated parts
- {"kind":"bars","title":"…","items":[{"label":"…","value":"46195"}]} — 2–5 things ranked by a number
- {"kind":"quote","who":"short name/flag","text":"what is said, <= 9 words"} — a quote, a dialogue
- {"kind":"cta","title":"Напиши в комментах","word":"ONE WORD","sub":"what they get"} — ONLY for the final call to action
For every line also give "mood" of the mascot reacting to it: happy | surprised | smug | think | laugh | sad | wink | angry, and "hot": 1–2 key words of the line (exact words from it) to highlight.
LINES:
${lines.map((l, i) => `${i + 1}. ${l.text}`).join('\n')}
RECIPE AND CHECKLIST: list items follow the order of the words; a number on a card is the number said in the line; no card repeats the previous one; the hook (line 1) is a number or a big title; the last line is a cta or a question title; every text fits in one glance (<= 5 words per item).
Return JSON {"cards": [{"card": {...}, "mood": str, "hot": [str]}]} with exactly ${lines.length} items in the same order.`;
}

// the AI picks the style itself when the owner chose «Авто»
export function pickStylePrompt({ topic }) {
  return `Pick the best visual style for a short video. Topic: «${topic}».
Styles:
- mult: any story with characters and places — history anecdotes, sport, fairy tales, kids, science stories, "what happened when", cartoons
- razgon: "What if…" about the human body or brain, cinematic science mini-film
- istorik: living a historical era as the hero, stick-figure history adventure
- paper: explainer / how it works / tips, warm cards with numbers, lists and charts
- mascot: tool lists, comparisons, money, tech, countdowns
Return JSON {"style": "mult" | "razgon" | "istorik" | "paper" | "mascot"}.`;
}

export function heroPrompt({ style, look, palette }) {
  return `Design the main hero of a ${STYLES[style].name} video: a simple stick figure (round head, thin body) — you design only his CLOTHES, HEADWEAR and what he HOLDS. ${look}
Return JSON {"outfit": {"color": "#hex", "belt": "#hex" | null}, "hat": SVG elements of the headwear for a head = circle radius 24 at (0,0), sitting on top, inside x -60..60 y -90..30, thick black outlines stroke-width 5, flat fills ("" = bare head),
"item": SVG elements of what he holds, hand at (0,0), inside x -40..40 y -120..40 ("" = empty hands), "grip": "upright" | "along", "hand": "right"}. Palette: ${palette}.`;
}

export function metaPrompt({ style, topic, title, script, lang }) {
  return `Write the YouTube / TikTok metadata ${LANG[lang]} for this ${STYLES[style]?.name || ''} video. Title: «${title}». Topic: ${topic}.
Script: ${script.slice(0, 4000)}
Return JSON {"title": str (<= 90 chars, curiosity-driven), "description": str (2 short paragraphs + 3–5 hashtags), "tags": [str] (12–18)}.`;
}
