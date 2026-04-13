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

  const { typeNum, typeName, subtype, userName } = body;

  const TYPE_CONTEXT = {
    1: "fears being corrupt/wrong, desires integrity, tied identity to being correct and responsible",
    2: "fears being unloved, desires to feel needed, tied identity to helping and being indispensable",
    3: "fears being worthless, desires to feel valuable, tied identity to achievement and success",
    4: "fears having no identity, desires authenticity, tied identity to being unique and emotionally deep",
    5: "fears being overwhelmed, desires competence, tied identity to knowledge and self-sufficiency",
    6: "fears having no support, desires security, tied identity to loyalty and preparedness",
    7: "fears being trapped in pain, desires satisfaction, tied identity to possibilities and excitement",
    8: "fears being controlled, desires autonomy, tied identity to strength and protecting others",
    9: "fears conflict/disconnection, desires peace, tied identity to harmony and keeping everyone happy"
  };

  const SUBTYPE_CONTEXT = {
    "Self-Preservation": "focuses energy on personal safety, comfort, health, and resources",
    "Social": "focuses energy on belonging, community, and their place in groups",
    "One-on-One": "focuses energy on intense one-on-one connections and transformation"
  };

  const typeDesc = TYPE_CONTEXT[typeNum] || "has a unique way of experiencing the world";
  const subtypeDesc = SUBTYPE_CONTEXT[subtype] || "has a distinctive way of directing their energy";

  const prompt = `Write a personalized Enneagram report for ${userName}.

Type: ${typeNum} — ${typeName}. This type ${typeDesc}.
Subtype: ${subtype} — this person ${subtypeDesc}.

Write ONLY a JSON object with these 6 keys. Each value is 2-3 sentences of warm, specific, second-person prose:

{"typeLens":"How this type sees the world and how it shaped her career identity before motherhood","howYouExperiencedTheShift":"How this exact type+subtype combo experienced the post-motherhood identity shift","subtypeLayer":"How the ${subtype} subtype specifically shapes this person's patterns","whereYoullGetStuck":"The one specific sticking point for this type in transition — name it clearly","breakthroughPath":"The specific internal shift that unlocks movement for this type","invitationToBLN":"Warm 2-sentence bridge to Your Best Life Now program, mentioning Module 2"}

Return ONLY the JSON. No markdown.`;

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
        max_tokens: 800,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return { statusCode: 500, body: JSON.stringify({ error: 'API error', details: data }) };
    }

    const text = data.content[0].text.trim();
    const clean = text.replace(/```json|```/g, '').trim();
    JSON.parse(clean); // validate

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: clean
    };

  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
