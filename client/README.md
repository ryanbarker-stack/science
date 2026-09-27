# Reusable student client

Load `iaca-submission.css` and `iaca-submission.js`. The script exposes `window.IACASubmission`; it has no third-party dependencies. Keep the client files beside each published assignment or at a pinned versioned URL.

Use a visible identity/submission area and a **separate** activity element. Put the identity area near the start of long assignments so students can unlock the activity immediately. The component controls the activity's `inert` state and native form controls until the student confirms an identity.

```html
<link rel="stylesheet" href="../client/iaca-submission.css">
<script src="../client/iaca-submission.js"></script>
<aside id="submission" aria-label="Identity and turn in"></aside>
<section id="activity"><!-- activity inputs --></section>
```

```javascript
const submission = IACASubmission.init({
  mount: '#submission',
  workRoot: '#activity',
  endpoint: 'https://script.google.com/macros/s/DEPLOYMENT_ID/exec',
  assignment: {
    id: '2026-27-G6-ES-LIGHT-01',
    title: 'Light & Spectra Investigation',
    course: 'G6-EARTH-SPACE',
    schoolYear: '2026-27',
    version: '1.0.0'
  },
  identity: {
    type: 'student_name', // or anonymous_id or classroom_code
    namespace: 'iaca-2026-27',
    periods: ['1', '2', '3', '4', '5', '6', '7'],
    requirePeriod: true
  },
  collectResponses() { return collectAllActivityState(); },
  restoreResponses(responses) { restoreAllActivityState(responses); },
  resetResponses() { clearAllActivityState(); },
  validate(responses) {
    const errors = responses.observation.trim() ? [] : ['Write your observation.'];
    return { ok: errors.length === 0, errors };
  },
  collectResults() { return {}; },
  collectArtifacts() { return []; },
  autosaveMs: 350
});
```

The functions in this example are assignment-specific hooks, not built-in helpers. The actual starter hooks are in `../prototype/assignment.js`. Every assignment must also be registered privately in `../backend/Settings.gs`; browser configuration cannot grant server permission.

## API contract

| Option | Requirement |
| --- | --- |
| `mount` | CSS selector or element for the component. Must be outside `workRoot`. |
| `workRoot` | CSS selector or element containing all editable activity controls. |
| `endpoint` | Deployed Apps Script HTTPS `/exec` URL on `script.google.com`. |
| `assignment` | `id`, `title`, `course`, `schoolYear`, `version`. Server uses its registry for authoritative metadata. |
| `identity` | `type`, `namespace`, `periods`, `requirePeriod`; optional `nameTagRequired`, `idPattern`. |
| `collectResponses()` | Required synchronous function returning a JSON object containing all editable state. |
| `restoreResponses(responses)` | Required synchronous function restoring that complete state. Called only after identity confirmation. |
| `resetResponses()` | Required synchronous function clearing every student's activity state. Called on initialization and identity changes. |
| `validate(responses)` | Required synchronous function returning `{ok, errors:[string]}`. Runs before a new attempt. |
| `collectResults()` | Optional synchronous object; treated as unverified by the server. |
| `collectArtifacts()` | Optional array of HTTPS URL descriptors; no binary/base64 uploads. |
| `autosaveMs` | Input/change debounce; default 350 ms. |
| `timeoutMs` | Receipt wait; default 35000 ms. Timeout never implies rejection or success. |

`init()` returns `{save, turnIn, changeStudent, destroy}`. `turnIn()` returns a Promise; `save()` and `changeStudent()` return booleans. `destroy()` removes listeners and leaves the activity locked. Applications should normally initialize once per page.

For programmatic activity changes, call `submission.save()` or dispatch a bubbling `input`/`change` event within `workRoot`. Native form edits autosave. Custom widgets must respect `workRoot.inert` and must not keep changing state while the request is frozen.

**Restoration requirement:** put all editable and resumable state in `responses`. Derive `results` and artifact descriptors from restored responses. If a graph, simulation, or artifact URL only exists outside `responses`, the module cannot recreate it after refresh. Hooks must not maintain unscoped global/local drafts that can leak between students.

## Identity modes

Change the `identity.type` configuration and matching private registry policy; the submission transport does not change. IDs default to `^IACA-[0-9]{6}$`; classroom codes default to `^P[1-9][0-9]*C[0-9]{2}$`. `idPattern` can override this with a teacher-defined regular-expression string. Namespace is configuration, never student input.

Names retain display capitalization but group by NFKC normalization, whitespace normalization, and lower-case comparison. IDs and classroom codes normalize to uppercase. Optional `nameTagRequired` adds a teacher-issued tag for same-name/same-period cases; valid tags contain 1–24 ASCII letters, digits, hyphens, or underscores and start with a letter/digit. Configure the same policy on the server. Names and IDs are identification, not authentication.

The remember checkbox is off by default. Remembered identity is scoped by namespace and type, so name-mode remembered values are not offered in ID mode. Every page load still asks the student to confirm identity. A guessed name or ID can access that identity's local draft on a shared browser; this is not a private login system.

## Saving and receipt behavior

Draft keys include assignment ID, version, and SHA-256 of the canonical modular identity. Drafts are separated for different students. Old drafts remain when the student changes identity; the page is reset before another draft opens. A hash in a browser key is not encryption.

A new attempt's complete request is written and verified locally **before** form POST. While waiting or uncertain, inputs are frozen and TRY AGAIN sends the same exact JSON/request ID. An error, timeout, page load, or local save never creates the TURNED IN state. A confirmed server receipt must match the frame ancestry, Google origin, nonce, request ID, assignment, and version. New edits after receipt clearly display that changes are not turned in.

Transient local save failures block new attempts and expose TRY LOCAL SAVE AGAIN. If a receipt is verified but caching it fails, the true receipt can be shown; the old on-disk pending request will safely retry after reopening. A definitive server validation rejection unlocks the rejected draft after that change is durably saved. Conflict, busy, rate, network, and server errors retain the frozen request.

Web Locks allow one tab to edit a given student's assignment/version at a time. A second tab asks the student to close the other tab and refresh. Browsers without Web Locks use revision checks/storage notifications and show a one-tab warning; this fallback is not an atomic multi-tab lock. Chromebook Chrome with Web Locks is the target. Back-forward cache restores require refresh to safely regain the lock.

Open assignments as top-level HTTPS pages. File previews and embedding inside another site's frame are not supported for turn-in. The Apps Script nested-frame receipt path still requires a real school Chromebook pilot. See the test and setup instructions before rollout.
