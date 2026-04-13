// Netlify serverless function — proxies Anthropic API securely
// Your API key lives here on the server, never exposed to the browser

exports.handler = async (event) => {
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

  const prompt = `You are writing a personalized Enneagram report for ${userName}, a woman who just completed The Shift — a self-discovery program for mothers navigating post-motherhood identity transition.

Her results:
- Enneagram Type: ${typeNum} — ${typeName}
- Subtype: ${subtype}
- Top 3 scores: ${sortedScores.slice(0, 3).map(s => "Type " + s.type + " (" + s.score + "/30)").join(', ')}

Write a deeply personalized report. Be specific to Type ${typeNum} ${subtype} — not generic. Warm, second-person, expert tone. Make her feel seen.

Respond with ONLY this JSON object — no markdown, no explanation:

{
  "typeLens": "2 paragraphs. How Type ${typeNum} sees the world — their core fear, core desire, and how this shaped their career identity before motherhood. Be specific and make her feel completely seen.",
  "howYouExperiencedTheShift": "2 paragraphs. Exactly how a Type ${typeNum} ${subtype} experienced the post-motherhood shift — what broke, what confused her, what felt like betrayal. Highly specific to this type-subtype combo.",
  "subtypeLayer": "1 paragraph. What the ${subtype} subtype means for Type ${typeNum} specifically — how it shapes her patterns in work and this transition.",
  "whereYoullGetStuck": "2 paragraphs. The specific predictable sticking point for Type ${typeNum} in this transition. Name it clearly and compassionately — the thing no one else has said.",
  "breakthroughPath": "2 paragraphs. The specific internal shift that unlocks movement for Type ${typeNum}. The counterintuitive move unique to this type. End with something that feels like a gift.",
  "invitationToBLN": "1 paragraph. Warm bridge to Your Best Life Now — mention Module 2 goes deep on this type's Enneagram patterns. Feel inevitable, not salesy."
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
        model: 'claude-sonnet-4-5',
        max_tokens: 1000,
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
