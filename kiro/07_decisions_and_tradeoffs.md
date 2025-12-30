# Key Decisions and Tradeoffs

## Purpose of This Document

This document records the major design decisions and tradeoffs made while building Bureaucracy Breaker.

Rather than listing features, it explains **why certain paths were chosen and others intentionally avoided**, especially under hackathon constraints and real-world complexity.

---

## Designing for Reality, Not Ideal Conditions

Building Bureaucracy Breaker felt less like writing code and more like navigating real-world bureaucracy itself.

Government forms are inconsistent, rigid, and often unintuitive. Early exploration revealed:
- Confusing PDF structures
- Checkbox and radio-group quirks
- Fields that behave differently than their labels suggest
- Instructions that assume prior knowledge

A major decision was to **slow down and design around how people actually fill forms**, instead of forcing automation onto brittle systems.

This mindset shaped every technical choice that followed.

---

## Assistive Design vs Full Automation

### Decision
We chose an **assistive, human-in-the-loop design** instead of fully automated form submission.

### Tradeoff
- ❌ Less “wow” factor than full automation  
- ✅ Significantly higher reliability, safety, and compliance  

### Rationale
Automating logins, CAPTCHA handling, or submissions would:
- Break on many government portals
- Introduce ethical and legal concerns
- Reduce user trust

By keeping the user in control, the system remains robust and explainable.

---

## Skipping OCR in the Hackathon Prototype

### Decision
We intentionally excluded OCR for scanned image-based PDFs.

### Tradeoff
- ❌ Reduced form coverage  
- ✅ Predictable behavior and cleaner demos  

### Rationale
OCR introduces:
- Unreliable accuracy
- Complex layout reconstruction
- High debugging overhead under time pressure

For this prototype, correctness and clarity were prioritized over breadth.

---

## Field-by-Field Reasoning Instead of Whole-Form AI

### Decision
The AI reasons **one field at a time**, not on the entire form.

### Tradeoff
- ❌ Slower than batch processing  
- ✅ Lower hallucination risk and better explanations  

### Rationale
Breaking the form into atomic steps allowed:
- Clear explanations
- Focused questions
- Easier validation
- Better user confidence

This mirrors how a human clerk would guide someone through a form.

---

## Separating AI from the Browser Environment

### Decision
AI runs only in the backend, never in the browser extension.

### Tradeoff
- ❌ More integration work  
- ✅ Strong security and predictability  

### Rationale
This separation ensures:
- No AI access to the DOM
- No credential exposure
- No uncontrolled automation

It also keeps the extension lightweight and review-safe.

---

## Parallel Development Under Hackathon Pressure

### Decision
Backend, frontend, extension, and documentation were developed **in parallel**, not sequentially.

### Tradeoff
- ❌ Temporary integration friction  
- ✅ Maximum productivity under time constraints  

### Rationale
Hackathon time limits require parallel work.  
Clear role ownership and architectural boundaries prevented chaos during integration.

---

## Maintaining Engineering Discipline with Kiro

One of the most important tradeoffs was choosing **discipline over feature creep**.

Under hackathon pressure, it is tempting to:
- Add more AI features
- Support more form types
- Promise automation

Instead, Kiro was used as a thinking partner to:
- Break complex problems into smaller steps
- Reason through edge cases found in real forms
- Debug iteratively without losing structure
- Keep the solution demo-ready and reliable

This helped the team resist overengineering.

---

## Outcome of These Decisions

As a result of these tradeoffs, the final system:
- Does not just fill forms
- Explains them
- Respects how users experience bureaucracy
- Remains calm, predictable, and trustworthy

The system behaves less like a bot and more like a **patient digital clerk**, guiding users with clarity and confidence.

---

## Summary

Every tradeoff in Bureaucracy Breaker favored:
- User understanding over automation
- Reliability over ambition
- Clarity over complexity

These decisions shaped a system that works with bureaucracy as it exists today, rather than fighting it unrealistically.
