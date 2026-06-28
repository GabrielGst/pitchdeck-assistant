# LoRA

Alternatives Names: Low-Rank Adaptation; LoRA Adapter
Resource Link: https://huggingface.co/docs/peft/conceptual_guides/lora
Category: Fine-Tuning Technique
Programming Language: Python
Description: Freezes pre-trained model weights and injects small trainable rank-decomposition matrices into transformer layers. Reduces trainable parameters by ~99% vs full fine-tuning — feasible on a single GPU. Each adapter is a small standalone file loadable on top of any compatible base model.
Role in VC Assistant Infrastructure: Core fine-tuning technique for per-tenant memo generation. Each VC client gets their own LoRA adapter (~50-300MB) trained on their analyst memos, stored in S3 and hot-swapped at inference time on top of a shared base model.
Potential Alternatives (with main comparison): Full fine-tuning: highest quality but requires 8x+ more VRAM and storage — impractical per-tenant. QLoRA: extends LoRA with 4-bit quantization for even lower VRAM — use when base model exceeds available GPU memory. Prefix Tuning: alternative PEFT method, worse performance than LoRA in practice. Adapter layers (Houlsby): older method, LoRA has superseded it for most use cases.
Deployment Notes & File Structure: LoRA produces adapter files, not full models. Recommended structure:
models/
  base/                   # shared base model (once)
  adapters/
    tenant_a/
      adapter_config.json
      adapter_model.safetensors
    tenant_b/
      adapter_config.json
      adapter_model.safetensors
Short File/Config Template: # lora_config.py
from peft import LoraConfig
config = LoraConfig(
    r=16,
    lora_alpha=32,
    target_modules=["q_proj", "v_proj"],
    lora_dropout=0.05,
    bias="none",
    task_type="CAUSAL_LM"
)
Stack & Framework Integration: Used exclusively through Hugging Face PEFT library. Requires Transformers for base model loading. Integrates with TRL (SFTTrainer) for supervised fine-tuning. Adapters stored as safetensors files in S3, loaded at inference via PEFT's load_adapter().

# Stack & Framework Integration

Used exclusively through Hugging Face PEFT library. Requires Transformers for base model loading. Integrates with TRL (SFTTrainer) for supervised fine-tuning. Adapters stored as safetensors files in S3, loaded at inference via PEFT's load_adapter().

# Alternative Tools

Full fine-tuning: highest quality but requires 8x+ more VRAM and storage — impractical per-tenant. QLoRA: extends LoRA with 4-bit quantization for even lower VRAM — use when base model exceeds available GPU memory. Prefix Tuning: alternative PEFT method, worse performance than LoRA in practice. Adapter layers (Houlsby): older method, LoRA has superseded it for most use cases.

# Config Template

```jsx
LoRA produces adapter files, not full models. Recommended structure:
models/
  base/                   # shared base model (once)
  adapters/
    tenant_a/
      adapter_config.json
      adapter_model.safetensors
    tenant_b/
      adapter_config.json
      adapter_model.safetensors
```

# Code Example

```jsx
# lora_config.py
from peft import LoraConfig
config = LoraConfig(
    r=16,
    lora_alpha=32,
    target_modules=["q_proj", "v_proj"],
    lora_dropout=0.05,
    bias="none",
    task_type="CAUSAL_LM"
)
```