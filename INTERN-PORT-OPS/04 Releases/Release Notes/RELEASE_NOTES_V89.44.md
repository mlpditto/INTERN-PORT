# Release Notes (V89.44) - Pre-Registration Linked Merging

## 🛠 Fixes & Improvements
- **Knowledge Base Modal Fix:** Fixed a missing closing `</div>` tag in the `knowledgeBaseModal` which caused it to encompass other modals (like `mergeModal`), inadvertently triggering its display when the `forceShowModal` function unwrapped parent elements.
- **Pre-Registration Integration in Merger:** The User Merger tool now robustly supports selecting and interacting with **Pre-registered Users**.
- **Bi-directional Merging:** 
  - Admins can now pick unclaimed **Pre-Registration entries** from the Merge target list alongside normal users.
  - The "Merge" button (`🔗`) is now added to Pre-registration user rows, allowing them to explicitly be selected as the Source.
  - **Manual Claim Execution:** When a merge operation detects a Real User and a Pre-Registration entry, it pivots from "moving collections" to a **Manual Claim** logic, which efficiently securely copies the `group`, `status`, and `dates` from the Pre-Reg to the Real User and flags the Pre-Reg as `claimed`.
- **Global Version Sync:** Bumped components globally to version **V89.44**.
