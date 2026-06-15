# Security Specification - ESE Roldanillo

## Data Invariants
1. **Identity Integrity**: A doctor can only read and update their own notification status.
2. **Shift Request Integrity**: Only the owner (doctor) can create a shift request; only an admin can approve/reject it.
3. **Audit Log Persistence**: Audit logs are immutable once created and can only be created by admins.
4. **Schedule Authority**: Only admins can modify monthly shift data and global variables.
5. **Doctor Profile Protection**: Doctors can update their own passwords, but not their status, category, or identity.

## The "Dirty Dozen" Payloads (Malicious Attempts)

1. **Identity Spoofing**: Attempt to create a shift request with a `doctorId` that doesn't match the authenticated user.
2. **Privilege Escalation**: A doctor attempting to update `monthlyData` to assign themselves better shifts.
3. **State Shortcutting**: A doctor attempting to mark their own shift request as `approved`.
4. **Resource Poisoning**: Injection of a 1MB string into a `doctorName` field in `shiftRequests`.
5. **Audit Log Deletion**: Attempting to delete a log from the `auditLogs` collection to hide unauthorized changes.
6. **Global Config Hijacking**: A non-admin trying to change shift hour variables in `settings/variables`.
7. **Cross-Doctor Snooping**: A doctor trying to read all `notifications` (sensitive because they contain shift change details).
8. **Shadow Field Injection**: Adding an `isAdmin: true` field to a `doctors` document update.
9. **Timestamp Manipulation**: Sending a manual `timestamp` instead of `serverTimestamp` to backdate a request.
10. **Ghost Doctor Creation**: A non-admin attempting to add a new doctor to the `doctors` collection.
11. **Negative Hour Injection**: Setting a shift hour value to -100 in `settings/variables`.
12. **Notification Spam**: Attempting to push notifications to other doctors.

## Security Rule Strategy
1. **Master Gate**: All writes must check for logical consistency (e.g., does the referenced doctor exist?).
2. **Role Verification**: Use a dedicated `admins` collection or check a `role` field in the doctor profile (verified against Firebase Auth).
3. **Validation Blueprints**: Strict schema checks for types and sizes on every write.
4. **Update Action Partitioning**: Updates to `shiftRequests` are and-ed with state checks (pending -> approved).

## Test Runner Plan
We will use `firestore-jest-mock` or similar for verification if available, or simply provide the `firestore.rules.test.ts` content for manual verification.
