# Hugging Face

Alternatives Names: HuggingFace; HF Hub; Transformers Hub
Resource Link: https://huggingface.co/docs
Category: Model Hub / Ecosystem
Programming Language: Python
Description: Central platform for open-source ML: model hub with 500k+ models, datasets repository, Spaces for demos, and the Transformers library. Industry-standard entry point for loading and sharing pre-trained models.
Role in VC Assistant Infrastructure: Source of base models (Mistral 7B, LLaMA 3 8B/70B) used before per-tenant fine-tuning. Private repos store fine-tuned adapter artifacts per client. Tokenizers and model configs pulled at training and inference time.
Potential Alternatives (with main comparison): Ollama: simpler local model serving but no training ecosystem — suitable for local dev only, not production fine-tuning pipelines. Together AI: managed model hosting with fine-tuning API but less control and transparency. Replicate: model serving marketplace but no private artifact management. Unsloth: optimized fine-tuning framework that sits on top of HF, not a replacement.
Deployment Notes & File Structure: Hub artifacts stored in S3 or HF private repos. Recommended project structure:
ml/
  models/
    download_base.py      # one-time base model pull
    push_adapter.py       # upload tenant adapter to HF Hub
  tokenizers/
    tokenizer_utils.py    # shared tokenizer loading
  configs/
    model_config.yaml     # base model ID and settings
Short File/Config Template: # hf_load.py
from transformers import AutoModelForCausalLM, AutoTokenizer
model_id = "mistralai/Mistral-7B-Instruct-v0.2"
tokenizer = AutoTokenizer.from_pretrained(model_id)
model = AutoModelForCausalLM.from_pretrained(
    model_id,
    device_map="auto"
)
Stack & Framework Integration: Core dependency for the entire ML stack. Transformers library used in Modal/RunPod training jobs and vLLM inference servers. Hub Python client used to push/pull adapter artifacts. Integrates with PEFT, TRL, bitsandbytes, and Accelerate. Private model repos per tenant for artifact storage.

# Stack & Framework Integration

Core dependency for the entire ML stack. Transformers library used in Modal/RunPod training jobs and vLLM inference servers. Hub Python client used to push/pull adapter artifacts. Integrates with PEFT, TRL, bitsandbytes, and Accelerate. Private model repos per tenant for artifact storage.

# Alternative Tools

Ollama: simpler local model serving but no training ecosystem — suitable for local dev only, not production fine-tuning pipelines. Together AI: managed model hosting with fine-tuning API but less control and transparency. Replicate: model serving marketplace but no private artifact management. Unsloth: optimized fine-tuning framework that sits on top of HF, not a replacement.

# Config Template

```jsx
Hub artifacts stored in S3 or HF private repos. Recommended project structure:
ml/
  models/
    download_base.py      # one-time base model pull
    push_adapter.py       # upload tenant adapter to HF Hub
  tokenizers/
    tokenizer_utils.py    # shared tokenizer loading
  configs/
    model_config.yaml     # base model ID and settings
```

# Code Example

```jsx
# hf_load.py
from transformers import AutoModelForCausalLM, AutoTokenizer
model_id = "mistralai/Mistral-7B-Instruct-v0.2"
tokenizer = AutoTokenizer.from_pretrained(model_id)
model = AutoModelForCausalLM.from_pretrained(
    model_id,
    device_map="auto"
)# hf_load.py
from transformers import AutoModelForCausalLM, AutoTokenizer
model_id = "mistralai/Mistral-7B-Instruct-v0.2"
tokenizer = AutoTokenizer.from_pretrained(model_id)
model = AutoModelForCausalLM.from_pretrained(
    model_id,
    device_map="auto"
)
```