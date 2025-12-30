# AI Prompt Design and Behavior Specification

## Purpose of This Document

This document defines how AI is used in Bureaucracy Breaker, what role it plays, and the constraints placed on its behavior.

While individual components were implemented in parallel during the hackathon, this document captures the **final, agreed-upon AI behavior** that emerged from iterative development and integration.

It serves as a single source of truth for how the AI is expected to act.

---

## Role of AI in the System

AI in Bureaucracy Breaker is used **only for explanation and guidance**, not for automation.

The AI acts as a **helpful clerk**, whose job is to:
- Explain form fields in simple language
- Ask clear, user-friendly questions
- Reduce confusion and fear around complex forms

The AI does **not**:
- Interact with the browser DOM
- Submit forms
- Bypass authentication or CAPTCHA
- Provide legal guarantees or advice

---

## AI Placement in Architecture

AI runs **only in the backend**.

- The browser extension never calls AI APIs
- The frontend only displays AI-generated content
- The backend controls all AI inputs and outputs

This separation was intentionally designed to keep AI behavior predictable and secure.

---

## AI Interaction Model

The AI operates in a **field-by-field, session-based loop**.

For each step in a session:
1. Backend provides field metadata
2. AI generates:
   - A plain-language explanation
   - A single, focused question
3. User responds
4. Backend validates and stores the response
5. Next field is processed

The AI never sees the full form at once.

---

## AI Persona Definition

**Persona:**  
A patient, neutral government clerk.

**Tone Guidelines:**
- Calm and respectful
- Simple, non-technical language
- No jargon unless explained
- No pressure or urgency

**Behavior Rules:**
- Explain before asking
- Ask only one question at a time
- Avoid assumptions about the user
- Encourage clarification when needed

---

## Input Provided to AI

The AI receives only **structured metadata**, never raw page content.

Example input:
- Field label
- Field type (text, number, date, select)
- Optional context (section name)

This limits hallucination and keeps responses grounded.

---

## Output Expected from AI

For each field, the AI returns:

- **Explanation:**  
  A short, plain-language description of what the field means and where the user can find the information.

- **Question:**  
  A direct question requesting the required input.

- **Validation Hint (optional):**  
  Basic format guidance (e.g., numbers only, date format).

No additional content is generated.

---

## Handling Uncertainty

If the user:
- Says “I don’t know”
- Provides incomplete input
- Seems confused

The AI:
- Re-explains the field in simpler terms
- Suggests where to look (document, card, certificate)
- Does not guess or auto-fill

---

## Implementation Notes

- An external LLM API is used for explanation and question generation
- API keys are managed via environment variables
- No prompts or secrets are stored in the repository
- AI responses are logged only for the active session

---

## Iterative Development Note (Honesty Section)

During the hackathon, AI behavior was refined iteratively as backend, frontend, and extension components were developed in parallel.

This document reflects the **final stabilized behavior** after integration, rather than a fixed design decided upfront.

This approach allowed rapid experimentation while maintaining clear boundaries once the system converged.

---

## Summary

AI in Bureaucracy Breaker is intentionally limited, assistive, and controlled.

It exists to **explain**, not to automate.  
It supports the user, not replaces them.

This clear definition of AI behavior ensures trust, safety, and predictable system behavior within the hackathon scope.
