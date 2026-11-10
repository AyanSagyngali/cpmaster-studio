// What a video says and how it is split into scenes. Two styles:
//  istorik — the AE.LAH channel «Историк»: history, «ты» as the hero, warm doodle stick figures, real facts
//  razgon  — «What if…»: one human ability pushed to the extreme, a mini-film in the second person, real science
// The owner's lessons (chat + ratings) are added to every prompt.

export const STYLES = {
  istorik: { name: 'Историк', about: 'История: ты проживаешь эпоху как герой. Тёплые рисованные стикмены, живые сцены, реальные факты.' },
  razgon: { name: 'What If', about: 'Что если бы твоё тело или мозг работали иначе? Мини-фильм от второго лица на настоящей науке.' },
  paper: { name: 'Бумага', about: 'Объяснялка: тёплые карточки с цифрами и списками, слова на экране, маленький маскот.', engine: 'cards', theme: 'paper' },
  mascot: { name: 'Маскот', about: 'Подборки и сравнения: тёмные инфокарточки, отсчёт цифр, галочки и живой персонаж.', engine: 'cards', theme: 'mascot' },
};

// what every script must do, whatever the style (the writer and the editor both get it)
const CRAFT = `CRAFT RULES (a script that breaks them is rejected):
- Line 1 is the HOOK: a concrete, surprising claim, number or conflict in the first 2 seconds. Never start with "Did you know", "Today", "In this video", greetings, or the topic's name alone.
- Every line gives the viewer something NEW: a specific fact, number, name, date, place, object, sensory detail or a twist. Zero filler, zero repeating the previous line in other words.
- Specific beats general: not "a lot of money" but "forty thousand dollars"; not "an old city" but "Samarkand, 1404".
- Open a loop early ("but the strangest part is the third one...") and pay it off later. Every 3–4 lines: a mini-reveal or a turn.
- Spoken rhythm: short sentences, mix 3-word punches with one longer line, contractions, rhetorical questions. It must sound like a smart friend telling it, not like an encyclopedia.
- Banned clichés: "since ancient times", "it is worth noting", "plays an important role", "in today's world", "let's dive in", "imagine a world", "unlock", "game-changer", "journey".
- The last line lands: a payoff, a twist, or a question the viewer wants to answer in the comments.`;

const LANG = { ru: 'на русском языке', en: 'in English' };
const per = (words, n) => Math.max(8, Math.round(words / n));

const VOICE_RULES = {
  paper: `Голос — умный и тёплый блогер-объяснялка из TikTok: говорит просто о сложном, на «ты», с лёгкой иронией. Структура: крючок с цифрой или парадоксом → «вот как это работает» по шагам → неожиданный вывод → призыв: «напиши в комментах слово …». Каждая фраза — одна мысль, которую можно показать карточкой (цифра, список, сравнение «было/стало»). Реальные цифры и названия, ничего не выдумывай.`,
  mascot: `Голос — бодрый тех/лайфхак-блогер из TikTok: быстро, с энергией и подколками, на «ты». Формат подборки или сравнения: крючок с ценой, выгодой или болью («платишь 1990 в месяц? зря») → пункты «первый… второй… третий… четвёртый», у каждого одна убойная цифра или факт → честный минус или предупреждение → итог в цифрах → призыв: «напиши в комментах слово …». Реальные названия и цифры (звёзды на GitHub, цены, сроки), ничего не выдумывай.`,
  istorik: `Голос — увлечённый ютубер-рассказчик: дружелюбно, живо, с юмором и мемными подколками там, где это к месту, но без кринжа. Второе лицо «ты», настоящее время: зритель — герой. Короткие фразы, многоточия для пауз перед развязкой, вопросы к зрителю. Реальные факты, даты и цифры (числа — словами), ничего не выдумывай; спорное — «по разным оценкам». Без жестокости напоказ.`,
  razgon: `Voice of the channel: second person, present tense — the viewer IS the hero ("you"), use "you/your" a lot. Ultra-short sentences (4–5 words on average, half of them 4 words or less), fragments welcome. Ellipses ("...") for dramatic pauses right before the payoff. Many questions ("The catch?" "The price?"). Contrast beats ("Amazing. And awful."). The "fact, then You?" move: a real human benchmark, then the hero's extreme ("A normal person reacts in a quarter of a second. You? Two hundredths."). Dry humour now and then. Warm, family-friendly, cinematic. At least five real, checkable facts with numbers (numbers written as words). Never invent studies or quotes. Story arc: cold open → the norm, the rule that limits the power, the title question → a montage of consequences from everyday to world scale → the hidden cost tied to a real mechanism → the heart (one relationship + a planted detail) → crisis and a hard either/or choice → resolution: the hero chooses people, the planted detail pays off → a short hook → call to action ("So what would you do...? Tell us in the comments... hit like and subscribe").`,
};

// the plan of a long video: chapters and the hero
export function planPrompt({ style, topic, minutes, lang, lessons }) {
  return `You plan a ${minutes}-minute YouTube video ${LANG[lang]} for a faceless channel ${STYLES[style].engine === 'cards' ? 'with animated infographic cards' : 'with animated stick figures'}. Style: ${STYLES[style].name} — ${STYLES[style].about}
TOPIC: ${topic}
${VOICE_RULES[style]}
${CRAFT}
Return JSON {"title": str (catchy, <= 70 chars, ${LANG[lang]}), "hook": str, "hero": str (who "you" are, one line), "hero_look": str (English: what the hero wears and holds, ONE fixed phrase), "chapters": [{"title": str, "beats": str (what happens, 1–3 sentences)}] (6–8 chapters following the story arc)}.${lessons ? `\nLESSONS FROM THE OWNER (follow strictly):\n${lessons}` : ''}`;
}

// one chapter, or the whole Short: lines of narration, each with the picture idea
export function linesPrompt({ style, topic, lang, lessons, words, n, plan, chapter, k, short }) {
  const where = short
    ? `This is a ${Math.round(words / 2.5)}-second YouTube Short: line 1 is the hook (no greetings), the last line is a question to the viewer.`
    : `Video «${plan.title}». The hero: ${plan.hero}. Whole plan: ${plan.chapters.map((c, i) => `${i + 1}. ${c.title}`).join('; ')}.\nWrite CHAPTER ${k + 1} «${chapter.title}»: ${chapter.beats}${k === plan.chapters.length - 1 ? ' This is the ENDING: close the story and end with the call to action.' : ''}`;
  return `You are the head writer of a faceless YouTube channel ${STYLES[style].engine === 'cards' ? 'with animated infographic cards' : 'with animated stick figures'}, style ${STYLES[style].name}. Write ${LANG[lang]}.
TOPIC: ${topic}
${where}
${VOICE_RULES[style]}
${CRAFT}
Exactly ${n} lines of voice-over, about ${per(words, n)} words each, ${words} words in total. Each line is one shot of the animation (6–10 seconds).
To every line add "idea": in ENGLISH, what we SEE in that shot — who, doing what, where, the mood; concrete and visual, different from the previous shot (wide / close / action / reaction). No camera words, no style words.
Return JSON {"lines": [{"text": str, "idea": str}]}.${lessons ? `\nLESSONS FROM THE OWNER (follow strictly):\n${lessons}` : ''}`;
}

// the editor: a second pass that rewrites the weak lines (same number of lines, same order, so the timing stays simple)
export function polishPrompt({ style, topic, lang, lines, lessons, short }) {
  return `You are the toughest script editor of a faceless YouTube channel (style ${STYLES[style].name}). Topic: ${topic}. ${short ? 'This is a Short: every second counts.' : 'This is one chapter of a long video.'}
${VOICE_RULES[style]}
${CRAFT}
THE DRAFT (${lines.length} lines):
${lines.map((l, i) => `${i + 1}. ${l.text}`).join('\n')}
Rewrite it ${LANG[lang]} so it is gripping: sharpen the hook, replace every vague line with a specific fact or image, cut filler, fix rhythm, keep facts true (if unsure — soften, never invent). Keep EXACTLY ${lines.length} lines and roughly the same length of each line. Keep each line's "idea" (in English, what we see), improve it if it is vague.
Return JSON {"lines": [{"text": str, "idea": str}]}.${lessons ? `
LESSONS FROM THE OWNER (follow strictly):
${lessons}` : ''}`;
}

// card styles: what is on the card of every line (one call for many lines)
export function cardsPrompt({ style, lines, lang }) {
  return `You design the on-screen infographic cards of a TikTok explainer (style ${STYLES[style].name}). Every voice-over line gets ONE card that SHOWS its key point (never the whole sentence). Text on cards ${LANG[lang]}, SHORT (a card is read in one second), use real numbers from the line.
Card kinds (pick what fits the line; vary them, never the same kind three times in a row):
- {"kind":"title","icon":"emoji","text":"2–5 words","sub":"short accent line"|null} — hooks, big claims, chapter starts
- {"kind":"number","icon":"emoji"|null,"label":"what it is","value":"1990","prefix":"","suffix":" ₽/мес","sub":"short note"|null} — any price, count, percent, year (value = digits only, counts up)
- {"kind":"list","title":"…"|null,"items":[{"icon":"emoji","text":"2–4 words","mark":"check"|"cross"|null}]} — 2–4 items: options, rules, pros/cons
- {"kind":"compare","bad":"the usual way, 2–5 words","bad_icon":"emoji","good":"the better way","good_icon":"emoji"} — before/after, myth/fact, them/you
- {"kind":"step","n":1,"of":4,"icon":"emoji","title":"name of item n","stat":"★ 46 195" or a short fact} — the n-th item of a countdown or list of tools
- {"kind":"wave","label":"REC","from":"RU"|null,"to":"EN"|null} — anything about voice, sound, music, speech, translation
- {"kind":"stamp","text":"what is wrong, 3–7 words","stamp":"1–2 word verdict, e.g. БЕЗ ЭТОГО / МИФ / ЗАПРЕЩЕНО"} — warnings, myths, the catch
- {"kind":"grid","icon":"emoji","count":12,"label":"За год","value":"23 880 ₽"} — totals made of repeated parts (months, people, days)
- {"kind":"bars","title":"…","items":[{"label":"…","value":"46195"}]} — 2–5 things ranked by a number
- {"kind":"quote","who":"short name/flag","text":"what is said, <= 9 words"} — a quote, a dialogue, an example phrase
- {"kind":"cta","title":"Напиши в комментах","word":"ONE WORD","sub":"what they get"} — ONLY for the final call to action
For every line also give "mood" of the mascot reacting to it: happy | surprised | smug | think | laugh | sad | wink | angry, and "hot": 1–2 key words of the line (exact words from it) to highlight.
LINES:
${lines.map((l, i) => `${i + 1}. ${l.text}`).join('\n')}
Return JSON {"cards": [{"card": {...}, "mood": str, "hot": [str]}]} with exactly ${lines.length} items in the same order.`;
}

export function heroPrompt({ style, look, palette }) {
  return `Design the main hero of a ${STYLES[style].name} video: a simple stick figure (round head, thin body) — you design only his CLOTHES, HEADWEAR and what he HOLDS. ${look}
Return JSON {"outfit": {"color": "#hex", "belt": "#hex" | null}, "hat": SVG elements of the headwear for a head = circle radius 24 at (0,0), sitting on top, inside x -60..60 y -90..30, thick black outlines stroke-width 5, flat fills ("" = bare head),
"item": SVG elements of what he holds, hand at (0,0), inside x -40..40 y -120..40 ("" = empty hands), "grip": "upright" | "along", "hand": "right"}. Palette: ${palette}.`;
}

export function metaPrompt({ style, topic, title, script, lang }) {
  return `Write the YouTube metadata ${LANG[lang]} for this ${STYLES[style].name} video. Title: «${title}». Topic: ${topic}.
Script: ${script.slice(0, 4000)}
Return JSON {"title": str (<= 90 chars), "description": str (2 short paragraphs + 3–5 hashtags), "tags": [str] (12–18)}.`;
}
