# Two practice assignments, one submission client

- `index.html`: full name + class period; `2026-27-G6-ES-PROTOTYPE-01`.
- `anonymous.html`: class-only ID + class period; `2026-27-G7-LS-PROJECT-01`.
- Both use `assignment.js` for activity hooks and `../client/iaca-submission.js` for all identity, draft, submission, retry, and receipt behavior.
- `config.js` contains the one public deployment address. Nothing here is a secret, credential, class roster, or name-to-ID mapping.

After setting up the private Apps Script receiver, edit `config.js`:

```javascript
window.IACA_SUBMISSION_ENDPOINT = 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec';
```

Publish the `prototype/` and `client/` folders together without changing their relative paths. Follow `../docs/SETUP.md` for the backend and GitHub Pages origin configuration. Serve the files over HTTP locally for preview or HTTPS when deployed; do not double-click the HTML file from disk.

The amber preview notice appears until an endpoint is supplied. A missing endpoint never produces a fake successful receipt. Preview draft-saving, identity changes, and restoration can be exercised without a deployed receiver. Complete the receipt and Chromebook tests against your actual deployment before students use it.

Use these fake identities for setup practice: `Jordan Example`, period `3`, or `IACA-000042`, period `3`. ID mode asks for no real name. The private registry already includes both assignment IDs/version `1.0.0` and response keys `observation`, `choice`, and `measurement`.

The sample activities demonstrate validation and a minimal payload, not a complete science lesson. Their results object is empty. Answers are stored as entered; optional grading must be designed and labeled separately. A Barker Science receipt does not change Google Classroom's official status.

To create another assignment, copy only the activity page/hooks, reuse the shared client, and add its authoritative registry entry. See `../client/README.md` and `../docs/REUSE-PROMPT.md`.
