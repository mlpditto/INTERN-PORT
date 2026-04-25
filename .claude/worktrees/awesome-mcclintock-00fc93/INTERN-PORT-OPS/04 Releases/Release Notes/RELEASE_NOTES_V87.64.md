# RELEASE NOTES - V87.64

## Knowledge Base: Folder & Project Management Upgrade
Enhanced the Research Assistant Knowledge Base (KB) with explicit folder management capabilities.

### 1. New Folder (Project) Creation
* Added a **New Folder** button in the Knowledge Base Manager.
* Admins can now create projects/folders explicitly before uploading documents.
* Implemented a system metadata mechanism that keeps folders persistent in the dropdown list even when they contain no documents.
* Automatically selects the newly created folder for the next upload session.

### 2. Streamlined Folder Renaming (Edit)
* Renamed the "Rename" button to **Edit** for a cleaner UI.
* Preserved the ability to perform batch updates on all documents within a project when a rename occurs.

### 3. Integrated Folder Filtering
* Synchronized the "Project Filter" with the new folder creation logic.
* Hidden system metadata documents from the document list to keep the view focused only on actual knowledge content.
* Improved UI feedback with SweetAlert2 (Swal) for a consistent premium experience.

---
*MedLifePlus Internship Admin Portal Development | 2024 Stable Build*
