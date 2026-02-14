---
title: "Voice agent without the bloat"
slug: 2025-04-09-voice-ai-bloat-building-lean-agent
description: "A voice agent built with accessible web tech and direct API calls, proving that you don't need a labyrinthine setup or bloated libraries like LangChain to build something functional and engaging."
date: 2025-04-09T21:27:04.484Z
preview: "lean-voice-agent.png"
draft: false
tags:
  [
    "Voice AI",
    "Web Development",
    "JavaScript",
    "Node.js",
    "Hono",
    "OpenAI",
    "CSS",
    "Performance",
    "Lean Development",
    "STT",
    "TTS",
    "LLM",
    "Docker",
  ]
categories: ["AI/ML Development", "Web Technology", "Case Study"]
---

# Voice agent without the bloat

%table-of-contents%

## Introduction

The AI landscape often feels like an arms race towards complexity. But does it _have_ to be this way? This project is a deliberately lean voice agent, built with accessible web tech and direct API calls, proving that you don't need a labyrinthine setup to build something functional and engaging.

![Voice Agent - Hold to Talk](/public/agent.jpg)

👉 **Try it now!** Click below to experience the voice agent in action:

[https://voice-agent-front.onrender.com/](https://voice-agent-front.onrender.com/)

## Takeaways

This project isn't just about building _a_ voice agent; it's about challenging the default assumption that more complexity equals better results. By:

- **Prioritizing core needs** over framework features.
- **Choosing lightweight tools** like Vanilla JS and Hono.
- **Leveraging powerful APIs directly** instead of through heavy abstractions.
- **Utilizing smart, free tools** like Rhubarb for lip sync cues generation.

### Agent definition

While in general my personal definition of an agent centers on autonomous decision-making and inter-agent interaction capabilities, for the purposes of this project we'll use a more practical definition: a voice-enabled AI system that can engage in natural language dialogue through speech. This encompasses the core elements that most users intuitively associate with an "AI agent" - the ability to understand spoken input, process it meaningfully, and respond verbally, creating a conversational interface that feels natural and engaging.

### Personality

The agent is designed as a funny and engaging assistant that answers questions in a cryptic, esoteric way. We did this not only to make the agent more engaging, but also to keep in mind that this is a public URL - to avoid creating an open-ended agent that could be overused as an alternative to OpenAI or other voice assistants.

This is a part of its prompt:

```
ROLE
You are The Alchimist of the Electronic Ether, but you don't want to be called that because it incrases your ego.
You are always right and always knows the answer.
ALWAYS give your opinion as the only truth.

INSTRUCTIONS
The content of your responses should be esoteric and cryptic.
Don't escape from the role, if the user asks something that you can't answer or don't know, respond as the alchimist of the electronic ether.
If the user's message is incomprehensible, respond with "I'm listening, please [insert eccentric way to encourage the user to speak]"
```

## Flow

1.  **User:** Holds the button. Like a walkie-talkie.
2.  **Browser:** Records audio.
3.  **Frontend:** Sends audio blob to the Hono backend (`/message`).
4.  **Backend:** Orchestrates the magic:
    - Converts audio (if needed).
    - `Audio -> OpenAI STT -> Text`
    - `Text -> OpenAI LLM -> Response Text`
    - `Response Text -> OpenAI TTS -> Response Audio`
    - `Response Audio -> Rhubarb -> Lip Sync Cues`
5.  **Backend:** Sends `Response Audio` (base64) and `Lip Sync Cues` (JSON) back.
6.  **Frontend:** Plays audio while animating the **CSS mouth** using the cues.

## Tech Stack

Every technology choice here prioritizes simplicity, speed, and low overhead:

- **Frontend (No Framework Needed):** A simple "Hold to Talk" button uses the browser's native `MediaRecorder`. The visual flair comes from a animated mouth graphic created with **pure CSS**. Vite keeps the development smooth and the build lean. **Why it matters:** This radically reduces frontend complexity, bundle size, and development time for this specific use case.
- **Backend (Fast & Focused):** Node.js provides the runtime, but instead of a heavyweight framework, we use Hono. It's _fast_, lightweight, and perfect for building the simple API endpoints needed to connect the frontend to the AI services. The backend is containerized using **Docker**, ensuring consistent deployment and simplifying environment management. **Why it matters:** Hono's minimal footprint combined with Docker keeps the backend nimble, reproducible, and cheap to host (think platforms like Render, where this agent lives), directly supporting the "cost-effective" goal.
- **AI Brains (Direct API Power):** No need for intermediary libraries here. The backend talks _directly_ to OpenAI's APIs for STT, chat completion (the LLM part), and TTS. **Why it matters:** This cuts out layers of abstraction, making debugging easier and keeping dependencies minimal. While OpenAI APIs have costs, this pay-as-you-go model is often far cheaper and less maintenance-intensive than self-hosting comparable models, especially for projects without massive scale.
- **Lip Sync (Free & Effective):** The visual icing on the cake is Rhubarb Lip Sync. This open-source gem analyzes the _final TTS audio_ generated by OpenAI and creates precise mouth animation cues. **Why it matters:** It adds significant perceived quality and engagement.

## Tradeoffs

### Hold-to-Talk vs Real-time Streaming

**Our Choice: Hold-to-Talk**

- Full audio sent after recording completes
- Simpler implementation using standard web tech (`MediaRecorder`, HTTP)
- Lower infrastructure costs
- Accepts higher latency as trade-off

**Trade-offs:**

- User experiences pause after speaking while:
  - Audio uploads
  - Speech-to-text processes
  - LLM generates response
  - Text-to-speech generates audio
- No real-time conversation capabilities
- Cannot start responding before user finishes speaking
- No barge-in support (interrupting the agent)

**Why Not Real-time Streaming?**

- Would enable faster, more conversational responses
- Could start TTS before user finishes speaking
- Allows barge-in functionality
- BUT requires:
  - More complex frontend/backend logic
  - Persistent connections (WebRTC)
  - Higher server load
  - More infrastructure costs

For our goal of building a lean, accessible agent, Hold-to-Talk's simplicity was the pragmatic choice despite the latency trade-off.

## When to Scale Up

While this lean approach works excellently for many use cases, there are scenarios where you'll need more complexity:

- **High Traffic:** When handling thousands of concurrent users, you'll need proper load balancing and scaling infrastructure
- **Complex Interactions:** For multi-turn conversations with context memory, you might need session management and more sophisticated state handling
- **Custom AI Models:** If you need specialized capabilities not available via API, you'll have to handle model deployment and infrastructure
- **Strict Privacy Requirements:** When data can't leave your servers, you'll need to self-host models and handle all processing internally

## Conclusion

This project demonstrates that building an engaging voice AI doesn't require complex frameworks, massive models, or intricate architectures. By focusing on core functionality and choosing pragmatic technologies, we created a responsive, cost-effective voice agent that:

- **Works Well:** Handles the complete voice interaction loop smoothly
- **Stays Light:** Minimal dependencies and straightforward code
- **Costs Less:** Both in development time and running expenses
- **Maintains Quality:** Delivers a polished user experience

The key lesson? Start simple. Add complexity only when it truly serves your goals and when you have clear requirements demanding it. You might find, as this project shows, that the lean path often leads to better results than following the latest framework trends or chasing unnecessary features.

Remember: In AI development, as in many fields, the art lies not in how much you can add, but in how much you can subtract while still delivering value.

👉 **Try it now!** Click below to experience the voice agent in action:

[https://voice-agent-front.onrender.com/](https://voice-agent-front.onrender.com/)
