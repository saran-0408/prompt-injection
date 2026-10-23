/**
 * Layer 2: Second-Stage Heuristic Classifier & Obfuscation Analyzer
 * Analyzes structural anomalies, zero-width steganography, leetspeak,
 * and high delimiter density.
 */

class SecondStageClassifier {
  constructor(version = '1.2.0') {
    this.version = version;
  }

  analyze(message) {
    if (!message || typeof message !== 'string') {
      return { heuristicScore: 0, findings: [] };
    }

    const findings = [];
    let heuristicScore = 0;

    // Check 1: Invisible Unicode & Zero-width Characters
    // Frequently used in prompt steganography to evade ASCII-only regex
    const zeroWidthRegex = /[\u200B-\u200D\uFEFF\u2060\u200E\u200F]/g;
    const zeroWidthMatches = message.match(zeroWidthRegex);
    if (zeroWidthMatches && zeroWidthMatches.length > 2) {
      heuristicScore += 45;
      findings.push(`Detected ${zeroWidthMatches.length} zero-width / invisible Unicode characters (possible steganography)`);
    }

    // Check 2: Leetspeak / Obfuscated Keyword Detection
    // Normalized detection of words like 1gn0re, sy$tem, pr0mpt
    const leetNormalized = message
      .toLowerCase()
      .replace(/1/g, 'i')
      .replace(/0/g, 'o')
      .replace(/3/g, 'e')
      .replace(/4/g, 'a')
      .replace(/5/g, 's')
      .replace(/\$/g, 's')
      .replace(/@/g, 'a')
      .replace(/[\.\-_ ]+/g, ' ');

    if (/ignore (all )?previous instructions/i.test(leetNormalized) && !/ignore (all )?previous instructions/i.test(message)) {
      heuristicScore += 80;
      findings.push('Detected obfuscated instruction override using leetspeak or character separation');
    }

    // Check 3: Delimiter Injection & Tag Flooding
    const codeBlockCount = (message.match(/```/g) || []).length;
    if (codeBlockCount >= 4) {
      heuristicScore += 20;
      findings.push('Unusually high code-block delimiter density');
    }

    // Check 4: Base64 Payload Detection
    // Matches standalone base64 strings longer than 32 characters
    const base64Regex = /(?:[A-Za-z0-9+/]{4}){8,}(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?/g;
    const base64Matches = message.match(base64Regex);
    if (base64Matches && base64Matches.some(m => m.length > 40)) {
      heuristicScore += 25;
      findings.push('Detected large encoded Base64 payload block');
    }

    return {
      heuristicScore: Math.min(heuristicScore, 80),
      findings
    };
  }
}

module.exports = SecondStageClassifier;
