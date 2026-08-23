import { createEvent, convertTimestampToArray } from 'ics';

/**
 * Builds a .ics calendar invite for an interview session. Reschedule emails
 * pass the SAME `uid` with an incremented `sequence` so well-behaved calendar
 * clients (Google/Outlook/Apple) update the existing event instead of
 * creating a duplicate — there is no live two-way calendar sync, this is the
 * accepted limitation documented in the build plan.
 */
export function buildInterviewIcs({ uid, start, end, title, description, organizerEmail, organizerName, attendeeEmail, attendeeName, sequence = 0, status = 'CONFIRMED' }) {
    const { error, value } = createEvent({
        uid,
        sequence,
        status,
        title,
        description,
        start: convertTimestampToArray(new Date(start).getTime(), 'utc'),
        startInputType: 'utc',
        startOutputType: 'utc',
        end: convertTimestampToArray(new Date(end).getTime(), 'utc'),
        endInputType: 'utc',
        endOutputType: 'utc',
        organizer: { name: organizerName, email: organizerEmail },
        attendees: [{ name: attendeeName, email: attendeeEmail, rsvp: true, partstat: 'NEEDS-ACTION' }],
        productId: 'dreamjob/mock-interviews',
    });

    if (error) {
        console.error('[ICS] Failed to generate calendar invite:', error.message);
        return null;
    }
    return value;
}

// Same uid+sequence reschedule pattern as buildInterviewIcs, separate product ID since this
// is a distinct content type (1-host/N-attendee webinar, not a 1:1 interview).
export function buildWebinarIcs({ uid, start, end, title, description, organizerEmail, organizerName, attendeeEmail, attendeeName, sequence = 0, status = 'CONFIRMED' }) {
    const { error, value } = createEvent({
        uid,
        sequence,
        status,
        title,
        description,
        start: convertTimestampToArray(new Date(start).getTime(), 'utc'),
        startInputType: 'utc',
        startOutputType: 'utc',
        end: convertTimestampToArray(new Date(end).getTime(), 'utc'),
        endInputType: 'utc',
        endOutputType: 'utc',
        organizer: { name: organizerName, email: organizerEmail },
        attendees: [{ name: attendeeName, email: attendeeEmail, rsvp: true, partstat: 'NEEDS-ACTION' }],
        productId: 'dreamjob/webinars',
    });

    if (error) {
        console.error('[ICS] Failed to generate webinar calendar invite:', error.message);
        return null;
    }
    return value;
}
