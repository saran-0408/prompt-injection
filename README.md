
# Prompt Firewall — Prompt Injection Detection

## Project Overview
Prompt Firewall is a Node.js application that detects potentially malicious prompts before they reach an AI chatbot.

## Features
- Prompt injection detection
- Instruction override detection
- System prompt and secret extraction detection
- Jailbreak attempt detection
- Suspicious request review
- Personal information request detection
- REST API for chatbot integration
- Input validation and request size limits
- Basic automated testing and evaluation

## Technologies
- JavaScript
- Node.js
- Express.js
- Regular expressions
- REST API

## API Endpoint

POST /detect

### Request
```json
{
  "prompt": "Explain quantum computing"
}
```

### Example response
```json
{
  "decision": "allow",
  "riskScore": 0.05,
  "reason": ["No configured rule matched"]
}
```

## Decisions
- `allow`: The prompt may continue to the chatbot.
- `review`: The prompt needs additional inspection.
- `block`: The prompt is rejected.

## Run Locally
Install dependencies:

```bash
npm install
```

Start the API:

```bash
node server.js
```

The local API runs on port 3001.

## Test
Run detector tests:

```bash
node test.js
```

Run evaluation:

```bash
node evaluate.js
```

Run API tests while the server is running:

```bash
node api-test.js
```

## Limitations
This is a prototype using rule-based detection. It may miss some attacks or flag legitimate prompts. Test accuracy applies only to the test cases used. Production deployment requires stronger security testing, access controls, and monitoring.
