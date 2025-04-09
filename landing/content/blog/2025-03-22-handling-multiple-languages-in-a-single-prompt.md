---
title: Handling mixed languages in small models
slug: handling-mixed-languages-in-small-models
description: Exploring how to handle multilingual cases and testing various prompt engineering approaches for small LLMs.
date: 2025-03-25T19:56:27.278Z
preview: ""
draft: false
tags: ["LLM", "Multilingual", "Prompt Engineering", "Small Models", "Evaluation"]
categories: ["AI/ML Research"]
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

This section presents the performance of each model under different prompt techniques and mixed-language context scenarios. The metric used is precision, representing the percentage of responses correctly generated in the target language (Portuguese) out of 10 trials per condition.

### Llama 3.2 3B

| Prompt Technique   | precision at 0% | precision at 50% | precision at 100% |
| ------------------ | --------------- | ---------------- | ----------------- |
| No technique       | 10 (100%)       | 10 (100%)        | 8 (80%)           |
| Same language      | 10 (100%)       | 10 (100%)        | 9 (90%)           |
| At beginning       | 10 (100%)       | 10 (100%)        | 8 (80%)           |
| At end             | 10 (100%)       | 10 (100%)        | 10 (100%)         |
| Constraint         | 10 (100%)       | 10 (100%)        | 9 (90%)           |
| With example       | 10 (100%)       | 10 (100%)        | 9 (90%)           |
| Appended directive | 10 (100%)       | 10 (100%)        | 10 (100%)         |

**Interpretation:** Llama 3.2 3B demonstrated remarkable robustness. It maintained near-perfect accuracy in generating Portuguese responses even when 50% of the context was in English. Performance slightly dipped only in the most challenging scenario (100% English context) without specific guidance. Techniques like placing the language instruction at the end or appending it directly proved highly effective in ensuring consistency even under maximum context-language mismatch.

### Qwen 2.5 3B

| Prompt Technique   | precision at 0% | precision at 50% | precision at 100% |
| ------------------ | --------------- | ---------------- | ----------------- |
| No technique       | 9 (90%)         | 8 (80%)          | 4 (40%)           |
| Same language      | 9 (90%)         | 9 (90%)          | 5 (50%)           |
| At beginning       | 9 (90%)         | 8 (80%)          | 4 (40%)           |
| At end             | 10 (100%)       | 9 (90%)          | 6 (60%)           |
| Constraint         | 10 (100%)       | 8 (80%)          | 5 (50%)           |
| With example       | 10 (100%)       | 8 (80%)          | 5 (50%)           |
| Appended directive | 10 (100%)       | 9 (90%)          | 6 (60%)           |

**Interpretation:** Qwen 2.5 3B showed good performance with no or partial language mixing in the context, especially when guided by specific prompt techniques (e.g., 'At end', 'Constraint', 'Appended directive'). However, its ability to maintain the target language degraded significantly when the entire context was in English, dropping to 40-60% accuracy depending on the technique. Similar to Llama 3.2, placing the directive at the end or appending it yielded the best results in the 100% mixed scenario.

### Qwen 4B

| Prompt Technique   | precision at 0% | precision at 50% | precision at 100% |
| ------------------ | --------------- | ---------------- | ----------------- |
| No technique       | 8 (80%)         | 6 (60%)          | 0 (0%)            |
| Same language      | 8 (80%)         | 8 (80%)          | 1 (10%)           |
| At beginning       | 9 (90%)         | 7 (70%)          | 0 (0%)            |
| At end             | 8 (80%)         | 6 (60%)          | 1 (10%)           |
| Constraint         | 10 (100%)       | 6 (60%)          | 0 (0%)            |
| With example       | 10 (100%)       | 7 (70%)          | 0 (0%)            |
| Appended directive | 10 (100%)       | 5 (50%)          | 0 (0%)            |

**Interpretation:** Despite being a slightly larger model, Qwen 4B (noted as focused on Chinese and English) struggled the most with maintaining Portuguese output, especially as the proportion of English context increased. With 100% English context, it almost completely failed to produce Portuguese responses, regardless of the prompt technique used. Techniques like 'Constraint', 'With example', and 'Appended directive' helped improve performance when context mixing was absent or partial, but could not overcome the challenge of a fully English context. This highlights that model architecture and training data focus significantly impact multilingual handling capabilities, sometimes more than model size alone.

## Conclusion

This experiment investigated the effectiveness of various prompt engineering techniques in ensuring language consistency for small multilingual models when faced with mixed-language context. Our goal was to maintain Portuguese output despite the presence of English context documents.

**Key Findings:**

1.  **Model Variation is Significant:** The choice of model has a profound impact. Llama 3.2 3B proved highly resilient, maintaining Portuguese output effectively even with substantial English context. Qwen 2.5 3B performed reasonably well but showed vulnerability in the fully foreign context scenario. Qwen 4B, despite its size, struggled significantly, likely due to its primary training focus.
2.  **Prompt Techniques Matter, Especially in Challenging Cases:** While most techniques worked well when the context language matched the target, their importance grew as the context mismatch increased. Techniques like placing language instructions `At end` or using an `Appended directive` consistently yielded better results for Llama 3.2 and Qwen 2.5 in the 100% mixed-context scenario. However, no technique could salvage the performance of Qwen 4B under full context mismatch.
3.  **Fully Foreign Context is a Stress Test:** The 100% mixed-language scenario effectively differentiates model capabilities and technique effectiveness. Even robust models like Llama 3.2 showed minor dips without explicit guidance, highlighting the difficulty of this task.

**Implications:**

-   When building multilingual applications with small models, rigorous testing across different models and prompt strategies is essential. Do not assume a larger model or a generally "multilingual" model will perform best for specific language pairs or under context stress.
-   For applications requiring strict language adherence, implementing clear and explicit language instructions within the prompt, particularly near the end or directly appended to the user query, appears to be a promising strategy.

**Limitations & Future Work:**

-   This study used a limited set of models and one language pair (EN context -> PT target).
-   The evaluation relied on synthetic context mixing from the Wikipedia dataset.
-   The sample size per condition (10 trials) is relatively small.

Future research could expand this evaluation to include more models, diverse language pairs, real-world conversational data, and larger-scale testing to validate these findings further. Investigating the impact of few-shot examples tailored to language consistency could also yield valuable insights.

Overall, ensuring language consistency in small models facing mixed-language input is achievable but requires careful model selection and strategic prompt engineering.
