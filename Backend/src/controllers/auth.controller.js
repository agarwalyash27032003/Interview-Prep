const userModel = require("../models/user.model")
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const tokenBlacklistModel = require("../models/backlist.model")

/**
 * @name registerUserContoller
 * @description Register a New User, excepts username, email and password
 * @access PUBLIC
 */
async function registerUserContoller(req, res) {

    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({
            message: "Username, Email and Password is required"
        })
    }

    // If we get a User with either same username or same email then return the user
    const isUserAlreadyExists = await userModel.findOne({
        $or: [{ username }, { email }]
    })

    if (isUserAlreadyExists) {
        return res.status(400).json({
            message: "User already exists"
        })
    }

    const hash = await bcrypt.hash(password, 10)
    const user = await userModel.create({
        username,
        email,
        password: hash
    })

    const token = jwt.sign(
        { id: user._id, username: user.username },
        process.env.JWT_SECRET,
        { expiresIn: "1d" }
    )

    const isProduction =
    process.env.NODE_ENV === "production"

const cookieOptions = {

    httpOnly: true,

    secure:
        process.env.NODE_ENV === "production",

    sameSite:
        process.env.NODE_ENV === "production"
            ? "none"
            : "lax",

    maxAge:
        24 * 60 * 60 * 1000
}

res.cookie("token", token, cookieOptions)

    res.status(201).json({
        message: "User Registered Successfully",
        user: {
            id: user._id,
            username: user.username,
            email: user.email
        }
    })

}

/**
 * @name loginUserContoller
 * @description Login a User
 * @access PUBLIC
 */
async function loginUserContoller(req, res) {

    const { email, password } = req.body

    const user = await userModel.findOne({ email })

    if (!user) {
        return res.status(400).json({
            message: "Invalid email or password"
        })
    }

    const isPasswordValid = await bcrypt.compare(password, user.password)

    if (!isPasswordValid) {
        return res.status(400).json({
            message: "Password is invalid"
        })
    }

    const token = jwt.sign(
        { id: user._id, username: user.username },
        process.env.JWT_SECRET,
        { expiresIn: "1d" }
    )

    const isProduction =
        process.env.NODE_ENV === "production"

    const cookieOptions = {

    httpOnly: true,

    secure:
        process.env.NODE_ENV === "production",

    sameSite:
        process.env.NODE_ENV === "production"
            ? "none"
            : "lax",

    maxAge:
        24 * 60 * 60 * 1000
}

res.cookie("token", token, cookieOptions)



    res.status(200).json({
        message: "User LoggedIn Successfully",
        user: {
            id: user._id,
            username: user.username,
            email: user.email
        }
    })

}

/**
 * @name logoutUserContoller
 * @description Logout a User
 * @access PUBLIC
 */
async function logoutUserContoller(req, res) {

    const token = req.cookies.token

    if (token) {
        await tokenBlacklistModel.create({ token })
    }

    const isProduction =
        process.env.NODE_ENV === "production"

    const cookieOptions = {

    httpOnly: true,

    secure:
        process.env.NODE_ENV === "production",

    sameSite:
        process.env.NODE_ENV === "production"
            ? "none"
            : "lax",

    maxAge:
        24 * 60 * 60 * 1000
}

res.cookie("token", token, cookieOptions)

    res.status(200).json({
        message: "User Logged Out Successfully"
    })

}

/**
 * @name getMeContoller
 * @description Get details of a user
 * @access PROTECTED
 */
async function getMeContoller(req, res) {

    const user = await userModel.findById(req.user.id)

    if (!user) {
        return res.status(404).json({
            message: "User not logged in / signed up",
        })
    }

    return res.status(200).json({
        message: "User details fetched successfully",
        user: {
            id: user._id,
            username: user.username,
            email: user.email
        }
    })

}


module.exports = {
    registerUserContoller,
    loginUserContoller,
    logoutUserContoller,
    getMeContoller
}