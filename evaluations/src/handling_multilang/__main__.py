import os
import asyncio
import csv
from datetime import datetime
from logging import getLogger, INFO, basicConfig
from random import sample as random_sample
from dotenv import load_dotenv

from ollama import chat
from openai import OpenAI

from .config import Config
from .utils import import_prompts, load_wikipedia_dataset, Languages, Models

logger = getLogger(__name__)

load_dotenv()

client = OpenAI()

def truncate_text(text: str, max_tokens: int) -> str:
    max_tokens_per_dataset = max_tokens // 2

    # Count approximate tokens in context (rough estimation: 4 chars = 1 token)
    context_tokens = len(text) // 3.75
    if context_tokens > max_tokens_per_dataset:
        # Truncate to approximately 7000 tokens (28000 chars)
        text = text[:max_tokens_per_dataset * 4]
        logger.info(f"Truncated context from ~{context_tokens} to ~{max_tokens_per_dataset} tokens")
    return text

async def detect_language(text: str) -> str:
    system_prompt = f"""
    <Role>
    You are the best language classifier that detects the language of a text.
    </Role>

    <Instructions>
    Classify the USER TEXT language as one of: ["es", "en", "zh"]. 
    Return only ISO 639-1 2-letter code. Avoid any other text or symbols. Example output: "es" 
    </Instructions>
    """

    user_prompt = f"USER TEXT: \n\n {text[:1000]}"

    max_tokens = Models.get_model_config(Config.language_detection_model).context_size
    
    try:
        output = client.chat.completions.create(
            model=Config.language_detection_model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            max_tokens=max_tokens,
            temperature=0.0
        )
        detected = output.choices[0].message.content.strip().lower()
        if detected in Config.test_languages:
            return detected
        else:
            raise ValueError(f"Detected language '{detected}' not in {Config.test_languages}")
    except Exception as e:
        logger.error(f"Language detection failed: {e}")
        raise e

async def generate_output(prompt_name: str, prompt_template: str, percentage: int, model: str, 
                         target_lang: Languages, mixed_lang: Languages,
                         main_dataset, mixed_dataset):
    # Select context sources based on percentage
    total_samples = Config.take_n_per_case
    main_samples = int(total_samples * (100 - percentage) / 100)
    mixed_samples = total_samples - main_samples
    max_tokens = Models.get_model_config(model_name=model).context_size - 1000
    
    # Get samples from both datasets
    main_texts = [t['text'] for t in random_sample(list(main_dataset), main_samples)] if main_samples > 0 else []
    mixed_texts = [t['text'] for t in random_sample(list(mixed_dataset), mixed_samples)] if mixed_samples > 0 else []
    
    truncated_main_texts = [truncate_text(t, max_tokens) for t in main_texts]
    truncated_mixed_texts = [truncate_text(t, max_tokens) for t in mixed_texts]

    combined_text = "\n\n".join(truncated_main_texts + truncated_mixed_texts)
    
    # Prepare prompt
    prompt = prompt_template.replace("%%LANGUAGE%%", target_lang)
    prompt = prompt.replace("%%CONTEXT%%", combined_text)
    prompt = prompt.replace("%%EXAMPLE%%", {
        Languages.ES: "El contenido principal del texto trata sobre...",
        Languages.EN: "The main content of the text is about...",
        Languages.ZH: "文本的主要内容是关于...",
        Languages.PT: "O conteúdo principal do texto aborda..."
    }[target_lang])
    
    # Generate response
    output = chat(model=model, messages=[{"role": "user", "content": prompt}], stream=False, options={"num_ctx": 8000})
    response = output['message']['content']

    detected_lang = await detect_language(response)
    
    return {
        "model": model,
        "prompt_name": prompt_name,
        "percentage": percentage,
        "target_lang": target_lang,
        "detected_lang": detected_lang,
        "is_correct": detected_lang == target_lang,
        "output": response,
        "timestamp": datetime.now().isoformat()
    }

async def main():
    try:
        logger.info("Loading datasets...")
        target_ds = load_wikipedia_dataset(Config.target_language, Config.take_n_samples)
        mixed_ds = load_wikipedia_dataset(Config.mixed_language, Config.take_n_samples)
        
        logger.info("Importing prompts...")
        prompts = import_prompts()
        
        # Initialize results storage
        results_file = f"results_{datetime.now().strftime('%Y%m%d%H%M')}.csv"
        fieldnames = ["model", "prompt_name", "percentage", 
                     "target_lang", "detected_lang", "is_correct", "output", "timestamp"]
        
        with open(results_file, 'w', newline='') as csvfile:
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            writer.writeheader()
            
            logger.info("Evaluating prompts...")
            for prompt_name, prompt_template in prompts.items():
                for model in Config.test_models:
                    for time in range(Config.test_times):
                        for percentage in Config.test_percentages:
                            logger.info(f"Testing {prompt_name} with {model} at {percentage}% mixed and {time} time...")
                            result = await generate_output(
                                prompt_name=prompt_name,
                                prompt_template=prompt_template,
                                percentage=percentage,
                                model=model,
                                target_lang=Config.target_language,
                                mixed_lang=Config.mixed_language,
                                main_dataset=target_ds,
                                mixed_dataset=mixed_ds
                            )
                            writer.writerow(result)

        
        logger.info(f"Evaluation complete. Results saved to {results_file}")
                        
    except Exception as e:
        logger.error(f"\nError: {e}\n")
        raise e

if __name__ == "__main__":
    basicConfig(level=INFO, format="%(asctime)s - %(levelname)s - %(message)s")
    asyncio.run(main())
