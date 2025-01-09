import User from "../models/UserModel.js";
import jwt from "jsonwebtoken";
import { compare } from "bcrypt";
import {renameSync, unlinkSync} from "fs";

const maxAge = 3 * 24 * 60 * 60 * 1000;

const createToken = (email,userId) => {
    return jwt.sign({ email, userId }, process.env.JWT_KEY, {
        expiresIn: maxAge,
    });
};

export const signup = async (request, response, next) => {
  try {
    const { email, password, storageType = 'local' } = request.body;
    if(!email || !password) { 
      return response.status(400).json({ message: "All fields are required" });
    }
    
    // Check if email already exists
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return response.status(400).json({ message: "Email already exists" });
    }

    const user = await User.create({ email, password, storageType });
    response.cookie("jwt", createToken(email, user.id), {
      maxAge,
      secure: true,
      sameSite: "None",
    });
    return response.status(201).json({
      user:{
        id: user.id,
        email: user.email,
        profileSetup: user.profileSetup,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return response.status(400).json({ message: "Username already exists" });
    }
    response.status(500).json({ message: "Internal Server Error" });
  }
};

export const login = async (request, response, next) => {
  try {
    const { email, password } = request.body;
    if (!email || !password) {
      return response.status(400).send("Email and Password is required.");
    }
    const user = await User.findOne({ email });
    if (!user) {
      return response.status(404).send("Email not found");
    }
    const auth = await compare(password, user.password);
    if(!auth) {
      return response.status(400).send("Password is incorrect");
    }
    response.cookie("jwt", createToken(email, user.id), {
        maxAge,
        secure: true,
        sameSite: "None",
    }); 
    return response.status(200).json({
        user: {
            id: user.id,
            email: user.email,
            profileSetup: user.profileSetup,
            firstName: user.firstName,
            lastName: user.lastName,
            image: user.image,
            color: user.color,
            storageType: user.storageType,
            username: user.username
        },
    });
  } catch (error) {
    console.log({ error });
    response.status(500).json({ message: "Internal Server Error" });
  }
};

export const getUserInfo = async (request, response, next) => {
    try {
        const userData = await User.findById(request.userId);
        if(!userData) {
            return response.status(404).json("User not found.");
        }
        return response.status(200).json({
            id: userData.id,
            email: userData.email,
            profileSetup: userData.profileSetup,
            firstName: userData.firstName,
            lastName: userData.lastName,
            image: userData.image,
            color: userData.color,
            storageType: userData.storageType,
            username: userData.username
        });
    } catch (error) {
      console.log({ error });
      response.status(500).json({ message: "Internal Server Error" });
    }
};


export const updateProfile = async (request, response, next) => {
  try {
    const { userId } = request;
    const { firstName, lastName, color, storageType, username } = request.body;
    if(!firstName || !lastName || !username) {
      return response.status(400).json({ message: "All fields are required." });
    }

    // Check if username is already taken by another user
    const existingUser = await User.findOne({ username, _id: { $ne: userId } });
    if (existingUser) {
      return response.status(400).json({ message: "Username is already taken" });
    }

    const userData = await User.findByIdAndUpdate(
      userId,
      {
        firstName,
        lastName,
        color,
        storageType,
        username,
        profileSetup: true,
      },
      { new: true, runValidators: true }
    );

    return response.status(200).json({
      id: userData.id,
      email: userData.email,
      profileSetup: userData.profileSetup,
      firstName: userData.firstName,
      lastName: userData.lastName,
      image: userData.image,
      color: userData.color,
      storageType: userData.storageType,
      username: userData.username
    });
  } catch (error) {
    console.log({ error });
    if (error.code === 11000) {
      return response.status(400).json({ message: "Username is already taken" });
    }
    response.status(500).json({ message: "Internal Server Error" });
  }
};

export const addProfileImage = async (request, response, next) => {
  try {
    if (!request.file) {
      return response.status(400).send("File is required.");
    }

    const date = Date.now();
    let fileName = "uploads/profiles/" + date + request.file.originalname;
    renameSync(request.file.path, fileName);

    const updatedUser = await User.findByIdAndUpdate(
      request.userId, 
      {image: fileName}, 
      {new: true, runValidators: true}
    );

    return response.status(200).json({
    image: updatedUser.image
    });
  } catch (error) {
    console.log({ error });
    response.status(500).json({ message: "Internal Server Error" });
  }
};

export const removeProfileImage = async (request, response, next) => {
  try {
    const { userId } = request;
    const user = await User.findById(userId);

    if (!user) {
      return response.status(404).send("User not found.");
    }

    if (user.image) {
      unlinkSync(user.image);
    }

    user.image = null;
    await user.save();

    return response.status(200).json({msg: "Profile image removed successfully"});
  } catch (error) {
    console.log(error);
    return response.status(500).send("Internal Server Error");
  }
};

export const logout = async (request, response, next) => {
  try {
  
    response.cookie("jwt", "", {maxAge: 0, secure: true, sameSite: "None"});
    return response.status(200).json({msg: "Logged out successfully"}); 
  } catch (error) {
    console.log(error);
    return response.status(500).send("Internal Server Error");
  }
};

