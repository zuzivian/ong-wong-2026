'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useSpacetimeDB } from 'spacetimedb/react';
import { getVariantMeta } from '@/lib/design-variant';
import Icon from '@/components/icon';
import { DbConnection, tables } from '@/module_bindings';
import { useDebugTable } from '@/lib/use-debug-table';

type Attendance = 'attending' | 'declining' | '';
type DietaryMode = 'none' | 'add' | '';
type ContactMode = 'skip' | 'add' | '';
type VerificationState = 'idle' | 'verifying' | 'verified' | 'failed';

type Companion = {
  name: string;
  dietaryNotes: string;
};

type RsvpFlowProps = {
  initialToken?: string;
};

const STEP_META = [
  {
    title: 'Step 1: Confirm Your Name',
    guidance: 'Start with your first and last name exactly as shown on your invitation.',
  },
  {
    title: 'Step 2: Enter Invite Code',
    guidance: 'Enter your invite code so we can match your RSVP to the correct invitation.',
  },
  {
    title: 'Step 3: Attendance',
    guidance: 'Choose whether you can joyfully attend or regretfully decline.',
  },
  {
    title: 'Step 4: Dietary Requirements',
    guidance: 'If there are no dietary restrictions, simply select that option and continue.',
  },
  {
    title: 'Step 5: Contact Details',
    guidance: 'If contact details are not needed, choose skip and continue.',
  },
  {
    title: 'Step 6: Add Loved Ones',
    guidance: 'Add companions or family members only if your invitation allows.',
  },
  {
    title: 'Step 7: Review and Submit',
    guidance: 'Review your information and submit your RSVP.',
  },
] as const;

export default function RsvpFlow({ initialToken }: RsvpFlowProps) {
  const variantMeta = getVariantMeta();
  const db = useSpacetimeDB();
  const connection = db.getConnection() as DbConnection | null;
  const senderIdentity = db.identity;

  const [guestRows] = useDebugTable<any>('rsvp.guest', tables.guest);
  const [sessionRows] = useDebugTable<any>('rsvp.guest_session', tables.guest_session);
  const [rsvpRows] = useDebugTable<any>('rsvp.rsvp_response', tables.rsvp_response);
  const [companionRows] = useDebugTable<any>('rsvp.companion', tables.companion);
  const [configRows] = useDebugTable<any>('rsvp.config', tables.config);

  const [step, setStep] = useState(1);
  const [isEditingStep, setIsEditingStep] = useState(false);

  const [lookupFirstName, setLookupFirstName] = useState('');
  const [lookupLastName, setLookupLastName] = useState('');
  const [lookupInviteCode, setLookupInviteCode] = useState('');

  const [attendance, setAttendance] = useState<Attendance>('');
  const [dietaryMode, setDietaryMode] = useState<DietaryMode>('');
  const [dietaryNotes, setDietaryNotes] = useState('');

  const [contactMode, setContactMode] = useState<ContactMode>('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');

  const [companions, setCompanions] = useState<Companion[]>([]);
  const [companionName, setCompanionName] = useState('');
  const [companionDietary, setCompanionDietary] = useState('');

  const [lookupError, setLookupError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verificationState, setVerificationState] = useState<VerificationState>('idle');
  const [verificationMessage, setVerificationMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const hydratedGuestId = useRef<bigint | null>(null);
  const totalSteps = STEP_META.length;
  const normalizedInitialToken = initialToken?.trim() ?? '';
  const normalizedInviteCode = lookupInviteCode.trim().toUpperCase();

  const progressPercent = useMemo(
    () => Math.round((step / totalSteps) * 100),
    [step, totalSteps]
  );

  const activeSession = useMemo(() => {
    if (!senderIdentity) {
      return undefined;
    }
    const senderHex = senderIdentity.toHexString();
    return sessionRows.find((row) => row.sender.toHexString() === senderHex);
  }, [senderIdentity, sessionRows]);

  const activeGuest = useMemo(
    () => guestRows.find((row) => row.id === activeSession?.guestId),
    [activeSession?.guestId, guestRows]
  );

  const activeRsvp = useMemo(
    () => (activeGuest ? rsvpRows.find((row) => row.guestId === activeGuest.id) : undefined),
    [activeGuest, rsvpRows]
  );

  const activeCompanions = useMemo(
    () => (activeGuest ? companionRows.filter((row) => row.guestId === activeGuest.id) : []),
    [activeGuest, companionRows]
  );

  const config = useMemo(() => configRows.find((row) => row.id === 1n), [configRows]);

  const isRsvpClosed = useMemo(() => {
    const cutoff = config?.globalRsvpCutoffAt;
    if (!cutoff) {
      return false;
    }
    return BigInt(Date.now()) * 1000n > cutoff.microsSinceUnixEpoch;
  }, [config?.globalRsvpCutoffAt]);

  const isNameSatisfied = Boolean(normalizedInitialToken) || Boolean(
    lookupFirstName.trim() && lookupLastName.trim()
  );

  const isInviteCodeSatisfied = Boolean(normalizedInitialToken) || Boolean(normalizedInviteCode);

  const companionAllowed = activeGuest?.canAddCompanions ?? false;
  const maxCompanions = Number(activeGuest?.maxCompanions ?? 0n);
  const hasVerifiedSession = Boolean(activeSession && activeGuest);

  useEffect(() => {
    if ((step === 1 || step === 2) && !normalizedInitialToken) {
      setIsEditingStep(true);
      return;
    }
    setIsEditingStep(false);
  }, [normalizedInitialToken, step]);

  useEffect(() => {
    if (step === 2 && verificationState === 'verifying' && hasVerifiedSession) {
      setVerificationState('verified');
      setVerificationMessage('Invitation verified successfully.');
      setStep(3);
    }
  }, [hasVerifiedSession, step, verificationState]);

  const canSubmitCurrentStep = useMemo(() => {
    if (step === 1) {
      return isNameSatisfied;
    }

    if (step === 2) {
      return isInviteCodeSatisfied;
    }

    if (step === 3) {
      return hasVerifiedSession && (!isEditingStep || attendance !== '');
    }

    if (step === 4) {
      return !isEditingStep || dietaryNotes.trim().length > 0;
    }

    if (step === 5) {
      return !isEditingStep || contactEmail.trim().length > 0 || contactPhone.trim().length > 0;
    }

    return true;
  }, [
    attendance,
    contactEmail,
    contactPhone,
    dietaryNotes,
    hasVerifiedSession,
    isEditingStep,
    isInviteCodeSatisfied,
    isNameSatisfied,
    step,
  ]);

  useEffect(() => {
    if (!activeGuest || hydratedGuestId.current === activeGuest.id) {
      return;
    }

    hydratedGuestId.current = activeGuest.id;
    setLookupFirstName(activeGuest.firstName);
    setLookupLastName(activeGuest.lastName);
    setLookupInviteCode(activeGuest.inviteCode);
    if (activeRsvp) {
      setAttendance(activeRsvp.attendance ? 'attending' : 'declining');
      setDietaryMode(activeRsvp.dietaryNotes ? 'add' : 'none');
      setDietaryNotes(activeRsvp.dietaryNotes ?? '');
    } else {
      setAttendance('');
      setDietaryMode('');
      setDietaryNotes('');
    }
    if (activeGuest.contactEmail || activeGuest.contactPhone) {
      setContactMode('add');
      setContactEmail(activeGuest.contactEmail ?? '');
      setContactPhone(activeGuest.contactPhone ?? '');
    } else {
      setContactMode('skip');
      setContactEmail('');
      setContactPhone('');
    }
    setCompanions(
      activeCompanions.map((row) => ({
        name: row.name,
        dietaryNotes: row.dietaryNotes ?? '',
      }))
    );
  }, [activeCompanions, activeGuest, activeRsvp]);

  const addCompanion = () => {
    if (!companionName.trim()) {
      return;
    }
    if (maxCompanions > 0 && companions.length >= maxCompanions) {
      setLookupError(`You can add up to ${maxCompanions} loved one(s) for this invitation.`);
      return;
    }

    setCompanions((current) => [
      ...current,
      { name: companionName.trim(), dietaryNotes: companionDietary.trim() },
    ]);
    setCompanionName('');
    setCompanionDietary('');
    setLookupError('');
  };

  const applyDefaultForStep = (targetStep: number) => {
    if (targetStep === 3) {
      setAttendance((currentAttendance) => currentAttendance || 'attending');
      return;
    }

    if (targetStep === 4) {
      setDietaryMode('none');
      setDietaryNotes('');
      return;
    }

    if (targetStep === 5) {
      setContactMode('skip');
      setContactEmail('');
      setContactPhone('');
      return;
    }

    if (targetStep === 6) {
      setCompanionName('');
      setCompanionDietary('');
    }
  };

  const openEditForCurrentStep = () => {
    setLookupError('');
    setSubmitError('');

    if (step === 4) {
      setDietaryMode('add');
    }
    if (step === 5) {
      setContactMode('add');
    }
    setIsEditingStep(true);
  };

  const useDefaultForCurrentStep = () => {
    applyDefaultForStep(step);
    setIsEditingStep(false);
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLookupError('');
    setSubmitError('');
    if (step !== 2) {
      setVerificationMessage('');
    }

    if (!canSubmitCurrentStep) {
      return;
    }

    if ((step === 2 || step === totalSteps) && !connection) {
      setLookupError('Connection is still starting. Please try again in a moment.');
      return;
    }

    if (step === 2) {
      setVerificationState('verifying');
      setVerificationMessage('Verifying invitation details...');
      try {
        if (normalizedInitialToken) {
          await connection!.reducers.identifyGuestByToken({ token: normalizedInitialToken });
        } else {
          await connection!.reducers.identifyGuestByFallback({
            firstName: lookupFirstName.trim(),
            lastName: lookupLastName.trim(),
            inviteCode: normalizedInviteCode,
          });
        }
      } catch (error) {
        setVerificationState('failed');
        setVerificationMessage('');
        setLookupError(error instanceof Error ? error.message : 'Unable to verify invitation details.');
        return;
      }

      if (!hasVerifiedSession) {
        return;
      }
    }

    if (step < totalSteps) {
      if (!isEditingStep) {
        applyDefaultForStep(step);
      }
      setStep((current) => current + 1);
      setIsEditingStep(false);
      return;
    }

    if (isRsvpClosed) {
      setSubmitError('RSVP edits are closed because the global cutoff has passed.');
      return;
    }

    setIsSubmitting(true);
    try {
      await connection!.reducers.submitRsvp({
        attendance: attendance === 'attending',
        dietaryNotes: dietaryMode === 'add' ? dietaryNotes.trim() : undefined,
        notes: undefined,
        contactEmail: contactMode === 'add' ? contactEmail.trim() : undefined,
        contactPhone: contactMode === 'add' ? contactPhone.trim() : undefined,
        companions:
          attendance === 'attending'
            ? companions.map((companion) => ({
                name: companion.name.trim(),
                dietaryNotes: companion.dietaryNotes.trim() || undefined,
                relationship: undefined,
              }))
            : [],
      });
      setSubmitted(true);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Unable to submit RSVP.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const current = STEP_META[step - 1];
  const showNameEditor = step === 1 && (isEditingStep || !normalizedInitialToken);
  const showInviteEditor = step === 2 && (isEditingStep || !normalizedInitialToken);
  const hasDefaultPath = step > 2 || Boolean(normalizedInitialToken);
  const editToggleDisabled = (step === 1 || step === 2) && !normalizedInitialToken;
  const isVerifying = step === 2 && verificationState === 'verifying';
  const attendancePreview = attendance === 'declining' ? 'Regretfully Decline' : 'Joyfully Accept';

  if (submitted) {
    return (
      <section className={`rsvp-shell ${variantMeta.stepperClass}`}>
        <h1 className="heading-with-icon">
          <Icon name="task_alt" className="heading-icon" />
          <span>RSVP Received</span>
        </h1>
        <p>Thank you. Your response has been recorded.</p>
        <p className="small-note">
          You may return to your dashboard to review or edit details before the RSVP cutoff date.
        </p>
        <div className="cta-row">
          <Link href="/dashboard" className="button-primary">
            <Icon name="dashboard" className="button-icon" /> Go to Dashboard
          </Link>
          <Link href="/event-details" className="button-secondary">
            <Icon name="arrow_outward" className="button-icon" /> View Event Details
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className={`rsvp-shell ${variantMeta.stepperClass}`}>
      <h1>RSVP Flow</h1>
      <p className="step-title">{current.title}</p>
      <p className="small-note">{current.guidance}</p>

      <div className="stepper" aria-label="RSVP progress">
        <div className="stepper-line" style={{ width: `${progressPercent}%` }} />
      </div>
      <p className="small-note">
        Step {step} of {totalSteps}
      </p>
      {isRsvpClosed ? (
        <p className="small-note">RSVP edits are closed because the global cutoff has passed.</p>
      ) : null}
      {lookupError ? <p className="small-note">{lookupError}</p> : null}
      {submitError ? <p className="small-note">{submitError}</p> : null}
      {verificationMessage ? <p className="small-note">{verificationMessage}</p> : null}

      <form onSubmit={onSubmit} className="form-stack">
        {step === 1 ? (
          <fieldset>
            <legend>Name Details</legend>
            {showNameEditor ? (
              <>
                <p className="small-note">
                  Enter your invitation name details to continue.
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
                We detected an invitation link. Continue with the default invitation details.
              </p>
            )}
          </fieldset>
        ) : null}

        {step === 2 ? (
          <fieldset>
            <legend>Invite Code</legend>
            {showInviteEditor ? (
              <>
                <p className="small-note">Enter the invite code from your invitation card.</p>
                <label>
                  Invite code
                  <input
                    value={lookupInviteCode}
                    onChange={(event) => setLookupInviteCode(event.target.value)}
                    placeholder="e.g. SW26-148"
                    required
                  />
                </label>
                <p className="small-note">
                  Please contact us if you cannot locate your invite code.
                </p>
              </>
            ) : (
              <p className="small-note">Invite code is already embedded in your invitation link.</p>
            )}
            {verificationState === 'verified' ? (
              <p className="small-note">Status: Verified</p>
            ) : null}
            {verificationState === 'verifying' ? (
              <p className="small-note">Status: Verifying...</p>
            ) : null}
            {verificationState === 'failed' ? (
              <p className="small-note">Status: Verification failed</p>
            ) : null}
          </fieldset>
        ) : null}

        {step === 3 ? (
          <fieldset>
            <legend>Attendance</legend>
            {isEditingStep ? (
              <>
                <p className="small-note">Choose your attendance response.</p>
                <label className="radio-row">
                  <input
                    type="radio"
                    name="attendance"
                    checked={attendance === 'attending'}
                    onChange={() => setAttendance('attending')}
                  />
                  Joyfully Accept
                </label>
                <label className="radio-row">
                  <input
                    type="radio"
                    name="attendance"
                    checked={attendance === 'declining'}
                    onChange={() => setAttendance('declining')}
                  />
                  Regretfully Decline
                </label>
              </>
            ) : (
              <p className="small-note">Default response: {attendancePreview}</p>
            )}
          </fieldset>
        ) : null}

        {step === 4 ? (
          <fieldset>
            <legend>Dietary Requirements</legend>
            {isEditingStep ? (
              <label>
                Dietary notes
                <textarea
                  value={dietaryNotes}
                  onChange={(event) => {
                    setDietaryMode('add');
                    setDietaryNotes(event.target.value);
                  }}
                  rows={4}
                  placeholder="Please include allergies, vegetarian requirements, or other needs."
                />
              </label>
            ) : (
              <>
                <p className="small-note">Default response: No dietary restrictions.</p>
                {dietaryMode === 'add' && dietaryNotes.trim().length > 0 ? (
                  <p className="small-note">
                    Saved dietary notes exist and will be replaced if you continue with default.
                  </p>
                ) : null}
              </>
            )}
          </fieldset>
        ) : null}

        {step === 5 ? (
          <fieldset>
            <legend>Contact Details</legend>
            {isEditingStep ? (
              <>
                <label>
                  Email (optional)
                  <input
                    type="email"
                    value={contactEmail}
                    onChange={(event) => {
                      setContactMode('add');
                      setContactEmail(event.target.value);
                    }}
                    placeholder="name@email.com"
                  />
                </label>
                <label>
                  Phone (optional)
                  <input
                    value={contactPhone}
                    onChange={(event) => {
                      setContactMode('add');
                      setContactPhone(event.target.value);
                    }}
                    placeholder="+65 ..."
                  />
                </label>
              </>
            ) : (
              <>
                <p className="small-note">Default response: Skip contact details.</p>
                {(contactEmail || contactPhone) ? (
                  <p className="small-note">
                    Saved contact details exist and will be removed if you continue with default.
                  </p>
                ) : null}
              </>
            )}
          </fieldset>
        ) : null}

        {step === 6 ? (
          <fieldset>
            <legend>Add loved ones</legend>
            {companionAllowed ? (
              <>
                <p className="small-note">
                  Invitation allowance: up to {maxCompanions} loved one(s).
                </p>
                {isEditingStep ? (
                  <>
                    <label>
                      Name
                      <input
                        value={companionName}
                        onChange={(event) => setCompanionName(event.target.value)}
                        placeholder="Companion full name"
                      />
                    </label>
                    <label>
                      Dietary requirements
                      <input
                        value={companionDietary}
                        onChange={(event) => setCompanionDietary(event.target.value)}
                        placeholder="Optional dietary notes"
                      />
                    </label>
                    <button type="button" className="button-secondary" onClick={addCompanion}>
                      <Icon name="person_add" className="button-icon" /> Add loved one
                    </button>
                  </>
                ) : (
                  <p className="small-note">
                    Default response: Continue with the current loved ones list.
                  </p>
                )}

                {companions.length > 0 ? (
                  <ul className="companion-list">
                    {companions.map((companion) => (
                      <li key={`${companion.name}-${companion.dietaryNotes}`}>
                        <strong>{companion.name}</strong>
                        <span>{companion.dietaryNotes || 'No dietary notes'}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="small-note">No loved ones added yet.</p>
                )}
              </>
            ) : (
              <p className="small-note">
                Companion options are not enabled for this invitation.
              </p>
            )}
          </fieldset>
        ) : null}

        {step === 7 ? (
          <fieldset>
            <legend>Review</legend>
            <ul className="review-list">
              <li>
                <strong>Name:</strong>{' '}
                {activeGuest ? `${activeGuest.firstName} ${activeGuest.lastName}` : `${lookupFirstName} ${lookupLastName}`}
              </li>
              <li>
                <strong>Invite code:</strong> {activeGuest ? activeGuest.inviteCode : lookupInviteCode}
              </li>
              <li>
                <strong>Attendance:</strong>{' '}
                {attendance === 'attending' ? 'Joyfully accepting' : 'Regretfully declining'}
              </li>
              <li>
                <strong>Dietary:</strong> {dietaryMode === 'none' ? 'No restrictions' : dietaryNotes}
              </li>
              <li>
                <strong>Contact:</strong>{' '}
                {contactMode === 'skip'
                  ? 'Not provided'
                  : `${contactEmail || 'No email'}, ${contactPhone || 'No phone'}`}
              </li>
              <li>
                <strong>Loved ones added:</strong> {companions.length}
              </li>
            </ul>
          </fieldset>
        ) : null}

        {step < totalSteps ? (
          <div className="cta-row">
            <button
              type="button"
              className="button-back-small"
              disabled={step === 1 || isVerifying}
              onClick={() => setStep((currentStep) => currentStep - 1)}
            >
              <Icon name="arrow_back" className="button-icon" /> Back
            </button>

            <button
              type="button"
              className="button-secondary"
              disabled={editToggleDisabled || isVerifying}
              onClick={() => {
                if (isEditingStep && hasDefaultPath) {
                  useDefaultForCurrentStep();
                  return;
                }
                openEditForCurrentStep();
              }}
            >
              {isEditingStep && hasDefaultPath ? 'Use default' : 'Edit'}
            </button>

            <button
              type="submit"
              className="button-primary"
              disabled={!canSubmitCurrentStep || isVerifying}
            >
              {isEditingStep ? (
                <>
                  Save and Continue <Icon name="arrow_forward" className="button-icon" />
                </>
              ) : (
                <>
                  Continue with Default <Icon name="arrow_forward" className="button-icon" />
                </>
              )}
            </button>
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
              type="button"
              className="button-secondary"
              onClick={() => {
                setStep(3);
                setIsEditingStep(true);
              }}
            >
              Edit
            </button>

            <button
              type="submit"
              className="button-primary"
              disabled={isSubmitting || isRsvpClosed}
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
