const express  = require("express") ; 
const router = express.Router() ; 
const {signUp} = require('../controllers/signupController')
const {signIn} = require('../controllers/signinController')
const {getGifs} = require('../controllers/getgifController')
const { updateProfile } = require('../controllers/profileController')
const { startUpload, uploadChunk, finishUpload, downloadFile } = require('../controllers/uploadController')
const { getContacts, sendRequest, acceptRequest } = require('../controllers/contactController')
const { getChatState, postCreateGroup, postCreateChannel, postArchiveChat, patchGroupMemberRole, postGroupMember, deleteGroupMember } = require('../controllers/chatStateController')
const adminRoutes = require('./adminRoutes')

const authMiddleware = require('../middleware/authMiddleware')
const { requireAuthToken } = require('../middleware/authMiddleware')
const { authRateLimiter } = require('../middleware/authRateLimiter')

router.post('/signin', authRateLimiter, signIn)

router.post('/signup', authRateLimiter, authMiddleware, signUp);
router.patch('/profile', requireAuthToken, updateProfile);
router.get('/contacts', requireAuthToken, getContacts);
router.post('/contacts/request', requireAuthToken, sendRequest);
router.post('/contacts/accept', requireAuthToken, acceptRequest);
router.get('/chat-state', requireAuthToken, getChatState);
router.post('/groups', requireAuthToken, postCreateGroup);
router.post('/channels', requireAuthToken, postCreateChannel);
router.patch('/groups/:groupId/roles', requireAuthToken, patchGroupMemberRole);
router.post('/groups/:groupId/members', requireAuthToken, postGroupMember);
router.delete('/groups/:groupId/members/:targetEmail', requireAuthToken, deleteGroupMember);
router.post('/archive', requireAuthToken, postArchiveChat);
router.post('/files/start', requireAuthToken, startUpload);
router.post('/files/chunk', requireAuthToken, uploadChunk);
router.post('/files/finish', requireAuthToken, finishUpload);
router.get('/files/:fileId', downloadFile);

router.get('/get-gif',getGifs)  ; 
router.use('/admin', adminRoutes);


router.get('/',( _ , res)=>{


    res.status(200).json({
    message: "MV Messenger ga xush kelibsiz!",
    status: "Onlayn",
    timestamp: new Date().toISOString()
    });


})


module.exports = router  ; 
