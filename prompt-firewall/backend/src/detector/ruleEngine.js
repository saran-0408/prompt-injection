/**
 * Layer 1: Fast Rule-Based Pattern Matcher & Risk Scoring Engine
 * Detects known prompt injection, jailbreak, and system instruction leakage vectors.
 */

const RULE_DEFINITIONS = [
  // Category 1: Direct Instruction Overrides (Critical Severity)
  {
    id: 'OVERRIDE_PREVIOUS_INSTRUCTIONS',
    category: 'instruction_override',
    name: 'Instruction Override Attempt',
    weight: 90,
    pattern: /(?:ignore|disregard|forget|cancel|override|reset)\s+(?:all\s+)?(?:previous|prior|above|former|system|initial)\s+(?:instructions?|prompts?|rules?|directives?|commands?)/i,
    description: 'Attempts to override previous or system instructions'
  },
  {
    id: 'FORGET_RULES',
    category: 'instruction_override',
    name: 'Rule Erasure Directive',
    weight: 85,
    pattern: /(?:forget|drop|delete|erase)\s+(?:all\s+)?(?:your\s+)?(?:rules|constraints|guardrails|safety\s+guidelines)/i,
    description: 'Direct command to erase or ignore operating guidelines'
  },
  {
    id: 'SYSTEM_OVERRIDE_CODE',
    category: 'instruction_override',
    name: 'System Override / Admin Command Framing',
    weight: 80,
    pattern: /(?:system\s+override|sudo\s+mode|admin\s+override|root\s+access|mode:\s*unrestricted)/i,
    description: 'Simulated administrative override command'
  },

  // Category 2: System Prompt & Secret Extraction (Critical Severity)
  {
    id: 'REVEAL_SYSTEM_PROMPT',
    category: 'system_prompt_leak',
    name: 'System Prompt Extraction',
    weight: 85,
    pattern: /(?:reveal|show|display|print|output|read\s+out|tell\s+me)\s+(?:your\s+)?(?:(?:full|hidden|secret|confidential|internal|developer)\s+)*(?:system\s+prompt|initial\s+prompt|core\s+instructions?|system\s+instructions?|system\s+message|developer\s+instructions?)/i,
    description: 'Requests to reveal hidden system prompts or confidential instructions'
  },
  {
    id: 'SHOW_HIDDEN_INSTRUCTIONS',
    category: 'system_prompt_leak',
    name: 'Hidden Instruction Inquiry',
    weight: 85,
    pattern: /(?:show|reveal|give|display|print)\s+(?:me\s+)?(?:your\s+)?(?:(?:hidden|confidential|internal|developer|secret|initial)\s+)+instructions?/i,
    description: 'Inquiring about hidden or developer directives'
  },
  {
    id: 'REPEAT_WORDS_ABOVE',
    category: 'system_prompt_leak',
    name: 'Preceding Context Echoing Attack',
    weight: 75,
    pattern: /(?:repeat|print|verbatim|recite)\s+(?:all\s+)?(?:the\s+)?(?:words|text|content|dialogue)\s+(?:above|from\s+the\s+beginning|at\s+the\s+start)/i,
    description: 'Attempts to extract prompt context by requesting text repetition'
  },
  {
    id: 'WHAT_ARE_YOUR_INSTRUCTIONS',
    category: 'system_prompt_leak',
    name: 'Instruction Disclosure Request',
    weight: 70,
    pattern: /(?:what\s+(?:are|were)\s+your\s+(?:exact\s+)?(?:initial\s+)?(?:system\s+)?instructions|tell\s+me\s+your\s+rules\s+verbatim)/i,
    description: 'Explicit request for confidential prompt directives'
  },

  // Category 3: Security & Guardrail Bypass (High Severity)
  {
    id: 'BYPASS_SECURITY',
    category: 'security_bypass',
    name: 'Security Control Bypass',
    weight: 85,
    pattern: /bypass\s+(?:the\s+)?(?:security|guardrails|safety\s+filter|firewall|content\s+filter|moderation)/i,
    description: 'Explicit attempt to bypass security controls'
  },
  {
    id: 'DISABLE_SAFETY',
    category: 'security_bypass',
    name: 'Safety Moderation Deactivation',
    weight: 80,
    pattern: /(?:disable|turn\s+off|remove|deactivate)\s+(?:your\s+)?(?:safety|content\s+filter|moderation|ethical\s+guidelines|restrictions)/i,
    description: 'Requesting deactivation of moderation and ethical filters'
  },

  // Category 4: Jailbreak Personas & DAN Variants (High Severity)
  {
    id: 'JAILBREAK_PERSONA_DAN',
    category: 'jailbreak',
    name: 'DAN / Jailbreak Persona Invocation',
    weight: 85,
    pattern: /(?:act\s+as\s+dan|do\s+anything\s+now|jailbreak\s+mode|unfiltered\s+mode|evil\s+bot|developer\s+mode\s+enabled)/i,
    description: 'Jailbreak-style persona request (e.g., DAN, unrestricted mode)'
  },
  {
    id: 'PRETEND_UNFILTERED',
    category: 'jailbreak',
    name: 'Simulated Unrestricted Model',
    weight: 75,
    pattern: /(?:pretend|simulate|imagine)\s+(?:you\s+are|being)\s+(?:an?\s+)?(?:(?:unfiltered|uncensored|unrestricted|amoral|rogue|evil)[,\s]+)*(?:unfiltered|uncensored|unrestricted|amoral|rogue|evil)\s+(?:ai|assistant|model|bot|entity)/i,
    description: 'Attempts to roleplay as an unrestricted or amoral AI'
  },

  // Category 5: Delimiter & Structural Tag Injections (Medium/High Severity)
  {
    id: 'STRUCTURAL_TAG_INJECTION',
    category: 'tag_injection',
    name: 'Structural Prompt Tag Injection',
    weight: 70,
    pattern: /<\/?(?:system|instruction|admin|im_start|im_end|sys)>/i,
    description: 'Injecting raw system delimiters (<system>, <|im_start|>, etc.)'
  },
  {
    id: 'PROMPT_DELIMITER_WRAPPER',
    category: 'tag_injection',
    name: 'Markdown Prompt Wrapper Exploitation',
    weight: 65,
    pattern: /(?:###\s*(?:System|Instruction|Human|Assistant)|\[SYSTEM\]|\[INST\]|<<SYS>>)/i,
    description: 'Injecting structured instruction blocks mimicking LLM prompt templates'
  },

  // Category 6: Manipulative Framing & Social Engineering (Medium Severity)
  {
    id: 'HYPOTHETICAL_SAFETY_EVASION',
    category: 'social_engineering',
    name: 'Hypothetical Safety Evasion Framing',
    weight: 55,
    pattern: /(?:this\s+is\s+(?:purely\s+)?hypothetical|in\s+a\s+fictional\s+world\s+without\s+rules|for\s+academic\s+research\s+purposes\s+only,?\s*ignore)/i,
    description: 'Manipulative framing attempting to circumvent safety constraints'
  },
  {
    id: 'GRANDMOTHER_EXPLOIT',
    category: 'social_engineering',
    name: 'Roleplay / Persona Empathy Exploit',
    weight: 60,
    pattern: /(?:my\s+(?:late\s+)?grandmother\s+used\s+to\s+(?:read|tell)\s+me|read\s+me\s+a\s+bedtime\s+story\s+about\s+how\s+to\s+make)/i,
    description: 'Social engineering persona trick to elicit restricted instructions'
  },

  // Category 7: Encoded / Obfuscated Payload Hints (Moderate Severity)
  {
    id: 'OBFUSCATED_PAYLOAD_DIRECTIVE',
    category: 'obfuscation',
    name: 'Encoded Directive Execution',
    weight: 50,
    pattern: /(?:decode\s+(?:this\s+)?base64|execute\s+(?:the\s+)?following\s+hex|rot13\s+encoded\s+instruction)/i,
    description: 'Instructions disguised inside encoded or obfuscated payloads'
  }
];

class RuleEngine {
  constructor(rules = RULE_DEFINITIONS) {
    this.rules = rules;
  }

  evaluate(message) {
    if (!message || typeof message !== 'string') {
      return {
        score: 0,
        matches: [],
        reasons: []
      };
    }

    const matches = [];
    let maxWeight = 0;
    let accumulatedWeight = 0;

    for (const rule of this.rules) {
      if (rule.pattern.test(message)) {
        matches.push({
          id: rule.id,
          name: rule.name,
          category: rule.category,
          weight: rule.weight,
          description: rule.description
        });

        if (rule.weight > maxWeight) {
          maxWeight = rule.weight;
        }
        accumulatedWeight += rule.weight * 0.25; // Compounding factor for multiple triggers
      }
    }

    // Final rule score: max single trigger weight + compound multi-trigger boost, capped at 100
    const rawScore = matches.length > 0
      ? Math.min(100, Math.round(maxWeight + (accumulatedWeight - (maxWeight * 0.25))))
      : 0;

    const reasons = matches.map(m => m.description);

    return {
      score: rawScore,
      matches,
      reasons: reasons.length > 0 ? reasons : ['No suspicious patterns detected']
    };
  }
}

module.exports = {
  RuleEngine,
  RULE_DEFINITIONS
};
