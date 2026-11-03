import assert from 'node:assert/strict';

/**
 * Unit tests for confirmation dialog safety logic and exact string matching.
 */

function validateConfirmationState(options: {
  confirmTextMatch?: string;
  typedText: string;
  reasonRequired?: boolean;
  reasonText: string;
}): boolean {
  if (options.confirmTextMatch) {
    if (options.typedText.trim() !== options.confirmTextMatch.trim()) {
      return false;
    }
  }

  if (options.reasonRequired) {
    if (!options.reasonText.trim()) {
      return false;
    }
  }

  return true;
}

console.log('Running ConfirmDialog safety verification tests...');

// 1. Exact text match disabled when mismatched
assert.equal(
  validateConfirmationState({
    confirmTextMatch: 'Acme Corp',
    typedText: 'acme corp', // case-sensitive check
    reasonRequired: false,
    reasonText: ''
  }),
  false,
  'Mismatched case should fail confirmation'
);

assert.equal(
  validateConfirmationState({
    confirmTextMatch: 'Acme Corp',
    typedText: 'Acme Corp',
    reasonRequired: false,
    reasonText: ''
  }),
  true,
  'Exact string match should unlock confirmation button'
);

// 2. Reason requirement validation
assert.equal(
  validateConfirmationState({
    confirmTextMatch: 'Acme Corp',
    typedText: 'Acme Corp',
    reasonRequired: true,
    reasonText: '   ' // empty whitespace
  }),
  false,
  'Empty reason text should block confirmation when reason is mandatory'
);

assert.equal(
  validateConfirmationState({
    confirmTextMatch: 'Acme Corp',
    typedText: 'Acme Corp',
    reasonRequired: true,
    reasonText: 'Violated terms of service policy'
  }),
  true,
  'Valid reason with exact match should unlock confirmation'
);

// 3. Confirmation without match string
assert.equal(
  validateConfirmationState({
    typedText: '',
    reasonRequired: false,
    reasonText: ''
  }),
  true,
  'Standard confirmation without match requirement should succeed'
);

console.log('✅ ConfirmDialog safety tests passed successfully.');
