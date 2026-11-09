// What a video says and how it is split into scenes. Two styles:
//  istorik — the AE.LAH channel «Историк»: history, «ты» as the hero, warm doodle stick figures, real facts
//  razgon  — «What if…»: one human ability pushed to the extreme, a mini-film in the second person, real science
// The owner's lessons (chat + ratings) are added to every prompt.

export const STYLES = {
  istorik: { name: 'Историк', about: 'История: ты проживаешь эпоху как герой. Тёплые рисованные стикмены, живые сцены, реальные факты.' },
  razgon: { name: 'What If', about: 'Что если бы твоё тело или мозг работали иначе? Мини-фильм от второго лица на настоящей науке.' },
};

const LANG = { ru: 'на русском языке', en: 'in English' };
const per = (words, n) => Math.max(8, Math.round(words / n));

const VOICE_RULES = {
  istorik: `Голос — увлечённый ютубер-рассказчик: дружелюбно, живо, с юмором и мемными подколками там, где это к месту, но без кринжа. Второе лицо «ты», настоящее время: зритель — герой. Короткие фразы, многоточия для пауз перед развязкой, вопросы к зрителю. Реальные факты, даты и цифры (числа — словами), ничего не выдумывай; спорное — «по разным оценкам». Без жестокости напоказ.`,
  razgon: `Voice of the channel: second person, present tense — the viewer IS the hero ("you"), use "you/your" a lot. Ultra-short sentences (4–5 words on average, half of them 4 words or less), fragments welcome. Ellipses ("...") for dramatic pauses right before the payoff. Many questions ("The catch?" "The price?"). Contrast beats ("Amazing. And awful."). The "fact, then You?" move: a real human benchmark, then the hero's extreme ("A normal person reacts in a quarter of a second. You? Two hundredths."). Dry humour now and then. Warm, family-friendly, cinematic. At least five real, checkable facts with numbers (numbers written as words). Never invent studies or quotes. Story arc: cold open → the norm, the rule that limits the power, the title question → a montage of consequences from everyday to world scale → the hidden cost tied to a real mechanism → the heart (one relationship + a planted detail) → crisis and a hard either/or choice → resolution: the hero chooses people, the planted detail pays off → a short hook → call to action ("So what would you do...? Tell us in the comments... hit like and subscribe").`,
};

// the plan of a long video: chapters and the hero
export function planPrompt({ style, topic, minutes, lang, lessons }) {
  return `You plan a ${minutes}-minute YouTube video ${LANG[lang]} for a faceless channel with animated stick figures. Style: ${STYLES[style].name} — ${STYLES[style].about}
TOPIC: ${topic}
${VOICE_RULES[style]}
Return JSON {"title": str (catchy, <= 70 chars, ${LANG[lang]}), "hook": str, "hero": str (who "you" are, one line), "hero_look": str (English: what the hero wears and holds, ONE fixed phrase), "chapters": [{"title": str, "beats": str (what happens, 1–3 sentences)}] (6–8 chapters following the story arc)}.${lessons ? `\nLESSONS FROM THE OWNER (follow strictly):\n${lessons}` : ''}`;
}

// one chapter, or the whole Short: lines of narration, each with the picture idea
export function linesPrompt({ style, topic, lang, lessons, words, n, plan, chapter, k, short }) {
  const where = short
    ? `This is a ${Math.round(words / 2.5)}-second YouTube Short: line 1 is the hook (no greetings), the last line is a question to the viewer.`
    : `Video «${plan.title}». The hero: ${plan.hero}. Whole plan: ${plan.chapters.map((c, i) => `${i + 1}. ${c.title}`).join('; ')}.\nWrite CHAPTER ${k + 1} «${chapter.title}»: ${chapter.beats}${k === plan.chapters.length - 1 ? ' This is the ENDING: close the story and end with the call to action.' : ''}`;
  return `You are the head writer of a faceless YouTube channel with animated stick figures, style ${STYLES[style].name}. Write ${LANG[lang]}.
TOPIC: ${topic}
${where}
${VOICE_RULES[style]}
Exactly ${n} lines of voice-over, about ${per(words, n)} words each, ${words} words in total. Each line is one shot of the animation (6–10 seconds).
To every line add "idea": in ENGLISH, what we SEE in that shot — who, doing what, where, the mood; concrete and visual, different from the previous shot (wide / close / action / reaction). No camera words, no style words.
Return JSON {"lines": [{"text": str, "idea": str}]}.${lessons ? `\nLESSONS FROM THE OWNER (follow strictly):\n${lessons}` : ''}`;
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
