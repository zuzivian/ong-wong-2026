'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSpacetimeDB } from 'spacetimedb/react';
import { getVariantMeta } from '@/lib/design-variant';
import Icon from '@/components/icon';
import {
  RSVP_STEP_META,
  useRsvpWorkflow,
} from '@/lib/use-rsvp-workflow';
import { DbConnection } from '@/module_bindings';
import { useIsRsvpClosed } from '@/lib/use-is-rsvp-closed';

type RsvpFlowProps = {
  initialInviteCode?: string;
};

const DIETARY_OPTIONS = [
  'Vegetarian',
  'Halal',
  'Others',
] as const;

export default function RsvpFlow({ initialInviteCode = '' }: RsvpFlowProps) {
  const variantMeta = getVariantMeta();
  const db = useSpacetimeDB();
  const connection = db.getConnection() as DbConnection | null;
  const router = useRouter();

  const isRsvpClosed = useIsRsvpClosed();
  const {
    activeGuest,
    attendance,
    canSubmitCurrentStep,
    companionDietary,
    companionName,
    companions,
    current,
    detectedGuestByInviteCode,
    dietaryMode,
    dietaryNotes,
    dietaryOptionsSelected,
    dietarySummary,
    editButtonLabel,
    editToggleDisabled,
    hasDefaultPath,
    isEditingStep,
    isRibbonNavigationDisabled,
    isSavingProgress,
    isSubmitting,
    isVerifying,
    lookupError,
    lookupFirstName,
    lookupInviteCode,
    lookupLastName,
    normalizedInviteCode,
    primaryButtonLabel,
    progressPercent,
    showNameEditor,
    step,
    submitError,
    submitted,
    totalSteps,
    verificationMessage,
    verificationState,
    setCompanionDietary,
    setCompanionName,
    setDietaryMode,
    setDietaryNotes,
    setDietaryOptionsSelected,
    setIsEditingStep,
    setLookupFirstName,
    setLookupLastName,
    setStep,
    addCompanion,
    chooseAttendanceAndContinue,
    jumpToCompletedStep,
    onSubmit,
    openEditForCurrentStep,
    removeCompanion,
    toggleDietaryOption,
    useDefaultForCurrentStep,
  } = useRsvpWorkflow(connection, router, initialInviteCode, isRsvpClosed);

  if (submitted) {
    return (
      <section className={`rsvp-shell ${variantMeta.stepperClass}`}>
        <h1 className="heading-with-icon">
          <Icon name="task_alt" className="heading-icon" />
          <span>RSVP Received</span>
        </h1>
        <p>Thank you for responding. We are so grateful you are celebrating with us.</p>
        <p className="small-note">
          You can return to your dashboard to review or edit details before the RSVP deadline.
        </p>
        <div className="cta-row">
          <Link href="/dashboard" className="button-primary">
            <Icon name="how_to_reg" className="button-icon" /> See Your RSVP
          </Link>
          <Link href="/#schedule" className="button-secondary">
            <Icon name="arrow_outward" className="button-icon" /> View Event Details
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className={`rsvp-shell ${variantMeta.stepperClass}`}>
      <h1>RSVP</h1>
      <p className="step-title">{current.title}</p>
      <p className="small-note">{current.guidance}</p>
      <ol className="step-ribbon" aria-label="RSVP step ribbon">
        {RSVP_STEP_META.map((meta, index) => {
          const stepNumber = index + 1;
          const ribbonClass =
            stepNumber === step ? 'active' : stepNumber < step ? 'complete' : '';
          const canJumpToStep = !isRibbonNavigationDisabled && stepNumber < step;
          return (
            <li key={meta.title} className={ribbonClass}>
              <button
                type="button"
                className="step-ribbon-button"
                disabled={!canJumpToStep}
                onClick={() => jumpToCompletedStep(stepNumber)}
                aria-current={stepNumber === step ? 'step' : undefined}
              >
                <span className="step-ribbon-number">{stepNumber}</span>
                <span className="step-ribbon-label">{meta.title.replace(/^Step \d+: /, '')}</span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="stepper" aria-label="RSVP progress">
        <div className="stepper-line" style={{ width: `${progressPercent}%` }} />
      </div>
      <p className="small-note">
        Step {step} of {totalSteps}
      </p>
      {isSavingProgress ? <p className="small-note">Saving your progress...</p> : null}
      {isRsvpClosed ? (
        <p className="small-note">RSVP updates are now closed because the deadline has passed.</p>
      ) : null}
      {lookupError ? <p className="small-note">{lookupError}</p> : null}
      {submitError ? <p className="small-note">{submitError}</p> : null}
      {verificationMessage ? <p className="small-note">{verificationMessage}</p> : null}

      <form onSubmit={onSubmit} className="form-stack">
        {step === 1 ? (
          <fieldset>
            <legend>Confirm Your Name</legend>
                        {showNameEditor ? (
              <>
                <p className="small-note">
                  Please update your name if anything needs correcting before verification.
                </p>
                <label>
                  First name
                  <input
                    value={lookupFirstName}
                    onChange={(event) => setLookupFirstName(event.target.value)}
                    placeholder="e.g. Natasha"
                    required
                  />
                </label>
                <label>
                  Last name
                  <input
                    value={lookupLastName}
                    onChange={(event) => setLookupLastName(event.target.value)}
                    placeholder="e.g. Wong"
                    required
                  />
                </label>
              </>
            ) : (
              <p className="small-note">
                Name found from invitation list:
                {' '}
                <strong className="detail-strong">
                  {detectedGuestByInviteCode?.firstName || lookupFirstName}{' '}
                  {detectedGuestByInviteCode?.lastName || lookupLastName}
                </strong>
              </p>
            )}
            {normalizedInviteCode ? (
              <p className="small-note">
                Invite code:
                {' '}
                <span className="detail-pill">{normalizedInviteCode}</span>
              </p>
            ) : (
              <p className="small-note">
                We could not find an invite code. Please return to <Link href="/">Home</Link> and unlock your invitation first.
              </p>
            )}
            {verificationState === 'verified' ? (
              <p className="small-note">Status: Verified</p>
            ) : null}
            {verificationState === 'verifying' ? (
              <p className="small-note">Status: Verifying...</p>
            ) : null}
            {verificationState === 'failed' ? (
              <p className="small-note">Status: We could not verify those details</p>
            ) : null}
          </fieldset>
        ) : null}

        {step === 2 ? (
          <fieldset>
            <legend>Attendance</legend>
            <p className="small-note">Choose one option to continue.</p>
          </fieldset>
        ) : null}

        {step === 3 ? (
          <fieldset>
            <legend>Dietary Requirements</legend>
            <p className="small-note">Please choose one option to continue.</p>
            <div className="option-row">
              <button
                type="button"
                className={`option-chip ${dietaryMode === 'none' ? 'active' : ''}`}
                onClick={() => {
                  setDietaryMode('none');
                  setDietaryOptionsSelected([]);
                  setDietaryNotes('');
                  setIsEditingStep(false);
                }}
              >
                <Icon name="check_circle" className="inline-icon" /> No dietary restrictions
              </button>
              <button
                type="button"
                className={`option-chip ${dietaryMode === 'add' ? 'active' : ''}`}
                onClick={() => {
                  setDietaryMode('add');
                  setIsEditingStep(true);
                }}
              >
                <Icon name="restaurant" className="inline-icon" /> I have dietary needs
              </button>
            </div>
            {dietaryMode === 'add' ? (
              <>
                <p className="small-note">Select any standard options that apply.</p>
                <div className="dietary-grid">
                  {DIETARY_OPTIONS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={`option-chip ${dietaryOptionsSelected.includes(option) ? 'active' : ''}`}
                      onClick={() => toggleDietaryOption(option)}
                    >
                      {option}
                    </button>
                  ))}
                </div>
                <label>
                  Other dietary details (optional)
                  <textarea
                    value={dietaryNotes}
                    onChange={(event) => {
                      setDietaryMode('add');
                      setDietaryNotes(event.target.value);
                    }}
                    rows={4}
                    placeholder="Please include allergy severity or anything not listed above."
                  />
                </label>
              </>
            ) : (
              <p className="small-note">Current response: No dietary restrictions.</p>
            )}
          </fieldset>
        ) : null}

        {step === 4 ? (
          <fieldset>
            <legend>Add loved ones</legend>
            <label>
              Loved one full name
              <input
                value={companionName}
                onChange={(event) => setCompanionName(event.target.value)}
                placeholder="Companion full name"
              />
            </label>
            <label>
              Dietary requirements (optional)
              <input
                value={companionDietary}
                onChange={(event) => setCompanionDietary(event.target.value)}
                placeholder="Optional dietary notes"
              />
            </label>
            <button type="button" className="button-secondary" onClick={addCompanion}>
              <Icon name="person_add" className="button-icon" /> Add loved one
            </button>
            <p className="small-note">
              If no loved ones are added here, we will submit RSVP for you only.
            </p>

            {companions.length > 0 ? (
              <div className="companion-stack">
                {companions.map((companion, index) => (
                  <article key={`${companion.name}-${companion.dietaryNotes}-${index}`} className="companion-card">
                    <div className="companion-card-head">
                      <strong>{companion.name}</strong>
                      <button
                        type="button"
                        className="button-back-small companion-remove"
                        onClick={() => removeCompanion(index)}
                      >
                        Remove
                      </button>
                    </div>
                    <p className="small-note">{companion.dietaryNotes || 'No dietary notes'}</p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="small-note">No loved ones added yet.</p>
            )}
          </fieldset>
        ) : null}

        {step === 5 ? (
          <fieldset>
            <legend>Review</legend>
            <ul className="review-list">
              <li>
                <strong>Name:</strong>{' '}
                <span className="detail-inline">
                  {activeGuest ? `${activeGuest.firstName} ${activeGuest.lastName}` : `${lookupFirstName} ${lookupLastName}`}
                </span>
              </li>
              <li>
                <strong>Invite code:</strong>{' '}
                <span className="detail-inline">{activeGuest ? activeGuest.inviteCode : lookupInviteCode}</span>
              </li>
              <li>
                <strong>Attendance:</strong>{' '}
                <span className="detail-inline">
                  {attendance === 'attending' ? 'Joyfully accepting' : 'Respectfully declining'}
                </span>
              </li>
              <li>
                <strong>Dietary:</strong>{' '}
                <span className="detail-inline">{dietarySummary}</span>
              </li>
              <li>
                <strong>Loved ones added:</strong>{' '}
                <span className="detail-inline">
                  {companions.length > 0
                    ? `${companions.map((companion) => companion.name).join(', ')} (${companions.length})`
                    : 'None'}
                </span>
              </li>
            </ul>
          </fieldset>
        ) : null}

        {step < totalSteps ? (
          <div className="cta-row">
            {step === 1 ? (
              <Link href="/" className="button-back-small">
                <Icon name="arrow_back" className="button-icon" /> Back
              </Link>
            ) : (
              <button
                type="button"
                className="button-back-small"
                disabled={isVerifying || isSavingProgress}
                onClick={() => setStep((currentStep) => currentStep - 1)}
              >
                <Icon name="arrow_back" className="button-icon" /> Back
              </button>
            )}

            {step === 2 ? (
              <>
                <button
                  type="button"
                  className="button-secondary"
                  disabled={isSavingProgress}
                  onClick={() => {
                    void chooseAttendanceAndContinue('declining');
                  }}
                >
                  Respectfully Decline <Icon name="arrow_forward" className="button-icon" />
                </button>
                <button
                  type="button"
                  className="button-primary"
                  disabled={isSavingProgress}
                  onClick={() => {
                    void chooseAttendanceAndContinue('attending');
                  }}
                >
                  Joyfully Accept <Icon name="arrow_forward" className="button-icon" />
                </button>
              </>
            ) : (
              <>
                {step !== 4 && !(step === 3 && isEditingStep && hasDefaultPath) ? (
                  <button
                    type="button"
                    className="button-secondary"
                    disabled={editToggleDisabled || isVerifying || isSavingProgress}
                    onClick={() => {
                      if (isEditingStep && hasDefaultPath) {
                        useDefaultForCurrentStep();
                        return;
                      }
                      openEditForCurrentStep();
                    }}
                  >
                    {editButtonLabel}
                  </button>
                ) : null}

                <button
                  type="submit"
                  className="button-primary"
                  disabled={!canSubmitCurrentStep || isVerifying || isSavingProgress}
                >
                  <>
                    {isSavingProgress
                      ? 'Saving...'
                      : isVerifying
                        ? 'Verifying...'
                        : primaryButtonLabel}
                    <Icon name="arrow_forward" className="button-icon" />
                  </>
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="cta-row">
            <button
              type="button"
              className="button-back-small"
              onClick={() => setStep((currentStep) => currentStep - 1)}
            >
              <Icon name="arrow_back" className="button-icon" /> Back
            </button>

            <button
              type="submit"
              className="button-primary"
              disabled={isSubmitting || isRsvpClosed || isSavingProgress}
            >
              <>
                {isSubmitting ? 'Submitting...' : 'Submit RSVP'}{' '}
                <Icon name="task_alt" className="button-icon" />
              </>
            </button>
          </div>
        )}
      </form>
    </section>
  );
}
