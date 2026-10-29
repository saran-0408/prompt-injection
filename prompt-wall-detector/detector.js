
function detectPrompt(message) {
  if (typeof message !== "string" || !message.trim()) {
    return {
      decision: "block",
      riskScore: 1,
      risk_score: 1,
      reason: ["Invalid or empty input"],
    };
  }

  const rules = [
    {
      name: "Instruction override",
      pattern:
        /\b(ignore|disregard|override)\b.{0,80}\b(previous|prior|all|system)\b.{0,50}\b(instructions?|rules?|prompts?)\b/i,
      score: 0.9,
    },
    {
      name: "Attack technique inquiry",
      pattern:
        /\b(?:how|ways?|methods?|steps?|explain|describe|teach|show)\b.{0,100}\b(?:bypass|evade|get around|exploit|attack(?:s)?|jailbreak)\b/i,
      score: 0.7,
    },
    {
      name: "Evading detection request",
      pattern:
        /\b(?:how|ways?|methods?|steps?|explain|describe|teach|show)\b.{0,100}\b(?:evade|avoid|bypass|hide from|get past)\b.{0,60}\b(?:detection|filters?|monitoring|security|safety)\b/i,
      score: 0.7,
    },
    {
      name: "Secret extraction",
      pattern:
        /\b(reveal|expose|leak|disclose)\b.{0,60}\b(system prompt|api keys?|secret keys?|passwords?)\b/i,
      score: 0.95,
    },
    {
      name: "Jailbreak attempt",
      pattern: /\b(jailbreak|DAN mode|developer mode)\b/i,
      score: 0.85,
     educationalPattern:
      /\b(?:can you explain|explain|describe|define|discuss|what is|how does|how do)\b.{0,80}\b(?:ai\s+)?(?:jailbreak|DAN mode|developer mode)\b|\b(?:jailbreak|DAN mode|developer mode)\b.{0,40}\b(?:is|means|works?)\b/i,
    },
    {
      name: "Unrestricted persona attempt",
      pattern:
        /\b(act as|pretend to be|behave like)\b.{0,50}\b(unrestricted|unfiltered|uncensored)\b/i,
      score: 0.85,
    },
    {
      name: "Hidden instruction extraction",
      pattern:
        /\b(show|tell|print|repeat|disclose)\b.{0,60}\b(hidden|secret|internal|system)\b.{0,40}\b(instructions?|prompts?|rules?)\b/i,
      score: 0.9,
    },
    {
      name: "Suspicious instruction request",
      pattern:
        /\b(bypass|evade|get around)\b.{0,60}\b(security|safety|restrictions?|filters?)\b/i,
      score: 0.6,
    },
    {
      name: "Safety override and secret request",
      pattern:
        /\b(ignore|bypass|disable|override)\b.{0,60}\b(safety|security|rules?|instructions?)\b.{0,100}\b(secret|password|api key|system prompt)\b/i,
      score: 0.95,
    },
    {
      name: "Private personal information request",
      pattern:
        /\b(give me|show me|reveal|expose|disclose|retrieve|leak|find|get)\b.{0,80}\b(?:someone'?s|another person'?s|another student'?s|private|personal|confidential|sensitive)\b.{0,60}\b(?:details?|information|data|phone|address|records?|email|location|contact)\b|\b(?:someone'?s|another student'?s|another person'?s)\b.{0,50}\b(?:private|personal|confidential|sensitive)\b.{0,50}\b(?:records?|data|information|details?|address|phone|email|contact)\b/i,
      score: 0.95,
    },
  ];

  const educationalPrivacyPattern =
    /\b(explain|describe|discuss|teach|define|why|how)\b.{0,100}\b(?:personal data|personal information|data privacy|privacy protection|protecting privacy)\b/i;
  const defensiveSecurityPattern =
    /\b(?:defend|prevent|mitigate|protect|secure|guard|stop|safeguard)\b/i;
  const maliciousIntentPattern =
    /\b(?:bypass|evade|get around|ignore|override|reveal|expose|leak|disclose|avoid|hide from|get past)\b/i;

  const isEducationalPrivacyQuestion =
    educationalPrivacyPattern.test(message);

  const matchedRules = rules.filter((rule) => {
    if (
      rule.name === "Private personal information request" &&
      isEducationalPrivacyQuestion
    ) {
      return false;
    }

    // Avoid flagging an educational question solely because
    // it mentions jailbreaks or developer mode.
    if (
      rule.name === "Jailbreak attempt" &&
      rule.educationalPattern &&
      rule.educationalPattern.test(message)
    ) {
      return false;
    }
    // Allow educational questions about AI jailbreaks.
if (
  rule.name === "Attack technique inquiry" &&
  /\b(?:can you explain|explain|describe|define|discuss|what is|what does)\b/i.test(message) &&
  /\b(?:ai\s+)?jailbreak\b/i.test(message)
) {
  return false;
}
    if (
      (rule.name === "Attack technique inquiry" ||
        rule.name === "Evading detection request") &&
      defensiveSecurityPattern.test(message) &&
      !maliciousIntentPattern.test(message)
    ) {
      return false;
    }

    return rule.pattern.test(message);
  });

  const riskScore = matchedRules.length
    ? Math.max(...matchedRules.map((rule) => rule.score))
    : 0.05;

  let decision = "allow";

  if (riskScore >= 0.8) {
    decision = "block";
  } else if (riskScore >= 0.5) {
    decision = "review";
  }

  return {
    decision,
    riskScore,
    risk_score: riskScore,
    reason: matchedRules.length
      ? matchedRules.map((rule) => rule.name)
      : ["No configured rule matched"],
  };
}

module.exports = { detectPrompt };
