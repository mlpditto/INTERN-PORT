# Exam styles — source check (Phase 1)

Checked 2026-10-17 for the planned Expand quiz styles **NAPLEX · FPGEE · SPC Competency · SPC Forensic · Korean KPLE**.
Nothing here is built yet. The Expand quiz styles live in `SQM_EXAM_STYLES` (`public/admin.html`); each style is
written **in our own words** from the public blueprint and never reproduces real exam items.

Legend — ✅ read in the official document this session · ⚠️ only seen in a search-result summary or a secondary
source (open the link before relying on it) · ❓ not found.

The owner's pasted blueprint is compared line by line; where it differs, the official figure wins.

---

## 1. NAPLEX (USA — NABP)

| Fact | Value | Status | Source |
|---|---|---|---|
| In force | exams on or after **1 May 2025** | ✅ | [Content Outline](https://nabp.pharmacy/wp-content/uploads/2024/09/NAPLEX-Content-Outline.pdf) |
| Domain weights (of **200 scored** questions) | 1 Foundational Knowledge for Pharmacy Practice **25%** (50) · 2 Medication Use Process (Prescribing, Transcribing and Documenting, Dispensing, Administering, Monitoring) **25%** (50) · 3 Person-Centered Assessment and Treatment Planning **40%** (80) · 4 Professional Practice **5%** (10) · 5 Pharmacy Management and Leadership **5%** (10) | ✅ | Content Outline p. 4 |
| Item types | multiple choice, multiple response (select all that apply), fill in the blank | ✅ | [Fact Sheet](https://nabp.pharmacy/wp-content/uploads/2024/08/NAPLEX-Fact-Sheet.pdf) |
| Unscored pre-test items exist | yes | ✅ | Fact Sheet |
| Max attempts | 5 | ✅ | Fact Sheet |
| Domain 1 sub-domains | pharmaceutical science (pharmacology, PK/PD/pharmacogenomics, pharmaceutics) · compounding (non-sterile, sterile) · **pharmaceutical calculations** (9 kinds: patient/lab parameters, quantities to dispense, rates, dose conversions, concentrations/osmolarity, compounding quantities, nutrition, biostatistical/epidemiological/pharmacoeconomic, PK parameters) · drug development · research design and biostatistics · literature retrieval | ✅ | Content Outline |
| Domain 2 sub-domains | prescription/medication-order interpretation · therapeutic substitution · immunization services · handling, storage, stability, disposal | ✅ | Content Outline |
| Total 225 items (200 scored + 25 pre-test), 6 hours | — | ❓ not in the outline or fact sheet | pasted text only |
| "Ordered response", "constructed response" | — | ❓ the fact sheet says *fill in the blank* instead | pasted text only |

**Pasted blueprint vs official:** weights match. Item types differ (see above). Duration and total items unconfirmed.

**For the prompt:** weights are safe to encode. Stress patient data → decision (drug / dose / monitoring) and calculations. Only ask for item types the app can store (Phase 3 must check which of select-all and numeric / fill-in answers it supports).

---

## 2. FPGEE (USA — NABP, foreign graduates)

| Fact | Value | Status | Source |
|---|---|---|---|
| Domain weights (of **200 scored** questions) | 1 Foundational Biomedical Sciences **12%** (24) · 2 Pharmaceutical Sciences **31%** (62) · 3 Social, Behavioral, and Administrative Sciences **20%** (40) · 4 Pharmacy Practice and Clinical Sciences **37%** (74) | ✅ | [2025 Content Outline](https://nabp.pharmacy/wp-content/uploads/2025/10/FPGEE-Content-Outline.pdf) p. 5 |
| Domain 1 | anatomy and physiology · biochemistry · medical microbiology · immunology · pathophysiological bases of disease | ✅ | Content Outline |
| Domain 2 | pharmaceutical calculations · medicinal chemistry · pharmacology and toxicology · pharmaceutics and biopharmaceutics · pharmacokinetics · pharmacogenomics · extemporaneous compounding | ✅ | Content Outline |
| Domain 3 | pharmacy law and ethics · health care systems · pharmacoeconomics · population-based care / public health · practice management · professional communication · biostatistics and research methods · social and behavioral aspects | ✅ | Content Outline |
| Domain 4 | clinical pathophysiology · data collection · data assessment (incl. clinical calculations) · patient-care decision making and education · patient safety · disease prevention · personalized medicine · evidence-based practice | ✅ | Content Outline |
| Format | 200 questions, computer-based fixed form, 4.5 h testing inside 5.5 h seat time, scaled pass 75 | ⚠️ search summary of [NABP FPGEE page](https://nabp.pharmacy/programs/foreign-pharmacy/fpgee/) | open the page |
| Item formats | multiple choice, multiple response, constructed/ordered response, hot spot | ⚠️ only an older 2020 bulletin | — |

**Pasted blueprint vs official:** weights match the 2025 outline exactly. A NABP competency-statements page was summarised as "Clinical ≈ 35%" in a search result; it was not reopened — treat as older than the 2025 outline.

**For the prompt:** heavier on Pharmaceutical Sciences (31%) and Foundational Biomedical (12%) than NAPLEX, plus a Social/Admin domain (law, systems, communication, biostatistics).

---

## 3. SPC Competency (Singapore Pharmacy Council)

| Fact | Value | Status | Source |
|---|---|---|---|
| Format | closed book · all multiple choice, pick the most appropriate answer · **no negative marking** | ✅ | [Guide to the Competency Assessment/Examination, March 2023](https://isomer-user-content.by.gov.sg/79/c2cf1c0d-8582-45a7-98f7-30d880d151a1/guide-to-competency-assessment-exam-2023.pdf) §A.3 |
| Size | **100** questions · **2 hours** · pass mark **60%** | ✅ | Guide §A.3 |
| Weights | ~**85%** Pharmaceutical Care · ~**15%** Pharmacy Ethics, Pharmacy Systems and Procedures | ✅ | Guide §A.3 / syllabus |
| Case-based | **50%** of questions | ✅ | Guide §A.3 (March 2023) |
| Syllabus | sections A Pharmaceutical Care · B Ethics, Systems and Procedures · C Pharmacoeconomics and D Pharmacogenomics are marked *currently omitted* | ✅ | Guide, syllabus |
| Re-sits | 2 re-sit attempts | ✅ | Guide |

**Pasted blueprint vs official:** "about 40 case-based questions" is the **2018** wording; the 2023 guide says **50%**. Everything else matches.

**For the prompt:** short clinical-decision items, half of them case-based, with ~15% ethics / confidentiality / procedure. No law-heavy content (that is the Forensic exam).

---

## 4. SPC Forensic (Singapore — pharmacy law)

| Fact | Value | Status | Source |
|---|---|---|---|
| Format | **60** multiple-choice questions + **2** structured questions | ⚠️ SPC annual reports 2020 / 2022 / 2023 (search summaries) | [Annual Report 2023](https://isomer-user-content.by.gov.sg/79/e1851203-b688-47aa-a7ef-ecf0214825c5/spc-annual-report-2023_full_final-w-fs_2sepalttextremoved_pdfa.pdf) |
| Pass mark / attempts | pass mark **60** · max **3** attempts · covers Pharmacy Laws in Singapore | ⚠️ SPC web pages (search summary) | [SPC — foreign-trained graduates](https://www.spc.gov.sg/for-professionals/apply-for-registration/foreign-trained-pharmacy-graduates-pharmacists/) |
| Mark split (60 + 20 + 20) | — | ❓ | pasted text only |
| Acts / code on the syllabus (Pharmacists Registration Act, Health Products Act, Poisons, Misuse of Drugs, Code of Ethics …) | — | ❓ no syllabus document found | pasted text only |

**Pasted blueprint vs official:** the two-part shape is consistent; the mark split and the list of Acts are unverified.

**For the prompt:** generic "Singapore pharmacy law and professional ethics" scenarios only, unless the owner supplies the syllabus. **Do not let the model cite Act names, section numbers or penalties** — it will invent them.

---

## 5. KPLE — Korean Pharmacist Licensing Examination (한국보건의료인국가시험원)

| Fact | Value | Status | Source |
|---|---|---|---|
| Size / format | 4 subjects · **350** questions · 1 point each · 5-option multiple choice | ✅ | [kuksiwon.or.kr — 약사 시험정보](https://www.kuksiwon.or.kr/subcnt/c_2009/7/view.do?seq=7) |
| Sessions | 1: 생명약학 (Life Science in Pharmacy) **100**, 90 min · 2: 산업약학 (Industrial Pharmacy) **90**, 85 min · 3: 임상·실무약학 1 **77**, 75 min · 4: 임상·실무약학 2 **63** + 보건·의약관계법규 **20**, 75 min | ✅ | same page |
| Clinical + practice total | 77 + 63 = **140** | ✅ | same page |
| Total test time | 90 + 85 + 75 + 75 = **325 min** | ✅ | same page |
| Law subject covers | 약사법 · 마약류 관리에 관한 법률 · 국민건강증진법 · 보건의료기본법 · 국민건강보험법 · 지역보건법 and their decrees / rules | ✅ | same page |
| Pass rule (≥ 60% overall and ≥ 40% in every subject) | — | ⚠️ secondary source; the regulation annex PDF had unreadable Korean text (only "60" / "40" digits visible) | [법령 별표](https://www.law.go.kr/LSW//flDownload.do?flSeq=43909142&flNm=%5B%EB%B3%84%ED%91%9C+1%EC%9D%983%5D+%EA%B5%AD%EA%B0%80%EC%8B%9C%ED%97%98%EC%9D%98+%EC%8B%9C%ED%97%98%EA%B3%BC%EB%AA%A9%2C+%EC%8B%9C%ED%97%98%EB%B0%A9%EB%B2%95+%EB%B0%8F+%ED%95%A9%EA%B2%A9%EC%9E%90+%EA%B2%B0%EC%A0%95%EB%B0%A9%EB%B2%95%28%EC%A0%9C2%EC%A1%B0+%EA%B4%80%EB%A0%A8%29%0A) |
| Moves to computer-based testing | from the 2026 sitting (77th) | ⚠️ search summary of the official notice | open the notice |

**Pasted blueprint vs official:** 100 / 90 / 140 / 20 = 350 and ~325 min **match the official page exactly**. An older 2017 paper gave Clinical = 104 (total 314) — superseded; ignore it.
**Don't mix up:** `kuksiwon.or.kr/subcnt/c_2010/7/…` is the **한약사** (Korean-medicine pharmacist) page — 250 questions, a different exam.

**For the prompt:** clinical + practice is the largest part (140 / 350 = 40%), then 생명약학 (29%), 산업약학 (26%), law (6%). Law items must stay inside the six Acts named above and must not cite article numbers.

---

## What this settles

| Exam | Weights usable in the prompt? | Needs from the owner |
|---|---|---|
| NAPLEX | yes (official) | confirm duration / 225 items only if we want them in the hint text |
| FPGEE | yes (official 2025) | — |
| SPC Competency | yes (official 2023; case-based = 50%) | — |
| SPC Forensic | **format only** | the syllabus (Acts list) if law-specific items are wanted |
| KPLE | yes (official) | confirm the pass rule if it goes in the hint |

## Rules for every new style (same as the existing styles)

- Original items in our own words; never reproduce or closely paraphrase real exam questions.
- Law content: name the *area* of law; **no article / section numbers, fines or dates** unless the owner supplied the text.
- Use only item types the quiz editor can store (check before Phase 3; the existing styles use single-best, "Choose TWO" and "Select ALL").
- Each new style gets a one-line hint and, where law is optional, the existing Clinical / + Law scope toggle.

## Not verified (carry forward)

NAPLEX 225 items / 6 h · NAPLEX ordered response · FPGEE format line (page not opened) · SPC Forensic mark split and syllabus · KPLE pass rule and CBT date.
