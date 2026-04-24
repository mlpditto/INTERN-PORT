# RELEASE NOTES - V87.63

## Knowledge Base Management Upgrade
Implemented major improvements to the Knowledge Base (KB) project management system.

### 1. Project/Folder Renaming
* Added a **Rename Project** button in the Knowledge Base Manager.
* Admins can now rename an entire project, which automatically updates all associated documents in Firestore via a batch operation.
* Integrated with SweetAlert2 (Swal) for a premium, non-blocking UI.

### 2. Document Reassignment (Move-to-Project)
* Added a **Move to another Project** button on individual documents.
* Allows moving files accidentally uploaded to the wrong project without deleting and re-uploading.

### 3. Improved Data Segregation
* Refined the filtering logic in `renderKnowledgeBase` to ensure the UI correctly isolates documents by their assigned project.
* Synchronized the filters between the **AI Digital Hub** sidebar and the **KB Manager** modal.
* Ensured AI grounding (RAG) strictly adheres to the project filter selected in the sidebar.

### 4. UI Polish & Stability
* Fixed project filter dropdowns to dynamically populate and sort project names.
* Optimized Document counting logic for filtered views.
* Corrected syntax issues with async project updates.

---
*MedLifePlus Internship Admin Portal Development | 2024 Stable Build*
