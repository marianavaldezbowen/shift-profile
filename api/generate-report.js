export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'No API key configured' });
  }

  const { typeNum, typeName, subtype, sortedScores, userName } = req.body;
  if (!typeNum || !sortedScores || !userName) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const topScore = sortedScores[0].score;
  const tiedTypes = sortedScores.filter(s => s.score === topScore);
  const isTied = tiedTypes.length > 1;
  const secondType = sortedScores[1];
  const thirdType = sortedScores[2];

  const TYPE_CONTEXT = {
    1: "fears being corrupt or wrong, desires integrity, built identity around responsibility and doing things right",
    2: "fears being unloved, desires to feel needed, built identity around helping and being indispensable to others",
    3: "fears being worthless without achievement, desires to feel valuable, built identity around success and how she looks to the world",
    4: "fears having no identity, desires authentic self-expression, built identity around being unique and emotionally deep",
    5: "fears being overwhelmed or depleted, desires competence, built identity around mastery and independent thinking",
    6: "fears having no support or guidance, desires security, built identity around loyalty, preparedness, and being trustworthy",
    7: "fears being trapped in pain or limitation, desires joy and freedom, built identity around excitement and keeping life expansive",
    8: "fears being controlled or betrayed, desires autonomy, built identity around strength, directness, and protecting what matters",
    9: "fears conflict and disconnection, desires inner peace, built identity around harmony and making space for everyone else"
  };

  const TYPE_NAMES = {
    1: "The Reformer", 2: "The Helper", 3: "The Achiever", 4: "The Individualist",
    5: "The Investigator", 6: "The Loyalist", 7: "The Enthusiast", 8: "The Challenger", 9: "The Peacemaker"
  };

  const WINGS = {
    1: [9, 2], 2: [1, 3], 3: [2, 4], 4: [3, 5], 5: [4, 6],
    6: [5, 7], 7: [6, 8], 8: [7, 9], 9: [8, 1]
  };

  const SUBTYPE_CONTEXT = {
    "Self-Preservation": "channels energy toward personal safety, physical comfort, health, and having enough resources",
    "Social": "channels energy toward her place in groups — belonging, contributing, being valued by community",
    "One-on-One": "channels energy toward deep, intense one-on-one connection — drawn to people and experiences that feel transformative"
  };

  const TYPE_MOTHERHOOD_LENS = {
    1: "becoming a mother activates the inner critic in overdrive — there are suddenly infinite ways to do it wrong",
    2: "becoming a mother can feel like the role she was always meant for — and also the place where her own needs completely disappear",
    3: "becoming a mother disrupts the achievement engine — there's no metric for 'good enough mom,' no promotion, no applause",
    4: "becoming a mother brings an identity earthquake — who am I if I'm now 'just mom'?",
    5: "becoming a mother is an assault on the boundaries and solitude that made her feel safe",
    6: "becoming a mother amplifies every anxiety — the stakes are so much higher now",
    7: "becoming a mother means accepting limitation and repetition — the exact opposite of what her type craves",
    8: "becoming a mother cracks open a vulnerability she has spent her whole life protecting",
    9: "becoming a mother can cause her to lose herself completely — her needs and voice quietly slip to the bottom"
  };

  const secondName = TYPE_NAMES[secondType.type] || "";
  const thirdName = TYPE_NAMES[thirdType.type] || "";
  const tieNote = isTied
    ? `IMPORTANT: ${userName} tied between ${tiedTypes.map(t => `Type ${t.type}`).join(' and ')} — acknowledge this dual pull naturally.`
    : '';

  const trueWings = WINGS[typeNum] || [];
  const secondIsWing = trueWings.includes(secondType.type);
  const thirdIsWing = trueWings.includes(thirdType.type);
  const secondLabel = secondIsWing ? `Type ${secondType.type} wing (${secondName})` : `Type ${secondType.type} (${secondName}) secondary influence`;
  const thirdLabel = thirdIsWing ? `Type ${thirdType.type} wing (${thirdName})` : `Type ${thirdType.type} (${thirdName}) secondary influence`;

  const prompt = `You're writing a personalized Enneagram report for ${userName}, who completed The Shift — a program for mothers navigating post-motherhood identity transition.

TONE: Warm, direct, conversational — like a really smart friend who knows the Enneagram deeply. NOT clinical or formal. Write in second person. Speak directly to her.

MOTHERHOOD LENS: Every section written through the lens of this type as a mother in identity transition.

HER PROFILE:
- Primary type: Type ${typeNum} — ${typeName}
- Core pattern: ${TYPE_CONTEXT[typeNum]}
- In motherhood: ${TYPE_MOTHERHOOD_LENS[typeNum]}
- Subtype: ${subtype} — she ${SUBTYPE_CONTEXT[subtype]}
- Second highest: ${secondLabel} (${secondType.score}/30)
- Third highest: ${thirdLabel} (${thirdType.score}/30)
${tieNote}

WING RULE: Type ${typeNum}'s only true wings are Types ${trueWings.join(' and ')}. Never call non-adjacent types "wings."

Return ONLY a valid JSON object. No markdown, no backticks, no text outside the JSON:

{
  "whatIsTheEnneagram": "3 paragraphs separated by \\n\\n. Warm plain-language intro to what the Enneagram is — not academic. What it is and why it matters. Why it's different from other systems. A warm note that this isn't about boxing her in.",
  "gettingToKnowYourType": "4 paragraphs separated by \\n\\n. Deep dive on Type ${typeNum} — core fear, core desire, worldview, how this played out before motherhood. Specific and surprising. Write like you've known her for years.",
  "youAsMother": "4 paragraphs separated by \\n\\n. How becoming a mother specifically shook up Type ${typeNum}. What broke, what got activated, what stopped working. End with something that feels like relief.",
  "yourInnerWorld": "3 paragraphs separated by \\n\\n. How Type ${typeNum} thinks, feels, moves through daily life. What she notices, what she misses. How the ${subtype} subtype shapes this.",
  "yourBlindSpots": "3 paragraphs separated by \\n\\n. The things she genuinely cannot see about herself. Loving but unflinching. The 'oh god that's me' section.",
  "yourStrengths": "3 paragraphs separated by \\n\\n. Real earned advantages specific to Type ${typeNum} in this transition. Not generic — specific superpowers from her type.",
  "whereYouGetStuck": "3 paragraphs separated by \\n\\n. The specific loop for Type ${typeNum} in the motherhood identity shift. Precise — name the exact pattern. End making her feel seen not criticized.",
  "yourRelationships": "3 paragraphs separated by \\n\\n. How Type ${typeNum} shows up with partner, kids, friends, her own mother. What she gives easily, struggles to receive, needs but rarely asks for.",
  "yourGrowthEdge": "3 paragraphs separated by \\n\\n. What integration looks like for Type ${typeNum} as a mother. Real and practical. End with something genuinely hopeful.",
  "questionsToSitWith": "1. [question]\\n2. [question]\\n3. [question]\\n4. [question]\\n5. [question]\\n6. [question]",
  "invitationToBLN": "3 sentences max. Warm and direct. Acknowledge what she just read. Tell her everything comes alive in The Shift's 5 videos. Mention Your Best Life Now at marianavaldez.com/your-best-life-now for deeper work, with a discount waiting at the end of The Shift."
}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 3000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json({ error: 'Anthropic error', details: data });
    }

    const rawText = data.content[0].text.trim();
    const firstBrace = rawText.indexOf('{');
    const lastBrace = rawText.lastIndexOf('}');

    if (firstBrace === -1 || lastBrace === -1) {
      return res.status(500).json({ error: 'No JSON found', raw: rawText.substring(0, 200) });
    }

    const jsonStr = rawText.substring(firstBrace, lastBrace + 1);
    const parsed = JSON.parse(jsonStr);
    return res.status(200).json(parsed);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export const config = {
  maxDuration: 60
};
