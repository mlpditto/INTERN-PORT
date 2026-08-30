# openmed-pharma — on-device drug-name NER

`onnx/model_quantized.onnx` is an int8 ONNX export of
[`OpenMed/OpenMed-NER-PharmaDetect-ElectraMed-33M`](https://huggingface.co/OpenMed/OpenMed-NER-PharmaDetect-ElectraMed-33M)
(Apache-2.0, `BertForTokenClassification`, labels `O / B-CHEM / I-CHEM`).

Used by `lnrScanDrugs()` in `admin.html` to suggest drug tags in the Learning Note
Review modal. Runs entirely in the browser via transformers.js — the note text
never leaves the admin's machine, unlike the `callAIProxy` features.

The upstream repo ships **no** ONNX, so this was exported locally:

```bash
uv pip install "optimum[onnxruntime]" onnx onnxruntime
python - <<'PY'
from optimum.onnxruntime import ORTModelForTokenClassification
from onnxruntime.quantization import quantize_dynamic, QuantType
from transformers import AutoTokenizer
mid = "OpenMed/OpenMed-NER-PharmaDetect-ElectraMed-33M"
ORTModelForTokenClassification.from_pretrained(mid, export=True).save_pretrained("out")
AutoTokenizer.from_pretrained(mid).save_pretrained("out")
quantize_dynamic("out/model.onnx", "out/onnx/model_quantized.onnx", weight_type=QuantType.QInt8)
PY
```

fp32 export is 133 MB; int8 is 33.8 MB with no measured accuracy loss (drug recall
16/17 on both, on a 12-note Thai/English spike corpus).

Only `model_quantized.onnx` is committed — transformers.js is pinned to `dtype: 'q8'`,
so the fp32 graph would be 133 MB of dead weight in the repo.

## Known limits

- English/Latin drug names only. Thai-script drug words ("ยาลดความดัน") score 0/3 —
  this model family has no Thai encoder. See the spike notes for the full picture.
- Fires on some non-drug medical acronyms (e.g. `DKA`). Output is a *suggestion*
  chip row the admin clicks, never an auto-applied tag, so a false positive costs
  nothing but a glance.
- Multi-word names are split per word ("vitamin K" surfaces as "vitamin"), a
  deliberate trade for precision — merging runs across whitespace produced
  garbage spans like "Warfarin Salbutamol".
