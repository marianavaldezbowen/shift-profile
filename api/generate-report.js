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

  const secondType = sortedScores[1];
  const thirdType = sortedScores[2];

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

  const TYPE_NAMES = {
    1: "The Reformer", 2: "The Helper", 3: "The Achiever", 4: "The Individualist",
    5: "The Investigator", 6: "The Loyalist", 7: "The Enthusiast", 8: "The Challenger", 9: "The Peacemaker"
  };

  const WINGS = {
    1: [9, 2], 2: [1, 3], 3: [2, 4], 4: [3, 5], 5: [4, 6],
    6: [5, 7], 7: [6, 8], 8: [7, 9], 9: [8, 1]
  };

  const trueWings = WINGS[typeNum] || [];
  const secondIsWing = trueWings.includes(secondType.type);
  const thirdIsWing = trueWings.includes(thirdType.type);
  const secondLabel = secondIsWing ? `Type ${secondType.type} wing` : `Type ${secondType.type} secondary influence`;
  const thirdLabel = thirdIsWing ? `Type ${thirdType.type} wing` : `Type ${thirdType.type} secondary influence`;

  const prompt = `Write a personalized Enneagram Shift Profile report for ${userName}.

Type ${typeNum} — ${typeName}. ${TYPE_CONTEXT[typeNum]}.
Subtype: ${subtype}.
Second highest: ${secondLabel} (${TYPE_NAMES[secondType.type]}, score ${secondType.score}/30).
Third highest: ${thirdLabel} (${TYPE_NAMES[thirdType.type]}, score ${thirdType.score}/30).

Context: ${userName} completed The Shift, a program for mothers in post-motherhood identity transition.
Tone: Warm, direct, conversational — like a smart friend. Second person. NOT clinical.
Every section written through the lens of motherhood and identity transition.

Return ONLY a JSON object with these exact keys. No markdown, no backticks, nothing outside the JSON braces:

{"whatIsTheEnneagram":"3 short paragraphs about what the Enneagram is, why it matters, how it differs from other systems. Warm and plain-language.","gettingToKnowYourType":"4 paragraphs deep-diving Type ${typeNum} — core fear, core desire, worldview, how this shaped identity before motherhood.","youAsMother":"4 paragraphs on how becoming a mother specifically disrupted Type ${typeNum}. What broke, what got activated. End with relief.","yourInnerWorld":"3 paragraphs on how Type ${typeNum} with ${subtype} subtype thinks, feels, moves through daily life.","yourBlindSpots":"3 paragraphs on what Type ${typeNum} cannot see about herself. Loving but honest.","yourStrengths":"3 paragraphs on real specific strengths of Type ${typeNum} in this transition.","whereYouGetStuck":"3 paragraphs on the specific loop for Type ${typeNum} in this identity shift.","yourRelationships":"3 paragraphs on how Type ${typeNum} shows up with partner, kids, friends, her own mother.","yourGrowthEdge":"3 paragraphs on what integration looks like for Type ${typeNum} as a mother. End hopefully.","questionsToSitWith":"1. [question]\n2. [question]\n3. [question]\n4. [question]\n5. [question]\n6. [question]","invitationToBLN":"2-3 warm sentences. Acknowledge her work. Point to The Shift videos and Your Best Life Now at marianavaldez.com/your-best-life-now."}`;

  try {
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2500,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await anthropicRes.json();

    if (!anthropicRes.ok) {
      return res.status(500).json({ error: 'Anthropic API error', details: data });
    }

    if (!data.content || !data.content[0] || !data.content[0].text) {
      return res.status(500).json({ error: 'Empty response from Anthropic', data });
    }

    const rawText = data.content[0].text.trim();
    const firstBrace = rawText.indexOf('{');
    const lastBrace = rawText.lastIndexOf('}');

    if (firstBrace === -1 || lastBrace === -1) {
      return res.status(500).json({ error: 'No JSON braces found', preview: rawText.substring(0, 300) });
    }

    const jsonStr = rawText.substring(firstBrace, lastBrace + 1);

    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (parseErr) {
      return res.status(500).json({ error: 'JSON parse failed', parseError: parseErr.message, preview: jsonStr.substring(0, 300) });
    }

    return res.status(200).json(parsed);

  } catch (err) {
    return res.status(500).json({ error: 'Function error', message: err.message });
  }
}

export const config = {
  maxDuration: 60
};
