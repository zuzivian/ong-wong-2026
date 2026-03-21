'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { DbConnection } from '@/module_bindings';
import { loadGuestPortalState, type GuestPortalState } from '@/lib/guest-portal-state';
import { normalizeInviteCode } from '@/lib/unlock-client';

export type EditableField = 'attendance' | 'dietaryNotes';

export type CompanionDraft = {
  name: string;
  dietaryNotes: string;
  relationship: string;
};

type SubmitPatch = {
  attendance?: boolean;
  dietaryNotes?: string | undefined;
};

type UnlockCookieResponse = {
  ok?: boolean;
  inviteCode?: string | null;
};

function normalizeOptionalInput(text: string | undefined | null): string | undefined {
  if (text == null) {
    return undefined;
  }
  const trimmed = text.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function toErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function useDashboardWorkflow(
  connection: DbConnection | null,
  isRsvpClosed: boolean
) {
  const [lookupError, setLookupError] = useState('');
  const [lookupStatus, setLookupStatus] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [portalLoading, setPortalLoading] = useState(true);
  const [unlockInviteCode, setUnlockInviteCode] = useState('');
  const [unlockCodeReady, setUnlockCodeReady] = useState(false);
  const autoLookupAttemptRef = useRef<string | null>(null);
  const [portalState, setPortalState] = useState<GuestPortalState>({
    companions: [],
    messages: [],
  });

  const [editingField, setEditingField] = useState<EditableField | null>(null);
  const [feedbackField, setFeedbackField] = useState<EditableField | null>(null);
  const [fieldError, setFieldError] = useState('');
  const [fieldStatus, setFieldStatus] = useState('');
  const [isSavingField, setIsSavingField] = useState(false);

  const [attendanceDraft, setAttendanceDraft] = useState<boolean | undefined>(undefined);
  const [dietaryDraft, setDietaryDraft] = useState('');
  const [companionDrafts, setCompanionDrafts] = useState<CompanionDraft[]>([]);
  const [isEditingCompanions, setIsEditingCompanions] = useState(false);
  const [companionStatus, setCompanionStatus] = useState('');
  const [companionError, setCompanionError] = useState('');
  const [isSavingCompanions, setIsSavingCompanions] = useState(false);

  const activeGuest = portalState.activeGuest;
  const activeRsvp = portalState.activeRsvp;
  const detectedGuestByUnlockCode = portalState.previewGuest;
  const guestCompanions = portalState.companions;

  const companionPayload = useMemo(
    () =>
      guestCompanions.map((companion) => ({
        name: companion.name,
        dietaryNotes: normalizeOptionalInput(companion.dietaryNotes),
        relationship: normalizeOptionalInput(companion.relationship),
      })),
    [guestCompanions]
  );

  const canEditRsvpDetails = activeRsvp?.attendance !== undefined;
  const isAttending = activeRsvp?.attendance === true;
  const maxCompanions = 5;
  const canManageCompanions = Boolean(activeRsvp?.attendance === true && !isRsvpClosed);

  useEffect(() => {
    setEditingField(null);
    setFeedbackField(null);
    setFieldError('');
    setFieldStatus('');
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

  const refreshPortalState = async (inviteCodeOverride?: string) => {
    if (!connection) {
      return;
    }

    const nextState = await loadGuestPortalState(connection, inviteCodeOverride ?? unlockInviteCode);
    setPortalState(nextState);
  };

  useEffect(() => {
    if (!connection || !unlockCodeReady) {
      return;
    }

    let cancelled = false;
    setPortalLoading(true);

    loadGuestPortalState(connection, unlockInviteCode)
      .then((nextState) => {
        if (!cancelled) {
          setPortalState(nextState);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setLookupError(toErrorMessage(error, 'Unable to load your invitation details.'));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setPortalLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [connection, unlockCodeReady, unlockInviteCode]);

  useEffect(() => {
    if (!connection || !unlockCodeReady || !unlockInviteCode || portalLoading || isLookingUp) {
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
      .then(async () => {
        await refreshPortalState(unlockInviteCode);
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
    connection,
    detectedGuestByUnlockCode,
    isLookingUp,
    portalLoading,
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
    }
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
    const nextAttendance = hasAttendance ? patch.attendance : activeRsvp?.attendance;
    if (nextAttendance === undefined) {
      throw new Error('Please set attendance first before editing this field.');
    }

    const nextDietaryNotes = hasDietaryNotes
      ? patch.dietaryNotes
      : normalizeOptionalInput(activeRsvp?.dietaryNotes);

    await connection.reducers.submitRsvp({
      attendance: nextAttendance,
      dietaryNotes: nextDietaryNotes,
      notes: normalizeOptionalInput(activeRsvp?.notes),
      contactEmail: normalizeOptionalInput(activeGuest.contactEmail),
      contactPhone: normalizeOptionalInput(activeGuest.contactPhone),
      companions: nextAttendance ? companionPayload : [],
      submitted: activeRsvp?.submitted ?? false,
    });
    await refreshPortalState();
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
        submitted: activeRsvp.submitted,
      });
      await refreshPortalState();
      setCompanionStatus('Loved ones attending were updated.');
      setIsEditingCompanions(false);
    } catch (error) {
      setCompanionError(toErrorMessage(error, 'Unable to update loved ones.'));
    } finally {
      setIsSavingCompanions(false);
    }
  };

  return {
    activeGuest,
    activeRsvp,
    attendanceDraft,
    canEditRsvpDetails,
    canManageCompanions,
    companionDrafts,
    companionError,
    companionStatus,
    detectedGuestByUnlockCode,
    dietaryDraft,
    editingField,
    feedbackField,
    fieldError,
    fieldStatus,
    guestCompanions,
    isAttending,
    isEditingCompanions,
    isLookingUp,
    isSavingCompanions,
    isSavingField,
    lookupError,
    lookupStatus,
    maxCompanions,
    portalLoading,
    unlockCodeReady,
    unlockInviteCode,
    setAttendanceDraft,
    setDietaryDraft,
    openEditor,
    cancelEditor,
    onConfirmAttendance,
    onConfirmDietaryNotes,
    openCompanionEditor,
    cancelCompanionEditor,
    addCompanionDraft,
    removeCompanionDraft,
    updateCompanionDraft,
    onSaveCompanions,
  };
}
