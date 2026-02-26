'use client';

import Link from 'next/link';
import { FormEvent, useMemo, useState } from 'react';
import { DesignVariant, getVariantMeta } from '@/lib/design-variant';
import Icon from '@/components/icon';

type Attendance = 'attending' | 'declining' | '';
type DietaryMode = 'none' | 'add' | '';
type ContactMode = 'skip' | 'add' | '';

type Companion = {
  name: string;
  dietaryNotes: string;
};

type RsvpFlowProps = {
  initialToken?: string;
  variant?: DesignVariant;
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

export default function RsvpFlow({ initialToken, variant = 'heirloom' }: RsvpFlowProps) {
  const variantMeta = getVariantMeta(variant);

  const [step, setStep] = useState(1);

  const [lookupFirstName, setLookupFirstName] = useState('');
  const [lookupLastName, setLookupLastName] = useState('');
  const [lookupInviteCode, setLookupInviteCode] = useState('');

  const [attendance, setAttendance] = useState<Attendance>('');
  const [dietaryMode, setDietaryMode] = useState<DietaryMode>('');
  const [dietaryNotes, setDietaryNotes] = useState('');

  const [contactMode, setContactMode] = useState<ContactMode>('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');

  const [companionAllowed] = useState(true);
  const [companions, setCompanions] = useState<Companion[]>([]);
  const [companionName, setCompanionName] = useState('');
  const [companionDietary, setCompanionDietary] = useState('');

  const [submitted, setSubmitted] = useState(false);

  const totalSteps = STEP_META.length;

  const progressPercent = useMemo(
    () => Math.round((step / totalSteps) * 100),
    [step, totalSteps]
  );

  const isNameSatisfied = Boolean(initialToken) || Boolean(
    lookupFirstName.trim() && lookupLastName.trim()
  );

  const isInviteCodeSatisfied = Boolean(initialToken) || Boolean(lookupInviteCode.trim());

  const isDietarySatisfied =
    dietaryMode === 'none' || (dietaryMode === 'add' && dietaryNotes.trim().length > 0);

  const isContactSatisfied =
    contactMode === 'skip' ||
    (contactMode === 'add' && (contactEmail.trim().length > 0 || contactPhone.trim().length > 0));

  const canMoveForward =
    (step === 1 && isNameSatisfied) ||
    (step === 2 && isInviteCodeSatisfied) ||
    (step === 3 && attendance !== '') ||
    (step === 4 && isDietarySatisfied) ||
    (step === 5 && isContactSatisfied) ||
    step === 6 ||
    step === 7;

  const addCompanion = () => {
    if (!companionName.trim()) {
      return;
    }

    setCompanions((current) => [
      ...current,
      { name: companionName.trim(), dietaryNotes: companionDietary.trim() },
    ]);
    setCompanionName('');
    setCompanionDietary('');
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canMoveForward) {
      return;
    }

    if (step < totalSteps) {
      setStep((current) => current + 1);
      return;
    }

    setSubmitted(true);
  };

  const current = STEP_META[step - 1];

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

      <form onSubmit={onSubmit} className="form-stack">
        {step === 1 ? (
          <fieldset>
            <legend>Name Details</legend>
            {initialToken ? (
              <p className="small-note">Invitation link verified. You may continue.</p>
            ) : (
              <>
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
            )}
          </fieldset>
        ) : null}

        {step === 2 ? (
          <fieldset>
            <legend>Invite Code</legend>
            {initialToken ? (
              <p className="small-note">Invite code already verified via direct invitation link.</p>
            ) : (
              <>
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
            )}
          </fieldset>
        ) : null}

        {step === 3 ? (
          <fieldset>
            <legend>Attendance</legend>
            <div className="option-row">
              <button
                type="button"
                className={`option-chip ${attendance === 'attending' ? 'active' : ''}`}
                onClick={() => {
                  setAttendance('attending');
                  setStep(4);
                }}
              >
                <Icon name="check_circle" className="inline-icon" /> Joyfully Accept
              </button>
              <button
                type="button"
                className={`option-chip ${attendance === 'declining' ? 'active' : ''}`}
                onClick={() => {
                  setAttendance('declining');
                  setStep(4);
                }}
              >
                <Icon name="cancel" className="inline-icon" /> Regretfully Decline
              </button>
            </div>
          </fieldset>
        ) : null}

        {step === 4 ? (
          <fieldset>
            <legend>Dietary Requirements</legend>
            <div className="option-row">
              <button
                type="button"
                className={`option-chip ${dietaryMode === 'none' ? 'active' : ''}`}
                onClick={() => {
                  setDietaryMode('none');
                  setDietaryNotes('');
                  setStep(5);
                }}
              >
                <Icon name="done_all" className="inline-icon" /> No dietary restrictions
              </button>
              <button
                type="button"
                className={`option-chip ${dietaryMode === 'add' ? 'active' : ''}`}
                onClick={() => setDietaryMode('add')}
              >
                <Icon name="edit_note" className="inline-icon" /> Add dietary notes
              </button>
            </div>

            {dietaryMode === 'add' ? (
              <label>
                Dietary notes
                <textarea
                  value={dietaryNotes}
                  onChange={(event) => setDietaryNotes(event.target.value)}
                  rows={4}
                  placeholder="Please include allergies, vegetarian requirements, or other needs."
                />
              </label>
            ) : null}
          </fieldset>
        ) : null}

        {step === 5 ? (
          <fieldset>
            <legend>Contact Details</legend>
            <div className="option-row">
              <button
                type="button"
                className={`option-chip ${contactMode === 'skip' ? 'active' : ''}`}
                onClick={() => {
                  setContactMode('skip');
                  setContactEmail('');
                  setContactPhone('');
                  setStep(6);
                }}
              >
                <Icon name="check_circle" className="inline-icon" /> Skip contact details
              </button>
              <button
                type="button"
                className={`option-chip ${contactMode === 'add' ? 'active' : ''}`}
                onClick={() => setContactMode('add')}
              >
                <Icon name="edit_square" className="inline-icon" /> Add contact details
              </button>
            </div>

            {contactMode === 'add' ? (
              <>
                <label>
                  Email (optional)
                  <input
                    type="email"
                    value={contactEmail}
                    onChange={(event) => setContactEmail(event.target.value)}
                    placeholder="name@email.com"
                  />
                </label>
                <label>
                  Phone (optional)
                  <input
                    value={contactPhone}
                    onChange={(event) => setContactPhone(event.target.value)}
                    placeholder="+65 ..."
                  />
                </label>
              </>
            ) : null}
          </fieldset>
        ) : null}

        {step === 6 ? (
          <fieldset>
            <legend>Add loved ones</legend>
            {companionAllowed ? (
              <>
                <div className="option-row">
                  <button
                    type="button"
                    className="option-chip"
                    onClick={() => setStep(7)}
                  >
                    <Icon name="check_circle" className="inline-icon" /> No loved ones to add
                  </button>
                </div>
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
                {initialToken ? 'Verified via invitation link' : `${lookupFirstName} ${lookupLastName}`}
              </li>
              <li>
                <strong>Invite code:</strong> {initialToken ? 'Verified via invitation link' : lookupInviteCode}
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

        <div className="cta-row">
          {step > 1 ? (
            <button
              type="button"
              className="button-secondary"
              onClick={() => setStep((currentStep) => currentStep - 1)}
            >
              <Icon name="arrow_back" className="button-icon" /> Back
            </button>
          ) : null}

          <button type="submit" className="button-primary" disabled={!canMoveForward}>
            {step < totalSteps ? (
              <>
                Continue <Icon name="arrow_forward" className="button-icon" />
              </>
            ) : (
              <>
                Submit RSVP <Icon name="task_alt" className="button-icon" />
              </>
            )}
          </button>
        </div>
      </form>
    </section>
  );
}
