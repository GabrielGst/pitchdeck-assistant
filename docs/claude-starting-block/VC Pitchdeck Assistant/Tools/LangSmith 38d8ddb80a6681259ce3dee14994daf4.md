# LangSmith

Alternatives Names: LangChain LangSmith; LS Tracing
Resource Link: https://docs.smith.langchain.com
Category: LLM Observability
Programming Language: Python / TypeScript
Description: LLM-native observability platform by LangChain. Traces every LLM call with full prompt, output, token counts, latency, and cost. Supports prompt versioning, dataset management, and automated evaluations against golden datasets.
Role in VC Assistant Infrastructure: Traces all LLM calls in the orchestration layer: prompt version used, retrieved context, model output, latency, and cost per call. Essential for debugging poor memo quality, detecting prompt regressions after updates, and building evaluation datasets from production traces.
Potential Alternatives (with main comparison): Langfuse: open-source self-hostable alternative — preferred when client data sovereignty prohibits external SaaS. Helicone: simpler LLM proxy-based observability, less feature-rich. Weights & Biases (W&B): broader ML experiment tracking that includes LLM tracing — good if you already use W&B for model training. Arize Phoenix: open-source LLM observability with strong eval framework. Braintrust: evaluation-first platform, less strong on production tracing.
Deployment Notes & File Structure: LangSmith is SaaS — no deployment. Recommended code structure:
app/
  llm/
    langsmith_config.py   # env var setup + project config
    traceable_chains.py   # LangChain chains with auto-tracing
    eval/
      datasets.py         # golden dataset push to LangSmith
      run_evals.py        # automated eval runner
  config/
    langsmith.env         # LANGCHAIN_API_KEY, PROJECT per env
Short File/Config Template: # langsmith_config.py
import os
os.environ["LANGCHAIN_TRACING_V2"] = "true"
os.environ["LANGCHAIN_API_KEY"] = "ls-key"
os.environ["LANGCHAIN_PROJECT"] = "vc-assistant-prod"
# All LangChain calls now auto-traced
Stack & Framework Integration: Auto-integrates with LangChain via environment variables — zero code change for LangChain-based pipelines. For non-LangChain LLM calls, wrap with RunTree or @traceable decorator. Traces organized by project (one per environment). Tenant ID passed as metadata on each trace for filtering.

# Stack & Framework Integration

Auto-integrates with LangChain via environment variables — zero code change for LangChain-based pipelines. For non-LangChain LLM calls, wrap with RunTree or @traceable decorator. Traces organized by project (one per environment). Tenant ID passed as metadata on each trace for filtering.

# Alternative Tools

Langfuse: open-source self-hostable alternative — preferred when client data sovereignty prohibits external SaaS. Helicone: simpler LLM proxy-based observability, less feature-rich. Weights & Biases (W&B): broader ML experiment tracking that includes LLM tracing — good if you already use W&B for model training. Arize Phoenix: open-source LLM observability with strong eval framework. Braintrust: evaluation-first platform, less strong on production tracing.

# Config Template

```jsx
LangSmith is SaaS — no deployment. Recommended code structure:
app/
  llm/
    langsmith_config.py   # env var setup + project config
    traceable_chains.py   # LangChain chains with auto-tracing
    eval/
      datasets.py         # golden dataset push to LangSmith
      run_evals.py        # automated eval runner
  config/
    langsmith.env         # LANGCHAIN_API_KEY, PROJECT per env
```

# Code Example

```jsx
# langsmith_config.py
import os
os.environ["LANGCHAIN_TRACING_V2"] = "true"
os.environ["LANGCHAIN_API_KEY"] = "ls-key"
os.environ["LANGCHAIN_PROJECT"] = "vc-assistant-prod"
# All LangChain calls now auto-traced
```