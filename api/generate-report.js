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
    1: "fears being corrupt or wrong, desires integrity, built identity around responsibility and ethics",
    2: "fears being unloved, desires to feel needed, built identity around helping and being indispensable",
    3: "fears being worthless without achievement, desires to feel valuable, built identity around success and recognition",
    4: "fears having no identity, desires authentic self-expression, built identity around being unique and emotionally deep",
    5: "fears being overwhelmed, desires competence, built identity around mastery and independent thinking",
    6: "fears having no support, desires security, built identity around loyalty and preparedness",
    7: "fears being trapped in pain, desires joy, built identity around excitement and possibility",
    8: "fears being controlled, desires autonomy, built identity around strength and protecting others",
    9: "fears conflict, desires inner peace, built identity around harmony and making space for everyone"
  };

  const TYPE_NAMES = {
    1:"The Reformer", 2:"The Helper", 3:"The Achiever", 4:"The Individualist",
    5:"The Investigator", 6:"The Loyalist", 7:"The Enthusiast", 8:"The Challenger", 9:"The Peacemaker"
  };

  // True wings — only adjacent types on the Enneagram circle
  const WINGS = {
    1: [9, 2], 2: [1, 3], 3: [2, 4], 4: [3, 5], 5: [4, 6],
    6: [5, 7], 7: [6, 8], 8: [7, 9], 9: [8, 1]
  };

  const SUBTYPE_CONTEXT = {
    "Self-Preservation": "directs energy toward personal safety, comfort, and resources",
    "Social": "directs energy toward belonging, community, and group contribution",
    "One-on-One": "directs energy toward intense one-on-one connections and transformation"
  };

  const secondName = TYPE_NAMES[secondType.type] || "";
  const thirdName = TYPE_NAMES[thirdType.type] || "";
  const tieNote = isTied
    ? `NOTE: ${userName} tied between ${tiedTypes.map(t=>`Type ${t.type}`).join(' and ')} — acknowledge this dual pull.`
    : '';

  // Determine if 2nd/3rd types are true wings or just secondary influences
  const trueWings = WINGS[typeNum] || [];
  const secondIsWing = trueWings.includes(secondType.type);
  const thirdIsWing = trueWings.includes(thirdType.type);

  const secondLabel = secondIsWing ? `Type ${secondType.type} wing (${secondName})` : `Type ${secondType.type} (${secondName}) secondary influence`;
  const thirdLabel = thirdIsWing ? `Type ${thirdType.type} wing (${thirdName})` : `Type ${thirdType.type} (${thirdName}) secondary influence`;

  const prompt = `Write a personalized Enneagram Shift Profile report for ${userName}.

Primary: Type ${typeNum} — ${typeName}. This type ${TYPE_CONTEXT[typeNum]}.
Subtype: ${subtype} — ${SUBTYPE_CONTEXT[subtype]}.
Second highest score: ${secondLabel} (${secondType.score}/30). ${TYPE_CONTEXT[secondType.type]}.
Third highest score: ${thirdLabel} (${thirdType.score}/30). ${TYPE_CONTEXT[thirdType.type]}.
${tieNote}

IMPORTANT ENNEAGRAM ACCURACY NOTE: Wings are ONLY the adjacent types on the Enneagram circle. Type ${typeNum}'s true wings are Types ${trueWings.join(' and ')}. ${secondIsWing ? `Type ${secondType.type} IS a true wing.` : `Type ${secondType.type} is NOT a wing — it is a secondary scoring influence. Never call it a wing.`} ${thirdIsWing ? `Type ${thirdType.type} IS a true wing.` : `Type ${thirdType.type} is NOT a wing — it is a secondary scoring influence. Never call it a wing.`} Use the words "influence," "energy," or "pattern" instead of "wing" when referring to non-adjacent types.

Context: ${userName} completed The Shift, a program for mothers in post-motherhood identity transition.

Return ONLY a JSON object with exactly these 8 keys. No markdown, no backticks, no explanation before or after:
{
  "typeLens": "2 paragraphs about how Type ${typeNum} sees the world and shaped career identity before motherhood",
  "howYouExperiencedTheShift": "2 paragraphs about how Type ${typeNum} ${subtype} experienced the post-motherhood shift",
  "subtypeLayer": "2 paragraphs about what ${subtype} subtype means for Type ${typeNum} specifically",
  "typeBlend": "2 paragraphs: first about the ${secondLabel} influence on her transition, second about the ${thirdLabel} influence. Never use the word 'wing' unless the type is truly adjacent.",
  "yourStrengths": "2 paragraphs about specific gifts Type ${typeNum} brings to this transition",
  "whereYoullGetStuck": "2 paragraphs about the specific loop for Type ${typeNum}",
  "breakthroughPath": "2 paragraphs about the internal shift that unlocks Type ${typeNum} — end with something that feels like a gift",
  "invitationToBLN": "MAXIMUM 3 sentences total. Warm, direct, specific to this type. One sentence on what she's ready for, one sentence on what Your Best Life Now offers her specifically (mention Module 2 and Enneagram work), one sentence invitation. No more than 3 sentences."
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
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json({ error: 'Anthropic error', details: data });
    }

    const rawText = data.content[0].text.trim();

    // Robust JSON extraction
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
  maxDuration: 30
};
