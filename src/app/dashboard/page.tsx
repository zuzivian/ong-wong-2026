'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useSpacetimeDB } from 'spacetimedb/react';
import Icon from '@/components/icon';
import { DbConnection, tables } from '@/module_bindings';
import { useDebugTable } from '@/lib/use-debug-table';
import { normalizeInviteCode } from '@/lib/unlock-client';

type EditableField = 'attendance' | 'dietaryNotes' | 'notes' | 'contactEmail' | 'contactPhone';

type CompanionDraft = {
  name: string;
  dietaryNotes: string;
  relationship: string;
};

type SubmitPatch = {
  attendance?: boolean;
  dietaryNotes?: string | undefined;
  notes?: string | undefined;
  contactEmail?: string | undefined;
  contactPhone?: string | undefined;
};

type UnlockCookieResponse = {
  ok?: boolean;
  inviteCode?: string | null;
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

function toMessageStatusLabel(status: string): string {
  const normalizedStatus = status.trim().toLowerCase();
  if (!normalizedStatus || normalizedStatus === 'new') {
    return 'Awaiting response';
  }
  if (normalizedStatus === 'updated') {
    return 'Updated';
  }
  return status;
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

  const [messageDraft, setMessageDraft] = useState('');
  const [messageError, setMessageError] = useState('');
  const [messageStatus, setMessageStatus] = useState('');
  const [editingMessageId, setEditingMessageId] = useState<bigint | null>(null);
  const [editingMessageDraft, setEditingMessageDraft] = useState('');
  const [messageActionError, setMessageActionError] = useState('');
  const [messageActionStatus, setMessageActionStatus] = useState('');
  const [isSavingMessageAction, setIsSavingMessageAction] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [lookupStatus, setLookupStatus] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [unlockInviteCode, setUnlockInviteCode] = useState('');
  const [unlockCodeReady, setUnlockCodeReady] = useState(false);
  const autoLookupAttemptRef = useRef<string | null>(null);

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
  const [companionDrafts, setCompanionDrafts] = useState<CompanionDraft[]>([]);
  const [isEditingCompanions, setIsEditingCompanions] = useState(false);
  const [companionStatus, setCompanionStatus] = useState('');
  const [companionError, setCompanionError] = useState('');
  const [isSavingCompanions, setIsSavingCompanions] = useState(false);

  const sessionQuery = useMemo(() => {
    if (!senderIdentity) {
      return tables.guest_session.where((row) => row.guestId.eq(0n));
    }
    return tables.guest_session.where((row) => row.sender.eq(senderIdentity));
  }, [senderIdentity]);
  const [sessionRows] = useDebugTable<any>('dashboard.guest_session', sessionQuery);

  const activeSession = useMemo(() => {
    return sessionRows[0];
  }, [sessionRows]);
  const activeSessionGuestId = activeSession?.guestId as bigint | undefined;

  const guestQuery = useMemo(() => {
    if (activeSessionGuestId !== undefined) {
      return tables.guest.where((row) => row.id.eq(activeSessionGuestId));
    }
    if (unlockInviteCode) {
      return tables.guest.where((row) => row.inviteCode.eq(unlockInviteCode));
    }
    return tables.guest.where((row) => row.id.eq(0n));
  }, [activeSessionGuestId, unlockInviteCode]);
  const [guestRows, guestLoading] = useDebugTable<any>('dashboard.guest', guestQuery);

  const activeGuest = useMemo(
    () => guestRows[0],
    [guestRows]
  );

  const activeGuestId = activeGuest?.id as bigint | undefined;

  const rsvpQuery = useMemo(() => {
    if (activeGuestId === undefined) {
      return tables.rsvp_response.where((row) => row.guestId.eq(0n));
    }
    return tables.rsvp_response.where((row) => row.guestId.eq(activeGuestId));
  }, [activeGuestId]);
  const [rsvpRows] = useDebugTable<any>('dashboard.rsvp_response', rsvpQuery);

  const companionQuery = useMemo(() => {
    if (activeGuestId === undefined) {
      return tables.companion.where((row) => row.guestId.eq(0n));
    }
    return tables.companion.where((row) => row.guestId.eq(activeGuestId));
  }, [activeGuestId]);
  const [companionRows] = useDebugTable<any>('dashboard.companion', companionQuery);

  const messageQuery = useMemo(() => {
    if (activeGuestId === undefined) {
      return tables.guest_message.where((row) => row.guestId.eq(0n));
    }
    return tables.guest_message.where((row) => row.guestId.eq(activeGuestId));
  }, [activeGuestId]);
  const [messageRows] = useDebugTable<any>('dashboard.guest_message', messageQuery);

  const configQuery = useMemo(
    () => tables.config.where((row) => row.id.eq(1n)),
    []
  );
  const [configRows] = useDebugTable<any>('dashboard.config', configQuery);

  const activeRsvp = useMemo(
    () => (activeGuest ? rsvpRows.find((row) => row.guestId === activeGuest.id) : undefined),
    [activeGuest, rsvpRows]
  );

  const detectedGuestByUnlockCode = useMemo(() => {
    if (!unlockInviteCode) {
      return undefined;
    }

    return guestRows.find(
      (row) => normalizeInviteCode(row.inviteCode) === unlockInviteCode
    );
  }, [guestRows, unlockInviteCode]);

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

  useEffect(() => {
    if (editingMessageId === null) {
      return;
    }
    const messageStillExists = guestMessages.some((message) => message.id === editingMessageId);
    if (!messageStillExists) {
      setEditingMessageId(null);
      setEditingMessageDraft('');
    }
  }, [editingMessageId, guestMessages]);

  const companionPayload = useMemo(
    () =>
      guestCompanions.map((companion) => ({
        name: companion.name,
        dietaryNotes: normalizeOptionalInput(companion.dietaryNotes),
        relationship: normalizeOptionalInput(companion.relationship),
      })),
    [guestCompanions]
  );

  const config = useMemo(() => configRows[0], [configRows]);

  const isRsvpClosed = useMemo(() => {
    const cutoff = config?.globalRsvpCutoffAt;
    if (!cutoff) {
      return false;
    }
    return BigInt(Date.now()) * 1000n > cutoff.microsSinceUnixEpoch;
  }, [config?.globalRsvpCutoffAt]);

  const attendanceLabel = toAttendanceLabel(activeRsvp?.attendance);
  const canEditRsvpDetails = activeRsvp?.attendance !== undefined;
  const isAttending = activeRsvp?.attendance === true;
  const maxCompanions = Number(activeGuest?.maxCompanions ?? 0n);
  const canManageCompanions = Boolean(
    activeGuest?.canAddCompanions &&
    activeRsvp?.attendance === true &&
    !isRsvpClosed
  );
  const phoneChanged =
    normalizeOptionalInput(contactPhoneDraft) !== normalizeOptionalInput(activeGuest?.contactPhone);

  useEffect(() => {
    setEditingField(null);
    setFeedbackField(null);
    setFieldError('');
    setFieldStatus('');
    setMessageDraft('');
    setMessageError('');
    setMessageStatus('');
    setEditingMessageId(null);
    setEditingMessageDraft('');
    setMessageActionError('');
    setMessageActionStatus('');
    setCompanionStatus('');
    setCompanionError('');
    setIsEditingCompanions(false);
  }, [activeGuest?.id]);

  useEffect(() => {
    setCompanionDrafts(
      guestCompanions.map((companion) => ({
        name: companion.name,
        dietaryNotes: companion.dietaryNotes ?? '',
        relationship: companion.relationship ?? '',
      }))
    );
  }, [guestCompanions]);

  useEffect(() => {
    if (!activeGuest) {
      return;
    }
    setLookupError('');
    setLookupStatus('');
  }, [activeGuest]);

  useEffect(() => {
    let cancelled = false;

    const loadUnlockCode = async () => {
      try {
        const response = await fetch('/api/unlock', {
          method: 'GET',
          cache: 'no-store',
        });
        const payload = (await response.json().catch(() => null)) as UnlockCookieResponse | null;

        if (!response.ok || !payload?.ok || typeof payload.inviteCode !== 'string') {
          return;
        }

        const normalizedCode = normalizeInviteCode(payload.inviteCode);
        if (!cancelled && normalizedCode) {
          setUnlockInviteCode(normalizedCode);
        }
      } finally {
        if (!cancelled) {
          setUnlockCodeReady(true);
        }
      }
    };

    void loadUnlockCode();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!connection || !unlockCodeReady || !unlockInviteCode || guestLoading || activeGuest || isLookingUp) {
      return;
    }

    if (!detectedGuestByUnlockCode) {
      return;
    }

    if (autoLookupAttemptRef.current === unlockInviteCode) {
      return;
    }

    autoLookupAttemptRef.current = unlockInviteCode;
    setLookupError('');
    setLookupStatus('Unlocked invite code detected. Loading your dashboard...');
    setIsLookingUp(true);

    connection.reducers.identifyGuestByFallback({
      firstName: detectedGuestByUnlockCode.firstName,
      lastName: detectedGuestByUnlockCode.lastName,
      inviteCode: unlockInviteCode,
    })
      .then(() => {
        setLookupStatus('Verification successful. Loading your dashboard...');
      })
      .catch((error) => {
        setLookupStatus('');
        setLookupError(toErrorMessage(error, 'Unable to load your invitation details from unlock code.'));
      })
      .finally(() => {
        setIsLookingUp(false);
      });
  }, [
    activeGuest,
    connection,
    detectedGuestByUnlockCode,
    guestLoading,
    isLookingUp,
    unlockCodeReady,
    unlockInviteCode,
  ]);

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
    setMessageStatus('');

    if (!connection) {
      setMessageError('Connection is still starting. Please try again.');
      return;
    }

    const trimmed = messageDraft.trim();
    if (!trimmed) {
      setMessageError('Please enter a question or well wish.');
      return;
    }

    try {
      await connection.reducers.sendGuestMessage({ message: trimmed });
      setMessageDraft('');
      setMessageStatus('Thank you. Your note has been sent.');
    } catch (error) {
      setMessageError(toErrorMessage(error, 'Unable to send message.'));
    }
  };

  const clearMessageActionFeedback = () => {
    setMessageActionError('');
    setMessageActionStatus('');
  };

  const openMessageEditor = (messageId: bigint, messageText: string) => {
    clearMessageActionFeedback();
    setEditingMessageId(messageId);
    setEditingMessageDraft(messageText);
  };

  const cancelMessageEditor = () => {
    clearMessageActionFeedback();
    setEditingMessageId(null);
    setEditingMessageDraft('');
  };

  const onSaveEditedMessage = async (messageId: bigint) => {
    clearMessageActionFeedback();
    const trimmed = editingMessageDraft.trim();
    if (!trimmed) {
      setMessageActionError('Please enter a question or well wish.');
      return;
    }
    if (!connection) {
      setMessageActionError('Connection is still starting. Please try again.');
      return;
    }

    setIsSavingMessageAction(true);
    try {
      await connection.reducers.updateGuestMessage({
        messageId,
        message: trimmed,
      });
      setMessageActionStatus('Your note was updated.');
      setEditingMessageId(null);
      setEditingMessageDraft('');
    } catch (error) {
      setMessageActionError(toErrorMessage(error, 'Unable to update your note.'));
    } finally {
      setIsSavingMessageAction(false);
    }
  };

  const onDeleteMessage = async (messageId: bigint) => {
    clearMessageActionFeedback();
    if (!connection) {
      setMessageActionError('Connection is still starting. Please try again.');
      return;
    }
    if (!window.confirm('Delete this question or well wish? This cannot be undone.')) {
      return;
    }

    setIsSavingMessageAction(true);
    try {
      await connection.reducers.deleteGuestMessage({ messageId });
      setMessageActionStatus('Your note was deleted.');
      if (editingMessageId === messageId) {
        setEditingMessageId(null);
        setEditingMessageDraft('');
      }
    } catch (error) {
      setMessageActionError(toErrorMessage(error, 'Unable to delete your note.'));
    } finally {
      setIsSavingMessageAction(false);
    }
  };

  const resetCompanionDrafts = () => {
    setCompanionDrafts(
      guestCompanions.map((companion) => ({
        name: companion.name,
        dietaryNotes: companion.dietaryNotes ?? '',
        relationship: companion.relationship ?? '',
      }))
    );
  };

  const openCompanionEditor = () => {
    setCompanionError('');
    setCompanionStatus('');
    resetCompanionDrafts();
    setIsEditingCompanions(true);
  };

  const cancelCompanionEditor = () => {
    setCompanionError('');
    setCompanionStatus('');
    resetCompanionDrafts();
    setIsEditingCompanions(false);
  };

  const addCompanionDraft = () => {
    setCompanionError('');
    setCompanionStatus('');
    if (companionDrafts.length >= maxCompanions) {
      setCompanionError(`You can include up to ${maxCompanions} loved one(s) on this invitation.`);
      return;
    }
    setCompanionDrafts((current) => [
      ...current,
      {
        name: '',
        dietaryNotes: '',
        relationship: '',
      },
    ]);
  };

  const removeCompanionDraft = (indexToRemove: number) => {
    setCompanionError('');
    setCompanionStatus('');
    setCompanionDrafts((current) => current.filter((_companion, index) => index !== indexToRemove));
  };

  const updateCompanionDraft = (
    indexToUpdate: number,
    field: keyof CompanionDraft,
    value: string
  ) => {
    setCompanionDrafts((current) =>
      current.map((companion, index) =>
        index === indexToUpdate ? { ...companion, [field]: value } : companion
      )
    );
  };

  const onSaveCompanions = async () => {
    setCompanionError('');
    setCompanionStatus('');

    if (!connection) {
      setCompanionError('Connection is still starting. Please try again.');
      return;
    }
    if (!activeGuest || !activeRsvp || !activeRsvp.attendance) {
      setCompanionError('Please confirm your attendance first.');
      return;
    }
    if (isRsvpClosed) {
      setCompanionError('RSVP updates are closed because the deadline has passed.');
      return;
    }
    if (!activeGuest.canAddCompanions || maxCompanions < 1) {
      setCompanionError('This invitation does not include loved ones.');
      return;
    }
    if (companionDrafts.length > maxCompanions) {
      setCompanionError(`You can include up to ${maxCompanions} loved one(s) on this invitation.`);
      return;
    }

    const hasBlankName = companionDrafts.some((companion) => companion.name.trim().length === 0);
    if (hasBlankName) {
      setCompanionError('Please add a name for each loved one, or remove empty rows.');
      return;
    }

    const nextCompanions = companionDrafts
      .map((companion) => ({
        name: companion.name.trim(),
        dietaryNotes: normalizeOptionalInput(companion.dietaryNotes),
        relationship: normalizeOptionalInput(companion.relationship),
      }))
      .filter((companion) => companion.name.length > 0);

    setIsSavingCompanions(true);
    try {
      await connection.reducers.submitRsvp({
        attendance: true,
        dietaryNotes: normalizeOptionalInput(activeRsvp.dietaryNotes),
        notes: normalizeOptionalInput(activeRsvp.notes),
        contactEmail: normalizeOptionalInput(activeGuest.contactEmail),
        contactPhone: normalizeOptionalInput(activeGuest.contactPhone),
        companions: nextCompanions,
      });
      setCompanionStatus('Loved ones attending were updated.');
      setIsEditingCompanions(false);
    } catch (error) {
      setCompanionError(toErrorMessage(error, 'Unable to update loved ones.'));
    } finally {
      setIsSavingCompanions(false);
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
          <span>Guest Information</span>
        </h1>
        <p>Welcome. You can update your RSVP details, loved ones, and notes to us here anytime.</p>
      </section>

      {!activeGuest ? (
        <section className="card">
          <h2 className="heading-with-icon">
            <Icon name="lock" className="heading-icon" />
            <span>Loading Invitation</span>
          </h2>
          {!unlockCodeReady || isLookingUp ? (
            <p className="small-note">We are finding your invitation details now...</p>
          ) : null}
          {lookupStatus ? <p className="small-note">{lookupStatus}</p> : null}
          {lookupError ? <p className="small-note">{lookupError}</p> : null}
          {unlockCodeReady && !unlockInviteCode ? (
            <p className="small-note">
              We could not find an unlocked invitation yet. Please unlock from the home page to continue.
            </p>
          ) : null}
          {unlockCodeReady && unlockInviteCode && !detectedGuestByUnlockCode && !isLookingUp ? (
            <p className="small-note">
              We could not match that invite code yet. Please try unlocking again from the home page.
            </p>
          ) : null}
          <div className="cta-row">
            <Link href="/" className="button-secondary">
              <Icon name="lock_open" className="button-icon" /> Go to Home to Unlock
            </Link>
          </div>
        </section>
      ) : null}

      {activeGuest ? (
        <>
          <section className="card">
            <h2 className="heading-with-icon">
              <Icon name="person" className="heading-icon" />
              <span>Your Invitation</span>
            </h2>
            <p className="small-note">
              We are so grateful to celebrate with you, {activeGuest.firstName}.
            </p>
            <p>
              <strong>Name:</strong> {activeGuest.firstName} {activeGuest.lastName}
            </p>
            <p>
              <strong>Invite code:</strong> {activeGuest.inviteCode}
            </p>
            <p>
              <strong>Loved ones currently on your RSVP:</strong> {guestCompanions.length}
            </p>
            <p className="small-note">
              Last updated {formatTimestamp(activeGuest.updatedAt.microsSinceUnixEpoch)}
            </p>
            <p className="small-note">
              {config?.globalRsvpCutoffAt
                ? `RSVP updates close on ${formatTimestamp(config.globalRsvpCutoffAt.microsSinceUnixEpoch)}.`
                : 'RSVP timing is still flexible, and updates remain open.'}
            </p>
          </section>

          <section className="card">
            <h2 className="heading-with-icon">
              <Icon name="edit_square" className="heading-icon" />
              <span>Update Your RSVP</span>
            </h2>
            <p className="small-note">
              Please adjust anything that helps us care for you well on the day.
            </p>

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
                      className="button-secondary edit-action-button"
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
                      className="button-secondary edit-action-button"
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
                      className="button-secondary edit-action-button"
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
                      className="button-secondary edit-action-button"
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
                    <button
                      type="button"
                      className="button-secondary edit-action-button"
                      onClick={() => openEditor('contactPhone')}
                      disabled={!canEditRsvpDetails}
                    >
                      <Icon name="edit" className="button-icon" /> Edit
                    </button>
                  </div>
                )}
                {!canEditRsvpDetails ? <p className="small-note">Set attendance first to edit this field.</p> : null}
                {renderFieldFeedback('contactPhone')}
              </fieldset>
            </div>
          </section>

          <section className="card">
            <h2 className="heading-with-icon">
              <Icon name="group" className="heading-icon" />
              <span>Loved Ones Attending</span>
            </h2>
            {!isAttending ? (
              <p className="small-note">
                Once you choose &quot;Attending,&quot; you can add or update loved ones here.
              </p>
            ) : null}
            {isAttending && (!activeGuest.canAddCompanions || maxCompanions < 1) ? (
              <p className="small-note">
                Your invitation is reserved for you, so no additional loved ones are needed here.
              </p>
            ) : null}
            {isAttending && activeGuest.canAddCompanions && maxCompanions > 0 ? (
              <>
                <p className="small-note">
                  You can include up to {maxCompanions} loved one(s). Currently added: {guestCompanions.length}.
                </p>
                {isEditingCompanions ? (
                  <div className="form-stack">
                    {companionDrafts.length > 0 ? (
                      <div className="companion-stack">
                        {companionDrafts.map((companion, index) => (
                          <article
                            key={`companion-draft-${index}`}
                            className="companion-card companion-card-edit"
                          >
                            <div className="companion-card-head">
                              <strong>Loved one {index + 1}</strong>
                              <button
                                type="button"
                                className="button-secondary edit-action-button"
                                onClick={() => removeCompanionDraft(index)}
                                disabled={isSavingCompanions}
                              >
                                <Icon name="delete" className="button-icon" /> Remove
                              </button>
                            </div>
                            <label>
                              Full name
                              <input
                                value={companion.name}
                                onChange={(event) =>
                                  updateCompanionDraft(index, 'name', event.target.value)
                                }
                                placeholder="Companion full name"
                              />
                            </label>
                            <label>
                              Relationship (optional)
                              <input
                                value={companion.relationship}
                                onChange={(event) =>
                                  updateCompanionDraft(index, 'relationship', event.target.value)
                                }
                                placeholder="Sibling, partner, parent..."
                              />
                            </label>
                            <label>
                              Dietary notes (optional)
                              <input
                                value={companion.dietaryNotes}
                                onChange={(event) =>
                                  updateCompanionDraft(index, 'dietaryNotes', event.target.value)
                                }
                                placeholder="Allergies or preferences"
                              />
                            </label>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <p className="small-note">No loved ones added yet.</p>
                    )}
                    <div className="cta-row">
                      <button
                        type="button"
                        className="button-secondary"
                        onClick={addCompanionDraft}
                        disabled={isSavingCompanions || companionDrafts.length >= maxCompanions}
                      >
                        <Icon name="person_add" className="button-icon" /> Add loved one
                      </button>
                      <button
                        type="button"
                        className="button-secondary edit-action-button"
                        onClick={cancelCompanionEditor}
                        disabled={isSavingCompanions}
                      >
                        <Icon name="close" className="button-icon" /> Cancel
                      </button>
                      <button
                        type="button"
                        className="button-primary"
                        onClick={() => {
                          void onSaveCompanions();
                        }}
                        disabled={isSavingCompanions}
                      >
                        <Icon name="check" className="button-icon" />
                        {isSavingCompanions ? 'Saving...' : 'Save Loved Ones'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {guestCompanions.length > 0 ? (
                      <div className="companion-stack">
                        {guestCompanions.map((companion) => (
                          <article key={companion.id.toString()} className="companion-card">
                            <div className="companion-card-head">
                              <strong>{companion.name}</strong>
                            </div>
                            <p className="small-note">
                              Relationship: {formatOptional(companion.relationship)}
                            </p>
                            <p className="small-note">
                              Dietary notes: {formatOptional(companion.dietaryNotes)}
                            </p>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <p className="small-note">No loved ones added yet.</p>
                    )}
                    <div className="cta-row">
                      <button
                        type="button"
                        className="button-secondary edit-action-button"
                        onClick={openCompanionEditor}
                        disabled={!canManageCompanions}
                      >
                        <Icon name="edit" className="button-icon" /> Edit Loved Ones
                      </button>
                    </div>
                  </>
                )}
              </>
            ) : null}
            {isRsvpClosed ? (
              <p className="small-note">RSVP updates are now closed because the deadline has passed.</p>
            ) : null}
            {companionError ? <p className="small-note">{companionError}</p> : null}
            {companionStatus ? <p className="small-note">{companionStatus}</p> : null}
          </section>

          <section className="card">
            <h2 className="heading-with-icon">
              <Icon name="mail" className="heading-icon" />
              <span>Questions &amp; Well Wishes</span>
            </h2>
            <p className="small-note">Share any questions or kind notes. We will respond with care.</p>
            <h3>Your notes</h3>
            {guestMessages.length > 0 ? (
              <ol className="faq-list">
                {guestMessages.map((message) => (
                  <li key={message.id.toString()} className="dashboard-message-item">
                    {editingMessageId === message.id ? (
                      <div className="form-stack">
                        <label>
                          Edit your question or well wish
                          <textarea
                            rows={4}
                            value={editingMessageDraft}
                            onChange={(event) => setEditingMessageDraft(event.target.value)}
                          />
                        </label>
                        <div className="cta-row">
                          <button
                            type="button"
                            className="button-secondary edit-action-button"
                            onClick={cancelMessageEditor}
                            disabled={isSavingMessageAction}
                          >
                            <Icon name="close" className="button-icon" /> Cancel
                          </button>
                          <button
                            type="button"
                            className="button-primary"
                            onClick={() => {
                              void onSaveEditedMessage(message.id);
                            }}
                            disabled={isSavingMessageAction}
                          >
                            <Icon name="check" className="button-icon" />
                            {isSavingMessageAction ? 'Saving...' : 'Save Changes'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p>{message.message}</p>
                        <p className="small-note">
                          Sent {formatTimestamp(message.createdAt.microsSinceUnixEpoch)} |{' '}
                          {toMessageStatusLabel(message.status)}
                        </p>
                        <div className="cta-row">
                          <button
                            type="button"
                            className="button-secondary edit-action-button"
                            onClick={() => openMessageEditor(message.id, message.message)}
                            disabled={isSavingMessageAction}
                          >
                            <Icon name="edit" className="button-icon" /> Edit
                          </button>
                          <button
                            type="button"
                            className="button-secondary edit-action-button danger-action-button"
                            onClick={() => {
                              void onDeleteMessage(message.id);
                            }}
                            disabled={isSavingMessageAction}
                          >
                            <Icon name="delete" className="button-icon" /> Delete
                          </button>
                        </div>
                      </>
                    )}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="small-note">No questions or well wishes yet. You can share one below.</p>
            )}
            {messageActionError ? <p className="small-note">{messageActionError}</p> : null}
            {messageActionStatus ? <p className="small-note">{messageActionStatus}</p> : null}
            <form className="form-stack" onSubmit={onSendMessage}>
              <label>
                Question or well wish
                <textarea
                  rows={5}
                  placeholder="Share a question, note, or well wish..."
                  value={messageDraft}
                  onChange={(event) => setMessageDraft(event.target.value)}
                />
              </label>
              {messageError ? <p className="small-note">{messageError}</p> : null}
              {messageStatus ? <p className="small-note">{messageStatus}</p> : null}
              <button type="submit" className="button-primary">
                <Icon name="send" className="button-icon" /> Send Note
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
