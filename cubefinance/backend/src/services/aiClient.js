// ============================================================================
// Worker 4 (backend half) — AI service wrapper
// aiClient.js — thin wrapper around the Anthropic SDK with a graceful,
// rule-based fallback so the app is fully functional WITHOUT an API key.
// ============================================================================

const config = require('../config');

let Anthropic = null;
try {
  // Lazy require so the backend still boots if the dep isn't installed.
  Anthropic = require('@anthropic-ai/sdk');
} catch (_) {
  Anthropic = null;
}

const client =
  Anthropic && config.anthropicApiKey
    ? new Anthropic({ apiKey: config.anthropicApiKey })
    : null;

const isLive = () => Boolean(client);

/**
 * Build the system prompt that grounds the buddy in the user's live data.
 * Everything the AI knows about money comes from here — never a bank.
 */
function buildSystemPrompt(context) {
  const { profile, cubes, mainAccount } = context;
  const cubeLines = (cubes || [])
    .map(
      (c) =>
        `- ${c.name}: balance ${c.balance?.toLocaleString?.() ?? c.balance} ILS, ` +
        `monthly target ${c.monthlyContribution?.toLocaleString?.() ?? c.monthlyContribution} ILS (${c.percentage}%)`
    )
    .join('\n');

  return `You are "Cubey", the friendly financial buddy inside the CubeFinance app.

HARD RULES:
- You have NO access to any bank. Every number you reason about is provided below.
- Be warm, concise and practical. Talk like a supportive friend, not a bank.
- Amounts are in ILS (₪). Never invent balances not shown here.
- When the user asks "can I afford X", compare X against the relevant cube
  balance(s), state the impact clearly, and suggest which cube to spend from.
- If a cube would go negative or a balance is low, gently flag it.

USER PROFILE:
- Age: ${profile?.age ?? 'unknown'}
- Employed: ${profile?.employed ? 'yes' : 'no'}
- Monthly income: ${profile?.monthlyIncome?.toLocaleString?.() ?? profile?.monthlyIncome ?? 0} ILS
- Living situation: ${profile?.livesWithParents ? 'with parents' : 'independent'}

MAIN ACCOUNT POOL: ${mainAccount?.toLocaleString?.() ?? mainAccount ?? 0} ILS

CURRENT CUBES:
${cubeLines || '(no cubes yet — user has not completed onboarding)'}
`;
}

/**
 * Stream a chat completion. Calls onDelta(textChunk) for each token chunk.
 * Falls back to a deterministic, data-aware reply if no API key is present.
 *
 * @returns {Promise<string>} the full assembled text
 */
async function streamChat({ messages, context, onDelta }) {
  if (!isLive()) {
    const reply = ruleBasedReply(messages, context);
    // Simulate streaming for a consistent client experience.
    for (const chunk of chunkText(reply)) {
      onDelta(chunk);
      await sleep(18);
    }
    return reply;
  }

  const stream = await client.messages.stream({
    model: config.chatModel,
    max_tokens: 1024,
    system: buildSystemPrompt(context),
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });

  let full = '';
  stream.on('text', (text) => {
    full += text;
    onDelta(text);
  });
  await stream.finalMessage();
  return full;
}

// --------------------------------------------------------------------------
// Rule-based fallback: makes the buddy genuinely useful with zero API cost.
// --------------------------------------------------------------------------
function ruleBasedReply(messages, context) {
  const last = [...messages].reverse().find((m) => m.role === 'user');
  const q = (last?.content || '').toLowerCase();
  const cubes = context?.cubes || [];
  const byKey = Object.fromEntries(cubes.map((c) => [c.key, c]));
  const totalBalance = cubes.reduce((s, c) => s + (c.balance || 0), 0);

  // "can I afford <amount>"
  const amountMatch = q.match(/(\d[\d,]*)\s*(ils|₪|shekel)?/);
  if (q.includes('afford') && amountMatch) {
    const amount = Number(amountMatch[1].replace(/,/g, ''));
    const lifestyle = byKey.lifestyle || cubes.find((c) => !c.fixed);
    if (!lifestyle) return `You haven't set up your cubes yet — finish onboarding first! 🧊`;
    if (amount <= lifestyle.balance) {
      return `Yes! 🎉 Spending ${amount.toLocaleString()} ILS from your ${lifestyle.name} cube (balance ${lifestyle.balance.toLocaleString()} ILS) leaves you ${(
        lifestyle.balance - amount
      ).toLocaleString()} ILS there. You're good.`;
    }
    if (amount <= totalBalance) {
      return `It's tight. Your ${lifestyle.name} cube only has ${lifestyle.balance.toLocaleString()} ILS, so ${amount.toLocaleString()} ILS would overdraw it. You *could* cover it across cubes (total ${totalBalance.toLocaleString()} ILS), but I'd hold off or pull the difference from Savings deliberately.`;
    }
    return `I'd say no for now. ${amount.toLocaleString()} ILS is more than your total tracked balance of ${totalBalance.toLocaleString()} ILS. Let's protect your Emergency and Housing cubes.`;
  }

  // "rent is going up / adjust"
  if (q.includes('rent') || q.includes('adjust') || q.includes('increase')) {
    const housing = byKey.housing;
    return housing
      ? `If your rent changes, update your Housing cube target (currently ${housing.monthlyContribution.toLocaleString()} ILS). The extra usually comes out of Lifestyle first, then Savings. Want me to model a specific new rent figure?`
      : `You're living with parents, so there's no Housing cube. If that changes, tell me your new rent and I'll rebuild your cubes.`;
  }

  // "low / status / how am I doing"
  if (q.includes('low') || q.includes('status') || q.includes('doing') || q.includes('overview')) {
    const lowest = [...cubes].sort((a, b) => a.balance - b.balance)[0];
    return `Total across cubes: ${totalBalance.toLocaleString()} ILS. ${
      lowest ? `Your lowest cube right now is ${lowest.name} at ${lowest.balance.toLocaleString()} ILS.` : ''
    } Ask me "can I afford ___?" anytime.`;
  }

  return `I'm Cubey 🧊 — your money buddy. I can see your cubes (total ${totalBalance.toLocaleString()} ILS). Try: "Can I afford 500 ILS?", "My rent is going up", or "How am I doing?"`;
}

// Split into small fixed-size chunks WITHOUT dropping any characters
// ([\s\S] matches newlines too) so streamed text reassembles exactly.
const chunkText = (t) => t.match(/[\s\S]{1,5}/g) || [t];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

module.exports = { streamChat, buildSystemPrompt, isLive };
