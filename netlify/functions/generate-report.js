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

Key Enneagram context to draw on:
- Type 1 (Reformer): Core fear of being bad/corrupt. Core desire to be good and have integrity. In transition: struggles with resentment when their high standards feel impossible to meet in both roles.
- Type 2 (Helper): Core fear of being unloved/unwanted. Core desire to feel loved. In transition: loses herself completely in motherhood role, forgets she has needs.
- Type 3 (Achiever): Core fear of being worthless without achievement. Core desire to feel valuable. In transition: discovers achievement alone no longer fills the void — meaning becomes the new hunger.
- Type 4 (Individualist): Core fear of having no identity/significance. Core desire to be authentically themselves. In transition: motherhood either feels like it erases their uniqueness or paradoxically deepens it.
- Type 5 (Investigator): Core fear of being overwhelmed/incapable. Core desire to be competent and self-sufficient. In transition: withdraws to process, struggles with the emotional overwhelm of new identity.
- Type 6 (Loyalist): Core fear of having no support/guidance. Core desire to feel safe and supported. In transition: anxiety spikes when the reliable old path disappears and the new one isn't clear.
- Type 7 (Enthusiast): Core fear of being trapped in pain. Core desire to be satisfied and content. In transition: reframes everything as exciting possibility but struggles to sit with the grief of the old life.
- Type 8 (Challenger): Core fear of being controlled/harmed. Core desire to protect themselves and others. In transition: struggles with vulnerability — motherhood cracks them open in ways they didn't consent to.
- Type 9 (Peacemaker): Core fear of loss of connection and fragmentation. Core desire to have inner stability and peace. In transition: disappears into everyone else's needs, loses their own voice entirely.

Subtype context:
- Self-Preservation: Energy focused on safety, health, comfort, personal resources
- Social: Energy focused on belonging, status in groups, community contribution  
- One-on-One (Sexual): Energy focused on intense one-on-one connection, transformation, merging

Structure your response as a JSON object with these exact keys. Each value must be rich, specific, emotionally resonant prose — minimum 150 words per section:

{
  "typeLens": "3 paragraphs. Describe how Type ${typeNum} experiences the world at their core — their motivation, their fear, the story they've been living by. Then connect this specifically to how this type experienced their career identity BEFORE motherhood. Make her feel completely seen.",
  
  "howYouExperiencedTheShift": "3 paragraphs. Describe exactly how a Type ${typeNum} with ${subtype} subtype experiences the post-motherhood identity transition. What specifically shifted for this type? What did they lose? What confused them? What felt like betrayal? Be highly specific to this exact type-subtype combination — this should feel like you're describing HER life.",
  
  "subtypeLayer": "2 paragraphs. Explain the ${subtype} subtype and how it shapes this specific Type ${typeNum}'s patterns. How does it show up in her work, relationships, and this transition? What does it explain about the specific way her type shows up that might surprise her?",
  
  "whereYoullGetStuck": "3 paragraphs. Name the exact, specific sticking point for Type ${typeNum} in this transition — the loop, the pattern, the thing she'll keep doing even when she knows better. Be compassionately honest. Name it clearly. This should feel like someone finally said the thing no one else has said.",
  
  "breakthroughPath": "3 paragraphs. Describe the specific internal shift that unlocks movement for Type ${typeNum}. What does this type need to practice, release, or lean into? What is the counterintuitive move that other types don't need but this type does? Make it feel like a genuine insight, not generic advice. End with something that feels like a gift.",
  
  "invitationToBLN": "2 paragraphs. Warmly and naturally bridge to 'Your Best Life Now' — frame it as the natural next step for exactly this type. Mention that Module 2 goes deep into the Enneagram work, including the specific subconscious patterns that drive this type. Make it feel inevitable, not salesy."
}

Return ONLY the JSON object. No preamble, no markdown code blocks, no explanation outside the JSON.`;

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
        max_tokens: 2500,
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
