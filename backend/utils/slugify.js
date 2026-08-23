// Tiny shared slug helper — used by Course.generateUniqueSlug and the
// Category migration seed step, so both produce slugs the same way.
export function slugify(text) {
    return String(text)
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80) || 'item';
}
