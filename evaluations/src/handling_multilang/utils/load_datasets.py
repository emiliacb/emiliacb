import os
from datasets import load_dataset


def load_wikipedia_dataset(lang: str, take: int):
    cache_path = os.path.expanduser("../../datasets")
    os.makedirs(cache_path, mode=0o755, exist_ok=True)
    os.environ["HF_HOME"] = cache_path
    
    ds = load_dataset("wikimedia/wikipedia", f"20231101.{lang}", 
                        cache_dir=cache_path,
                        streaming=True)

    ds = ds["train"].take(take)
    return list(ds)
