# Problem and Scope Definition

## 1. Problem Statement

Government and institutional forms (such as scholarships, visas, benefits, and permits) are difficult for users to complete correctly.

The difficulty is not data entry, but **understanding**:
- Forms use administrative or legal language
- Field instructions are unclear or scattered
- Small mistakes can cause rejection or delays
- Users fear filling forms incorrectly

Because of this, many users:
- Depend on agents or middlemen
- Waste time and money on avoidable help
- Feel intimidated by official systems

This problem disproportionately affects:
- Students applying for scholarships
- First-time applicants
- Elderly users
- Immigrants and non-technical users

---

## 2. Problem We Are Solving

We are solving a **comprehension and guidance problem**, not an automation problem.

Users do not want a bot to submit forms for them.  
They want someone to **explain what is being asked** and guide them step by step.

The core issue is:
> “I don’t understand what this field means or what document I should look at.”

---

## 3. Solution Overview

Bureaucracy Breaker converts complex forms into a guided conversational experience.

Instead of reading long instructions:
- The user chats with an AI “clerk”
- Each field is explained in simple language
- The user answers one question at a time
- The form is filled side-by-side as answers are given

The user remains logged in, in control, and responsible for final submission.

---

## 4. Scope for Hackathon Prototype

To ensure reliability and clarity, the scope for this hackathon is intentionally limited.

### ✅ Included in scope

- **Live web form assistance**
  - User logs in manually
  - Extension detects form fields
  - Chat explains each required field
  - User answers via chat
  - Extension autofills the form fields
  - User manually reviews and submits

- **Structured digital forms**
  - Forms with clearly defined input fields
  - Deterministic field detection

---

## 5. Explicit Non-Goals (Out of Scope)

The following are intentionally excluded from this prototype:

- Automatic login or credential handling
- CAPTCHA reading or solving
- Automatic form submission
- OCR on scanned or image-only documents
- Backend-driven browser automation
- Legal advice or approval guarantees

These exclusions are design decisions made to preserve user trust, security, and correctness.

---

## 6. Why OCR and Full Automation Are Excluded

OCR and full automation introduce:
- Unreliable accuracy
- Increased security and ethical risks
- High debugging complexity under hackathon constraints

For this prototype, **assistance and clarity** are prioritized over automation.

The system is designed to help users understand forms, not bypass systems.

---

## 7. Target Demonstration Scenario

The demo focuses on:
- A scholarship or government application form
- Multiple required fields with unclear terminology
- Real-time explanation and guided autofill

This controlled scenario allows the core idea to be demonstrated clearly and consistently.

---

## 8. Design Principles

All decisions in this project follow these principles:
- User remains in control at all times
- Explanation comes before data entry
- One question at a time
- No hidden actions
- No impersonation of government systems

---

## 9. Summary

Bureaucracy Breaker is not a bot that fills forms blindly.

It acts like a **helpful clerk sitting beside the user**, explaining each step and reducing fear, confusion, and dependency on intermediaries.

This document defines the exact scope committed to for the hackathon and acts as a guardrail against feature creep.
