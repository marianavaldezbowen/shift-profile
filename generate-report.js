// Netlify serverless function — proxies Anthropic API securely
// Your API key lives here on the server, never exposed to the browser

exports.handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: 'API key not configured' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { typeNum, typeName, subtype, sortedScores, userName } = body;

  const prompt = `You are writing a personalized Enneagram report for ${userName}, a woman who has just completed The Shift — a self-discovery program designed for mothers navigating a post-motherhood identity transition.

Her results:
- Dominant Enneagram Type: Type ${typeNum} — ${typeName}
- Dominant Subtype: ${subtype}
- Top 3 types by score: ${sortedScores.slice(0, 3).map(s => `Type ${s.type} (${s.score}/30)`).join(', ')}

Write her deeply personalized Shift Profile report. Use warm, direct, second-person language. Sound like a wise, deeply knowledgeable guide who understands both the Enneagram at an expert level AND the specific lived experience of women navigating post-motherhood identity transition. Be SPECIFIC to this exact type and subtype combination — not generic. Make her feel like this was written only for her.

Write a JSON object with these 6 keys. Each value: 2 paragraphs, warm second-person, deeply specific to Type ${typeNum} ${subtype} subtype, emotionally resonant:

{
  "typeLens": "How Type ${typeNum} sees the world — core fear, core desire, how this shaped her career identity before motherhood",
  "howYouExperiencedTheShift": "Exactly how a Type ${typeNum} ${subtype} experienced the post-motherhood identity shift — what broke, what confused her, what felt like betrayal",
  "subtypeLayer": "What the ${subtype} subtype means for Type ${typeNum} specifically — how it shapes her patterns in work and this transition",
  "whereYoullGetStuck": "The specific predictable sticking point for Type ${typeNum} in this transition — name it clearly and compassionately",
  "breakthroughPath": "The specific internal shift that unlocks movement for Type ${typeNum} — the counterintuitive move unique to this type",
  "invitationToBLN": "Warm bridge to Your Best Life Now — mention Module 2 goes deep on this type's Enneagram patterns"
}

Return ONLY valid JSON. No markdown, no preamble.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 1200,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Anthropic API error:', data);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'API error', details: data })
      };
    }

    const text = data.content[0].text.trim();
    const clean = text.replace(/```json|```/g, '').trim();

    // Validate it's parseable JSON before returning
    JSON.parse(clean);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: clean
    };

  } catch (err) {
    console.error('Function error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
