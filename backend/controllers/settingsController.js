import Settings from '../models/Settings.js';

// @desc    Public, safe-to-expose subset of platform Settings (join window etc.)
// @route   GET /api/v1/settings/public
// @access  Public
export const getPublicSettings = async (req, res, next) => {
    try {
        const settings = await Settings.getSettings();
        res.status(200).json({
            success: true,
            data: {
                interviewJoinWindowMinutesBefore: settings.interviewJoinWindowMinutesBefore,
                interviewJoinWindowMinutesAfterEnd: settings.interviewJoinWindowMinutesAfterEnd,
                lateJoinThresholdMinutes: settings.lateJoinThresholdMinutes,
                noShowGraceMinutes: settings.noShowGraceMinutes,
                recordingEnabled: settings.recordingEnabled,
                recordingRequiresConsent: settings.recordingRequiresConsent,
                cancellationFullRefundHoursBefore: settings.cancellationFullRefundHoursBefore,
                cancellationPartialRefundPercent: settings.cancellationPartialRefundPercent,
                maintenanceMode: settings.site?.maintenanceMode ?? false,
                maintenanceMessage: settings.site?.maintenanceMessage ?? '',
            }
        });
    } catch (error) {
        next(error);
    }
};
