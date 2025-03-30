---
title: Handling mixed languages in small models
slug: handling-mixed-languages-in-small-models
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

In multilingual applications, ensuring consistent language responses is crucial. This study focuses on how different prompt engineering techniques can help language models maintain language consistency across various contextual scenarios.

This could be crucial for applications where the users are not multilingual or are not tech-savvy. In those cases, the response is not useful if it is in a language that the user does not understand.

## Scenarios

### Real world example

**Multilingual Customer Support Chatbot**  
A Portuguese-speaking user asks about return policies through an e-commerce chatbot. The e-commerce website is available in English and Portuguese. The system retrieves three relevant context entries:

1. Return policy document in English (target language)
2. Return policy document in English (mixed language)
3. Customer's previous English inquiry from their order history

Without proper language handling, the chatbot might:

- Respond in English due to the strong English FAQ context
- Mix English phrases from the user's history
- Create a confusing polyglot response like:
  _"La devolución requiere el recibo original (within 30 days of purchase). Por favor verifique seus itens antes do envio."_

This could frustrate users who expect or require consistent Portuguese responses.

### Cases

In this section we will see the different cases we could encounter. The context could be the retrieved information, chat history, system prompt or shot cases.

**Non-mixed context**  
All context documents are in the same language as the expected output.

**Partially mixed context**  
Some context documents are in a different language than the expected output.

**Fully foreign context**  
All context documents are in a different language than the expected output.

## Evaluation

### Hypothesis

We hypothesize that the model will have hard time mantaining the language consistency when the context is in a different language than the expected output, and that the prompt engineering techniques will have a positive impact on the results.

### Scope

This experiment will focus on small multilingual models. Since this is a small experiment, cost is a constraint.

We will focus on challenging scenarios where context language differs from the target output.

This scope will help us to see the impact of the prompt engineering techniques.

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

Based on the defined scope, we will test the following models:

- llama3.2:3b (128k context, Multilingual)
- qwen2.5:3b (32k context, Multilingual)
- qwen:4b (32k context, Focused on Chinese and English)

The language detection model will be gpt-4o-mini.

### Languages

We will run the experiment with the following languages:

- Context language: English
- Target language: Portuguese

### Mixed language percentage

We will test the following mixed language percentages:

- 0%
- 50%
- 100%

### Dataset

The dataset will be a prompt template per case and a retrieved context from the wikimedia dataset. Wikimedia is a great source of context for our use case since it is real world data and it is available in different languages.

### Implementation

The evaluation script is quite simple. Let's look at how it works:

1. We have the prompt template for each case defined in separate txt files.

2. At the beginning of the script, we load the Wikipedia dataset for the languages we want to test.

3. For each prompt template, mixed language percentage and model, we:

   - Take random samples from the dataset to populate the context
   - Sends the prompt to the tested LLM (using Ollama in this case)
   - Sends the output to the language detection model

4. At the end of the script, we save the results in a csv file.

Here's a simplified version of the main loop:

```python
prompt_templates = load_prompt_templates()
mixed_language_percentages = [0, 50, 100]
models = ["llama3.2:3b", "qwen2.5:3b", "qwen:4b"]
target_language = "pt"
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

### Llama 3.2 3B

| Prompt Technique   | precision at 0% | precision at 50% | precision at 100% |
| ------------------ | --------------- | ---------------- | ----------------- |
| No technique       | 10              | 10               | 8                 |
| Same language      | 10              | 10               | 9                 |
| At beginning       | 10              | 10               | 8                 |
| At end             | 10              | 10               | 10                |
| Constraint         | 10              | 10               | 9                 |
| With example       | 10              | 10               | 9                 |
| Appended directive | 10              | 10               | 10                |

### Qwen 4B

| Prompt Technique   | precision at 0% | precision at 50% | precision at 100% |
| ------------------ | --------------- | ---------------- | ----------------- |
| No technique       | 8               | 6                | 0                 |
| Same language      | 8               | 8                | 1                 |
| At beginning       | 9               | 7                | 0                 |
| At end             | 8               | 6                | 1                 |
| Constraint         | 10              | 6                | 0                 |
| With example       | 10              | 7                | 0                 |
| Appended directive | 10              | 5                | 0                 |

As we can see, the model performed perfectly across all prompt techniques, maintaining 100% accuracy in generating Spanish responses despite having English context. This suggests that the model has a strong ability to handle multilingual tasks and can reliably generate content in a specified target language regardless of the context language.

## Conclusion

// WIP
