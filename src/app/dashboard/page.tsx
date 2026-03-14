'use client';

import Link from 'next/link';
import { useSpacetimeDB } from 'spacetimedb/react';
import Icon from '@/components/icon';
import { DbConnection } from '@/module_bindings';
import { useDashboardWorkflow, type EditableField } from '@/lib/use-dashboard-workflow';
import { useIsRsvpClosed } from '@/lib/use-is-rsvp-closed';
import { RSVP_CUTOFF_AT_MICROS } from '../../../shared/globals';

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

export default function DashboardPage() {
  const db = useSpacetimeDB();
  const connection = db.getConnection() as DbConnection | null;

  const isRsvpClosed = useIsRsvpClosed();
  const {
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
    editingMessageDraft,
    editingMessageId,
    feedbackField,
    fieldError,
    fieldStatus,
    guestCompanions,
    guestMessages,
    isAttending,
    isEditingCompanions,
    isLookingUp,
    isSavingCompanions,
    isSavingField,
    isSavingMessageAction,
    lookupError,
    lookupStatus,
    maxCompanions,
    messageActionError,
    messageActionStatus,
    messageDraft,
    messageError,
    messageStatus,
    notesDraft,
    unlockCodeReady,
    unlockInviteCode,
    setAttendanceDraft,
    setDietaryDraft,
    setEditingMessageDraft,
    setMessageDraft,
    setNotesDraft,
    openEditor,
    cancelEditor,
    onConfirmAttendance,
    onConfirmDietaryNotes,
    onConfirmNotes,
    onSendMessage,
    openMessageEditor,
    cancelMessageEditor,
    onSaveEditedMessage,
    onDeleteMessage,
    openCompanionEditor,
    cancelCompanionEditor,
    addCompanionDraft,
    removeCompanionDraft,
    updateCompanionDraft,
    onSaveCompanions,
  } = useDashboardWorkflow(connection, isRsvpClosed);

  const attendanceLabel = toAttendanceLabel(activeRsvp?.attendance);

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
          <Icon name="how_to_reg" className="heading-icon" />
          <span>Your RSVP</span>
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
              {`RSVP updates close on ${formatTimestamp(RSVP_CUTOFF_AT_MICROS)}.`}
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
            {isAttending ? (
              <>
                <p className="small-note">
                  Currently added: {guestCompanions.length}.
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
              <Link href="/#schedule" className="button-secondary">
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
