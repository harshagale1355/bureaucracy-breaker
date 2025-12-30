# Team Roles and Responsibilities

## Purpose of This Document

This document defines clear roles and ownership within the team to ensure smooth execution, accountability, and efficient collaboration during the hackathon.

Each system component has a single owner to avoid overlap, confusion, and last-minute conflicts.

---

## Team Structure

The team consists of **four members**, each owning a distinct part of the system.

Roles were assigned based on skill alignment and project needs.

---

## 1. Frontend Lead / Project Lead

**Primary Responsibility:**  
Own the user experience, product flow, and overall execution timeline.

**Responsibilities:**
- Design and implement the chat-based UI
- Manage the sidebar layout and interactions
- Ensure a smooth end-to-end demo experience
- Coordinate team progress and timelines
- Lead the final project presentation

**Out of Scope:**
- Backend logic
- AI prompt design
- Browser extension permissions

---

## 2. System Architect (Documentation & Planning Lead)

**Primary Responsibility:**  
Define system boundaries and ensure architectural consistency.

**Responsibilities:**
- Design the overall system architecture
- Define data flow and session model
- Control project scope and prevent feature creep
- Maintain planning and documentation using Kiro
- Review architectural and security decisions

**Out of Scope:**
- Detailed UI implementation
- Day-to-day backend coding

---

## 3. Backend + AI Engineer

**Primary Responsibility:**  
Build and manage the system’s intelligence and logic layer.

**Responsibilities:**
- Implement backend APIs and session handling
- Integrate AI for explanations and question generation
- Design and enforce the AI “clerk” behavior
- Validate user input formats
- Manage backend-side state and flow control

**Out of Scope:**
- Browser DOM manipulation
- UI design and presentation logic
- Extension development

---

## 4. Browser Extension Engineer

**Primary Responsibility:**  
Handle all browser-side execution safely and reliably.

**Responsibilities:**
- Develop the Chrome extension using Manifest V3
- Detect form fields on live web pages
- Inject sidebar UI and contextual controls
- Autofill form inputs using user-provided data
- Highlight active fields for user clarity
- Enforce security and compliance boundaries

**Out of Scope:**
- AI logic or prompt design
- Backend API implementation
- CAPTCHA handling beyond user guidance

---

## Role Ownership Summary

| Area | Owner |
|----|----|
| Product flow & demo | Frontend Lead |
| Architecture & scope | System Architect |
| Backend APIs | Backend + AI Engineer |
| AI behavior & prompts | Backend + AI Engineer |
| Browser extension | Extension Engineer |
| Autofill execution | Extension Engineer |
| Security boundaries | System Architect |
| Documentation (Kiro) | System Architect |

---

## Collaboration Principles

- Each component has a single owner
- Cross-role input is welcome, ownership is not shared
- Scope changes require architectural review
- The user remains in control at all times

These principles ensure the team remains aligned and execution stays focused.

---

## Summary

Clear role ownership allows the team to move fast without confusion.

This structure ensures:
- Efficient parallel development
- Reduced integration risk
- A stable and explainable final demo

The roles defined here guided all planning and implementation decisions throughout the hackathon.
