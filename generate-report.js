exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: 'No API key' }) };
  }

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, body: JSON.stringify({ error: 'Bad JSON' }) }; }

  const { typeNum, typeName, subtype, sortedScores, userName } = body;

  // ── Tie detection ──────────────────────────────────────────────────
  const topScore = sortedScores[0].score;
  const tiedTypes = sortedScores.filter(s => s.score === topScore);
  const isTied = tiedTypes.length > 1;

  // Second and third types (excluding primary)
  const secondType = sortedScores[1];
  const thirdType = sortedScores[2];

  const TYPE_CONTEXT = {
    1: "fears being corrupt or wrong, desires integrity above all, built identity around being responsible, ethical, and doing things the right way",
    2: "fears being unloved or unwanted, desires to feel genuinely needed, built identity around being the person everyone could count on",
    3: "fears being worthless without achievement, desires to feel valuable, built identity around success, recognition, and becoming someone impressive",
    4: "fears having no identity or significance, desires authentic self-expression, built identity around being unique, emotionally deep, and creatively alive",
    5: "fears being overwhelmed or incapable, desires competence and self-sufficiency, built identity around mastery, knowledge, and independent thinking",
    6: "fears having no support or guidance, desires security and trust, built identity around loyalty, preparedness, and being someone others could rely on",
    7: "fears being trapped in pain or limitation, desires joy and possibility, built identity around excitement, optimism, and always having options",
    8: "fears being controlled or betrayed, desires autonomy and strength, built identity around protecting others, taking charge, and never being seen as weak",
    9: "fears conflict and disconnection, desires inner peace, built identity around keeping the harmony, being agreeable, and making space for everyone else"
  };

  const TYPE_NAMES = {
    1:"The Reformer", 2:"The Helper", 3:"The Achiever", 4:"The Individualist",
    5:"The Investigator", 6:"The Loyalist", 7:"The Enthusiast", 8:"The Challenger", 9:"The Peacemaker"
  };

  const SUBTYPE_CONTEXT = {
    "Self-Preservation": "directs most energy toward personal safety, health, comfort, and securing resources — her home base must feel stable before she can give outward",
    "Social": "directs most energy toward belonging, community contribution, and her role in groups — she measures herself by how she fits and matters within her circles",
    "One-on-One": "directs most energy toward intense one-on-one connections and transformation — she craves depth, chemistry, and the feeling of being truly met by another person"
  };

  const typeDesc = TYPE_CONTEXT[typeNum] || "has a unique way of experiencing the world";
  const subtypeDesc = SUBTYPE_CONTEXT[subtype] || "has a distinctive way of directing her energy";
  const secondName = TYPE_NAMES[secondType.type] || "";
  const thirdName = TYPE_NAMES[thirdType.type] || "";
  const secondDesc = TYPE_CONTEXT[secondType.type] || "";
  const thirdDesc = TYPE_CONTEXT[thirdType.type] || "";

  const tieNote = isTied
    ? `IMPORTANT: ${userName} has a TIE between ${tiedTypes.map(t => `Type ${t.type}`).join(' and ')} — both scored ${topScore}/30. Acknowledge this in typeLens and howYouExperiencedTheShift: she genuinely operates from both types and may feel pulled between two very different core motivations. This is meaningful, not a flaw in the assessment.`
    : '';

  const prompt = `You are writing a deeply personalized Enneagram report for ${userName}, a woman who just completed The Shift — a self-discovery program for mothers navigating post-motherhood identity transition.

Primary Type: ${typeNum} — ${typeName}. This type ${typeDesc}.
Subtype: ${subtype} — this person ${subtypeDesc}.
Second highest type: Type ${secondType.type} — ${secondName} (score: ${secondType.score}/30). This type ${secondDesc}.
Third highest type: Type ${thirdType.type} — ${thirdName} (score: ${thirdType.score}/30). This type ${thirdDesc}.
${tieNote}

Write ONLY a JSON object with these 8 keys. Each value must be 2 rich paragraphs of warm, specific, second-person prose. Be deeply specific. Make her feel like this was written only for her.

{
  "typeLens": "2 paragraphs. How Type ${typeNum} experiences the world — their fear, desire, and the story they've been living. Connect to how this built their career identity before motherhood. If there's a tie, acknowledge both types and what it means to live with that dual pull.",

  "howYouExperiencedTheShift": "2 paragraphs. Exactly how a Type ${typeNum} ${subtype} experienced the post-motherhood shift — what broke, what confused her, what felt like betrayal. Be highly specific to this exact type-subtype combination.",

  "subtypeLayer": "2 paragraphs. What the ${subtype} subtype means for Type ${typeNum} specifically — how it shapes her patterns in work, relationships, and this transition in a way that makes her different from other ${typeNum}s.",

  "typeBlend": "2 paragraphs. Because ${userName} also scored high in Type ${secondType.type} (${secondName}) and Type ${thirdType.type} (${thirdName}), she carries those energies too. First paragraph: what the Type ${secondType.type} influence adds to her experience of this transition — how it colors or complicates her primary type's patterns. Second paragraph: what the Type ${thirdType.type} influence contributes — a strength, a blind spot, or a nuance that makes her blend uniquely hers. Make this feel like a revelation.",

  "yourStrengths": "2 paragraphs. The specific strengths and gifts Type ${typeNum} brings to this transition — what this type is uniquely equipped to do, see, or offer in this chapter that others can't. Frame as earned advantages. Make her feel genuinely proud.",

  "whereYoullGetStuck": "2 paragraphs. The specific predictable sticking point for Type ${typeNum} in this transition. Name the loop clearly and compassionately — the thing no one else has said out loud.",

  "breakthroughPath": "2 paragraphs. The specific internal shift that unlocks movement for Type ${typeNum}. The counterintuitive move unique to this type. End with something that feels like a genuine gift — a reframe that changes how she sees herself.",

  "invitationToBLN": "2 paragraphs. Warm, earned bridge to Your Best Life Now. Frame it as the natural next step for exactly this type and blend. Mention Module 2 goes deep on this type's Enneagram patterns. Feel inevitable and exciting, not like a pitch."
}

Return ONLY the JSON object. No markdown, no preamble, no explanation.`;

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
        max_tokens: 2500,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return { statusCode: 500, body: JSON.stringify({ error: 'API error', details: data }) };
    }

    const text = data.content[0].text.trim();
    const clean = text.replace(/```json|```/g, '').trim();
    JSON.parse(clean);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: clean
    };

  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
