import express from 'express';
import {
    startWebinar, endWebinar, lockRoom, unlockRoom,
    listWaitingRoom, admitParticipant, denyParticipant,
    removeParticipant, muteParticipant, unmuteParticipant, muteAll, disableParticipantCam,
    assignCoHost, removeCoHost, assignModerator, removeModerator, promoteToSpeaker, demoteFromSpeaker,
    spotlightParticipant, setScreenSharePermission, toggleFeature,
    getRosterSearch, getLiveStats,
} from '../controllers/webinarHostController.js';
import { protect } from '../middleware/authMiddleware.js';
import { requireHostTier } from '../middleware/webinarHostMiddleware.js';
import { HOST_TIER, MODERATION_TIER } from '../utils/webinarRoleResolver.js';

const router = express.Router();

router.use(protect);

router.post('/:sessionId/host/start', requireHostTier(HOST_TIER), startWebinar);
router.post('/:sessionId/host/end', requireHostTier(HOST_TIER), endWebinar);
router.post('/:sessionId/host/lock', requireHostTier(HOST_TIER), lockRoom);
router.post('/:sessionId/host/unlock', requireHostTier(HOST_TIER), unlockRoom);

router.get('/:sessionId/host/waiting-room', requireHostTier(MODERATION_TIER), listWaitingRoom);
router.post('/:sessionId/host/waiting-room/admit', requireHostTier(MODERATION_TIER), admitParticipant);
router.post('/:sessionId/host/waiting-room/deny', requireHostTier(MODERATION_TIER), denyParticipant);

router.post('/:sessionId/host/remove', requireHostTier(MODERATION_TIER), removeParticipant);
router.post('/:sessionId/host/mute', requireHostTier(MODERATION_TIER), muteParticipant);
router.post('/:sessionId/host/unmute', requireHostTier(MODERATION_TIER), unmuteParticipant);
router.post('/:sessionId/host/mute-all', requireHostTier(HOST_TIER), muteAll);
router.post('/:sessionId/host/camera', requireHostTier(MODERATION_TIER), disableParticipantCam);

router.post('/:sessionId/host/co-host', requireHostTier(HOST_TIER), assignCoHost);
router.delete('/:sessionId/host/co-host', requireHostTier(HOST_TIER), removeCoHost);
router.post('/:sessionId/host/moderator', requireHostTier(HOST_TIER), assignModerator);
router.delete('/:sessionId/host/moderator', requireHostTier(HOST_TIER), removeModerator);
router.post('/:sessionId/host/speaker', requireHostTier(HOST_TIER), promoteToSpeaker);
router.delete('/:sessionId/host/speaker', requireHostTier(HOST_TIER), demoteFromSpeaker);

router.post('/:sessionId/host/spotlight', requireHostTier(MODERATION_TIER), spotlightParticipant);
router.post('/:sessionId/host/screen-share-permission', requireHostTier(HOST_TIER), setScreenSharePermission);
router.patch('/:sessionId/host/feature', requireHostTier(HOST_TIER), toggleFeature);

router.get('/:sessionId/host/roster', requireHostTier(MODERATION_TIER), getRosterSearch);
router.get('/:sessionId/host/stats', requireHostTier(MODERATION_TIER), getLiveStats);

export default router;
