# Security Specification - Medical Shift Scheduling System

## 1. Data Invariants
- A doctor must have a unique ID and category.
- Shift requests can only be approved/rejected by admins.
- Audit logs are immutable and require admin privileges to create.
- Monthly data can only be modified by admins.
- Doctors can only modify their own passwords.
- Notifications can only be marked as 'read' by the recipient.

## 2. The "Dirty Dozen" Payloads (Target: Access Denied)
1. **Self-Promotion**: Non-admin attempting to add themselves to the `admins` collection.
2. **Shift Highjacking**: Doctor A attempting to update a shift request belonging to Doctor B.
3. **Audit Log Erasure**: Any user attempting to delete an audit log.
4. **Schedule Vandalism**: Non-admin attempting to overwrite `monthlyData`.
5. **PII Scraping**: Anonymous user attempting to list all `doctors`.
6. **Setting Hijacking**: Non-admin attempting to change global `settings/variables`.
7. **Phantom Notification**: Doctor A attempting to create a notification for Doctor B.
8. **Status Bypass**: Non-admin attempting to approve their own `shiftRequest`.
9. **History Tampering**: Any user attempting to update an existing `auditLog`.
10. **Availability Spoofing**: Non-admin attempting to modify `ruralAvailability` records.
11. **Training Gatekeeping**: Non-admin attempting to delete a `trainingActivity`.
12. **Anonymous Admin**: Anonymous user (even if signed in) attempting to write to `admins` collection.

## 3. Test Runner (Conceptual)
All the above payloads MUST result in `PERMISSION_DENIED`.
