/**
 * search.js — SearchProvider abstraction. `mongoTextSearchProvider` is the
 * free/local implementation (Mongo `$text` index + relevance sort); a
 * future Elasticsearch/Algolia provider just needs to implement the same
 * `search(Model, options)` signature and be swapped in as the default
 * export below — no caller changes required.
 */
export const mongoTextSearchProvider = {
    /**
     * @param {import('mongoose').Model} Model
     * @param {{ query?: string, filters?: object, page?: number, limit?: number, sort?: object, populate?: string|object|array }} options
     * @returns {Promise<{ results: any[], total: number }>}
     */
    async search(Model, { query = '', filters = {}, page = 1, limit = 12, sort = null, populate = null } = {}) {
        const mongoQuery = { ...filters };
        let projection = {};
        let sortSpec = sort || { createdAt: -1 };

        const trimmed = query && query.trim();
        if (trimmed) {
            mongoQuery.$text = { $search: trimmed };
            projection = { score: { $meta: 'textScore' } };
            sortSpec = { score: { $meta: 'textScore' } };
        }

        const pageNum = Math.max(1, Number(page) || 1);
        const pageSize = Math.max(1, Number(limit) || 12);
        const skip = (pageNum - 1) * pageSize;

        let resultsQuery = Model.find(mongoQuery, projection).sort(sortSpec).skip(skip).limit(pageSize);
        if (populate) resultsQuery = resultsQuery.populate(populate);

        const [results, total] = await Promise.all([
            resultsQuery,
            Model.countDocuments(mongoQuery),
        ]);

        return { results, total, page: pageNum, pages: Math.ceil(total / pageSize) || 1 };
    },
};

export const searchProvider = mongoTextSearchProvider;
