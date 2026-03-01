'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useSpacetimeDB } from 'spacetimedb/react';
import Icon from '@/components/icon';
import { DbConnection, tables } from '@/module_bindings';
import { useDebugTable } from '@/lib/use-debug-table';

type EditableField = 'attendance' | 'dietaryNotes' | 'notes' | 'contactEmail' | 'contactPhone';

type SubmitPatch = {
  attendance?: boolean;
  dietaryNotes?: string | undefined;
  notes?: string | undefined;
  contactEmail?: string | undefined;
  contactPhone?: string | undefined;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[+\d][\d\s().-]{5,24}$/;

function formatTimestamp(microsSinceUnixEpoch: bigint): string {
  return new Date(Number(microsSinceUnixEpoch / 1000n)).toLocaleString();
}

function toAttendanceLabel(value: boolean | undefined): string {
  if (value === undefined) {
    return 'Pending';
  }
  return value ? 'Attending' : 'Regretfully declining';
}

function formatOptional(text: string | undefined): string {
  if (!text) {
    return 'Not provided';
  }
  const trimmed = text.trim();
  return trimmed.length > 0 ? trimmed : 'Not provided';
}

function normalizeOptionalInput(text: string | undefined): string | undefined {
  if (text === undefined) {
    return undefined;
  }
  const trimmed = text.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function toErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email);
}

function isValidPhone(phone: string): boolean {
  if (!PHONE_PATTERN.test(phone)) {
    return false;
  }
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15;
}

export default function DashboardPage() {
  const db = useSpacetimeDB();
  const connection = db.getConnection() as DbConnection | null;
  const senderIdentity = db.identity;

  const [guestRows, guestReady] = useDebugTable<any>('dashboard.guest', tables.guest);
  const [sessionRows, sessionReady] = useDebugTable<any>('dashboard.guest_session', tables.guest_session);
  const [rsvpRows] = useDebugTable<any>('dashboard.rsvp_response', tables.rsvp_response);
  const [companionRows] = useDebugTable<any>('dashboard.companion', tables.companion);
  const [messageRows] = useDebugTable<any>('dashboard.guest_message', tables.guest_message);
  const [configRows] = useDebugTable<any>('dashboard.config', tables.config);

  const [messageDraft, setMessageDraft] = useState('');
  const [messageError, setMessageError] = useState('');
  const [lookupFirstName, setLookupFirstName] = useState('');
  const [lookupLastName, setLookupLastName] = useState('');
  const [lookupPassword, setLookupPassword] = useState('');
  const [lookupError, setLookupError] = useState('');
  const [lookupStatus, setLookupStatus] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);

  const [editingField, setEditingField] = useState<EditableField | null>(null);
  const [feedbackField, setFeedbackField] = useState<EditableField | null>(null);
  const [fieldError, setFieldError] = useState('');
  const [fieldStatus, setFieldStatus] = useState('');
  const [isSavingField, setIsSavingField] = useState(false);

  const [attendanceDraft, setAttendanceDraft] = useState<boolean | undefined>(undefined);
  const [dietaryDraft, setDietaryDraft] = useState('');
  const [notesDraft, setNotesDraft] = useState('');
  const [contactEmailDraft, setContactEmailDraft] = useState('');
  const [contactPhoneDraft, setContactPhoneDraft] = useState('');

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

  const guestCompanions = useMemo(
    () => (activeGuest ? companionRows.filter((row) => row.guestId === activeGuest.id) : []),
    [activeGuest, companionRows]
  );

  const guestMessages = useMemo(() => {
    if (!activeGuest) {
      return [];
    }

    return messageRows
      .filter((row) => row.guestId === activeGuest.id)
      .sort((a, b) =>
        b.createdAt.microsSinceUnixEpoch > a.createdAt.microsSinceUnixEpoch ? 1 : -1
      );
  }, [activeGuest, messageRows]);

  const companionPayload = useMemo(
    () =>
      guestCompanions.map((companion) => ({
        name: companion.name,
        dietaryNotes: normalizeOptionalInput(companion.dietaryNotes),
        relationship: normalizeOptionalInput(companion.relationship),
      })),
    [guestCompanions]
  );

  const config = useMemo(() => configRows.find((row) => row.id === 1n), [configRows]);

  const isRsvpClosed = useMemo(() => {
    const cutoff = config?.globalRsvpCutoffAt;
    if (!cutoff) {
      return false;
    }
    return BigInt(Date.now()) * 1000n > cutoff.microsSinceUnixEpoch;
  }, [config?.globalRsvpCutoffAt]);

  const attendanceLabel = toAttendanceLabel(activeRsvp?.attendance);
  const isLoading = !guestReady || !sessionReady;
  const canEditRsvpDetails = activeRsvp?.attendance !== undefined;
  const phoneChanged =
    normalizeOptionalInput(contactPhoneDraft) !== normalizeOptionalInput(activeGuest?.contactPhone);

  useEffect(() => {
    setEditingField(null);
    setFeedbackField(null);
    setFieldError('');
    setFieldStatus('');
  }, [activeGuest?.id]);

  useEffect(() => {
    if (!activeGuest) {
      return;
    }
    setLookupError('');
    setLookupStatus('');
  }, [activeGuest]);

  const clearFieldFeedback = () => {
    setFeedbackField(null);
    setFieldError('');
    setFieldStatus('');
  };

  const openEditor = (field: EditableField) => {
    clearFieldFeedback();
    setEditingField(field);

    if (field === 'attendance') {
      setAttendanceDraft(activeRsvp?.attendance);
      return;
    }
    if (field === 'dietaryNotes') {
      setDietaryDraft(activeRsvp?.dietaryNotes ?? '');
      return;
    }
    if (field === 'notes') {
      setNotesDraft(activeRsvp?.notes ?? '');
      return;
    }
    if (field === 'contactEmail') {
      setContactEmailDraft(activeGuest?.contactEmail ?? '');
      return;
    }
    setContactPhoneDraft(activeGuest?.contactPhone ?? '');
  };

  const cancelEditor = () => {
    setEditingField(null);
    clearFieldFeedback();
  };

  const setFieldFailure = (field: EditableField, message: string) => {
    setFeedbackField(field);
    setFieldStatus('');
    setFieldError(message);
  };

  const setFieldSuccess = (field: EditableField, message: string) => {
    setFeedbackField(field);
    setFieldError('');
    setFieldStatus(message);
    setEditingField(null);
  };

  const submitRsvpPatch = async (patch: SubmitPatch) => {
    if (!connection) {
      throw new Error('Connection is still starting. Please try again.');
    }

    if (!activeGuest) {
      throw new Error('Guest profile not loaded yet.');
    }

    if (isRsvpClosed) {
      throw new Error('RSVP edits are closed because the global cutoff has passed.');
    }

    const hasAttendance = Object.prototype.hasOwnProperty.call(patch, 'attendance');
    const hasDietaryNotes = Object.prototype.hasOwnProperty.call(patch, 'dietaryNotes');
    const hasNotes = Object.prototype.hasOwnProperty.call(patch, 'notes');
    const hasContactEmail = Object.prototype.hasOwnProperty.call(patch, 'contactEmail');
    const hasContactPhone = Object.prototype.hasOwnProperty.call(patch, 'contactPhone');

    const nextAttendance = hasAttendance ? patch.attendance : activeRsvp?.attendance;
    if (nextAttendance === undefined) {
      throw new Error('Please set attendance first before editing this field.');
    }

    const nextDietaryNotes = hasDietaryNotes
      ? patch.dietaryNotes
      : normalizeOptionalInput(activeRsvp?.dietaryNotes);

    const nextNotes = hasNotes ? patch.notes : normalizeOptionalInput(activeRsvp?.notes);

    const nextContactEmail = hasContactEmail
      ? patch.contactEmail
      : normalizeOptionalInput(activeGuest.contactEmail);

    const nextContactPhone = hasContactPhone
      ? patch.contactPhone
      : normalizeOptionalInput(activeGuest.contactPhone);

    await connection.reducers.submitRsvp({
      attendance: nextAttendance,
      dietaryNotes: nextDietaryNotes,
      notes: nextNotes,
      contactEmail: nextContactEmail,
      contactPhone: nextContactPhone,
      companions: nextAttendance ? companionPayload : [],
    });
  };

  const onConfirmAttendance = async () => {
    const field: EditableField = 'attendance';
    clearFieldFeedback();

    if (attendanceDraft === undefined) {
      setFieldFailure(field, 'Please select attending or declining.');
      return;
    }

    setIsSavingField(true);
    try {
      await submitRsvpPatch({ attendance: attendanceDraft });
      setFieldSuccess(field, 'Attendance updated.');
    } catch (error) {
      setFieldFailure(field, toErrorMessage(error, 'Unable to update attendance.'));
    } finally {
      setIsSavingField(false);
    }
  };

  const onConfirmDietaryNotes = async () => {
    const field: EditableField = 'dietaryNotes';
    clearFieldFeedback();
    setIsSavingField(true);

    try {
      await submitRsvpPatch({ dietaryNotes: normalizeOptionalInput(dietaryDraft) });
      setFieldSuccess(field, 'Dietary notes updated.');
    } catch (error) {
      setFieldFailure(field, toErrorMessage(error, 'Unable to update dietary notes.'));
    } finally {
      setIsSavingField(false);
    }
  };

  const onConfirmNotes = async () => {
    const field: EditableField = 'notes';
    clearFieldFeedback();
    setIsSavingField(true);

    try {
      await submitRsvpPatch({ notes: normalizeOptionalInput(notesDraft) });
      setFieldSuccess(field, 'Additional notes updated.');
    } catch (error) {
      setFieldFailure(field, toErrorMessage(error, 'Unable to update additional notes.'));
    } finally {
      setIsSavingField(false);
    }
  };

  const onConfirmContactEmail = async () => {
    const field: EditableField = 'contactEmail';
    clearFieldFeedback();
    const normalizedEmail = normalizeOptionalInput(contactEmailDraft);

    if (normalizedEmail && !isValidEmail(normalizedEmail)) {
      setFieldFailure(field, 'Please enter a valid email address.');
      return;
    }

    setIsSavingField(true);

    try {
      await submitRsvpPatch({ contactEmail: normalizedEmail });
      setFieldSuccess(field, 'Contact email updated.');
    } catch (error) {
      setFieldFailure(field, toErrorMessage(error, 'Unable to update contact email.'));
    } finally {
      setIsSavingField(false);
    }
  };

  const onConfirmContactPhone = async () => {
    const field: EditableField = 'contactPhone';
    clearFieldFeedback();
    const normalizedPhone = normalizeOptionalInput(contactPhoneDraft);

    if (!connection) {
      setFieldFailure(field, 'Connection is still starting. Please try again.');
      return;
    }

    if (!phoneChanged) {
      setFieldFailure(field, 'No changes to save.');
      return;
    }

    if (normalizedPhone && !isValidPhone(normalizedPhone)) {
      setFieldFailure(field, 'Please enter a valid phone number.');
      return;
    }

    setIsSavingField(true);
    try {
      await connection.reducers.updateGuestPhone({
        contactPhone: normalizedPhone,
      });
      setFieldSuccess(field, 'Contact phone updated.');
    } catch (error) {
      setFieldFailure(field, toErrorMessage(error, 'Unable to update phone number.'));
    } finally {
      setIsSavingField(false);
    }
  };

  const onSendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessageError('');

    if (!connection) {
      setMessageError('Connection is still starting. Please try again.');
      return;
    }

    const trimmed = messageDraft.trim();
    if (!trimmed) {
      setMessageError('Message is required.');
      return;
    }

    try {
      await connection.reducers.sendGuestMessage({ message: trimmed });
      setMessageDraft('');
    } catch (error) {
      setMessageError(toErrorMessage(error, 'Unable to send message.'));
    }
  };

  const onLookupGuest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLookupError('');
    setLookupStatus('');

    if (!connection) {
      setLookupError('Connection is still starting. Please try again.');
      return;
    }

    const firstName = lookupFirstName.trim();
    const lastName = lookupLastName.trim();
    const password = lookupPassword.trim();

    if (!firstName || !lastName || !password) {
      setLookupError('First name, last name, and password are required.');
      return;
    }

    setIsLookingUp(true);
    try {
      await connection.reducers.identifyGuestByFallback({
        firstName,
        lastName,
        inviteCode: password,
      });
      setLookupStatus('Verification successful. Loading your dashboard...');
    } catch (error) {
      setLookupError(toErrorMessage(error, 'Unable to verify invitation details.'));
    } finally {
      setIsLookingUp(false);
    }
  };

  const renderFieldFeedback = (field: EditableField) => {
    if (feedbackField !== field) {
      return null;
    }
    if (fieldError) {
      return <p className="small-note">{fieldError}</p>;
    }
    if (fieldStatus) {
      return <p className="small-note">{fieldStatus}</p>;
    }
    return null;
  };

  return (
    <div className="dashboard-page">
      <section className="page-head">
        <h1 className="heading-with-icon">
          <Icon name="dashboard" className="heading-icon" />
          <span>Guest Dashboard</span>
        </h1>
        <p>Summary view with quick per-field editing.</p>
      </section>

      {isLoading ? (
        <section className="card">
          <p>Loading your guest profile...</p>
        </section>
      ) : null}

      {!isLoading && !activeGuest ? (
        <section className="card">
          <h2 className="heading-with-icon">
            <Icon name="lock" className="heading-icon" />
            <span>Find Your Invitation</span>
          </h2>
          <p>Enter your invitation details to open your dashboard.</p>
          <form className="form-stack" onSubmit={onLookupGuest}>
            <label>
              First name
              <input
                value={lookupFirstName}
                onChange={(event) => setLookupFirstName(event.target.value)}
                autoComplete="given-name"
                placeholder="e.g. Natasha"
              />
            </label>
            <label>
              Last name
              <input
                value={lookupLastName}
                onChange={(event) => setLookupLastName(event.target.value)}
                autoComplete="family-name"
                placeholder="e.g. Wong"
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={lookupPassword}
                onChange={(event) => setLookupPassword(event.target.value)}
                autoComplete="current-password"
                placeholder="Invitation password"
              />
            </label>
            {lookupError ? <p className="small-note">{lookupError}</p> : null}
            {lookupStatus ? <p className="small-note">{lookupStatus}</p> : null}
            <div className="cta-row">
              <button type="submit" className="button-primary" disabled={isLookingUp}>
                <Icon name="how_to_reg" className="button-icon" />
                {isLookingUp ? 'Checking...' : 'Open Dashboard'}
              </button>
            </div>
          </form>
          <div className="cta-row">
            <Link href="/rsvp" className="button-secondary">
              <Icon name="arrow_outward" className="button-icon" /> Go to RSVP Instead
            </Link>
          </div>
        </section>
      ) : null}

      {!isLoading && activeGuest ? (
        <>
          <section className="card">
            <h2 className="heading-with-icon">
              <Icon name="person" className="heading-icon" />
              <span>Guest Summary</span>
            </h2>
            <p>
              <strong>Name:</strong> {activeGuest.firstName} {activeGuest.lastName}
            </p>
            <p>
              <strong>Invite code:</strong> {activeGuest.inviteCode}
            </p>
            <p>
              <strong>Loved ones allowed:</strong>{' '}
              {activeGuest.canAddCompanions
                ? `Yes (up to ${activeGuest.maxCompanions.toString()})`
                : 'No'}
            </p>
            <p>
              <strong>Loved ones currently added:</strong> {guestCompanions.length}
            </p>
            <p className="small-note">
              Last updated: {formatTimestamp(activeGuest.updatedAt.microsSinceUnixEpoch)}
            </p>
            <p className="small-note">
              {config?.globalRsvpCutoffAt
                ? `RSVP edits close on ${formatTimestamp(config.globalRsvpCutoffAt.microsSinceUnixEpoch)}.`
                : 'RSVP cutoff date has not been finalized yet.'}
            </p>
          </section>

          <section className="card">
            <h2 className="heading-with-icon">
              <Icon name="edit_square" className="heading-icon" />
              <span>Edit your RSVP</span>
            </h2>

            <div className="rsvp-edit-grid">
              <fieldset>
                <legend>Attendance</legend>
                <p>
                  <strong>Current value:</strong> {attendanceLabel}
                </p>
                {editingField === 'attendance' ? (
                  <div className="form-stack">
                    <div className="option-row">
                      <button
                        type="button"
                        className={`option-chip ${attendanceDraft === true ? 'active' : ''}`}
                        onClick={() => setAttendanceDraft(true)}
                      >
                        <Icon name="check_circle" className="inline-icon" /> Attending
                      </button>
                      <button
                        type="button"
                        className={`option-chip ${attendanceDraft === false ? 'active' : ''}`}
                        onClick={() => setAttendanceDraft(false)}
                      >
                        <Icon name="cancel" className="inline-icon" /> Declining
                      </button>
                    </div>
                    <div className="cta-row">
                      <button type="button" className="button-secondary" onClick={cancelEditor}>
                        <Icon name="close" className="button-icon" /> Cancel
                      </button>
                      <button
                        type="button"
                        className="button-primary"
                        onClick={onConfirmAttendance}
                        disabled={isSavingField}
                      >
                        <Icon name="check" className="button-icon" /> Confirm
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="cta-row">
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={() => openEditor('attendance')}
                    >
                      <Icon name="edit" className="button-icon" /> Edit
                    </button>
                  </div>
                )}
                {renderFieldFeedback('attendance')}
              </fieldset>

              <fieldset>
                <legend>Dietary Notes</legend>
                <p>
                  <strong>Current value:</strong> {formatOptional(activeRsvp?.dietaryNotes)}
                </p>
                {editingField === 'dietaryNotes' ? (
                  <div className="form-stack">
                    <label>
                      Dietary notes
                      <textarea
                        rows={3}
                        value={dietaryDraft}
                        onChange={(event) => setDietaryDraft(event.target.value)}
                        placeholder="Allergies, vegetarian needs, or other requirements"
                      />
                    </label>
                    <div className="cta-row">
                      <button type="button" className="button-secondary" onClick={cancelEditor}>
                        <Icon name="close" className="button-icon" /> Cancel
                      </button>
                      <button
                        type="button"
                        className="button-primary"
                        onClick={onConfirmDietaryNotes}
                        disabled={isSavingField}
                      >
                        <Icon name="check" className="button-icon" /> Confirm
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="cta-row">
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={() => openEditor('dietaryNotes')}
                      disabled={!canEditRsvpDetails}
                    >
                      <Icon name="edit" className="button-icon" /> Edit
                    </button>
                  </div>
                )}
                {!canEditRsvpDetails ? <p className="small-note">Set attendance first to edit this field.</p> : null}
                {renderFieldFeedback('dietaryNotes')}
              </fieldset>

              <fieldset>
                <legend>Additional Notes</legend>
                <p>
                  <strong>Current value:</strong> {formatOptional(activeRsvp?.notes)}
                </p>
                {editingField === 'notes' ? (
                  <div className="form-stack">
                    <label>
                      Additional notes
                      <textarea
                        rows={3}
                        value={notesDraft}
                        onChange={(event) => setNotesDraft(event.target.value)}
                        placeholder="Any extra context for the hosts"
                      />
                    </label>
                    <div className="cta-row">
                      <button type="button" className="button-secondary" onClick={cancelEditor}>
                        <Icon name="close" className="button-icon" /> Cancel
                      </button>
                      <button
                        type="button"
                        className="button-primary"
                        onClick={onConfirmNotes}
                        disabled={isSavingField}
                      >
                        <Icon name="check" className="button-icon" /> Confirm
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="cta-row">
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={() => openEditor('notes')}
                      disabled={!canEditRsvpDetails}
                    >
                      <Icon name="edit" className="button-icon" /> Edit
                    </button>
                  </div>
                )}
                {!canEditRsvpDetails ? <p className="small-note">Set attendance first to edit this field.</p> : null}
                {renderFieldFeedback('notes')}
              </fieldset>

              <fieldset>
                <legend>Contact Email</legend>
                <p>
                  <strong>Current value:</strong> {formatOptional(activeGuest.contactEmail)}
                </p>
                {editingField === 'contactEmail' ? (
                  <div className="form-stack">
                    <label>
                      Contact email
                      <input
                        type="email"
                        value={contactEmailDraft}
                        onChange={(event) => setContactEmailDraft(event.target.value)}
                        placeholder="name@email.com"
                        autoComplete="email"
                      />
                    </label>
                    <div className="cta-row">
                      <button type="button" className="button-secondary" onClick={cancelEditor}>
                        <Icon name="close" className="button-icon" /> Cancel
                      </button>
                      <button
                        type="button"
                        className="button-primary"
                        onClick={onConfirmContactEmail}
                        disabled={isSavingField}
                      >
                        <Icon name="check" className="button-icon" /> Confirm
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="cta-row">
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={() => openEditor('contactEmail')}
                      disabled={!canEditRsvpDetails}
                    >
                      <Icon name="edit" className="button-icon" /> Edit
                    </button>
                  </div>
                )}
                {!canEditRsvpDetails ? <p className="small-note">Set attendance first to edit this field.</p> : null}
                {renderFieldFeedback('contactEmail')}
              </fieldset>

              <fieldset>
                <legend>Contact Phone</legend>
                <p>
                  <strong>Current value:</strong> {formatOptional(activeGuest.contactPhone)}
                </p>
                {editingField === 'contactPhone' ? (
                  <div className="form-stack">
                    <label>
                      Contact phone
                      <input
                        type="tel"
                        value={contactPhoneDraft}
                        onChange={(event) => setContactPhoneDraft(event.target.value)}
                        placeholder="+65 ..."
                        autoComplete="tel"
                      />
                    </label>
                    <div className="cta-row">
                      <button type="button" className="button-secondary" onClick={cancelEditor}>
                        <Icon name="close" className="button-icon" /> Cancel
                      </button>
                      <button
                        type="button"
                        className="button-primary"
                        onClick={onConfirmContactPhone}
                        disabled={isSavingField}
                      >
                        <Icon name="check" className="button-icon" /> Confirm
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="cta-row">
                    <button type="button" className="button-secondary" onClick={() => openEditor('contactPhone')}>
                      <Icon name="edit" className="button-icon" /> Edit
                    </button>
                  </div>
                )}
                {renderFieldFeedback('contactPhone')}
              </fieldset>
            </div>
          </section>

          <section className="card">
            <h2 className="heading-with-icon">
              <Icon name="mail" className="heading-icon" />
              <span>Questions</span>
            </h2>
            <p className="small-note">We'll respond as soon as possible.</p>
            <h3>Past Questions</h3>
            {guestMessages.length > 0 ? (
              <ol className="faq-list">
                {guestMessages.map((message) => (
                  <li key={message.id.toString()}>
                    <p>{message.message}</p>
                    <p className="small-note">
                      Sent {formatTimestamp(message.createdAt.microsSinceUnixEpoch)} | Status: {message.status}
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="small-note">You have not sent any questions yet.</p>
            )}
            <form className="form-stack" onSubmit={onSendMessage}>
              <label>
                Message
                <textarea
                  rows={5}
                  placeholder="Type your question here."
                  value={messageDraft}
                  onChange={(event) => setMessageDraft(event.target.value)}
                />
              </label>
              {messageError ? <p className="small-note">{messageError}</p> : null}
              <button type="submit" className="button-primary">
                <Icon name="send" className="button-icon" /> Send Message
              </button>
            </form>
          </section>

          <section className="card">
            <h2 className="heading-with-icon">
              <Icon name="calendar_month" className="heading-icon" />
              <span>Helpful Links</span>
            </h2>
            <div className="cta-row">
              <Link href="/rsvp" className="button-secondary">
                <Icon name="edit_square" className="button-icon" /> Full RSVP Flow
              </Link>
              <Link href="/event-details" className="button-secondary">
                <Icon name="event_note" className="button-icon" /> Event Details
              </Link>
              <Link href="/faq" className="button-secondary">
                <Icon name="help" className="button-icon" /> FAQ
              </Link>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
