import Company from '../models/Company.js';
import InterviewExperience from '../models/InterviewExperience.js';
import { deleteUploadedFile } from '../middleware/uploadMiddleware.js';

const buildFilePath = (file, subfolder) => {
    if (!file) return '';
    return `/uploads/${subfolder}/${file.filename}`;
};

const slugify = (name) => name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/**
 * findOrCreateCompany — resolves a free-typed company name to a Company doc,
 * matching against existing name/slug/aliases first (case-insensitive) so the same
 * company doesn't get duplicated by spelling variants, and auto-creating a new
 * (unverified) profile otherwise. Used when a user submits an interview experience.
 */
export async function findOrCreateCompany(nameRaw, userId) {
    const trimmed = nameRaw.trim();
    const slug = slugify(trimmed);

    let company = await Company.findOne({
        $or: [{ slug }, { aliases: trimmed.toLowerCase() }],
    });

    if (!company) {
        company = await Company.create({
            name: trimmed,
            slug,
            createdBy: userId,
            isVerified: false,
        });
    }
    return company;
}

// @desc    List companies (search + sort)
// @route   GET /api/v1/companies
// @access  Public
export const getCompanies = async (req, res, next) => {
    try {
        const { search, sort } = req.query;
        const query = {};
        if (search) query.name = { $regex: search, $options: 'i' };

        let sortSpec = { 'stats.totalExperiences': -1 };
        if (sort === 'name') sortSpec = { name: 1 };
        if (sort === 'newest') sortSpec = { createdAt: -1 };

        const companies = await Company.find(query).sort(sortSpec).limit(200);
        res.status(200).json({ success: true, count: companies.length, data: companies });
    } catch (error) {
        next(error);
    }
};

// @desc    Trending companies — most experiences submitted in the last 30 days
// @route   GET /api/v1/companies/trending
// @access  Public
export const getTrendingCompanies = async (req, res, next) => {
    try {
        const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const trending = await InterviewExperience.aggregate([
            { $match: { status: 'published', createdAt: { $gte: since } } },
            { $group: { _id: '$company', recentCount: { $sum: 1 } } },
            { $sort: { recentCount: -1 } },
            { $limit: 8 },
        ]);

        const companyIds = trending.map(t => t._id);
        const companies = await Company.find({ _id: { $in: companyIds } });
        const byId = new Map(companies.map(c => [String(c._id), c]));

        const data = trending
            .map(t => ({ company: byId.get(String(t._id)), recentCount: t.recentCount }))
            .filter(t => t.company);

        res.status(200).json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

// @desc    Get a single company profile (by slug) with linked resources
// @route   GET /api/v1/companies/:slug
// @access  Public
export const getCompany = async (req, res, next) => {
    try {
        const company = await Company.findOne({ slug: req.params.slug })
            .populate('linkedResources.addedBy', 'name');
        if (!company) return res.status(404).json({ message: 'Company not found' });
        res.status(200).json({ success: true, data: company });
    } catch (error) {
        next(error);
    }
};

// @desc    Create a company profile manually (Admin)
// @route   POST /api/v1/companies
// @access  Private/Admin
export const adminCreateCompany = async (req, res, next) => {
    try {
        const { name, industry, website, description, aliases } = req.body;
        if (!name) return res.status(400).json({ message: 'Company name is required' });

        const slug = slugify(name);
        const exists = await Company.findOne({ slug });
        if (exists) return res.status(400).json({ message: 'A company with this name already exists' });

        const company = await Company.create({
            name, slug, industry, website, description,
            aliases: Array.isArray(aliases) ? aliases.map(a => a.toLowerCase()) : [],
            isVerified: true,
            createdBy: req.user.id,
            logo: req.file ? buildFilePath(req.file, 'companies') : '',
        });
        res.status(201).json({ success: true, data: company });
    } catch (error) {
        next(error);
    }
};

// @desc    Update a company profile (Admin)
// @route   PUT /api/v1/companies/:id
// @access  Private/Admin
export const adminUpdateCompany = async (req, res, next) => {
    try {
        const company = await Company.findById(req.params.id);
        if (!company) return res.status(404).json({ message: 'Company not found' });

        const { name, industry, website, description, aliases, isVerified } = req.body;
        if (name) {
            company.name = name;
            company.slug = slugify(name);
        }
        if (industry !== undefined) company.industry = industry;
        if (website !== undefined) company.website = website;
        if (description !== undefined) company.description = description;
        if (aliases !== undefined) company.aliases = Array.isArray(aliases) ? aliases.map(a => a.toLowerCase()) : company.aliases;
        if (isVerified !== undefined) company.isVerified = isVerified;

        if (req.file) {
            if (company.logo) deleteUploadedFile(company.logo);
            company.logo = buildFilePath(req.file, 'companies');
        }

        await company.save();
        res.status(200).json({ success: true, data: company });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete a company profile (Admin) — blocked if experiences reference it
// @route   DELETE /api/v1/companies/:id
// @access  Private/Admin
export const adminDeleteCompany = async (req, res, next) => {
    try {
        const company = await Company.findById(req.params.id);
        if (!company) return res.status(404).json({ message: 'Company not found' });

        const experienceCount = await InterviewExperience.countDocuments({ company: company._id });
        if (experienceCount > 0) {
            return res.status(400).json({ message: `Cannot delete — ${experienceCount} experience(s) reference this company. Merge or remove them first.` });
        }

        if (company.logo) deleteUploadedFile(company.logo);
        await company.deleteOne();
        res.status(200).json({ success: true, data: {} });
    } catch (error) {
        next(error);
    }
};

// @desc    Link a prep resource (course/practice test/mock interview/webinar/external) to a company
// @route   POST /api/v1/companies/:id/resources
// @access  Private/Admin
export const adminLinkResource = async (req, res, next) => {
    try {
        const company = await Company.findById(req.params.id);
        if (!company) return res.status(404).json({ message: 'Company not found' });

        const { resourceType, resourceId, title, url, jobRole } = req.body;
        if (!resourceType || !title) return res.status(400).json({ message: 'resourceType and title are required' });
        if (resourceType === 'External' && !url) return res.status(400).json({ message: 'url is required for external resources' });
        if (resourceType !== 'External' && !resourceId) return res.status(400).json({ message: 'resourceId is required for internal resources' });

        company.linkedResources.push({
            resourceType, resourceId: resourceId || null, title, url: url || '', jobRole: jobRole || '',
            addedBy: req.user.id,
        });
        await company.save();
        res.status(201).json({ success: true, data: company });
    } catch (error) {
        next(error);
    }
};

// @desc    Unlink a prep resource from a company
// @route   DELETE /api/v1/companies/:id/resources/:resourceId
// @access  Private/Admin
export const adminUnlinkResource = async (req, res, next) => {
    try {
        const company = await Company.findById(req.params.id);
        if (!company) return res.status(404).json({ message: 'Company not found' });

        company.linkedResources.pull(req.params.resourceId);
        await company.save();
        res.status(200).json({ success: true, data: company });
    } catch (error) {
        next(error);
    }
};
