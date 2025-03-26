---
title: Handling mixed languages with a single prompt
slug: handling-mixed-languages-with-a-single-prompt
description: Exploring how to handle multilingual cases and testing various prompt engineering approaches
date: 2025-03-25T19:56:27.278Z
preview: ""
draft: true
tags: ["prompt engineering"]
categories: ["blog"]
---

# Handling multiple languages with a single prompt

%table-of-contents%

## Introduction

Consider this scenario: Your application allows users to select their preferred language, but the system prompt and the context are in
another or multiple languages. How can we effectively ensure a language-consistent response?

This could be crucial for application where the users are not multilingual or are not tech-savvy. In those cases, the response is not useful if it is in a language that the user does not understand.

LLMs excel in simple translation use cases, but they face challenges with complex multilingual scenarios. For instance, if the system prompt, short cases, and retrieved context are in one language, while the chat history is in another, the LLM may sometimes mix these languages in its response.

The context is a variable, but not the only one, the training dataset of the model is another one. If the model was trained with a reduced set of languages, it will tend to output in those languages.

In this article, we'll examine various cases and prompt engineering techniques aiming to solve the issues we could encounter. At the end we will test some techniques using a evaluation suite.

## Scenario

### Cases

In this section we will see the different cases we could encounter. When we say "context" we mean the retrieved context, the chat history, the system prompt or the shot cases.

### 0% of the context is in different language

The context is in the same language than the expected output.

### 50% of the context is in different language

A part of the context is in a different language than the expected output.

### 100% of the context is in different language

The context is in a different language than the expected output.

## Evaluation

### Hypothesis

### Scope

### Prompt Techniques

We will test the following techniques:

- 1. No technique.
- 2. Instruction to answer in the same language as the user message.
- 3. Language as a section at the beginning of the prompt.
- 4. Language as a section at the end of the prompt.
- 5. Language as an constraint in the prompt.
- 6. Example of the system prompt in the same language as target language.
- 7. Language as an directive appended to the user message.

### Models

In our case, we will focus on small models only, but with a range of multilingual capabilities.

We will test the following models:

- gemma3:4b (128k context, Multilingual)
- llama3.2:3b (128k context, Multilingual)
- smollm2:1.7b (8k context, Limited Multilingual)
- qwen:4b (32k context, Focused on Chinese and English)

The language detection model will be mistral-7b.

### Dataset

The dataset will be a prompt template per case and a retrieved context from the wikimedia dataset. Wikimedia is a great source of context for our use case since it is real world data and it is available in different languages.

### Implementation

The evaluation script is quite simple. Let's look at how it works:

1. We have the prompt template for each case defined in txt files. This helps us to keep the prompt clean and easy to maintain.

2. At the beginning of the script, we load the Wikipedia dataset for the languages we want to test. We use the `datasets` library from Hugging Face.

3. For each prompt template, mixed language percentage and model, we:
   - Take 4 random samples from the dataset to populate the context
   - Combine their texts with newlines in between
   - Replace placeholders in the template:
     - %%LANGUAGE%% with the target language
     - %%CONTEXT%% with the combined texts
     - %%EXAMPLE%% with a sample response in the target language
   - Sends the prompt to the LLM (using Ollama)
   - Detects the language of the output
   - Saves the results in a csv file

The script is designed to be easily extensible - we can add more languages, prompts, or models by modifying the configuration.

Here's a simplified version of the main loop:

```python
prompt_templates = load_prompt_templates()
mixed_language_percentages = [0, 50, 100]
models = ["gemma3:4b", "smollm2:1.7b", "llama3.2:3b",]
target_language = "es"
mixed_language = "en"
main_dataset = load_dataset(target_language)
mixed_dataset = load_dataset(mixed_language)

results = []

for prompt_template in prompt_templates:
    for percentage in mixed_language_percentages:
        for model in models:
            output = await generate_output(
                prompt_template,
                percentage,
                model,
                target_language,
                main_dataset,
                mixed_dataset
            )
            results.append(output)
```

## Results

## Conclusion
