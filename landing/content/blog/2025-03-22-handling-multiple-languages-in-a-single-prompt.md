---
title: Handling multiple languages with a single prompt
slug: handling-multiple-languages-with-a-single-prompt
description: Exploring how to handle multilingual cases and testing various prompt engineering approaches
date: 2025-03-25T19:56:27.278Z
preview: ""
draft: true
tags: []
categories: []
---

# Handling multiple languages with a single prompt

%table-of-contents%

## Introduction

LLMs can shine on simple use cases of translations, but they struggle to handle complex multilingual cases. For example if the system prompt, shot cases and retrieved context are in a language, but the chat history is in another language, the LLM sometimes will mix those languages in the response.

In this article, I will explore different cases and techniques using with a custom evaluation suite performing like a custom benchmark that can be reused to test future models.
