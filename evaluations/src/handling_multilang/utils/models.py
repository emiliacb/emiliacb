from enum import Enum

class ModelConfig:
  def __init__(self, name: str, context_size: int):
    self.name = name
    self.context_size = context_size

class Models(Enum):
  GEMMA3_4B = ModelConfig("gemma3:4b", 2000)
  SMOLLM2_1_7B = ModelConfig("smollm2:1.7b", 2000)
  QWEN_4B = ModelConfig("qwen:4b", 5000)
  QWEN2_5_3B = ModelConfig("qwen2.5:latest", 5000)
  LLAMA3_2_3B = ModelConfig("llama3.2:3b", 4000)
  GPT_4O_MINI = ModelConfig("gpt-4o-mini-2024-07-18", 2000)

  @property
  def name(self):
      return self.value.name

  @property
  def context_size(self):
      return self.value.context_size

  @classmethod
  def get_model_config(cls, model_name: str) -> ModelConfig:
    try:
      return next(m.value for m in cls if m.value.name == model_name)
    except StopIteration:
      raise ValueError(f"Unknown model: {model_name}")

  