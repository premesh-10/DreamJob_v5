// Derives the actual start/end Date objects from Webinar.date + "HH:MM" time + duration*numberOfDays.
// Shared by webinarController.js (status computation) and webinarMailTemplates.js/fulfillOrder.js
// callers that need the same window for calendar invites and reminder windows.
export const getScheduleWindow = (webinar) => {
    const [hh, mm] = (webinar.time || '00:00').split(':').map(Number);
    const start = new Date(webinar.date);
    start.setHours(hh, mm, 0, 0);
    const totalMinutes = (webinar.duration || 60) * (webinar.numberOfDays || 1);
    const end = new Date(start.getTime() + totalMinutes * 60000);
    return { start, end };
};
