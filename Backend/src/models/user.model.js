const mongoose = require("mongoose")

const userSchema = new mongoose.Schema({
    username:{
        type: String,
        required: true,
        unique: [true, "Username has already been taken"],
    },
    email:{
        type: String,
        unique:[true, "Account already exists with this email address"],
        required: true,
    },
    password:{
        type: String,
        required: true
    }
})

const userModel = mongoose.model("users", userSchema)
module.exports = userModel;