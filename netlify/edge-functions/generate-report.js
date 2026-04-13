export default async (request, context) => {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
  if (!ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ error: 'No API key' }), { status: 500 });
  }

  let body;
  try { body = await request.json(); }
  catch { return new Response(JSON.stringify({ error: 'Bad JSON' }), { status: 400 }); }

  const { typeNum, typeName, subtype, sortedScores, userName } = body;

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

  const SUBTYPE_CONTEXT = {
    "Self-Preservation": "directs energy toward personal safety, comfort, and resources",
    "Social": "directs energy toward belonging, community, and group contribution",
    "One-on-One": "directs energy toward intense one-on-one connections and transformation"
  };

  const secondName = TYPE_NAMES[secondType.type] || "";
  const thirdName = TYPE_NAMES[thirdType.type] || "";
  const tieNote = isTied ? `NOTE: ${userName} has tied between ${tiedTypes.map(t=>`Type ${t.type}`).join(' and ')} — acknowledge this dual pull in typeLens.` : '';

  const prompt = `Write a personalized Enneagram Shift Profile report for ${userName}.

Primary: Type ${typeNum} — ${typeName}. This type ${TYPE_CONTEXT[typeNum]}.
Subtype: ${subtype} — ${SUBTYPE_CONTEXT[subtype]}.
2nd: Type ${secondType.type} — ${secondName} (${secondType.score}/30). ${TYPE_CONTEXT[secondType.type]}.
3rd: Type ${thirdType.type} — ${thirdName} (${thirdType.score}/30). ${TYPE_CONTEXT[thirdType.type]}.
${tieNote}

Context: ${userName} just completed The Shift, a program for mothers in post-motherhood identity transition.

Return ONLY this JSON (no markdown):
{"typeLens":"2 paragraphs: how Type ${typeNum} sees the world, their fear/desire, how this shaped career identity before motherhood","howYouExperiencedTheShift":"2 paragraphs: how Type ${typeNum} ${subtype} specifically experienced the post-motherhood shift — what broke, confused her, felt like betrayal","subtypeLayer":"2 paragraphs: what ${subtype} subtype means for Type ${typeNum} — how it makes her different from other ${typeNum}s","typeBlend":"2 paragraphs: first para on Type ${secondType.type} influence, second para on Type ${thirdType.type} influence — how each colors her experience","yourStrengths":"2 paragraphs: specific gifts Type ${typeNum} brings to this transition — earned advantages that make her proud","whereYoullGetStuck":"2 paragraphs: the specific loop for Type ${typeNum} — name it clearly and compassionately","breakthroughPath":"2 paragraphs: the specific internal shift that unlocks Type ${typeNum} — end with something that feels like a gift","invitationToBLN":"2 paragraphs: warm bridge to Your Best Life Now, mention Module 2 goes deep on this type's patterns"}`;

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
      return new Response(JSON.stringify({ error: 'API error', details: data }), { status: 500 });
    }

    const text = data.content[0].text.trim();
    const clean = text.replace(/```json|```/g, '').trim();
    JSON.parse(clean); // validate

    return new Response(clean, {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};

export const config = { path: '/.netlify/functions/generate-report' };
