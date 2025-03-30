import os
import glob

def import_prompts():
    path = os.path.join(os.path.dirname(__file__), "../prompts")
    prompts = {}
    prompt_files = sorted(glob.glob(os.path.join(path, "*.txt")))
    
    for prompt_file in prompt_files:
        filename = os.path.basename(prompt_file)
        prompt_name = os.path.splitext(filename)[0]
        
        with open(prompt_file, "r") as f:
            prompts[prompt_name] = f.read()
            
    return prompts
