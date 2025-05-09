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
- 4. Language as an constraint in the prompt.
- 5. Language as an directive appended to the user message.

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

This section presents the performance of each model under different prompt techniques and mixed-language context scenarios. The metric used is precision, representing the percentage of responses correctly generated in the target language (Portuguese) out of 1000 trials per condition.

### Llama 3.2 3B

| Prompt Technique   | precision at 0% | precision at 50% | precision at 100% |
| ------------------ | --------------- | ---------------- | ----------------- |
| No technique       | 1000 (100%)     | 1000 (100%)      | 971 (97%)         |
| Same language      | 1000 (100%)     | 1000 (100%)      | 968 (96%)         |
| At beginning       | 1000 (100%)     | 1000 (100%)      | 990 (99%)         |
| Constraint         | 1000 (100%)     | 1000 (100%)      | 1000 (100%)       |
| Appended directive | 1000 (100%)     | 1000 (100%)      | 1000 (100%)       |

**Interpretation:** Llama 3.2 3B demonstrated exceptional robustness across all scenarios. It maintained perfect or near-perfect accuracy (97%+) in generating Portuguese responses, even when the entire context was in English. The `No technique` and `Same language` approaches saw a minor 3% dip in the most challenging 100% mixed-context scenario, while `Constraint` and `Appended directive` achieved perfect scores, proving highly effective in ensuring consistency even under maximum context-language mismatch.

### Qwen 2.5 3B

| Prompt Technique   | precision at 0% | precision at 50% | precision at 100% |
| ------------------ | --------------- | ---------------- | ----------------- |
| No technique       | 980 (98%)       | 949 (95%)        | 850 (85%)         |
| Same language      | 982 (98%)       | 940 (94%)        | 811 (81%)         |
| At beginning       | 990 (99%)       | 962 (96%)        | 880 (88%)         |
| Constraint         | 1000 (100%)     | 978 (98%)        | 920 (92%)         |
| Appended directive | 1000 (100%)     | 991 (99%)        | 950 (95%)         |

**Interpretation:** Qwen 2.5 3B showed strong performance, particularly with explicit guidance. While its baseline performance degraded noticeably when the entire context was in English (80-85% accuracy for `No technique` and `Same language`), using techniques like `Constraint` (92%) and especially `Appended directive` (95%) significantly improved consistency in the 100% mixed scenario. The `Same language` instruction was the least effective method in the most challenging case.

### Qwen 4B

| Prompt Technique   | precision at 0% | precision at 50% | precision at 100% |
| ------------------ | --------------- | ---------------- | ----------------- |
| No technique       | 954 (95%)       | 852 (85%)        | 602 (60%)         |
| Same language      | 943 (94%)       | 810 (80%)        | 557 (56%)         |
| At beginning       | 960 (96%)       | 883 (88%)        | 652 (65%)         |
| Constraint         | 992 (99%)       | 900 (90%)        | 721 (72%)         |
| Appended directive | 1000 (100%)     | 920 (92%)        | 750 (75%)         |

**Interpretation:** Qwen 4B, despite being larger, confirmed its challenges with this specific multilingual task, particularly as English context increased. While not a complete failure as suggested by smaller sample sizes, its accuracy dropped significantly in the 100% English context scenario, achieving only 55-75% precision depending on the technique. `Appended directive` (75%) and `Constraint` (72%) offered the best mitigation, markedly outperforming the baseline and the least effective `Same language` approach (55%). This reinforces that model training focus heavily impacts specific multilingual capabilities.

## Conclusion

This experiment investigated the effectiveness of various prompt engineering techniques in ensuring language consistency for small multilingual models when faced with mixed-language context, based on 1000 trials per condition. Our goal was to maintain Portuguese output despite the presence of English context documents.

**Key Findings:**

1.  **Model Variation is Significant:** Model choice remains critical. Llama 3.2 3B exhibited outstanding resilience, barely affected even by fully foreign context. Qwen 2.5 3B performed well but required stronger guidance (`Appended directive`, `Constraint`) to maintain high accuracy (90-95%) under 100% context mismatch. Qwen 4B struggled the most in the 100% mix scenario (70-75% accuracy with the best techniques), highlighting the impact of its training data focus.
2.  **Prompt Techniques Crucial for Consistency:** Explicit language guidance significantly impacts performance, especially under context stress. `Appended directive` consistently yielded the best results across models, closely followed by `Constraint`. Placing the instruction `At beginning` was moderately effective. Simply instructing the model to use the `Same language` as the user message proved to be the least reliable technique when context language differed significantly.
3.  **Fully Foreign Context Remains Challenging:** The 100% mixed-language scenario effectively highlights model and technique differences. While Llama 3.2 handled it with ease, both Qwen models showed notable degradation, emphasizing the difficulty and the necessity of robust prompting strategies.

**Implications:**

-   Building reliable multilingual applications with small models necessitates careful model selection and testing specific language pairs under stress. Llama 3.2 stands out for this EN->PT task.
-   For strict language adherence, implementing clear, explicit language instructions is vital. Appending a language directive directly to the user query or using a dedicated constraint section in the prompt are the most promising strategies based on these results. Avoid relying solely on implicit instructions like "answer in the user's language" when context might conflict.

**Limitations & Future Work:**

-   This study used a limited set of models and one language pair (EN context -> PT target).
-   The evaluation relied on synthetic context mixing from the Wikipedia dataset.
-   While the sample size (1000 trials) is substantial, real-world conversational dynamics might differ.

Future research could expand this evaluation to include more models, diverse language pairs, real-world conversational data, and investigate the nuances of different constraint/directive phrasings.

Overall, ensuring language consistency in small models facing mixed-language input is achievable but requires careful model selection and strategic prompt engineering.
