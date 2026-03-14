'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useSpacetimeDB } from 'spacetimedb/react';
import { getVariantMeta } from '@/lib/design-variant';
import Icon from '@/components/icon';
import { DbConnection } from '@/module_bindings';
import { loadGuestPortalState, type GuestPortalState } from '@/lib/guest-portal-state';
import { useIsRsvpClosed } from '@/lib/use-is-rsvp-closed';
import {
  normalizeInviteCode as normalizeUnlockedInviteCode,
  UNLOCKED_INVITE_CODE_STORAGE_KEY,
} from '@/lib/unlock-client';

type Attendance = 'attending' | 'declining' | '';
type DietaryMode = 'none' | 'add' | '';
type VerificationState = 'idle' | 'verifying' | 'verified' | 'failed';

type Companion = {
  name: string;
  dietaryNotes: string;
};

type RsvpFlowProps = {
  initialInviteCode?: string;
};

const DIETARY_OPTIONS = [
  'Vegetarian',
  'Vegan',
  'Halal',
  'Kosher',
  'Gluten-free',
  'Dairy-free',
  'Nut allergy',
  'Shellfish allergy',
] as const;

const DIETARY_OPTIONS_PREFIX = 'Dietary options:';
const DIETARY_OTHER_PREFIX = 'Other notes:';

const STEP_META = [
  {
    title: 'Step 1: Welcome and Confirm Invitation',
    guidance: 'We found your invitation details from your invite code. Please confirm your name to continue.',
  },
  {
    title: 'Step 2: Attendance',
    guidance: 'Let us know if you can celebrate with us or need to decline.',
  },
  {
    title: 'Step 3: Dietary Requirements',
    guidance: 'Share any dietary needs so we can care for you well.',
  },
  {
    title: 'Step 4: Add Loved Ones',
    guidance: 'Add loved ones if your invitation includes them.',
  },
  {
    title: 'Step 5: Review and Submit',
    guidance: 'Take one final look, then send your RSVP.',
  },
] as const;

function parseDietaryDetails(value: string | undefined): { mode: DietaryMode; selectedOptions: string[]; notes: string } {
  if (!value) {
    return { mode: 'none', selectedOptions: [], notes: '' };
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return { mode: 'none', selectedOptions: [], notes: '' };
  }

  const segments = trimmed
    .split('|')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  const parsedOptions = segments
    .filter((segment) => segment.startsWith(DIETARY_OPTIONS_PREFIX))
    .flatMap((segment) =>
      segment
        .slice(DIETARY_OPTIONS_PREFIX.length)
        .split(',')
        .map((option) => option.trim())
        .filter((option) => option.length > 0)
    );

  const parsedOther = segments
    .filter((segment) => segment.startsWith(DIETARY_OTHER_PREFIX))
    .map((segment) => segment.slice(DIETARY_OTHER_PREFIX.length).trim())
    .filter((segment) => segment.length > 0)
    .join(' ');

  if (parsedOptions.length > 0 || parsedOther.length > 0) {
    return {
      mode: 'add',
      selectedOptions: [...new Set(parsedOptions)],
      notes: parsedOther,
    };
  }

  return { mode: 'add', selectedOptions: [], notes: trimmed };
}

function composeDietaryNotes(mode: DietaryMode, selectedOptions: string[], notes: string): string | undefined {
  if (mode !== 'add') {
    return undefined;
  }

  const normalizedOptions = [...new Set(selectedOptions.map((option) => option.trim()).filter(Boolean))];
  const normalizedNotes = notes.trim();
  if (normalizedOptions.length === 0 && normalizedNotes.length === 0) {
    return undefined;
  }

  const parts: string[] = [];
  if (normalizedOptions.length > 0) {
    parts.push(`${DIETARY_OPTIONS_PREFIX} ${normalizedOptions.join(', ')}`);
  }
  if (normalizedNotes.length > 0) {
    parts.push(`${DIETARY_OTHER_PREFIX} ${normalizedNotes}`);
  }

  return parts.join(' | ');
}

export default function RsvpFlow({ initialInviteCode = '' }: RsvpFlowProps) {
  const variantMeta = getVariantMeta();
  const db = useSpacetimeDB();
  const connection = db.getConnection() as DbConnection | null;
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [isEditingStep, setIsEditingStep] = useState(false);

  const [lookupFirstName, setLookupFirstName] = useState('');
  const [lookupLastName, setLookupLastName] = useState('');
  const [lookupInviteCode, setLookupInviteCode] = useState(initialInviteCode);

  const [attendance, setAttendance] = useState<Attendance>('');
  const [dietaryMode, setDietaryMode] = useState<DietaryMode>('');
  const [dietaryNotes, setDietaryNotes] = useState('');
  const [dietaryOptionsSelected, setDietaryOptionsSelected] = useState<string[]>([]);

  const [companions, setCompanions] = useState<Companion[]>([]);
  const [companionName, setCompanionName] = useState('');
  const [companionDietary, setCompanionDietary] = useState('');

  const [lookupError, setLookupError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingProgress, setIsSavingProgress] = useState(false);
  const [verificationState, setVerificationState] = useState<VerificationState>('idle');
  const [verificationMessage, setVerificationMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [portalState, setPortalState] = useState<GuestPortalState>({
    companions: [],
    messages: [],
  });

  const hydratedGuestId = useRef<bigint | null>(null);
  const unlockRefreshedForInviteCode = useRef<string | null>(null);
  const totalSteps = STEP_META.length;
  const normalizedInviteCode = normalizeUnlockedInviteCode(lookupInviteCode);

  const progressPercent = useMemo(
    () => Math.round((step / totalSteps) * 100),
    [step, totalSteps]
  );
  const activeGuest = portalState.activeGuest;
  const activeRsvp = portalState.activeRsvp;
  const activeCompanions = portalState.companions;

  const isRsvpClosed = useIsRsvpClosed();

  const isNameSatisfied = Boolean(lookupFirstName.trim() && lookupLastName.trim());
  const isInviteCodeSatisfied = Boolean(normalizedInviteCode);
  const detectedGuestByInviteCode = portalState.previewGuest;
  const hasDetectedName = Boolean(detectedGuestByInviteCode);

  const maxCompanions = 5;

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const storedCode = normalizeUnlockedInviteCode(
      window.localStorage.getItem(UNLOCKED_INVITE_CODE_STORAGE_KEY) ?? ''
    );
    if (storedCode && storedCode !== lookupInviteCode) {
      setLookupInviteCode(storedCode);
    }
  }, [lookupInviteCode]);

  const refreshPortalState = async (inviteCodeOverride?: string) => {
    if (!connection) {
      return;
    }

    const nextState = await loadGuestPortalState(connection, inviteCodeOverride ?? normalizedInviteCode);
    setPortalState(nextState);
  };

  useEffect(() => {
    if (!connection) {
      return;
    }

    let cancelled = false;

    loadGuestPortalState(connection, normalizedInviteCode)
      .then((nextState) => {
        if (!cancelled) {
          setPortalState(nextState);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setLookupError(error instanceof Error ? error.message : 'Unable to load invitation details.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [connection, normalizedInviteCode]);

  useEffect(() => {
    if (!detectedGuestByInviteCode) {
      return;
    }

    if (!lookupFirstName.trim() && !lookupLastName.trim()) {
      setLookupFirstName(detectedGuestByInviteCode.firstName);
      setLookupLastName(detectedGuestByInviteCode.lastName);
    }
  }, [detectedGuestByInviteCode, lookupFirstName, lookupLastName]);

  const canSubmitCurrentStep = useMemo(() => {
    if (step === 1) {
      return isInviteCodeSatisfied && isNameSatisfied;
    }

    if (step === 2) {
      return !isEditingStep || attendance !== '';
    }

    if (step === 3) {
      return (
        dietaryMode === 'none' ||
        (dietaryMode === 'add' &&
          (dietaryOptionsSelected.length > 0 || dietaryNotes.trim().length > 0))
      );
    }

    return true;
  }, [
    attendance,
    dietaryMode,
    dietaryNotes,
    dietaryOptionsSelected.length,
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
      const parsedDietary = parseDietaryDetails(activeRsvp.dietaryNotes);
      setAttendance(activeRsvp.attendance ? 'attending' : 'declining');
      setDietaryMode(parsedDietary.mode);
      setDietaryNotes(parsedDietary.notes);
      setDietaryOptionsSelected(parsedDietary.selectedOptions);
    } else {
      setAttendance('');
      setDietaryMode('');
      setDietaryNotes('');
      setDietaryOptionsSelected([]);
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
    if (targetStep === 2) {
      setAttendance((currentAttendance) => currentAttendance || 'attending');
      return;
    }

    if (targetStep === 3) {
      setDietaryMode('none');
      setDietaryNotes('');
      setDietaryOptionsSelected([]);
      return;
    }

    if (targetStep === 4) {
      setCompanionName('');
      setCompanionDietary('');
    }
  };

  const openEditForCurrentStep = () => {
    setLookupError('');
    setSubmitError('');

    if (step === 3) {
      setDietaryMode('add');
    }
    setIsEditingStep(true);
  };

  const useDefaultForCurrentStep = () => {
    applyDefaultForStep(step);
    setIsEditingStep(false);
  };

  const removeCompanion = (indexToRemove: number) => {
    setCompanions((current) => current.filter((_companion, index) => index !== indexToRemove));
  };

  const toggleDietaryOption = (option: string) => {
    setDietaryMode('add');
    setDietaryOptionsSelected((current) =>
      current.includes(option) ? current.filter((value) => value !== option) : [...current, option]
    );
  };

  const refreshUnlockSession = async (inviteCode: string) => {
    const normalizedCode = normalizeUnlockedInviteCode(inviteCode);
    if (!normalizedCode || unlockRefreshedForInviteCode.current === normalizedCode) {
      return;
    }

    const response = await fetch('/api/unlock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inviteCode: normalizedCode }),
    });
    if (!response.ok) {
      throw new Error('We could not refresh your invite unlock session.');
    }

    unlockRefreshedForInviteCode.current = normalizedCode;
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(UNLOCKED_INVITE_CODE_STORAGE_KEY, normalizedCode);
    }
    router.refresh();
  };

  useEffect(() => {
    if (verificationState !== 'verified' || !activeGuest?.inviteCode) {
      return;
    }

    refreshUnlockSession(activeGuest.inviteCode).catch(() => {
      // Keep RSVP flow usable even if unlock-cookie refresh fails.
    });
  }, [activeGuest?.inviteCode, verificationState]);

  const persistRsvpDraft = async (overrides?: {
    attendance?: Attendance;
    dietaryMode?: DietaryMode;
    dietaryNotes?: string;
    dietaryOptionsSelected?: string[];
    companions?: Companion[];
  }) => {
    if (!connection) {
      throw new Error('Connection is still starting. Please try again in a moment.');
    }

    const nextAttendance = overrides?.attendance ?? attendance;
    if (nextAttendance === '') {
      throw new Error('Please choose your attendance before continuing.');
    }

    const nextDietaryMode = overrides?.dietaryMode ?? dietaryMode;
    const nextDietaryNotes = overrides?.dietaryNotes ?? dietaryNotes;
    const nextDietaryOptions = overrides?.dietaryOptionsSelected ?? dietaryOptionsSelected;
    const nextCompanions = overrides?.companions ?? companions;

    await connection.reducers.submitRsvp({
      attendance: nextAttendance === 'attending',
      dietaryNotes: composeDietaryNotes(nextDietaryMode, nextDietaryOptions, nextDietaryNotes),
      notes: undefined,
      contactEmail: undefined,
      contactPhone: undefined,
      companions:
        nextAttendance === 'attending'
          ? nextCompanions.map((companion) => ({
              name: companion.name.trim(),
              dietaryNotes: companion.dietaryNotes.trim() || undefined,
              relationship: undefined,
            }))
          : [],
      submitted: false,
    });
    await refreshPortalState();
  };

  const chooseAttendanceAndContinue = async (nextAttendance: Attendance) => {
    setAttendance(nextAttendance);
    setLookupError('');
    setSubmitError('');
    setVerificationMessage('');

    setIsSavingProgress(true);
    try {
      await persistRsvpDraft({ attendance: nextAttendance });
      setIsEditingStep(true);
      setStep(3);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Unable to save attendance.');
    } finally {
      setIsSavingProgress(false);
    }
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLookupError('');
    setSubmitError('');
    if (step !== 1) {
      setVerificationMessage('');
    }

    if (!canSubmitCurrentStep) {
      return;
    }

    if ((step === 1 || step === totalSteps) && !connection) {
      setLookupError('Connection is still starting. Please try again in a moment.');
      return;
    }

    if (step === 1) {
      setVerificationState('verifying');
      setVerificationMessage('Verifying invitation details...');
      try {
        await connection!.reducers.identifyGuestByFallback({
          firstName: lookupFirstName.trim(),
          lastName: lookupLastName.trim(),
          inviteCode: normalizedInviteCode,
        });
        await refreshPortalState(normalizedInviteCode);
      } catch (error) {
        setVerificationState('failed');
        setVerificationMessage('');
        setLookupError(error instanceof Error ? error.message : 'Unable to verify invitation details.');
        return;
      }

      setVerificationState('verified');
      setVerificationMessage('Invitation verified successfully.');
      setStep(2);
      setIsEditingStep(false);
      return;
    }

    if (step < totalSteps) {
      const shouldApplyDefault = !isEditingStep && step !== 4;
      const nextDietaryMode = shouldApplyDefault && step === 3 ? 'none' : dietaryMode;
      const nextDietaryNotes = shouldApplyDefault && step === 3 ? '' : dietaryNotes;
      const nextDietaryOptions = shouldApplyDefault && step === 3 ? [] : dietaryOptionsSelected;

      if (shouldApplyDefault) {
        applyDefaultForStep(step);
      }

      if (step >= 3 && step <= 4) {
        setIsSavingProgress(true);
        try {
          await persistRsvpDraft({
            dietaryMode: nextDietaryMode,
            dietaryNotes: nextDietaryNotes,
            dietaryOptionsSelected: nextDietaryOptions,
          });
        } catch (error) {
          setSubmitError(error instanceof Error ? error.message : 'Unable to save your progress.');
          return;
        } finally {
          setIsSavingProgress(false);
        }
      }

      setStep((current) => current + 1);
      setIsEditingStep(false);
      return;
    }

    if (isRsvpClosed) {
      setSubmitError('RSVP updates are now closed because the deadline has passed.');
      return;
    }

    setIsSubmitting(true);
    try {
      await connection!.reducers.submitRsvp({
        attendance: attendance === 'attending',
        dietaryNotes: composeDietaryNotes(dietaryMode, dietaryOptionsSelected, dietaryNotes),
        notes: undefined,
        contactEmail: undefined,
        contactPhone: undefined,
        companions:
          attendance === 'attending'
            ? companions.map((companion) => ({
                name: companion.name.trim(),
                dietaryNotes: companion.dietaryNotes.trim() || undefined,
                relationship: undefined,
              }))
            : [],
        submitted: true,
      });
      await refreshPortalState();
      setSubmitted(true);
      try {
        const inviteCodeForRefresh = activeGuest?.inviteCode ?? lookupInviteCode;
        if (inviteCodeForRefresh) {
          await refreshUnlockSession(inviteCodeForRefresh);
        }
      } catch {
        // RSVP is already submitted; cookie refresh is best effort.
      }
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Unable to submit RSVP.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const current = STEP_META[step - 1];
  const showNameEditor = step === 1 && (isEditingStep || !hasDetectedName);
  const hasDefaultPath = step > 1 || hasDetectedName;
  const editToggleDisabled = (step === 1 && !hasDetectedName) || step === 4;
  const isVerifying = step === 1 && verificationState === 'verifying';
  const isRibbonNavigationDisabled = isVerifying || isSavingProgress;
  const dietarySummary = useMemo(() => {
    if (dietaryMode === 'none') {
      return 'No dietary restrictions';
    }

    const composed = composeDietaryNotes(dietaryMode, dietaryOptionsSelected, dietaryNotes);
    return composed ?? 'No dietary restrictions';
  }, [dietaryMode, dietaryNotes, dietaryOptionsSelected]);
  const editButtonLabel = useMemo(() => {
    if (isEditingStep && hasDefaultPath) {
      if (step === 1) {
        return 'Use detected name';
      }
      if (step === 2) {
        return 'Use suggested attendance';
      }
      return 'Use default';
    }

    if (step === 1) {
      return 'Edit name';
    }
    if (step === 3) {
      return 'Add dietary notes';
    }
    return 'Edit';
  }, [hasDefaultPath, isEditingStep, step]);

  const primaryButtonLabel = useMemo(() => {
    if (step === 4) {
      return companions.length > 0
        ? `Submit ${companions.length} Loved Ones`
        : 'I am coming alone';
    }

    if (isEditingStep) {
      if (step === 1) {
        return 'Save Name and Verify';
      }
      if (step === 2) {
        return 'Save Attendance';
      }
      if (step === 3) {
        return dietaryOptionsSelected.length > 0 || dietaryNotes.trim().length > 0
          ? 'Save Dietary Details'
          : 'No Dietary Restrictions';
      }
      return 'Save and Continue';
    }

    if (step === 1) {
      return 'Name Is Correct';
    }
    if (step === 3) {
      return 'No Dietary Restrictions';
    }
    return 'Continue';
  }, [companions.length, dietaryNotes, dietaryOptionsSelected.length, isEditingStep, step]);

  const jumpToCompletedStep = (targetStep: number) => {
    if (isRibbonNavigationDisabled || targetStep >= step) {
      return;
    }

    setStep(targetStep);
  };

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
        {STEP_META.map((meta, index) => {
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
            <legend>Confirm Your Invitation</legend>
            <p className="small-note">We are using the invite code from your unlocked invitation.</p>
            {normalizedInviteCode ? (
              <p className="small-note">
                Invite code found:
                {' '}
                <span className="detail-pill">{normalizedInviteCode}</span>
              </p>
            ) : (
              <p className="small-note">
                We could not find an unlocked invite code. Please return to <Link href="/">Home</Link> and unlock your invitation first.
              </p>
            )}
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
                Name detected from invitation list:
                {' '}
                <strong className="detail-strong">
                  {detectedGuestByInviteCode?.firstName || lookupFirstName}{' '}
                  {detectedGuestByInviteCode?.lastName || lookupLastName}
                </strong>
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
            <p className="small-note">Please choose one path so this step is not skipped.</p>
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
            <button
              type="button"
              className="button-back-small"
              disabled={step === 1 || isVerifying || isSavingProgress}
              onClick={() => setStep((currentStep) => currentStep - 1)}
            >
              <Icon name="arrow_back" className="button-icon" /> Back
            </button>

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
