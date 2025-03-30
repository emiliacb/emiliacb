from .utils import Languages, Models

class Config:
  take_n_samples = 100
  take_n_per_case = 2
  test_times = 50
  test_models = [Models.LLAMA3_2_3B.name, Models.QWEN2_5_3B.name, Models.QWEN_4B.name]
  target_language = Languages.PT
  mixed_language = Languages.EN
  test_languages = [Languages.ES, Languages.PT, Languages.EN, Languages.ZH]
  test_percentages = [0, 100]
  language_detection_model = Models.GPT_4O_MINI.name
