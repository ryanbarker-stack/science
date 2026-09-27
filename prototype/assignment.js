/* Assignment-specific hooks only. Submission, identity, and saving live in the shared module. */
(function () {
  'use strict';
  const anonymous = document.documentElement.dataset.identity === 'anonymous_id';
  const field = id => document.getElementById(id);
  const collectResponses = () => ({ observation: field('observation').value, choice: field('choice').value, measurement: field('measurement').value });
  const resetResponses = () => { field('observation').value = ''; field('choice').value = ''; field('measurement').value = ''; };
  const restoreResponses = responses => { field('observation').value = responses.observation || ''; field('choice').value = responses.choice || ''; field('measurement').value = responses.measurement == null ? '' : String(responses.measurement); };
  field('setup-note').hidden = !!window.IACA_SUBMISSION_ENDPOINT;
  window.assignmentSubmission = IACASubmission.init({
    mount: '#submission',
    workRoot: '#activity',
    endpoint: window.IACA_SUBMISSION_ENDPOINT,
    assignment: {
      id: anonymous ? '2026-27-G7-LS-PROJECT-01' : '2026-27-G6-ES-PROTOTYPE-01',
      title: anonymous ? 'Project Observation — Practice' : 'Light & Data — Practice',
      course: anonymous ? 'G7-LIFE-SCIENCE' : 'G6-EARTH-SPACE',
      schoolYear: '2026-27',
      version: '1.0.0'
    },
    identity: { type: anonymous ? 'anonymous_id' : 'student_name', namespace: 'iaca-2026-27', periods: ['1', '2', '3', '4', '5', '6', '7'], requirePeriod: true },
    collectResponses,
    restoreResponses,
    resetResponses,
    validate(responses) {
      const errors = [];
      if (!responses.observation.trim()) errors.push('Write an observation for question 1.');
      if (!responses.choice.trim()) errors.push('Choose an answer for question 2.');
      if (!responses.measurement.trim() || !Number.isFinite(Number(responses.measurement))) errors.push('Enter a number for question 3.');
      return { ok: errors.length === 0, errors };
    },
    collectResults() { return {}; },
    collectArtifacts() { return []; },
    autosaveMs: 350
  });
})();
