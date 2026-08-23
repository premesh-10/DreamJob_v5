/**
 * Applies a new/updated rating to an Interview's rolling average + count,
 * mirroring a Booking's own `rating` field. Shared by the legacy single-tap
 * `rateInterview` endpoint and the structured post-session feedback flow so
 * the same averaging math isn't duplicated.
 */
export function applyRatingUpdate(interview, booking, rating) {
    if (booking.rating && booking.rating > 0) {
        const oldRating = booking.rating;
        const currentTotalSum = interview.ratings * interview.totalReviews;
        if (interview.totalReviews > 0) {
            interview.ratings = (currentTotalSum - oldRating + rating) / interview.totalReviews;
        } else {
            interview.ratings = rating;
            interview.totalReviews = 1;
        }
    } else {
        const newTotal = interview.totalReviews + 1;
        interview.ratings = ((interview.ratings * interview.totalReviews) + rating) / newTotal;
        interview.totalReviews = newTotal;
    }
    booking.rating = rating;
}
