# 📁 File Organization Archive

This folder contains archived files from the INTERN-PORT project cleanup on **2026-04-25**.

## 🗂️ Folder Structure

### `/versions/`
Contains backup versions of HTML files:
- `v9070_admin.html` - Admin interface backup (2.4MB)
- `v9070_admin_utf8.html` - UTF-8 version of admin
- `v9070_index.html` - Main interface backup (750KB)
- `v9070_index_utf8.html` - UTF-8 version of index
- `v91.html`, `v92_final.html`, `v99.html` - Development versions

**Current active files**: `admin.html` and `index.html` in root directory

### `/temp/`
Contains temporary files that were used during development:
- `temp_admin.html` - Temporary admin interface copy
- `temp_admin2.html` - Second temporary admin copy

### `/scratch/`
Contains scratch scripts and utilities:
- `extract_admin_script.js` - Script to extract admin JavaScript
- `extract_script.js` - Script to extract main JavaScript
- `fix_buttons.py` - Python script to fix duplicate buttons
- `add_llama.py` - Python script to add Llama model
- `scratch_*.js` - Extracted JavaScript files for testing

## 📋 Cleanup Summary

### Files Moved to Archive
- ✅ All version files (v9070_*, v9*.html)
- ✅ All temp files (temp_*.html)
- ✅ All scratch files and utilities

### Files Deleted
- ✅ `check_gemini_models.py` - Model checking utility
- ✅ `check_logs.js` - Log checking script
- ✅ Various temporary text files

### Files Kept in Root
- ✅ `admin.html` - Current admin interface (1.6MB, updated 2026-04-25)
- ✅ `index.html` - Current main interface (458KB, updated 2026-04-25)
- ✅ `draw_kanban.txt` - Kanban board code snippet
- ✅ Documentation files (*.md)
- ✅ Configuration files (*.json, *.js)
- ✅ Firebase and deployment files

## 🔄 Recovery Instructions

If you need to restore any archived files:

1. **Version Files**: Copy from `/versions/` to root directory
2. **Temp Files**: Copy from `/temp/` to root directory  
3. **Scratch Scripts**: Copy from `/scratch/` to root directory

## 📝 Notes

- The current active files (`admin.html`, `index.html`) are the most recent versions
- All archived files are from development work before 2026-04-25
- No functional code was deleted - only moved to archive for organization
- Scratch files contain utility scripts that may be useful for future maintenance

---
*Archive created: 2026-04-25 01:08 AM*
*Organized by: Cascade AI Assistant*
