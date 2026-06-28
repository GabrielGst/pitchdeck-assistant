# QLoRA

Alternatives Names: Quantized LoRA; 4-bit LoRA
Resource Link: https://huggingface.co/blog/4bit-transformers-bitsandbytes
Category: Fine-Tuning Technique
Programming Language: Python
Description: Extends LoRA by quantizing the frozen base model weights to 4-bit NF4 precision using bitsandbytes. Allows fine-tuning 70B parameter models on a single 48GB GPU that would otherwise require 4x A100s. Slight quality degradation vs full-precision LoRA.
Role in VC Assistant Infrastructure: Used for fine-tuning larger base models (LLaMA 3 70B) for enterprise tenants who require higher output quality. Enables cost-effective training on smaller GPU instances available on Modal and RunPod.
Potential Alternatives (with main comparison): LoRA (full precision): higher quality output but requires 2-4x more VRAM — use when GPU budget allows. GPTQ fine-tuning: alternative quantization approach, less flexible than QLoRA. AWQ: newer quantization, better inference speed but less training ecosystem support. Full fine-tuning: maximum quality, requires a GPU cluster — not viable per-tenant.
Deployment Notes & File Structure: Same adapter file structure as LoRA. Recommended structure:
training/
  qlora_train.py          # main training script
  bnb_config.py           # BitsAndBytes config
  data_loader.py          # tenant dataset loader
  push_adapter.py         # S3 artifact upload
  requirements.txt        # includes bitsandbytes
Short File/Config Template: # qlora_setup.py
from transformers import BitsAndBytesConfig
import torch
bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_use_double_quant=True,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_compute_dtype=torch.bfloat16
)
# Pass to AutoModelForCausalLM.from_pretrained()
Stack & Framework Integration: Requires bitsandbytes library alongside PEFT and Transformers. Must be combined with LoraConfig (QLoRA is not a standalone method — it is LoRA + quantized base model). Compatible with TRL's SFTTrainer. GPU must support bfloat16 (A100, H100, RTX 3090+).

# Stack & Framework Integration

Requires bitsandbytes library alongside PEFT and Transformers. Must be combined with LoraConfig (QLoRA is not a standalone method — it is LoRA + quantized base model). Compatible with TRL's SFTTrainer. GPU must support bfloat16 (A100, H100, RTX 3090+).

# Alternative Tools

LoRA (full precision): higher quality output but requires 2-4x more VRAM — use when GPU budget allows. GPTQ fine-tuning: alternative quantization approach, less flexible than QLoRA. AWQ: newer quantization, better inference speed but less training ecosystem support. Full fine-tuning: maximum quality, requires a GPU cluster — not viable per-tenant.

# Config Template

```jsx
Same adapter file structure as LoRA. Recommended structure:
training/
  qlora_train.py          # main training script
  bnb_config.py           # BitsAndBytes config
  data_loader.py          # tenant dataset loader
  push_adapter.py         # S3 artifact upload
  requirements.txt        # includes bitsandbytes
```

# Code Example

```jsx
# qlora_setup.py
from transformers import BitsAndBytesConfig
import torch
bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_use_double_quant=True,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_compute_dtype=torch.bfloat16
)
# Pass to AutoModelForCausalLM.from_pretrained()
```