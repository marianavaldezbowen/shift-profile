// The Shift Profile - report generation
// Two-pass: analysis (Sonnet) then writing (Haiku, two calls in parallel).

const ANALYSIS_MODEL = 'claude-sonnet-5';
const WRITING_MODEL  = 'claude-haiku-4-5-20251001';

const TYPE_NAMES = {
  // iEQ9 (Integrative Enneagram) type names, to match the certification.
  1: "Strict Perfectionist", 2: "Considerate Helper", 3: "Competitive Achiever",
  4: "Intense Creative", 5: "Quiet Specialist", 6: "Loyal Sceptic",
  7: "Enthusiastic Visionary", 8: "Active Controller", 9: "Adaptive Peacemaker"
};

const TYPE_CONTEXT = {
  1: "fears being corrupt or wrong, desires integrity, built identity around responsibility",
  2: "fears being unloved, desires to feel needed, built identity around helping others",
  3: "fears being worthless without achievement, desires to feel valuable, built identity around success",
  4: "fears having no identity, desires authentic self-expression, built identity around being unique",
  5: "fears being overwhelmed, desires competence, built identity around mastery and knowledge",
  6: "fears having no support, desires security, built identity around loyalty and preparedness",
  7: "fears being trapped in pain, desires joy and freedom, built identity around excitement",
  8: "fears being controlled, desires autonomy, built identity around strength and protecting others",
  9: "fears conflict, desires inner peace, built identity around harmony"
};

const WINGS = {
  1: [9, 2], 2: [1, 3], 3: [2, 4], 4: [3, 5], 5: [4, 6],
  6: [5, 7], 7: [6, 8], 8: [7, 9], 9: [8, 1]
};

const VOICE = `HOW TO WRITE THIS

You are writing as Mariana. She is a warm, direct, bilingual woman who coaches on identity and
change. She is not a guru. She talks like a friend who has done the work herself and is not
going to be precious about it.

Sound like a person talking, not a document.
- Contractions, always. "You're", "it's", "that's", "you've", "doesn't".
- Second person, present tense, the whole way through.
- Short paragraphs. Two to four sentences. Blank line between them.
- Sentence fragments are fine when that's how someone would actually say it.
- Short dash (-) for a pause. NEVER a long dash.
- Name feelings plainly. "You feel behind." Not "you may experience a sense of inadequacy."
- One good comparison beats three examples. Use a normal, everyday one.
- Let a hard line sit alone in its own paragraph. Don't rush to soften it.
- You can be a little funny once, briefly, then move on. Self-aware, never at her expense.
- You can be warm without being sweet. Say the true thing and trust her to handle it.

BANNED - these are what make writing sound generated. Do not use any of them:
"here's the thing", "the truth is", "let's be honest", "at the end of the day",
"it's important to note", "dive into", "journey", "unlock", "navigate", "lean into",
"powerful", "profound", "transformative", "life-changing", "beautiful", "sacred",
"you've got this", "believe in yourself", "you are enough", "give yourself grace",
"and that's okay", "and that's not a bad thing", "hold space", "show up for yourself".

Also banned as structures:
- "It's not X - it's Y." Once in a whole report at most, and only if it earns it.
- "X isn't just Y, it's Z."
- A rhetorical question followed immediately by its own answer.
- Three-item lists where two would do.
- Ending a section on an uplifting note that wasn't earned by what came before.
- Starting a section by restating what the section is about.

NEVER mention motherhood, children, pregnancy, parenting, or "this season of life".
Do not assume she has a partner, children, or a job. Write to the pattern, not to a demographic.

Test every sentence: would Mariana say this out loud to a smart friend over coffee?
If it sounds written rather than said, rewrite it.`;

async function callAnthropic(apiKey, model, maxTokens, prompt) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }]
    })
  });
  const data = await r.json();
  if (!r.ok) throw new Error(`${model} error: ${JSON.stringify(data).substring(0, 300)}`);
  if (!data.content || !data.content[0] || !data.content[0].text) {
    throw new Error(`${model} returned empty content`);
  }
  return data.content[0].text.trim();
}

function extractJson(rawText) {
  const cleaned = rawText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  const first = cleaned.indexOf('{');
  const last = cleaned.lastIndexOf('}');
  if (first === -1 || last === -1) throw new Error('No JSON braces found: ' + cleaned.substring(0, 200));
  return JSON.parse(cleaned.substring(first, last + 1));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) return res.status(500).json({ error: 'No API key configured' });

  const {
    typeNum, typeName, subtype, sortedScores, userName,
    subtypeRanking = [],   // full ranking, e.g. ["Social","One-on-One","Self-Preservation"]
    highOutliers = [],     // statements from OTHER types she rated 5
    lowOutliers = [],      // statements from HER type she rated 1-2
    userContext = '',      // her own sentence
    sunSign = '',          // optional, drives the zodiac section
    subtypeKeyword = '',   // official iEQ9 subtype name, e.g. 'Prestige'
    isCountertype = false  // this subtype behaves unlike the other two of its type
  } = req.body;

  if (!typeNum || !userName) {
    return res.status(400).json({ error: 'Missing required fields: typeNum or userName' });
  }
  if (!sortedScores || !Array.isArray(sortedScores)) {
    return res.status(400).json({ error: 'sortedScores must be an array' });
  }

  const hasScores  = sortedScores.length > 0;
  const secondType = sortedScores[1] || { type: (typeNum % 9) + 1, score: 0 };
  const thirdType  = sortedScores[2] || { type: ((typeNum + 1) % 9) + 1, score: 0 };
  const topScore   = sortedScores[0] ? sortedScores[0].score : 0;
  const gap        = (hasScores && sortedScores[1]) ? topScore - secondType.score : null;

  const trueWings = WINGS[typeNum] || [];
  const label = (t) => trueWings.includes(t.type)
    ? `Type ${t.type} wing (${TYPE_NAMES[t.type]})`
    : `Type ${t.type} secondary influence (${TYPE_NAMES[t.type]})`;

  const scoreTable = hasScores
    ? sortedScores.map(s => `Type ${s.type} ${TYPE_NAMES[s.type]}: ${s.score}/30`).join('\n')
    : 'Detailed scores are not available for this request. Work from type and subtype only, and do not reference specific numbers or a score gap anywhere in the report.';

  const gapLine = gap === null
    ? ''
    : `Gap between first and second: ${gap} points. A gap of 4 or less means her type is NOT clean-cut and she will feel genuinely torn between the two.`;

  const outlierBlock = (highOutliers.length || lowOutliers.length)
    ? [
        highOutliers.length
          ? `Statements from OTHER types she strongly agreed with (rated 5/5):\n` +
            highOutliers.map(o => `- (Type ${o.type}) "${o.text}"`).join('\n')
          : 'No strong cross-type agreements.',
        lowOutliers.length
          ? `Statements from HER OWN type she disagreed with (rated 1-2/5):\n` +
            lowOutliers.map(o => `- "${o.text}"`).join('\n')
          : 'No notable disagreements within her own type.'
      ].join('\n\n')
    : 'Individual statement data is not available for this request. Do not invent or reference specific statements.';

  const cleanContext = (userContext || '').trim().substring(0, 500);
  const contextBlock = cleanContext
    ? `HER OWN WORDS. She was asked what she keeps doing that she wishes she'd stop, and wrote:\n"${cleanContext}"`
    : 'She skipped the open question. Do not reference it or invent one.';

  // ────────────────────────────────────────
  // PASS 1 - ANALYSIS
  // ────────────────────────────────────────
  const analysisPrompt = `You are an expert Enneagram practitioner with NLP training. Analyse this person's assessment data. Do NOT write a report. Produce a tight working analysis another writer will use.

PERSON: ${userName}
Dominant: Type ${typeNum} ${typeName}. ${TYPE_CONTEXT[typeNum]}.
Dominant subtype: ${subtype}${subtypeRanking.length === 3 ? ` (full ranking: ${subtypeRanking.join(' > ')})` : ''}
${hasScores ? `Second: ${label(secondType)} at ${secondType.score}/30\nThird: ${label(thirdType)} at ${thirdType.score}/30\n${gapLine}` : ''}

ALL SCORES:
${scoreTable}

${outlierBlock}

${contextBlock}

Return plain text, no JSON, under 550 words, using exactly these labels:


CENTRAL CONTRADICTION: the specific tension in THIS data. Use the outliers, the gap, and her own words. Something a generic Type ${typeNum} description would miss.

META-PROGRAMS: which side she sits on for each, one line each, plus which one costs her most.
- Toward vs Away-From motivation
- Internal vs External reference
- Options vs Procedures
- Global vs Specific

THE SENTENCE: the literal sentence she says to herself on repeat, in quotes, in her own likely words. If she wrote something in HER OWN WORDS above, build this directly out of what she actually said. Then one line on what that sentence protects her from.

THE REFRAME: a different sentence, in quotes, that's also true and doesn't cost her the same thing.

THE TRIGGER: the exact first signal, physical or mental, that the pattern has started running. Something she can notice in the moment.

THE INTERRUPT: one specific action, under 60 seconds, that breaks it at that signal. Concrete enough that she knows whether she did it. Not "practice self-compassion", not "take a breath and reflect".

THE PREDICTION: what she'll do in the next two to three weeks as this pattern defends itself against being seen. Rules: it must be about the PATTERN, not her circumstances. Never predict external events, other people's behaviour, or anything involving a job, partner, or family member. It should be specific enough to feel uncanny and likely enough to actually happen. Give a rough timeframe. Include the tell - the exact thought she'll have when it starts.

THE 14-DAY PROTOCOL: one repeatable thing, under two minutes a day, built on THE TRIGGER and THE INTERRUPT. State what she does, when she does it, and how she knows she did it. It should be almost embarrassingly small.

WHAT TO NAME DIRECTLY: one or two specifics from her outliers or her own words the report must reference explicitly, so she knows this was written about her.`;

  let analysis;
  try {
    analysis = await callAnthropic(ANTHROPIC_API_KEY, ANALYSIS_MODEL, 1100, analysisPrompt);
  } catch (err) {
    console.error('Analysis pass failed, continuing without it:', err.message);
    analysis = `PATTERN NAME: not available - name her loop yourself, two to four plain words, Title Case.\nCENTRAL CONTRADICTION: not available - work from Type ${typeNum}, ${subtype} subtype, and whatever data is above.`;
  }

  const shared = `You're writing part of a personalized Enneagram profile for ${userName}, Type ${typeNum} (${typeName}), ${subtype} subtype.

WHO SHE IS
An adult in the middle of an identity shift. She's done some inner work already. She looks successful from outside and quietly suspects she's capable of more than the life she's built. Motherhood is NOT the lens here.

WHAT THIS IS
Not a personality description. She can get that free online in thirty seconds. Everything here has to be traceable to HER data below. If a paragraph could show up in any free Enneagram description, rewrite it or cut it.

Her ${subtype} subtype colours how Type ${typeNum} shows up, but the type is the subject. Reference the subtype only where it changes something real.

BALANCE - THIS MATTERS
Type ${typeNum} is the spine of this report. Write about the type first and foremost.
The subtype is a modifier, not a co-headline. Mention it where it genuinely changes
the picture - which is usually one or two places, not every section. Do not open
sections with "As a ${subtype} ${typeNum}..." and do not caveat every observation
with the subtype. If a paragraph would read the same with the subtype removed,
remove it.${subtypeKeyword ? `\nThe established name for this subtype is "${subtypeKeyword}". You may use it once, naturally, if it earns its place. Never invent an alternative name for her pattern.${isCountertype ? ` She is the COUNTERTYPE of her type - the one of the three that behaves unlike the other two, which is why people with her type often mistype themselves. Where it's relevant, write to what makes her the exception rather than the rule.` : ''}` : ''}

ANALYSIS OF HER RESULTS - build on this, don't restate it:
${analysis}

HER RAW DATA:
${scoreTable}

${outlierBlock}

${contextBlock}

The report already shows her, separately and visually, her core fear, core desire,
worldview, gift, vice, instinctual stack, centers of intelligence and her stress and
growth lines. Do NOT restate any of those as facts. Your job is the part a data panel
cannot do: what it actually feels like from the inside, and what to do about it.

${VOICE}

Return ONLY a raw JSON object. No markdown fences, no backticks, no text before or after the braces. Escape all newlines inside strings as \\n.`;

  const promptA = `${shared}

Write these five keys:

{
"gettingToKnowYourType": "About 200 words. Who Type ${typeNum} actually is, written so she feels caught rather than informed. Then what the ${subtype} subtype specifically does to this type, and name the version of Type ${typeNum} she is NOT so the difference lands. If the analysis says her gap is 4 points or less, say so plainly and describe what being between two types feels like day to day. Introduce the pattern name here for the first time, naturally, as if it's obvious. End with her core fear and core desire, one plain sentence each.",
"youAsMother": "About 180 words. Where this pattern got built. What it protected her from and what it earned her - it worked, that's why it stuck around. Then the turn: the thing that kept her safe at fifteen is the thing narrowing her options now. Specific to Type ${typeNum} and the ${subtype} subtype. Absolutely no mention of motherhood or children.",
"yourInnerWorld": "About 200 words. The meta-programs from the analysis, in plain language. Never name them as jargon, never list them mechanically. Walk through one real decision-shaped moment and show how her filters run it before she's consciously decided anything. Land on the one that costs her most. This is the section that should make her stop and read a line twice.",
"yourBlindSpots": "About 190 words. Two parts, no header between them. First, what she can't see because it's the lens and not the view - use the central contradiction, and include one thing people close to her have probably tried to tell her more than once. Direct, not cruel. Then, as the last two or three sentences, THE PREDICTION from the analysis, stated plainly and confidently with its timeframe and its tell. Something like: in about two weeks you're going to start thinking X - that's the pattern defending itself. Do not hedge it, do not add 'maybe' or 'you might'. Say it like you've watched it happen a hundred times."
}`;

  const promptB = `${shared}

Write these four keys:

{
"whereYouGetStuck": "About 190 words. THE STRONGEST SECTION IN THE REPORT.${cleanContext ? ` She wrote this in her own words: \\"${cleanContext}\\". Quote her back to herself EXACTLY, word for word, inside quotation marks, in the first two sentences. Do not clean up her grammar, do not paraphrase, do not summarize. Then show her what's underneath what she wrote.` : ' Open with THE SENTENCE from the analysis, in quotation marks, in her own likely words.'} Then what it's protecting. Then THE REFRAME, also in quotation marks. Make the swap concrete enough to use today. Use the pattern name at least once here.",
"yourGrowthEdge": "About 200 words. THE 14-DAY PROTOCOL from the analysis, written as an actual assignment with a start and an end. Name THE TRIGGER first - the exact signal that the pattern has started. Then the thing she does, when she does it, and how she knows she did it. Under two minutes a day, fourteen days. Be specific enough that she could start tomorrow and know by Friday whether she's doing it right. Say plainly that this is small on purpose and that reading about a pattern changes nothing while catching it four or five times changes how she decides. No 'practice self-compassion'. Something she could do on a Tuesday at 3pm.",
"questionsToSitWith": "Exactly 6 numbered questions as '1. text' each on its own line, separated by \\n. Specific to her data and her pattern name. Uncomfortable in a useful way. No yes/no questions - each should be hard to answer in one sentence.",
${sunSign ? `"zodiacBlend": "About 230 words. Type ${typeNum} with a ${sunSign} sun. This is a bonus section and it should read as one - lighter, more playful, curious rather than clinical. Do NOT treat astrology as measurement and do not claim it explains her. Frame it as a second lens laid over the first. Find the genuine TENSION between the two: where the Enneagram drive and the ${sunSign} archetype pull in different directions, and where they amplify each other into something specific. Be concrete about what that combination looks like on an ordinary Tuesday. End on the question the combination raises for her. No horoscope voice, no predictions about events, no 'the stars say'.",` : ''}
"invitationToBLN": "About 110 words. Do NOT pitch a program, a course, or a price. Tell her the one thing to do this week: start the 14 days, and put a note somewhere for day 14. Then remind her of the prediction and tell her to notice if it comes true, because that's how she'll know the pattern is real and not just a description she agreed with. Close by asking her to message Mariana on Instagram and say whether the type felt right and whether the prediction landed - say that it genuinely shapes what gets built next. Warm, direct, no hard sell."
}`;

  try {
    const [rawA, rawB] = await Promise.all([
      callAnthropic(ANTHROPIC_API_KEY, WRITING_MODEL, 1700, promptA),
      callAnthropic(ANTHROPIC_API_KEY, WRITING_MODEL, 1900, promptB)
    ]);

    const parsed = { ...extractJson(rawA), ...extractJson(rawB) };

    const requiredKeys = [
      'gettingToKnowYourType', 'youAsMother', 'yourInnerWorld', 'yourBlindSpots',
      'whereYouGetStuck', 'yourGrowthEdge', 'questionsToSitWith', 'invitationToBLN'
    ];
    const missingKeys = requiredKeys.filter(k => !parsed[k]);
    if (missingKeys.length > 0) {
      console.error('Missing keys:', missingKeys);
      return res.status(500).json({ error: 'Incomplete report', missingKeys });
    }



    return res.status(200).json(parsed);

  } catch (err) {
    console.error('Writing pass failed:', err.message);
    return res.status(500).json({ error: 'Function error', message: err.message });
  }
}

export const config = {
  maxDuration: 60
};
