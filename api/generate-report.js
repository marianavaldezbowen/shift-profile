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
    "Self-Preservation": "channels energy toward personal safety, physical comfort, health, and having enough resources — needs her foundations to feel stable before she can give to anything else",
    "Social": "channels energy toward her place in groups — belonging, contributing, being valued by community — deeply aware of social dynamics and motivated by being part of something meaningful",
    "One-on-One": "channels energy toward deep, intense one-on-one connection — drawn to people and experiences that feel electric, transformative, and completely real"
  };

  const TYPE_MOTHERHOOD_LENS = {
    1: "becoming a mother often activates the inner critic in overdrive — there are suddenly infinite ways to do it wrong, and the stakes feel impossibly high",
    2: "becoming a mother can feel like the role she was always meant for — and also the place where her own needs completely disappear",
    3: "becoming a mother disrupts the achievement engine — there's no metric for 'good enough mom,' no promotion, no applause, and that is genuinely destabilizing",
    4: "becoming a mother brings an identity earthquake — who am I if I'm now 'just mom'? The longing for depth can intensify even as daily life becomes more mundane",
    5: "becoming a mother is an assault on the boundaries and solitude that made her feel safe — suddenly her time, energy, and inner world are never fully her own",
    6: "becoming a mother amplifies every anxiety — the stakes are so much higher now, and the what-ifs multiply in ways that can feel paralyzing",
    7: "becoming a mother means accepting limitation, repetition, and being needed in ways that don't feel exciting — the exact opposite of what her type craves",
    8: "becoming a mother cracks open a vulnerability she has spent her whole life protecting — suddenly there is someone she cannot protect from everything, and that is terrifying",
    9: "becoming a mother can cause her to lose herself completely — her needs, her voice, her desires all quietly slip to the very bottom of the list"
  };

  const secondName = TYPE_NAMES[secondType.type] || "";
  const thirdName = TYPE_NAMES[thirdType.type] || "";
  const tieNote = isTied
    ? `IMPORTANT: ${userName} tied between ${tiedTypes.map(t => `Type ${t.type}`).join(' and ')} — acknowledge this dual pull naturally in the report.`
    : '';

  const trueWings = WINGS[typeNum] || [];
  const secondIsWing = trueWings.includes(secondType.type);
  const thirdIsWing = trueWings.includes(thirdType.type);
  const secondLabel = secondIsWing
    ? `Type ${secondType.type} wing (${secondName})`
    : `Type ${secondType.type} (${secondName}) secondary influence`;
  const thirdLabel = thirdIsWing
    ? `Type ${thirdType.type} wing (${thirdName})`
    : `Type ${thirdType.type} (${thirdName}) secondary influence`;

  const prompt = `You're writing a personalized Enneagram report for ${userName}, who just completed The Shift — a program for mothers navigating post-motherhood identity transition.

TONE: Warm, direct, and conversational — like a really smart friend who knows the Enneagram deeply. NOT clinical, NOT formal, NOT corporate. Write in second person ("you"), speak directly to her, use real language. Think: smart, warm, a little edgy, deeply knowing. Avoid phrases like "this report," "as a Type X," "it is important to note." Just talk to her like you know her.

MOTHERHOOD LENS: Every section should be written through the lens of what it means to be THIS type as a mother navigating identity transition. Don't treat motherhood as a side note — it's the entire context.

HER PROFILE:
- Primary type: Type ${typeNum} — ${typeName}
- Core pattern: ${TYPE_CONTEXT[typeNum]}
- In motherhood specifically: ${TYPE_MOTHERHOOD_LENS[typeNum]}
- Subtype: ${subtype} — she ${SUBTYPE_CONTEXT[subtype]}
- Second highest: ${secondLabel} (${secondType.score}/30) — ${TYPE_CONTEXT[secondType.type]}
- Third highest: ${thirdLabel} (${thirdType.score}/30) — ${TYPE_CONTEXT[thirdType.type]}
${tieNote}

WING ACCURACY: Type ${typeNum}'s only true wings are Types ${trueWings.join(' and ')}. ${secondIsWing ? `Type ${secondType.type} IS a true wing.` : `Type ${secondType.type} is NOT a wing — call it an "influence" or "energy," never a wing.`} ${thirdIsWing ? `Type ${thirdType.type} IS a true wing.` : `Type ${thirdType.type} is NOT a wing — never call it a wing.`}

Write EXACTLY this JSON structure. No markdown, no backticks, no text before or after. Just the raw JSON object:

{
  "whatIsTheEnneagram": "3 SHORT paragraphs. Warm, plain-language intro to what the Enneagram actually is — not academic, just real. Para 1: what it is and why it matters (focus on motivation, not behavior). Para 2: why it's different from other personality systems — it explains the WHY behind what you do, not just the what. Para 3: a warm note that this isn't about putting her in a box — it's about finally having a name for something she's always felt.",

  "gettingToKnowYourType": "4 paragraphs. This is the 'they really GET me' section. Go deep on Type ${typeNum}'s core fear, core desire, the worldview they built, and how that played out BEFORE motherhood — career, relationships, identity. Be specific and surprising. Name the things she's never heard put into words before. Write like you've known her for years.",

  "youAsMother": "4 paragraphs. This is the heart of the report. How did becoming a mother specifically shake up Type ${typeNum}? What broke, what got activated, what stopped working? What does the identity crisis actually FEEL like for this type? What does she tell herself vs. what's actually happening underneath? End with something that feels like relief — naming it takes away some of its power.",

  "yourInnerWorld": "3 paragraphs. How does Type ${typeNum} think, feel, and move through the world on a daily basis? What's the internal weather like? What does she notice, what does she miss? How does the ${subtype} subtype change or intensify this? Make it feel like a window into herself she didn't know existed.",

  "yourBlindSpots": "3 paragraphs. Name the things she genuinely can't see about herself — the patterns that are completely obvious to everyone else but invisible to her. Be loving but unflinching. This is the section where she goes 'oh god, that's me.' Don't soften it too much — the recognition IS the gift.",

  "yourStrengths": "3 paragraphs. What does Type ${typeNum} genuinely bring to this transition that is an actual superpower? Not generic positivity — real, earned advantages that come specifically from her type. Include how these strengths show up in motherhood and why they matter right now.",

  "whereYouGetStuck": "3 paragraphs. The specific loop for Type ${typeNum} in the context of the motherhood identity shift. Be precise. Name the exact pattern, what triggers it, what it looks like from the inside, and why it keeps recurring. End with something that makes her feel seen rather than criticized.",

  "yourRelationships": "3 paragraphs. How does Type ${typeNum} show up in her closest relationships — partner, kids, friends, mother? What does she give that feels natural? What does she struggle to receive? How has motherhood shifted the relational dynamics for her specific type? What does she need from others that she rarely asks for?",

  "yourGrowthEdge": "3 paragraphs. What does integration actually look like for Type ${typeNum} as a mother? Not abstract Enneagram theory — real, practical, what does she need to practice, what does she need to let go of, what does she need to stop doing? Be specific. End with something that feels genuinely hopeful and possible.",

  "questionsToSitWith": "6 reflection questions, each on its own line, numbered 1-6. These should be genuinely probing, type-specific, motherhood-focused questions that she could journal on for an hour. Not surface-level. The kind of questions that make her put down the paper and stare out the window. Format: just the numbered questions, one per line.",

  "invitationToBLN": "MAXIMUM 3 sentences. Warm, direct, zero hype. Sentence 1: something that lands — acknowledging what she just read and what it means that she's here doing this work. Sentence 2: let her know that everything in this report comes alive inside The Shift's 5 videos, and that's where the real movement happens. Sentence 3: if she's ready to go even deeper — working through her type fully and dismantling the patterns underneath — Your Best Life Now at marianavaldez.com/your-best-life-now was built exactly for this, and a special discount will be waiting for her at the end of The Shift."
}`;

  // Set up streaming response
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        stream: true,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!anthropicResponse.ok) {
      const errData = await anthropicResponse.json();
      res.write(`data: ${JSON.stringify({ error: 'Anthropic error', details: errData })}\n\n`);
      res.end();
      return;
    }

    // Stream the response chunks to the client
    let fullText = '';
    const reader = anthropicResponse.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
              fullText += parsed.delta.text;
              // Forward the delta to the client
              res.write(`data: ${JSON.stringify({ delta: parsed.delta.text })}\n\n`);
            } else if (parsed.type === 'message_stop') {
              // Parse and send the complete JSON
              const firstBrace = fullText.indexOf('{');
              const lastBrace = fullText.lastIndexOf('}');
              if (firstBrace !== -1 && lastBrace !== -1) {
                const jsonStr = fullText.substring(firstBrace, lastBrace + 1);
                const parsed = JSON.parse(jsonStr);
                res.write(`data: ${JSON.stringify({ complete: true, report: parsed })}\n\n`);
              } else {
                res.write(`data: ${JSON.stringify({ error: 'Could not parse JSON from response' })}\n\n`);
              }
            }
          } catch (e) {
            // Skip malformed SSE lines
          }
        }
      }
    }

    res.end();
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
}

export const config = {
  maxDuration: 60
};
