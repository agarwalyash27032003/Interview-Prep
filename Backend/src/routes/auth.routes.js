const { Router } = require("express")
const authController = require('../controllers/auth.controller')
const authMiddleware = require('../middlewares/auth.middleware')

const authRouter = Router()

/**
 * @route POST /api/auth/register
 */
authRouter.post("/register", authController.registerUserContoller)

/**
 * @route POST /api/auth/login
 */
authRouter.post("/login", authController.loginUserContoller)

/**
 * @route GET /api/auth/logout
 */
authRouter.get("/logout", authController.logoutUserContoller)

/**
 * @route GET /api/auth/get-me 
 */
authRouter.get("/get-me", authMiddleware.authUser, authController.getMeContoller)

module.exports = authRouter